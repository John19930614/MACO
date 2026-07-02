/**
 * Migration status reconciler — read-only, documentation-only.
 *
 * Reconciles the local supabase/migrations/*.sql files against the safetyiq
 * production migration history and writes the result to
 * docs/migrations-status.md. Never applies, edits, or creates a migration and
 * makes zero network calls.
 *
 * Data source: docs/prod-migration-history.json — a committed snapshot of
 * supabase_migrations.schema_migrations on the safetyiq prod project, plus
 * read-only information_schema probes for migrations that were applied by
 * hand (outside the tracked history). PostgREST does not expose the
 * supabase_migrations schema even to the service-role key, so a live query
 * requires the Supabase MCP `list_migrations` tool or
 * `supabase migration list --linked`. To refresh: regenerate the snapshot
 * with one of those, then re-run this script.
 *
 * Matching is by migration NAME, not version: local filenames use synthetic
 * timestamps while the prod history records the actual execution time, so a
 * version diff would mark everything pending. A few migrations were recorded
 * on prod under a different name — see NAME_ALIASES.
 *
 * Usage (from the repo root):
 *   node scripts/check-migration-status.ts     (Node >= 23.6, native TS)
 *   npx tsx scripts/check-migration-status.ts  (any Node)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

export interface LocalMigration {
  version: string;
  filename: string;
  name: string;
}

export interface HistoryEntry {
  version: string;
  name: string;
}

export interface Snapshot {
  project: string;
  projectRef: string;
  retrievedAt: string;
  retrievedVia: string;
  migrations: HistoryEntry[];
  schemaProbes: Record<string, boolean>;
}

export interface CodeRef {
  file: string;
  line: number;
  snippet: string;
}

export type Status = "applied" | "applied-untracked" | "pending" | "prod-only";

export interface ReconciledRow {
  version: string;
  filename: string;
  description: string;
  status: Status;
  /** Version recorded in prod history (execution timestamp), if tracked. */
  prodVersion: string | null;
  /** Name recorded in prod history, if tracked (may differ — see aliases). */
  prodName: string | null;
  /** For applied-untracked / pending: which schema probe verified it. */
  verifiedBy: string | null;
  codeBlocking: boolean;
  codeRefs: CodeRef[];
}

/** Local migration name -> name recorded in prod history. */
const NAME_ALIASES: Record<string, string> = {
  "0001_init": "arc_0001_init",
  "0002_rls": "arc_0002_rls",
  "0003_embeddings": "arc_0003_embeddings",
  arc_live_hardening: "arc_hardening",
  chemical_ghs_intelligence: "chemical_ghs_intelligence_bridge",
  chemical_concentration_hazard: "add_concentration_hazard_columns_to_chemical_inventory",
};

/**
 * Local migration name -> snapshot schemaProbes key that verifies whether the
 * migration is live even when it has no prod history record (i.e. it was
 * applied by hand via SQL editor / dashboard).
 */
const SCHEMA_PROBE_FOR: Record<string, string> = {
  create_ai_telemetry: "table:ai_telemetry",
  ai_findings_rejection_reason: "column:ai_findings.rejection_reason",
  chemical_container_capacity: "column:chemical_inventory.container_capacity",
};

/** Plain-language descriptions for notable migrations; extend as needed. */
const KNOWN_DESCRIPTIONS: Record<string, string> = {
  create_ai_telemetry: "AI usage tracking table (durable per-call latency/token/cost log for /sa/ai)",
  ai_findings_rejection_reason: "Audit-trail column recording why an AI finding was rejected",
  chemical_container_capacity: "Container capacity field driving EU CLP label sizing",
  chemical_concentration_hazard: "Concentration-based chemical hazard classification columns (incl. hazard_review_status)",
};

function describeMigration(name: string): string {
  return KNOWN_DESCRIPTIONS[name] ?? name.replace(/_/g, " ");
}

export function getLocalMigrations(dir: string): { numbered: LocalMigration[]; drafts: string[] } {
  const numbered: LocalMigration[] = [];
  const drafts: string[] = [];
  for (const filename of readdirSync(dir)) {
    if (!filename.endsWith(".sql")) continue;
    const match = filename.match(/^(\d{4,14})_(.+)\.sql$/);
    if (!match) {
      drafts.push(filename);
      continue;
    }
    // ARC-era files use a short 4-digit prefix (0001_init.sql) and are known
    // on prod by their full stem (arc_0001_init) — keep the stem as the name.
    const name = match[1].length === 4 ? filename.replace(/\.sql$/, "") : match[2];
    numbered.push({ version: match[1], filename, name });
  }
  numbered.sort((a, b) => a.version.localeCompare(b.version));
  drafts.sort();
  return { numbered, drafts };
}

/**
 * Extract table/column names a migration creates from its SQL — these are the
 * symbols whose presence in src/ marks a pending migration as code-blocking.
 */
export function extractSqlSymbols(sql: string): string[] {
  const symbols = new Set<string>();
  const patterns = [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-zA-Z_]\w*)"?/gi,
    /add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-zA-Z_]\w*)"?/gi,
  ];
  for (const pattern of patterns) {
    for (const match of sql.matchAll(pattern)) {
      if (match[1].length > 3) symbols.add(match[1]);
    }
  }
  return [...symbols];
}

/** Recursively scan a source tree for the given symbols (pure Node, no shell). */
export function scanSrcForSymbols(srcDir: string, symbols: string[], maxRefs = 6): CodeRef[] {
  if (symbols.length === 0) return [];
  const refs: CodeRef[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (refs.length >= maxRefs) return;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry) || entry.endsWith(".generated.ts")) continue;
      const lines = readFileSync(full, "utf-8").split("\n");
      for (let i = 0; i < lines.length && refs.length < maxRefs; i++) {
        if (symbols.some((s) => lines[i].includes(s))) {
          refs.push({
            file: relative(process.cwd(), full).replace(/\\/g, "/"),
            line: i + 1,
            snippet: lines[i].trim().slice(0, 120),
          });
        }
      }
    }
  };
  walk(srcDir);
  return refs;
}

export function reconcile(
  local: LocalMigration[],
  snapshot: Snapshot,
  codeRefsFor?: (migration: LocalMigration) => CodeRef[]
): ReconciledRow[] {
  const historyByName = new Map(snapshot.migrations.map((m) => [m.name, m]));
  const matchedProdNames = new Set<string>();
  const rows: ReconciledRow[] = [];

  for (const l of local) {
    const prodName = historyByName.has(l.name) ? l.name : NAME_ALIASES[l.name];
    const historyMatch = prodName ? historyByName.get(prodName) : undefined;
    if (historyMatch) {
      matchedProdNames.add(historyMatch.name);
      rows.push({
        version: l.version,
        filename: l.filename,
        description: describeMigration(l.name),
        status: "applied",
        prodVersion: historyMatch.version,
        prodName: historyMatch.name,
        verifiedBy: null,
        codeBlocking: false,
        codeRefs: [],
      });
      continue;
    }
    // No history record: fall back to the schema probe (manual applies leave
    // no history entry, so absence of a record does not mean pending).
    const probeKey = SCHEMA_PROBE_FOR[l.name];
    const probeResult = probeKey !== undefined ? snapshot.schemaProbes[probeKey] : undefined;
    const status: Status = probeResult === true ? "applied-untracked" : "pending";
    const codeRefs = status === "pending" && codeRefsFor ? codeRefsFor(l) : [];
    rows.push({
      version: l.version,
      filename: l.filename,
      description: describeMigration(l.name),
      status,
      prodVersion: null,
      prodName: null,
      verifiedBy: probeKey ?? null,
      codeBlocking: codeRefs.length > 0,
      codeRefs,
    });
  }

  for (const entry of snapshot.migrations) {
    if (matchedProdNames.has(entry.name)) continue;
    rows.push({
      version: entry.version,
      filename: `(no local file: ${entry.name})`,
      description: describeMigration(entry.name),
      status: "prod-only",
      prodVersion: entry.version,
      prodName: entry.name,
      verifiedBy: null,
      codeBlocking: false,
      codeRefs: [],
    });
  }

  return rows;
}

export interface DocMeta {
  generatedAt: string;
  snapshot: Pick<Snapshot, "retrievedAt" | "retrievedVia" | "projectRef">;
  draftFiles: string[];
}

export function buildMigrationsStatusMarkdown(rows: ReconciledRow[], meta: DocMeta): string {
  const localRows = rows.filter((r) => r.status !== "prod-only");
  const prodOnly = rows.filter((r) => r.status === "prod-only");
  const applied = localRows.filter((r) => r.status === "applied");
  const untracked = localRows.filter((r) => r.status === "applied-untracked");
  const pending = localRows.filter((r) => r.status === "pending");
  const blocking = pending.filter((r) => r.codeBlocking);

  const statusLabel = (r: ReconciledRow): string =>
    r.status === "applied"
      ? "✅ Live (tracked)"
      : r.status === "applied-untracked"
      ? "✅ Live (untracked)"
      : r.codeBlocking
      ? "🚨 Pending — code depends on it"
      : "⏳ Pending";

  const lines: string[] = [];
  lines.push("# Database Update Status: What's Live in Production");
  lines.push("");
  lines.push(`Generated: ${meta.generatedAt} by \`scripts/check-migration-status.ts\``);
  lines.push("Environment: safetyiq prod");
  lines.push(
    `Prod history snapshot: retrieved ${meta.snapshot.retrievedAt} from project \`${meta.snapshot.projectRef}\` via ${meta.snapshot.retrievedVia}`
  );
  lines.push("");
  lines.push(
    `**${applied.length + untracked.length} of ${localRows.length} local database updates are live in production** — ${applied.length} recorded in the migration history and ${untracked.length} applied by hand and verified directly against the live schema. **${pending.length} are NOT applied**${blocking.length ? `, and ${blocking.length} of those have application code that already depends on them.` : "."}`
  );
  lines.push("");
  lines.push(
    "> Safety note: this only checks, it doesn't change anything. This is a read-only audit — applying any pending migration requires a separate, explicitly approved follow-up."
  );
  lines.push("");
  lines.push("## Flagged — Pending & Code-Blocking");
  lines.push("");
  if (blocking.length === 0) {
    lines.push("None. No pending migration currently has a detected code dependency.");
  } else {
    for (const row of blocking) {
      lines.push(`- 🚨 **ACTION NEEDED**: \`${row.filename}\` — ${row.description}`);
      for (const ref of row.codeRefs) {
        lines.push(`  - Referenced in \`${ref.file}:${ref.line}\` — \`${ref.snippet}\``);
      }
    }
    lines.push("");
    lines.push(
      "Until these are applied, the code paths above hit a missing table/column at runtime in live mode. Applying them is a separate task requiring explicit approval."
    );
  }
  lines.push("");
  lines.push("## Full Migration List (local files)");
  lines.push("");
  lines.push("Matching is by migration name (local filename timestamps are synthetic; the prod history records execution time). \"Live (untracked)\" means the change was applied by hand — the schema was verified directly, but there is no migration-history record.");
  lines.push("");
  lines.push("| Local Version | Filename | What it does | Status | Prod history record |");
  lines.push("|---|---|---|---|---|");
  for (const row of localRows) {
    const prodRecord = row.prodVersion
      ? `${row.prodVersion}${row.prodName !== row.filename.replace(/^\d+_(.+)\.sql$/, "$1") ? ` (as \`${row.prodName}\`)` : ""}`
      : row.verifiedBy
      ? `— (schema probe: \`${row.verifiedBy}\`)`
      : "—";
    lines.push(`| ${row.version} | \`${row.filename}\` | ${row.description} | ${statusLabel(row)} | ${prodRecord} |`);
  }
  lines.push("");
  lines.push("## Prod-Only History Entries");
  lines.push("");
  lines.push(
    `${prodOnly.length} entries exist in the prod migration history with no matching local file. These are expected: they predate the local migration-file convention (2026-06-18 → 2026-06-25 era) or were applied directly via the Supabase MCP under ad-hoc names. They are listed for completeness, not as problems.`
  );
  lines.push("");
  lines.push("| Prod Version | Name |");
  lines.push("|---|---|");
  for (const row of prodOnly) {
    lines.push(`| ${row.prodVersion} | \`${row.prodName}\` |`);
  }
  lines.push("");
  if (meta.draftFiles.length > 0) {
    lines.push("## Draft Files (not migrations)");
    lines.push("");
    for (const draft of meta.draftFiles) {
      lines.push(`- \`${draft}\` — draft without a version prefix; never applied and not counted above.`);
    }
    lines.push("");
  }
  lines.push("## How to Refresh This Document");
  lines.push("");
  lines.push("1. Refresh `docs/prod-migration-history.json` — via the Supabase MCP `list_migrations` tool for the safetyiq project (or `supabase migration list --linked`), plus re-running the read-only `information_schema` probes listed under `schemaProbes`.");
  lines.push("2. Run `node scripts/check-migration-status.ts` from the repo root (Node >= 23.6; or `npx tsx`).");
  lines.push("3. Review the Flagged section — the code-reference scan is heuristic, so spot-check `file:line` hits before acting on them.");
  lines.push("");
  return lines.join("\n");
}

function main(): void {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const snapshotPath = join(process.cwd(), "docs", "prod-migration-history.json");
  const outputPath = join(process.cwd(), "docs", "migrations-status.md");
  const srcDir = join(process.cwd(), "src");

  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8")) as Snapshot;
  const { numbered, drafts } = getLocalMigrations(migrationsDir);

  const codeRefsFor = (migration: LocalMigration): CodeRef[] => {
    const sql = readFileSync(join(migrationsDir, migration.filename), "utf-8");
    return scanSrcForSymbols(srcDir, extractSqlSymbols(sql));
  };

  const rows = reconcile(numbered, snapshot, codeRefsFor);
  const markdown = buildMigrationsStatusMarkdown(rows, {
    generatedAt: new Date().toISOString(),
    snapshot,
    draftFiles: drafts,
  });
  writeFileSync(outputPath, markdown, "utf-8");

  const pending = rows.filter((r) => r.status === "pending");
  console.log(`Wrote ${outputPath}`);
  console.log(
    `applied=${rows.filter((r) => r.status === "applied").length} applied-untracked=${rows.filter((r) => r.status === "applied-untracked").length} pending=${pending.length} (${pending.filter((r) => r.codeBlocking).length} code-blocking) prod-only=${rows.filter((r) => r.status === "prod-only").length}`
  );
}

// Run only when executed directly (node/tsx), not when imported by vitest.
if (process.argv[1] && basename(process.argv[1]).startsWith("check-migration-status")) {
  main();
}

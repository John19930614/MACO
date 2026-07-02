// Platform Review — codified audit scanner.
//
// Runs deterministic audits over the REAL source tree and emits structured
// findings (same shape as dev_review_findings rows). This is the "find issues
// automatically" half of the Platform Review; the judgment half is the Claude
// pass (platform-review-ai.mjs). Run by .github/workflows/platform-review.yml,
// or by hand:
//
//   node scripts/platform-review-scan.mjs            # human-readable summary
//   node scripts/platform-review-scan.mjs --json out.json
//
// Every rule produces findings with STABLE finding_keys ('scan:<rule>' or
// 'scan:<rule>:<file>') so re-runs update rather than duplicate, operator
// dismissals stick, and findings auto-resolve when the code stops matching.
// Rules are exported pure functions over {path, content} so vitest can cover
// them without touching the filesystem.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

// ── source walking ────────────────────────────────────────────────────────────

export function collectSourceFiles(srcDir, root = process.cwd()) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry) || entry.endsWith(".generated.ts")) continue;
      files.push({
        path: relative(root, full).replace(/\\/g, "/"),
        content: readFileSync(full, "utf-8"),
      });
    }
  };
  walk(srcDir);
  return files;
}

const lineOf = (content, index) => content.slice(0, index).split("\n").length;
const F = (f) => ({ source: "scan", who_uses_it: "Platform Operations", ...f });

// ── rule: empty catch blocks (silent failures) ────────────────────────────────

export function scanEmptyCatches(files) {
  const findings = [];
  for (const { path, content } of files) {
    if (path.includes(".test.")) continue;
    const hits = [];
    for (const m of content.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g)) {
      hits.push(lineOf(content, m.index));
    }
    if (!hits.length) continue;
    findings.push(F({
      finding_key: `scan:empty-catch:${path}`,
      check_key: "routes_ux",
      severity: "amber",
      title: `Silent failure: empty catch block(s) in ${basename(path)}`,
      detail: `${path} swallows errors with ${hits.length} empty catch block(s) (line ${hits.join(", ")}). Failures there produce no warning, no log, and no telemetry.`,
      recommendation:
        "Surface the failure: return a per-item warning, log to telemetry, or add a comment justifying why ignoring the error is safe.",
      module: "Platform Operations",
      priority: "medium",
      risk_level: "medium",
      effort: "small",
      where_hint: `${path}:${hits[0]}`,
      success_criteria: "No empty catch blocks remain in the file, or each carries a justifying comment.",
    }));
  }
  return findings;
}

// ── rule: explicit any (aggregate debt metric) ────────────────────────────────

export function scanExplicitAny(files) {
  const byFile = [];
  for (const { path, content } of files) {
    if (path.includes(".test.")) continue;
    let count = 0;
    for (const line of content.split("\n")) {
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
      count += (line.match(/(:\s*any\b|\bas any\b|<any[,>])/g) ?? []).length;
    }
    if (count) byFile.push({ path, count });
  }
  if (!byFile.length) return [];
  byFile.sort((a, b) => b.count - a.count);
  const total = byFile.reduce((s, f) => s + f.count, 0);
  const top = byFile.slice(0, 8).map((f) => `${f.path} (${f.count})`).join(", ");
  return [F({
    finding_key: "scan:explicit-any",
    check_key: "tech_debt",
    severity: total > 20 ? "amber" : "green",
    title: `${total} explicit any-type(s) across ${byFile.length} file(s)`,
    detail: `Explicit \`any\` weakens type safety around external inputs. Top files: ${top}${byFile.length > 8 ? `, and ${byFile.length - 8} more` : ""}.`,
    recommendation: "Replace each any with a concrete type or a Zod schema, starting with the top files.",
    module: "Platform Operations",
    priority: "low",
    risk_level: "low",
    effort: "medium",
    where_hint: byFile[0].path,
    success_criteria: "The explicit-any count trends to zero; no new anys are introduced.",
  })];
}

// ── rule: eslint-disable without a reason ─────────────────────────────────────

export function scanUnexplainedDisables(files) {
  const hits = [];
  for (const { path, content } of files) {
    if (path.includes(".test.")) continue;
    content.split("\n").forEach((line, i) => {
      if (line.includes("eslint-disable") && !line.includes(" -- ")) {
        hits.push(`${path}:${i + 1}`);
      }
    });
  }
  if (!hits.length) return [];
  return [F({
    finding_key: "scan:unexplained-eslint-disable",
    check_key: "tech_debt",
    severity: "green",
    title: `${hits.length} eslint-disable(s) without a reason`,
    detail: `Per docs/nav-a11y-and-lint-conventions.md every disable carries a "-- reason". Missing at: ${hits.slice(0, 10).join(", ")}${hits.length > 10 ? ` and ${hits.length - 10} more` : ""}.`,
    recommendation: "Append ` -- <one-line reason>` to each disable comment, or fix the underlying lint.",
    module: "Platform Operations",
    priority: "low",
    risk_level: "low",
    effort: "small",
    where_hint: hits[0],
    success_criteria: "Every eslint-disable in src/ carries a reason.",
  })];
}

// ── rule: tables queried in code but created by no migration ──────────────────
// The exact bug class that bit the ARC layer: repo code querying tables that
// exist in no migration, crashing the moment live mode reaches them.

// Tables verified live on prod (docs/prod-tables.json — snapshot retrieved via
// the Supabase MCP). Covers the pre-convention era when tables were created via
// the dashboard/MCP with no local migration file. Refresh the snapshot when a
// table is added outside a local migration (rare — prefer a migration).
export function loadKnownProdTables(root = process.cwd()) {
  try {
    const snap = JSON.parse(readFileSync(join(root, "docs", "prod-tables.json"), "utf-8"));
    return new Set(snap.tables);
  } catch {
    return new Set(); // snapshot missing → rely on migrations only (noisier, never wrong-silent)
  }
}

export function scanGhostTables(files, migrationSqls, knownTables = loadKnownProdTables()) {
  const created = new Set(knownTables);
  for (const sql of migrationSqls) {
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-zA-Z_]\w*)"?/gi)) {
      created.add(m[1]);
    }
  }
  const refs = new Map(); // table -> first ref "file:line"
  for (const { path, content } of files) {
    if (path.includes(".test.") || path.includes("/mock")) continue;
    content.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/\.from\(\s*["'`]([a-zA-Z_]\w*)["'`]\s*\)/g)) {
        // .from() on storage buckets and URL objects is not a table read.
        if (line.includes("storage.from")) continue;
        if (!refs.has(m[1])) refs.set(m[1], `${path}:${i + 1}`);
      }
    });
  }
  const findings = [];
  for (const [table, where] of refs) {
    if (created.has(table)) continue;
    findings.push(F({
      finding_key: `scan:ghost-table:${table}`,
      check_key: "database",
      severity: "red",
      title: `Code queries table "${table}" that no migration creates`,
      detail: `${where} queries public.${table}, but the table appears in no local migration and is not a known pre-convention prod table. In live mode this path throws the moment it runs.`,
      recommendation:
        `Add an additive migration creating ${table} with tenant_id + RLS (or fence the code path until the table ships). If the table already exists on prod, refresh docs/prod-tables.json via the Supabase MCP list_tables tool.`,
      module: "Database",
      priority: "high",
      risk_level: "high",
      effort: "medium",
      where_hint: where,
      success_criteria: `public.${table} exists on prod with RLS, or the code path is gated; the finding clears on the next scan.`,
    }));
  }
  return findings;
}

// ── rule: service-role writes without a tenant-ownership check ────────────────

export function scanServiceRoleWrites(files) {
  const findings = [];
  for (const { path, content } of files) {
    if (path.includes(".test.")) continue;
    // Superadmin-only surfaces legitimately write cross-tenant with the service
    // role; the risk is TENANT-facing paths trusting a payload tenant_id.
    if (path.includes("/devcenter") || path.includes("/sa/") || path.includes("/ops")) continue;
    if (!content.includes("createServiceRoleClient")) continue;
    if (!/\.(insert|upsert|update)\(/.test(content)) continue;
    if (/getServerTenantId|assertCanWrite|isSuperadmin/.test(content)) continue;
    findings.push(F({
      finding_key: `scan:service-role-write:${path}`,
      check_key: "security",
      severity: "amber",
      title: `Service-role write without tenant check in ${basename(path)}`,
      detail: `${path} writes with the service-role client (RLS bypassed) but never calls getServerTenantId()/assertCanWrite()/isSuperadmin(). If any written tenant_id comes from the request payload, a spoofed payload writes into another tenant.`,
      recommendation:
        "Verify the target tenant_id equals the authenticated user's tenant before every service-role write, or document why the path is tenant-independent.",
      module: "Platform Operations",
      who_uses_it: "Platform / all tenants (isolation)",
      priority: "high",
      risk_level: "high",
      effort: "small",
      where_hint: path,
      success_criteria: "The file validates tenant ownership before service-role writes (or carries a justification), and a test proves a spoofed tenant_id is rejected.",
    }));
  }
  return findings;
}

// ── rule: leftover pre-rebrand branding ───────────────────────────────────────

export function scanBrandingLeftovers(files) {
  const hits = [];
  for (const { path, content } of files) {
    if (path.includes(".test.")) continue;
    // The review catalog legitimately DESCRIBES the old branding scrub.
    if (path.endsWith("devcenter/platform-review.ts")) continue;
    content.split("\n").forEach((line, i) => {
      if (/amaya/i.test(line)) hits.push(`${path}:${i + 1}`);
    });
  }
  if (!hits.length) return [];
  return [F({
    finding_key: "scan:branding-leftovers",
    check_key: "tech_debt",
    severity: "amber",
    title: `${hits.length} leftover "Amaya" reference(s)`,
    detail: `The pre-rebrand name resurfaced at: ${hits.slice(0, 10).join(", ")}${hits.length > 10 ? ` and ${hits.length - 10} more` : ""}. The 2026-07-02 scrub removed all of these — this is a regression.`,
    recommendation: "Rename to SafetyIQ (or remove), keeping only intentional historical notes.",
    module: "Team & Settings",
    priority: "low",
    risk_level: "low",
    effort: "small",
    where_hint: hits[0],
    success_criteria: "No 'Amaya' string remains in src/ outside intentional history.",
  })];
}

// ── rule: oversized modules ───────────────────────────────────────────────────

export function scanOversizedFiles(files, maxLines = 1200) {
  const big = files
    .filter((f) => !f.path.includes(".test."))
    .map((f) => ({ path: f.path, lines: f.content.split("\n").length }))
    .filter((f) => f.lines > maxLines)
    .sort((a, b) => b.lines - a.lines);
  if (!big.length) return [];
  return [F({
    finding_key: "scan:oversized-files",
    check_key: "tech_debt",
    severity: "green",
    title: `${big.length} file(s) over ${maxLines} lines`,
    detail: `Monoliths hurt navigability and testing: ${big.slice(0, 6).map((f) => `${f.path} (${f.lines})`).join(", ")}${big.length > 6 ? ` and ${big.length - 6} more` : ""}.`,
    recommendation: "Split by domain (see the ehs.ts → 4-module split for the pattern), keeping exports stable via a barrel.",
    module: "Platform Operations",
    priority: "low",
    risk_level: "low",
    effort: "large",
    where_hint: big[0].path,
    success_criteria: `No src file exceeds ${maxLines} lines, or oversized files have a documented reason.`,
  })];
}

// ── rule: TODO/FIXME backlog ──────────────────────────────────────────────────

export function scanTodoBacklog(files, threshold = 5) {
  const hits = [];
  for (const { path, content } of files) {
    if (path.includes(".test.")) continue;
    content.split("\n").forEach((line, i) => {
      if (/\/\/\s*(TODO|FIXME|HACK)\b/.test(line)) hits.push(`${path}:${i + 1}`);
    });
  }
  if (hits.length < threshold) return [];
  return [F({
    finding_key: "scan:todo-backlog",
    check_key: "tech_debt",
    severity: "green",
    title: `${hits.length} TODO/FIXME/HACK comment(s) in src/`,
    detail: `Deferred work is piling up: ${hits.slice(0, 8).join(", ")}${hits.length > 8 ? ` and ${hits.length - 8} more` : ""}.`,
    recommendation: "Triage each: turn real work into Dev Command tasks, delete the stale ones.",
    module: "Platform Operations",
    priority: "low",
    risk_level: "low",
    effort: "small",
    where_hint: hits[0],
    success_criteria: "Every TODO either has a task or is deleted.",
  })];
}

// ── orchestration ─────────────────────────────────────────────────────────────

export function runAllScans(files, migrationSqls) {
  return [
    ...scanGhostTables(files, migrationSqls),
    ...scanServiceRoleWrites(files),
    ...scanEmptyCatches(files),
    ...scanBrandingLeftovers(files),
    ...scanExplicitAny(files),
    ...scanUnexplainedDisables(files),
    ...scanOversizedFiles(files),
    ...scanTodoBacklog(files),
  ];
}

function main() {
  const root = process.cwd();
  const files = collectSourceFiles(join(root, "src"), root);
  const migrationsDir = join(root, "supabase", "migrations");
  const migrationSqls = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(migrationsDir, f), "utf-8"));

  const findings = runAllScans(files, migrationSqls);

  const jsonFlag = process.argv.indexOf("--json");
  if (jsonFlag !== -1 && process.argv[jsonFlag + 1]) {
    writeFileSync(process.argv[jsonFlag + 1], JSON.stringify(findings, null, 2), "utf-8");
    console.log(`platform-review-scan: ${findings.length} finding(s) → ${process.argv[jsonFlag + 1]}`);
  } else {
    for (const f of findings) {
      console.log(`[${f.severity.toUpperCase().padEnd(5)}] ${f.finding_key}\n        ${f.title}`);
    }
    console.log(`\nplatform-review-scan: ${findings.length} finding(s) across ${files.length} files.`);
  }
}

if (process.argv[1] && basename(process.argv[1]).startsWith("platform-review-scan")) {
  main();
}

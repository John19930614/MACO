import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  getLocalMigrations,
  extractSqlSymbols,
  reconcile,
  buildMigrationsStatusMarkdown,
  type Snapshot,
} from "../scripts/check-migration-status";

const DOC_PATH = join(process.cwd(), "docs", "migrations-status.md");
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const SNAPSHOT_FIXTURE: Snapshot = {
  project: "safetyiq",
  projectRef: "test",
  retrievedAt: "2026-07-02",
  retrievedVia: "fixture",
  migrations: [
    { version: "20260101120000", name: "add_widgets" },
    { version: "20260102130000", name: "arc_0001_init" },
  ],
  schemaProbes: {
    "table:ai_telemetry": false,
    "column:chemical_inventory.container_capacity": true,
  },
};

describe("docs/migrations-status.md (generated doc)", () => {
  const content = readFileSync(DOC_PATH, "utf-8");

  it("carries a Generated timestamp and the prod environment label", () => {
    expect(content).toMatch(/Generated: /);
    expect(content).toMatch(/Environment: safetyiq prod/);
    expect(content).toMatch(/Flagged — Pending & Code-Blocking/);
  });

  it("references every local numbered migration filename", () => {
    const filenames = readdirSync(MIGRATIONS_DIR).filter(
      (f) => f.endsWith(".sql") && /^\d/.test(f)
    );
    expect(filenames.length).toBeGreaterThan(0);
    for (const filename of filenames) {
      expect(content).toContain(filename);
    }
  });

  it("has no local-migration table row with an empty status cell", () => {
    const rows = content
      .split("\n")
      .filter((line) => line.startsWith("|") && line.includes(".sql"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const status = row.split("|").map((c) => c.trim())[4];
      expect(status).toBeTruthy();
    }
  });

  it("lists every code-blocking row in the Flagged section", () => {
    const flaggedSection = content.split("## Flagged")[1].split("## Full Migration List")[0];
    const blockingRows = content
      .split("\n")
      .filter((line) => line.startsWith("|") && line.includes("Pending — code depends on it"));
    for (const row of blockingRows) {
      const filename = row.match(/`([^`]+\.sql)`/)?.[1];
      expect(filename).toBeTruthy();
      expect(flaggedSection).toContain(filename as string);
    }
  });
});

describe("getLocalMigrations()", () => {
  it("separates numbered migrations from draft files and keeps ARC stems as names", () => {
    const { numbered, drafts } = getLocalMigrations(MIGRATIONS_DIR);
    expect(numbered.length).toBeGreaterThan(40);
    expect(drafts).toContain("DRAFT_build-smart-chemical-passport.sql");
    const arc = numbered.find((m) => m.filename === "0001_init.sql");
    expect(arc?.name).toBe("0001_init");
  });
});

describe("extractSqlSymbols()", () => {
  it("pulls created tables and added columns out of migration SQL", () => {
    const sql = [
      "create table if not exists public.ai_telemetry (id uuid primary key);",
      "alter table ai_findings add column if not exists rejection_reason text;",
    ].join("\n");
    expect(extractSqlSymbols(sql).sort()).toEqual(["ai_telemetry", "rejection_reason"]);
  });
});

describe("reconcile() pure logic", () => {
  it("marks name matches as applied and unmatched-unprobed locals as pending", () => {
    const local = [
      { version: "20260101000000", filename: "20260101000000_add_widgets.sql", name: "add_widgets" },
      { version: "20260103000000", filename: "20260103000000_add_gadgets.sql", name: "add_gadgets" },
    ];
    const rows = reconcile(local, SNAPSHOT_FIXTURE);
    expect(rows.find((r) => r.filename.includes("add_widgets"))?.status).toBe("applied");
    expect(rows.find((r) => r.filename.includes("add_widgets"))?.prodVersion).toBe("20260101120000");
    expect(rows.find((r) => r.filename.includes("add_gadgets"))?.status).toBe("pending");
  });

  it("matches renamed migrations through the alias map", () => {
    const local = [{ version: "0001", filename: "0001_init.sql", name: "0001_init" }];
    const rows = reconcile(local, SNAPSHOT_FIXTURE);
    expect(rows[0].status).toBe("applied");
    expect(rows[0].prodName).toBe("arc_0001_init");
  });

  it("classifies manual applies via schema probes: true → applied-untracked, false → pending", () => {
    const local = [
      {
        version: "20260701000000",
        filename: "20260701000000_chemical_container_capacity.sql",
        name: "chemical_container_capacity",
      },
      {
        version: "20260625000000",
        filename: "20260625000000_create_ai_telemetry.sql",
        name: "create_ai_telemetry",
      },
    ];
    const rows = reconcile(local, SNAPSHOT_FIXTURE);
    expect(rows.find((r) => r.filename.includes("container_capacity"))?.status).toBe("applied-untracked");
    expect(rows.find((r) => r.filename.includes("ai_telemetry"))?.status).toBe("pending");
  });

  it("marks pending rows code-blocking only when the resolver finds references", () => {
    const local = [
      {
        version: "20260625000000",
        filename: "20260625000000_create_ai_telemetry.sql",
        name: "create_ai_telemetry",
      },
    ];
    const withRefs = reconcile(local, SNAPSHOT_FIXTURE, () => [
      { file: "src/lib/ai/telemetry.ts", line: 40, snippet: "insert" },
    ]);
    const withoutRefs = reconcile(local, SNAPSHOT_FIXTURE, () => []);
    expect(withRefs[0].codeBlocking).toBe(true);
    expect(withoutRefs[0].codeBlocking).toBe(false);
  });

  it("emits prod-only rows for history entries with no local file", () => {
    const rows = reconcile([], SNAPSHOT_FIXTURE);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "prod-only")).toBe(true);
  });
});

describe("buildMigrationsStatusMarkdown()", () => {
  const rows = reconcile(
    [
      { version: "20260101000000", filename: "20260101000000_add_widgets.sql", name: "add_widgets" },
      {
        version: "20260625000000",
        filename: "20260625000000_create_ai_telemetry.sql",
        name: "create_ai_telemetry",
      },
    ],
    SNAPSHOT_FIXTURE,
    () => [{ file: "src/lib/ai/telemetry.ts", line: 40, snippet: "insert" }]
  );
  const md = buildMigrationsStatusMarkdown(rows, {
    generatedAt: "2026-07-02T00:00:00.000Z",
    snapshot: SNAPSHOT_FIXTURE,
    draftFiles: ["DRAFT_example.sql"],
  });

  it("renders header, counts, and safety note", () => {
    expect(md).toContain("Environment: safetyiq prod");
    expect(md).toContain("Generated: 2026-07-02T00:00:00.000Z");
    expect(md).toContain("**1 of 2 local database updates are live in production**");
    expect(md).toContain("this only checks, it doesn't change anything");
  });

  it("puts code-blocking migrations in the Flagged section with file:line refs", () => {
    const flagged = md.split("## Flagged")[1].split("## Full Migration List")[0];
    expect(flagged).toContain("20260625000000_create_ai_telemetry.sql");
    expect(flagged).toContain("src/lib/ai/telemetry.ts:40");
  });

  it("renders every row with a non-empty status and lists prod-only and draft entries", () => {
    expect(md).toContain("✅ Live (tracked)");
    expect(md).toContain("🚨 Pending — code depends on it");
    expect(md).toContain("`arc_0001_init`");
    expect(md).toContain("DRAFT_example.sql");
  });
});

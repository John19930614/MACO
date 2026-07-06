import { describe, expect, it } from "vitest";
import {
  scanEmptyCatches,
  scanExplicitAny,
  scanGhostTables,
  scanServiceRoleWrites,
  scanBrandingLeftovers,
  scanUnexplainedDisables,
  scanOversizedFiles,
} from "../scripts/platform-review-scan.mjs";
import { sanitizeAiFindings, extractJsonArray } from "../scripts/platform-review-ai.mjs";

const file = (path: string, content: string) => ({ path, content });

describe("platform-review scanner rules", () => {
  it("finds empty catch blocks with line numbers, skipping tests", () => {
    const findings = scanEmptyCatches([
      file("src/a.ts", "try {\n x();\n} catch {}\n"),
      file("src/a.test.ts", "try { x(); } catch {}"),
      file("src/b.ts", "try { x(); } catch (e) { log(e); }"),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding_key).toBe("scan:empty-catch:src/a.ts");
    expect(findings[0].detail).toContain("line 3");
  });

  it("aggregates explicit anys and skips comment lines", () => {
    const findings = scanExplicitAny([
      file("src/a.ts", "const x: any = 1;\n// const y: any = 2;\nconst z = v as any;\n"),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("2 explicit any");
  });

  it("flags tables no migration creates, honoring the prod snapshot", () => {
    const files = [file("src/repo.ts", 'db.from("ghost_table").select();\ndb.from("real_table").select();\ndb.from("prod_table").select();')];
    const migrations = ['create table if not exists public.real_table (id uuid);'];
    const findings = scanGhostTables(files, migrations, new Set(["prod_table"]));
    expect(findings).toHaveLength(1);
    expect(findings[0].finding_key).toBe("scan:ghost-table:ghost_table");
    expect(findings[0].severity).toBe("red");
  });

  it("ignores storage buckets in the ghost-table rule", () => {
    const files = [file("src/x.ts", 'supabase.storage.from("evidence").upload(p, f);')];
    expect(scanGhostTables(files, [], new Set())).toHaveLength(0);
  });

  it("flags service-role writes without a tenant check, sparing superadmin surfaces", () => {
    const risky = 'import { createServiceRoleClient } from "x";\nclient.insert({ tenant_id });';
    const findings = scanServiceRoleWrites([
      file("src/lib/actions/risky.ts", risky),
      file("src/lib/devcenter/repo.ts", risky),
      file("src/lib/actions/safe.ts", `${risky}\nconst t = await getServerTenantId();`),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding_key).toBe("scan:service-role-write:src/lib/actions/risky.ts");
  });

  it("catches branding regressions but not the review catalog itself", () => {
    const findings = scanBrandingLeftovers([
      file("src/lib/devcenter/platform-review.ts", "title: 'Scrub Amaya branding'"),
      file("src/app/page.tsx", "<h1>Amaya</h1>"),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].detail).toContain("src/app/page.tsx:1");
  });

  it("requires a reason on eslint-disable lines", () => {
    const findings = scanUnexplainedDisables([
      file("src/a.ts", "// eslint-disable-next-line foo -- print template needs raw img\nx();\n// eslint-disable-next-line bar\ny();"),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("1 eslint-disable");
  });

  it("reports oversized files above the threshold", () => {
    const findings = scanOversizedFiles([file("src/big.ts", "x\n".repeat(50))], 40);
    expect(findings).toHaveLength(1);
    expect(findings[0].detail).toContain("src/big.ts");
  });
});

describe("AI pass sanitization", () => {
  it("extracts a JSON array from chatty output", () => {
    expect(extractJsonArray('Here you go:\n[{"a":1}]\nDone.')).toEqual([{ a: 1 }]);
    expect(extractJsonArray("no json here")).toEqual([]);
  });

  it("normalizes fields, drops invalid rows, and caps the count", () => {
    const raw = [
      { title: "Real issue", detail: "d", recommendation: "r", check_key: "security", severity: "red", priority: "high", risk_level: "high", effort: "small" },
      { title: "Bad enums", detail: "d", recommendation: "r", check_key: "nope", severity: "purple", priority: "x", risk_level: "y", effort: "z" },
      { detail: "missing title", recommendation: "r" },
    ];
    const out = sanitizeAiFindings(raw);
    expect(out).toHaveLength(2);
    expect(out[0].finding_key).toBe("ai:real-issue");
    expect(out[0].source).toBe("ai");
    expect(out[1].check_key).toBe("tech_debt");
    expect(out[1].severity).toBe("amber");
  });
});

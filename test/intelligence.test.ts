import { describe, it, expect } from "vitest";
import { scoreSimilarCells, findSignals, computeHsl, deriveVelaInsights, heatWeight } from "@/lib/arc/intelligence";
import { HSL_DIMENSIONS } from "@/lib/arc/arc";
import type { SafetyCell, ControlProof, SafetyAction, ExpCapture, Profile, Site, AiFinding, CausalEdge } from "@/lib/types";

function cell(o: Partial<SafetyCell> = {}): SafetyCell {
  return {
    id: "c", tenant_id: "t", site_id: "s", location_id: "l1", title: "t", description: "", task: "unload",
    hazard_genome: { energySource: "motion", exposureType: "struck_by", trigger: "congestion", controlGap: "missing" },
    severity: "low", likelihood: 2, risk_score: 30, status: "open", owner_id: null, created_by: "u1",
    created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z", ...o,
  };
}

describe("scoreSimilarCells (EXP knowledge ghost)", () => {
  const target = cell({ id: "t0", location_id: "l1" });
  it("ranks same-location same-genome highest and excludes self", () => {
    const others = [
      cell({ id: "a", location_id: "l1" }), // same loc + genome
      cell({ id: "b", location_id: "l9", hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "x", controlGap: "weak" } }), // nothing shared
      cell({ id: "t0" }), // self
    ];
    const hits = scoreSimilarCells(target, others, 5);
    expect(hits.some((h) => h.cell.id === "t0")).toBe(false);
    expect(hits[0].cell.id).toBe("a");
    expect(hits[0].score).toBeGreaterThan(0.5);
    expect(hits[0].reasons.length).toBeGreaterThan(0);
  });
  it("respects the limit", () => {
    const others = Array.from({ length: 10 }, (_, i) => cell({ id: `x${i}`, location_id: "l1" }));
    expect(scoreSimilarCells(target, others, 3)).toHaveLength(3);
  });
});

describe("findSignals (P-CLSS hunt)", () => {
  const proofs = new Map<string, ControlProof[]>([
    ["crit", [{ id: "p", tenant_id: "t", cell_id: "crit", control: "x", required: true, status: "missing", evidence_id: null, verifier_id: null, verified_at: null, evidence_summary: null, expires_at: null }]],
  ]);
  it("weights a critical cell with missing proof above a low cell", () => {
    const cells = [cell({ id: "crit", severity: "critical" }), cell({ id: "lowc", severity: "low", hazard_genome: { energySource: "motion", exposureType: "struck_by", trigger: "x", controlGap: "weak" } })];
    const signals = findSignals(cells, proofs);
    expect(signals[0].cell.id).toBe("crit");
    expect(signals[0].weight).toBeGreaterThan(0);
  });
  it("excludes closed cells", () => {
    const cells = [cell({ id: "done", severity: "critical", status: "closed" })];
    expect(findSignals(cells, new Map())).toHaveLength(0);
  });
});

describe("computeHsl (live Human Signal Layer)", () => {
  const NOW = new Date("2026-06-10T00:00:00Z").getTime();
  const profiles: Profile[] = [
    { id: "u1", display_name: "Field", role: "contributor", tenant_id: "t", default_site_id: null, active: true },
    { id: "u2", display_name: "Sup", role: "supervisor", tenant_id: "t", default_site_id: null, active: true },
  ];
  const cells: SafetyCell[] = [
    cell({ id: "1", severity: "critical", created_by: "u1", company: "Acme", created_at: "2026-06-05T00:00:00Z" }),
    cell({ id: "2", severity: "low", created_by: "u2", company: "SubCo", created_at: "2026-06-06T00:00:00Z" }),
  ];
  const proofs: ControlProof[] = [
    { id: "p1", tenant_id: "t", cell_id: "1", control: "a", required: true, status: "missing", evidence_id: null, verifier_id: null, verified_at: null, evidence_summary: null, expires_at: null },
    { id: "p2", tenant_id: "t", cell_id: "2", control: "b", required: true, status: "proven", evidence_id: null, verifier_id: null, verified_at: null, evidence_summary: null, expires_at: null },
  ];
  const actions: SafetyAction[] = [];
  const exp: ExpCapture[] = [
    { id: "e1", tenant_id: "t", site_id: "s", source: "ai_interview", subject: "x", summary: "y", hazard_memory: null, embedded: true, created_at: "2026-05-01T00:00:00Z" },
    { id: "e2", tenant_id: "t", site_id: "s", source: "walk_floor", subject: "x", summary: "y", hazard_memory: null, embedded: false, created_at: "2026-05-01T00:00:00Z" },
  ];

  const result = computeHsl({ cells, proofs, actions, exp, profiles }, NOW);

  it("returns all six dimensions, each bounded 0-100", () => {
    expect(result).toHaveLength(6);
    expect(new Set(result.map((r) => r.dimension))).toEqual(new Set(HSL_DIMENSIONS.map((d) => d.key)));
    for (const r of result) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
    }
  });

  it("knowledge_ghost reflects the embedded ratio (1 of 2 = 50)", () => {
    expect(result.find((r) => r.dimension === "knowledge_ghost")!.value).toBe(50);
  });

  it("cultural_drift reflects the proof-gap ratio (1 of 2 = 50)", () => {
    expect(result.find((r) => r.dimension === "cultural_drift_index")!.value).toBe(50);
  });

  it("reacts to data: zero proof gaps drives cultural drift to 0", () => {
    const clean = computeHsl(
      { cells, proofs: proofs.map((p) => ({ ...p, status: "proven" as const })), actions, exp, profiles },
      NOW,
    );
    expect(clean.find((r) => r.dimension === "cultural_drift_index")!.value).toBe(0);
  });
});

describe("heatWeight (composite map heat)", () => {
  const NOW = new Date("2026-06-10T00:00:00Z").getTime();
  it("is bounded 0-1 and ranks recent gappy critical above old closed low", () => {
    const hot = heatWeight({ severity: "critical", likelihood: 5, risk_score: 95, status: "open", created_at: "2026-06-09T00:00:00Z" }, 3, NOW);
    const cold = heatWeight({ severity: "low", likelihood: 1, risk_score: 20, status: "closed", created_at: "2026-01-01T00:00:00Z" }, 0, NOW);
    expect(hot).toBeGreaterThan(cold);
    for (const v of [hot, cold]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("heavily damps closed cells vs an identical open one", () => {
    const base = { severity: "high" as const, likelihood: 3, risk_score: 70, created_at: "2026-06-08T00:00:00Z" };
    const open = heatWeight({ ...base, status: "open" }, 1, NOW);
    const closed = heatWeight({ ...base, status: "closed" }, 1, NOW);
    expect(closed).toBeLessThan(open * 0.3);
  });
});

describe("deriveVelaInsights (cross-tenant master intelligence)", () => {
  const sites: Site[] = [
    { id: "s_mar", tenant_id: "t1", name: "Port", vertical: "maritime", center: [0, 0] },
    { id: "s_con", tenant_id: "t2", name: "Tower", vertical: "construction", center: [0, 0] },
  ];
  const NOW = "2026-06-10T00:00:00Z";
  const c = (id: string, site: string, gap: string): SafetyCell =>
    cell({ id, site_id: site, hazard_genome: { energySource: "motion", exposureType: "struck_by", trigger: "x", controlGap: gap } });

  it("emits a pattern only for control gaps spanning 2+ verticals", () => {
    const cells = [
      c("a", "s_mar", "bypassed"),
      c("b", "s_con", "bypassed"), // 'bypassed' in BOTH verticals -> insight
      c("d", "s_mar", "expired"), // 'expired' only maritime -> excluded
    ];
    const out = deriveVelaInsights(cells, sites, [], [], NOW);
    const gaps = out.map((o) => o.pattern);
    expect(out.some((o) => o.pattern.includes("bypassed"))).toBe(true);
    expect(gaps.some((p) => p.includes("expired"))).toBe(false);
    const bypassed = out.find((o) => o.pattern.includes("bypassed"))!;
    expect(bypassed.applies_to.length).toBeGreaterThanOrEqual(1);
    expect(bypassed.confidence).toBeGreaterThan(0);
    expect(bypassed.confidence).toBeLessThanOrEqual(0.95);
  });

  it("human-confirmed reviews raise confidence", () => {
    const cells = [c("a", "s_mar", "bypassed"), c("b", "s_con", "bypassed")];
    const findings: AiFinding[] = [
      { id: "f", tenant_id: "t1", cell_id: "a", job: "analyze_cell", model: "m", prompt_version: "v", input_summary: "", output: {}, confidence: 0.8, review_status: "accepted", human_review_required: true, created_at: NOW },
    ];
    const without = deriveVelaInsights(cells, sites, [], [], NOW).find((o) => o.pattern.includes("bypassed"))!;
    const withConfirm = deriveVelaInsights(cells, sites, findings, [] as CausalEdge[], NOW).find((o) => o.pattern.includes("bypassed"))!;
    expect(withConfirm.confidence).toBeGreaterThan(without.confidence);
    expect(withConfirm.summary).toMatch(/confirmed/i);
  });
});

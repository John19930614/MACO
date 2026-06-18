import { describe, it, expect } from "vitest";
import { buildRiskGraph, proofToRiskType, type RiskGraphInput } from "@/lib/risk/objects";
import { RISK_OBJECT_TYPES } from "@/lib/constants";
import * as fx from "@/lib/data/mock";

const input: RiskGraphInput = {
  cells: fx.CELLS,
  proofs: fx.PROOFS,
  events: fx.EVENT_CELLS,
  behaviors: fx.BEHAVIOR_CELLS,
  findings: fx.FINDINGS,
  vela: fx.VELA_INSIGHTS,
};

describe("proofToRiskType", () => {
  it("classifies defined safeguards as control and broken/unverified as failure", () => {
    expect(proofToRiskType("proven")).toBe("control");
    expect(proofToRiskType("weak_proof")).toBe("control");
    expect(proofToRiskType("not_applicable")).toBe("control");
    expect(proofToRiskType("missing")).toBe("failure");
    expect(proofToRiskType("expired")).toBe("failure");
    expect(proofToRiskType("conflicting")).toBe("failure");
    expect(proofToRiskType("not_checked")).toBe("failure"); // "unverified" per the manual
  });
});

describe("buildRiskGraph", () => {
  const g = buildRiskGraph(input);

  it("produces all six first-class object types", () => {
    for (const t of RISK_OBJECT_TYPES) {
      expect(g.counts[t], t).toBeGreaterThan(0);
    }
  });

  it("creates exactly one precursor per Safety Cell", () => {
    expect(g.counts.precursor).toBe(fx.CELLS.length);
  });

  it("splits proofs into control + failure with no double-count", () => {
    expect(g.counts.control + g.counts.failure).toBe(fx.PROOFS.length);
  });

  it("gives every object a unique id", () => {
    const ids = g.objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only links to precursor objects that exist", () => {
    const precursorIds = new Set(g.objects.filter((o) => o.type === "precursor").map((o) => o.id));
    for (const l of g.links) {
      expect(precursorIds.has(l.target), `${l.source} -> ${l.target}`).toBe(true);
    }
  });

  it("anchors an event back to its precursor (evt_001 -> cell_009)", () => {
    const link = g.links.find((l) => l.source === "ro_event_evt_001" && l.kind === "event_of");
    expect(link?.target).toBe("ro_precursor_cell_009");
  });

  it("links a behavior to every precursor it recurs across", () => {
    const beh = fx.BEHAVIOR_CELLS.find((b) => b.id === "beh_002")!;
    const targets = g.links.filter((l) => l.source === "ro_behavior_beh_002").map((l) => l.target);
    for (const cid of beh.cell_ids) expect(targets).toContain(`ro_precursor_${cid}`);
  });

  it("includes cross-vertical VELA insights as learning objects with no precursor anchor", () => {
    const velaObj = g.objects.find((o) => o.type === "learning" && o.refId.startsWith("vela_"));
    expect(velaObj).toBeTruthy();
    expect(velaObj!.cellId).toBeNull();
  });
});

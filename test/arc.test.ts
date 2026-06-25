import { describe, it, expect } from "vitest";
import { GUS_VERTICALS, HSL_DIMENSIONS, ARC_LAYERS, GUS } from "@/lib/arc/arc";
import * as fx from "@/lib/data/mock";

describe("ARC method definitions", () => {
  it("declares exactly 19 GUS verticals (matches the diagram)", () => {
    expect(GUS_VERTICALS.length).toBe(19);
    expect(GUS.subtitle).toContain("19");
    const slugs = GUS_VERTICALS.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length); // unique
  });

  it("declares the six HSL dimensions from the method legend", () => {
    expect(HSL_DIMENSIONS.length).toBe(6);
    const keys = HSL_DIMENSIONS.map((d) => d.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "psych_safety_gap",
        "cultural_drift_index",
        "cognitive_load_monitor",
        "invisible_workforce",
        "knowledge_ghost",
        "crew_trauma_score",
      ]),
    );
  });

  it("each ARC layer has a code, summary, stages and a SafetyIQ mapping", () => {
    for (const layer of ARC_LAYERS) {
      expect(layer.code).toBeTruthy();
      expect(layer.summary.length).toBeGreaterThan(10);
      expect(layer.stages.length).toBeGreaterThan(0);
      expect(layer.safetyiqMapping.length).toBeGreaterThan(10);
    }
  });
});

describe("ARC fixture coverage", () => {
  it("every site has a reading for all six HSL dimensions", () => {
    const dimKeys = HSL_DIMENSIONS.map((d) => d.key);
    for (const site of fx.SITES) {
      const dims = fx.HSL_READINGS.filter((r) => r.site_id === site.id).map((r) => r.dimension);
      for (const k of dimKeys) expect(dims, `${site.id}/${k}`).toContain(k);
    }
  });

  it("every site's vertical is a known GUS vertical", () => {
    const slugs = new Set(GUS_VERTICALS.map((v) => v.slug));
    for (const s of fx.SITES) expect(slugs.has(s.vertical), s.id).toBe(true);
  });

  it("VELA insights only apply to known verticals", () => {
    const slugs = new Set(GUS_VERTICALS.map((v) => v.slug));
    for (const v of fx.VELA_INSIGHTS) {
      for (const t of v.applies_to) expect(slugs.has(t), `${v.id}:${t}`).toBe(true);
    }
  });
});

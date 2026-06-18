import { describe, it, expect } from "vitest";
import { extractCellDraft } from "@/lib/ai/extract";
import { extractCellDraftSmart } from "@/lib/ai/extract-llm";
import { safetyCellSchema } from "@/lib/schemas";

describe("extractCellDraft (EXP convert)", () => {
  it("reads a forklift/no-spotter narrative into a struck-by, missing-control draft", () => {
    const r = extractCellDraft("A forklift was unloading near the blind corner with no spotter and pedestrians cutting through.");
    expect(r.draft.hazard_genome.energySource).toBe("motion");
    expect(r.draft.hazard_genome.exposureType).toBe("struck_by");
    expect(r.draft.hazard_genome.controlGap).toBe("missing");
    expect(r.signals.length).toBeGreaterThan(0);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(0.9);
  });

  it("detects a fall-from-height + critical severity narrative", () => {
    const r = extractCellDraft("Worker on the roof edge with the guardrail removed; a fall here would be fatal.");
    expect(r.draft.hazard_genome.exposureType).toBe("fall");
    expect(r.draft.severity).toBe("critical");
  });

  it("detects an electrical / bypassed-control narrative", () => {
    const r = extractCellDraft("The panel was live and the lockout had been bypassed with tape.");
    expect(r.draft.hazard_genome.energySource).toBe("electrical");
    expect(r.draft.hazard_genome.controlGap).toBe("bypassed");
  });

  it("always produces a draft that passes the Safety Cell schema once site/location are added", () => {
    const r = extractCellDraft("Near miss: a dropped wrench fell from height into the exclusion zone.");
    const parsed = safetyCellSchema.safeParse({ ...r.draft, site_id: "s", location_id: "l", status: "open" });
    expect(parsed.success).toBe(true);
  });
});

describe("extractCellDraftSmart (live LLM path with heuristic fallback)", () => {
  it("falls back to the heuristic in mock mode and yields a schema-valid draft", async () => {
    const text = "A forklift was unloading near the blind corner with no spotter and pedestrians cutting through.";
    const r = await extractCellDraftSmart(text);
    // mock mode → identical to the deterministic heuristic
    expect(r.draft).toEqual(extractCellDraft(text).draft);
    const parsed = safetyCellSchema.safeParse({ ...r.draft, site_id: "s", location_id: "l", status: "open" });
    expect(parsed.success).toBe(true);
  });
});

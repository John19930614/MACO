import { describe, it, expect } from "vitest";
import { inputHash } from "@/lib/ai/cache";
import { analyzeChemical } from "@/lib/ai/engine";
import { MOCK_CHEMICALS } from "@/lib/data/mock";
import type { AiAnalysisOutput, AiFinding } from "@/lib/types";

describe("inputHash", () => {
  it("is deterministic for identical inputs", () => {
    expect(inputHash(["a", "b", "c"])).toBe(inputHash(["a", "b", "c"]));
  });
  it("changes when any input changes", () => {
    expect(inputHash(["a", "b"])).not.toBe(inputHash(["a", "b!"]));
    expect(inputHash(["a", "b"])).not.toBe(inputHash(["a", "b", "c"]));
  });
  it("treats null/undefined as empty and returns a fixed-width hex", () => {
    expect(inputHash([null, undefined])).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("analysis cache short-circuit", () => {
  it("stamps an input_hash on every finding", async () => {
    const finding = await analyzeChemical(MOCK_CHEMICALS[0]);
    const out = finding.output as AiAnalysisOutput;
    expect(out.input_hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("reuses a matching prior pending finding instead of recomputing", async () => {
    const chem = MOCK_CHEMICALS[0];
    const first = await analyzeChemical(chem);          // fresh — has input_hash
    const second = await analyzeChemical(chem, first);  // same inputs → cache hit
    expect(second).toBe(first);                          // exact prior object returned
  });

  it("does NOT reuse a prior whose hash differs", async () => {
    const chem = MOCK_CHEMICALS[0];
    const fresh = await analyzeChemical(chem);
    const staleOutput = { ...(fresh.output as AiAnalysisOutput), input_hash: "deadbeefdeadbeef" };
    const stalePrior: AiFinding = { ...fresh, id: "stale", output: staleOutput };
    const result = await analyzeChemical(chem, stalePrior);
    expect(result.id).not.toBe("stale");                 // recomputed, not reused
  });

  it("does NOT reuse a non-pending prior", async () => {
    const chem = MOCK_CHEMICALS[0];
    const fresh = await analyzeChemical(chem);
    const approved: AiFinding = { ...fresh, id: "approved", review_status: "accepted" };
    const result = await analyzeChemical(chem, approved);
    expect(result.id).not.toBe("approved");
  });
});

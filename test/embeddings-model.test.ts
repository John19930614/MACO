/**
 * Regression guard for the embedding model resolver: after the legacy
 * AMAYA_EMBED_MODEL fallback removal, EMBED_MODEL must always resolve to a
 * non-empty string, never from the legacy env var.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEYS = ["SAFETYIQ_EMBED_MODEL", "AMAYA_EMBED_MODEL"] as const;
const saved: Record<string, string | undefined> = {};

/** Re-imports the module so the top-level EMBED_MODEL const re-evaluates. */
async function resolveModel(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  const mod = await import("@/lib/ai/embeddings");
  return mod.EMBED_MODEL;
}

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

describe("EMBED_MODEL resolver (post AMAYA_EMBED_MODEL removal)", () => {
  it("uses SAFETYIQ_EMBED_MODEL when set", async () => {
    const model = await resolveModel({ SAFETYIQ_EMBED_MODEL: "text-embedding-3-large" });
    expect(model).toBe("text-embedding-3-large");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("ignores the legacy AMAYA_EMBED_MODEL even when it is set", async () => {
    const model = await resolveModel({ AMAYA_EMBED_MODEL: "amaya-legacy-embed-model" });
    expect(model).toBe("text-embedding-3-small");
    expect(model.toLowerCase()).not.toContain("amaya");
  });

  it("falls back to the hardcoded default and warns when nothing is set", async () => {
    const model = await resolveModel({});
    expect(model).toBe("text-embedding-3-small");
    expect(console.warn).toHaveBeenCalledOnce();
    expect(vi.mocked(console.warn).mock.calls[0][0]).toContain("SAFETYIQ_EMBED_MODEL");
  });

  it("never resolves to an empty or amaya-tainted string under any env state", async () => {
    const states = [
      { SAFETYIQ_EMBED_MODEL: "text-embedding-ada-002" },
      { AMAYA_EMBED_MODEL: "amaya-legacy" },
      {},
    ];
    for (const state of states) {
      const model = await resolveModel(state);
      expect(typeof model).toBe("string");
      expect(model.length).toBeGreaterThan(0);
      expect(model.toLowerCase()).not.toContain("amaya");
    }
  });
});

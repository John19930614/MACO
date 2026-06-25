import { describe, it, expect } from "vitest";
import { mapTelemetryRow, getPersistedTelemetry, recordAiCall, type AiTelemetryRow } from "@/lib/ai/telemetry";

describe("mapTelemetryRow", () => {
  it("coerces null columns to safe AiCall defaults", () => {
    const row: AiTelemetryRow = {
      at: "2026-06-25T00:00:00.000Z",
      provider: null, model: null, ms: null,
      input_tokens: null, output_tokens: null, ok: null,
    };
    expect(mapTelemetryRow(row)).toEqual({
      at: Date.parse("2026-06-25T00:00:00.000Z"),
      provider: "", model: "", ms: 0,
      inputTokens: 0, outputTokens: 0, ok: true,
    });
  });

  it("preserves populated fields and renames token columns", () => {
    const row: AiTelemetryRow = {
      at: "2026-06-25T12:00:00.000Z",
      provider: "anthropic", model: "claude-haiku-4-5", ms: 1200,
      input_tokens: 1000, output_tokens: 300, ok: false,
    };
    expect(mapTelemetryRow(row)).toMatchObject({
      provider: "anthropic", model: "claude-haiku-4-5", ms: 1200,
      inputTokens: 1000, outputTokens: 300, ok: false,
    });
  });
});

describe("getPersistedTelemetry (mock mode)", () => {
  it("returns the in-memory buffer and reflects recorded calls", async () => {
    recordAiCall({ provider: "test-prov", model: "telemetry-test-model", ms: 5, inputTokens: 1, outputTokens: 1, ok: true });
    const rows = await getPersistedTelemetry();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((r) => r.model === "telemetry-test-model")).toBe(true);
  });
});

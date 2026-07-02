/**
 * logAnalysisFailure() — the shared telemetry helper behind the
 * silent-AI-failure fix. Contract under test:
 *   • returns a user-safe AnalysisWarning (no stack traces / internal detail),
 *   • emits a console telemetry event with the full error detail,
 *   • forwards to the optional external sink when configured,
 *   • NEVER throws, even when logging itself fails.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  logAnalysisFailure,
  AuditWriteError,
  type AnalysisModule,
  type AnalysisWarning,
} from "@/lib/telemetry/logAnalysisFailure";

const ALL_MODULES: AnalysisModule[] = ["chemical", "complianceGap", "training", "waste", "remediation", "auditLog"];

type SinkGlobal = { __SAFETYIQ_TELEMETRY__?: { captureEvent: (event: string, payload: Record<string, unknown>) => void } };

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as SinkGlobal).__SAFETYIQ_TELEMETRY__;
});

describe("logAnalysisFailure()", () => {
  it("returns a user-safe warning that never leaks the raw error detail", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const warning: AnalysisWarning = logAnalysisFailure({
      module: "chemical",
      itemId: "chem-42",
      error: new Error("ECONNREFUSED at /var/task/src/lib/ai/provider.ts:88"),
    });
    expect(warning.itemId).toBe("chem-42");
    expect(warning.module).toBe("chemical");
    expect(warning.message.length).toBeGreaterThan(0);
    expect(warning.message).not.toContain("ECONNREFUSED");
    expect(warning.message).not.toContain("/var/task");
    expect(warning.message).not.toContain("provider.ts");
  });

  it("has a distinct, non-empty user-safe message for every module", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const messages = ALL_MODULES.map(
      (module) => logAnalysisFailure({ module, itemId: "x", error: new Error("e") }).message,
    );
    for (const m of messages) expect(m.length).toBeGreaterThan(10);
    expect(new Set(messages).size).toBe(ALL_MODULES.length);
  });

  it("emits a console telemetry event carrying module, itemId, and the real error message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logAnalysisFailure({ module: "training", itemId: "tenant-1", error: new Error("model timeout"), context: { run: "scan-7" } });
    expect(spy).toHaveBeenCalledWith(
      "[ai_analysis_failed]",
      expect.objectContaining({ module: "training", itemId: "tenant-1", message: "model timeout", context: { run: "scan-7" } }),
    );
  });

  it("extracts the message from Supabase-style plain-object errors (not Error instances)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logAnalysisFailure({ module: "auditLog", itemId: "finding-1", error: { message: "new row violates row-level security policy", code: "42501" } });
    expect(spy).toHaveBeenCalledWith(
      "[ai_analysis_failed]",
      expect.objectContaining({ message: "new row violates row-level security policy" }),
    );
  });

  it("survives unserializable errors (circular objects) without throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logAnalysisFailure({ module: "waste", itemId: "w-1", error: circular })).not.toThrow();
  });

  it("forwards the event to the external sink when one is configured", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const captureEvent = vi.fn();
    (globalThis as SinkGlobal).__SAFETYIQ_TELEMETRY__ = { captureEvent };
    logAnalysisFailure({ module: "remediation", itemId: "finding-9", error: new Error("boom") });
    expect(captureEvent).toHaveBeenCalledWith(
      "ai_analysis_failed",
      expect.objectContaining({ module: "remediation", itemId: "finding-9", message: "boom" }),
    );
  });

  it("never throws even when the sink AND console.error themselves throw", () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("logging service down");
    });
    (globalThis as SinkGlobal).__SAFETYIQ_TELEMETRY__ = {
      captureEvent: () => {
        throw new Error("sink down");
      },
    };
    let warning: AnalysisWarning | undefined;
    expect(() => {
      warning = logAnalysisFailure({ module: "chemical", itemId: "chem-1", error: new Error("original") });
    }).not.toThrow();
    expect(warning?.itemId).toBe("chem-1");
  });
});

describe("AuditWriteError", () => {
  it("is a typed Error carrying the itemId and original cause", () => {
    const cause = new Error("insert failed");
    const err = new AuditWriteError("finding-3", cause);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AuditWriteError");
    expect(err.itemId).toBe("finding-3");
    expect(err.cause).toBe(cause);
    expect(err.message).toBe("Audit log write failed");
  });
});

// Minimal, dependency-light telemetry logger for surfacing previously-silent
// AI-analysis and audit-write failures. Never throws — logging a failure must
// not mask or replace the original error, so callers can always invoke this
// from a catch block. Centralizes the failure-event shape so every action
// module (ehs-ai, ai-remediate, …) emits consistent telemetry.

export type AnalysisModule =
  | "chemical"
  | "complianceGap"
  | "training"
  | "waste"
  | "remediation"
  | "auditLog";

export interface AnalysisWarning {
  itemId: string;
  module: AnalysisModule;
  // Short, user-safe text — no stack traces, no file paths, no internal IDs beyond itemId.
  message: string;
}

interface LogAnalysisFailureInput {
  module: AnalysisModule;
  itemId: string;
  error: unknown;
  context?: Record<string, unknown>;
}

interface TelemetrySink {
  captureEvent: (event: string, payload: Record<string, unknown>) => void;
}

function toErrorDetail(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    // Supabase/PostgREST errors are plain objects with a message field, not Error instances.
    return { message: (error as { message: string }).message };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

const USER_SAFE_MESSAGES: Record<AnalysisModule, string> = {
  chemical: "We weren't able to fully analyze this chemical right now. Please retry or check back shortly.",
  complianceGap: "We couldn't complete the compliance gap check for this item. Retry to fill in the missing analysis.",
  training: "We couldn't analyze this training record. Try again or contact support if this continues.",
  waste: "We couldn't complete the classification check for this waste stream. Retry the scan to fill in the missing analysis.",
  remediation: "We couldn't generate a remediation suggestion for this item right now. You can still act on the finding manually.",
  auditLog: "Your change was saved, but we couldn't record it in the audit history. Our team has been notified.",
};

/**
 * Logs a previously-swallowed error to telemetry (console + optional external sink).
 * Safe to call from any catch block — will not throw.
 * Returns a user-safe AnalysisWarning the caller can attach to its result payload.
 */
export function logAnalysisFailure(input: LogAnalysisFailureInput): AnalysisWarning {
  const { module, itemId, error, context } = input;
  const detail = toErrorDetail(error);

  try {
    console.error("[ai_analysis_failed]", {
      module,
      itemId,
      message: detail.message,
      stack: detail.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    // Optional external observability sink (e.g. Sentry, Logtail) — kept generic
    // so this file has no hard dependency on any provider.
    const sink = (globalThis as { __SAFETYIQ_TELEMETRY__?: TelemetrySink }).__SAFETYIQ_TELEMETRY__;
    if (sink && typeof sink.captureEvent === "function") {
      sink.captureEvent("ai_analysis_failed", { module, itemId, ...detail, context });
    }
  } catch (loggingError) {
    // Logging must never throw or crash the caller's catch block.
    try {
      console.error("[telemetry_logging_failed]", loggingError);
    } catch {
      // Even the fallback logger failed — nothing left to do; stay silent.
    }
  }

  return {
    itemId,
    module,
    message: USER_SAFE_MESSAGES[module],
  };
}

/**
 * Typed error for audit-log write failures that must be propagated to the
 * caller instead of being silently swallowed. Server actions in this codebase
 * return `{ ok, error? }` rather than throwing across the action boundary, so
 * most call sites surface this as `{ auditWriteFailed: true, warnings: [...] }`
 * — but the class is exported for call chains that prefer to throw.
 * Never catch-and-discard this anywhere in the call chain.
 */
export class AuditWriteError extends Error {
  readonly itemId: string;

  constructor(itemId: string, cause?: unknown) {
    super("Audit log write failed");
    this.name = "AuditWriteError";
    this.itemId = itemId;
    this.cause = cause;
  }
}

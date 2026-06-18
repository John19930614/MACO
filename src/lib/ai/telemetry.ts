/**
 * In-process AI call telemetry (server-only). The provider records one entry
 * per model call; the engine records a marker when it falls back to the
 * heuristic. A small ring buffer on globalThis so it survives dev hot-reloads,
 * mirroring the mock store. Live/serverless deployments would point this at a
 * real sink — the shape (AiCall) is the contract.
 */
import "server-only";
import type { AiCall } from "@/lib/analytics/ai";

const CAP = 200;
const g = globalThis as unknown as { __macoAiTelemetry?: AiCall[] };
const buf: AiCall[] = g.__macoAiTelemetry ?? (g.__macoAiTelemetry = []);

export function recordAiCall(entry: Omit<AiCall, "at">): void {
  buf.push({ ...entry, at: Date.now() });
  if (buf.length > CAP) buf.splice(0, buf.length - CAP);
}

export function getAiTelemetry(): AiCall[] {
  return [...buf];
}

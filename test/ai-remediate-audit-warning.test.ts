/**
 * dismissFinding() audit-trail contract — an audit_log write failure is never
 * silent: the caller gets `auditWriteFailed: true` + a user-safe warning, and
 * telemetry is emitted. Covers both failure shapes (Supabase returned-error
 * and a thrown network error) plus a happy-path regression check that the
 * return shape is unchanged on success.
 *
 * Live mode is forced by overriding MOCK_MODE; Supabase + session are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  MOCK_MODE: false,
}));
vi.mock("@/lib/auth/session", () => ({
  getServerTenantId: async () => "tenant-1",
  getServerProfileId: async () => "profile-1",
}));

const supa = vi.hoisted(() => ({
  // null = audit insert succeeds; otherwise the failure to simulate.
  auditFailure: null as null | { kind: "returned-error"; message: string } | { kind: "throw"; message: string },
  auditInserts: [] as unknown[],
  findingUpdates: 0,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { default_site_id: "site-1" } }) }) }) };
      }
      if (table === "ai_findings") {
        return {
          update: () => ({
            eq: () => ({
              eq: async () => {
                supa.findingUpdates++;
                return { error: null };
              },
            }),
          }),
        };
      }
      if (table === "audit_log") {
        return {
          insert: async (row: unknown) => {
            supa.auditInserts.push(row);
            if (supa.auditFailure?.kind === "throw") throw new Error(supa.auditFailure.message);
            if (supa.auditFailure?.kind === "returned-error") return { error: { message: supa.auditFailure.message } };
            return { error: null };
          },
        };
      }
      if (table === "capa_records") {
        return { insert: async () => ({ error: null }) };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

import { dismissFinding } from "@/lib/actions/ai-remediate";

beforeEach(() => {
  supa.auditFailure = null;
  supa.auditInserts = [];
  supa.findingUpdates = 0;
  vi.restoreAllMocks();
});

describe("dismissFinding() — audit-log write failures are surfaced, never swallowed", () => {
  it("returns auditWriteFailed + a user-safe warning when the insert reports a DB-level error (RLS/FK)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    supa.auditFailure = { kind: "returned-error", message: "new row violates row-level security policy" };

    const result = await dismissFinding("finding-7", "not applicable");

    // The dismiss itself succeeded, but the result can never read as fully audited.
    expect(result.ok).toBe(true);
    expect(result.auditWriteFailed).toBe(true);
    expect(supa.findingUpdates).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0]).toMatchObject({ module: "auditLog", itemId: "finding-7" });
    // User-safe message — no internal error detail leaks.
    expect(result.warnings?.[0].message).not.toContain("row-level security");
    // Telemetry captured the real detail for engineering follow-up.
    expect(errSpy).toHaveBeenCalledWith(
      "[ai_analysis_failed]",
      expect.objectContaining({
        module: "auditLog",
        itemId: "finding-7",
        message: "new row violates row-level security policy",
        context: { action: "ai_finding_dismissed", entity: "ai_finding" },
      }),
    );
  });

  it("returns auditWriteFailed + telemetry when the insert throws (network failure)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    supa.auditFailure = { kind: "throw", message: "fetch failed: network unreachable" };

    const result = await dismissFinding("finding-8", "duplicate");

    expect(result.ok).toBe(true);
    expect(result.auditWriteFailed).toBe(true);
    expect(result.warnings?.[0]).toMatchObject({ module: "auditLog", itemId: "finding-8" });
    expect(errSpy).toHaveBeenCalledWith(
      "[ai_analysis_failed]",
      expect.objectContaining({ module: "auditLog", message: "fetch failed: network unreachable" }),
    );
  });

  it("regression: the happy-path return shape is unchanged when the audit write succeeds", async () => {
    const result = await dismissFinding("finding-9", "handled offline");

    expect(result).toEqual({ ok: true });
    expect(result.auditWriteFailed).toBeUndefined();
    expect(result.warnings).toBeUndefined();
    expect(supa.auditInserts).toHaveLength(1);
    expect(supa.auditInserts[0]).toMatchObject({ action: "ai_finding_dismissed", entity_id: "finding-9" });
  });
});

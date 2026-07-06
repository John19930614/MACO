// Proves assertTenantOwnership rejects a spoofed tenant_id before any
// service-role write can use it, and passes legitimate same-tenant calls
// through. Mocks the layers UNDER session.ts (env + supabase profile lookup)
// so the real assertTenantOwnership + getServerTenantId code paths run.
import { describe, test, expect, vi, beforeEach } from "vitest";

const getAuthProfileMock = vi.hoisted(() => vi.fn());

// Force the live (non-mock) path so getServerTenantId resolves via getAuthProfile.
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  MOCK_MODE: false,
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: vi.fn(async () => ({ id: "user-1" })),
  getAuthProfile: (...a: unknown[]) => getAuthProfileMock(...a),
  DEMO_SARAH_ID: "cccccccc-0001-4000-c000-000000000001",
}));

import { assertTenantOwnership, TenantMismatchError } from "@/lib/auth/session";

describe("assertTenantOwnership", () => {
  beforeEach(() => {
    getAuthProfileMock.mockReset();
  });

  test("rejects a spoofed tenant_id that does not match the session tenant", async () => {
    getAuthProfileMock.mockResolvedValue({ id: "user-1", tenant_id: "tenant-A" });

    await expect(assertTenantOwnership("tenant-B-spoofed")).rejects.toBeInstanceOf(
      TenantMismatchError,
    );
  });

  test("allows a matching tenant_id and returns the verified id", async () => {
    getAuthProfileMock.mockResolvedValue({ id: "user-1", tenant_id: "tenant-A" });

    await expect(assertTenantOwnership("tenant-A")).resolves.toBe("tenant-A");
  });

  test("rejects when there is no authenticated session tenant", async () => {
    getAuthProfileMock.mockResolvedValue(null);

    await expect(assertTenantOwnership("tenant-A")).rejects.toBeInstanceOf(
      TenantMismatchError,
    );
  });

  test("rejects a superadmin session (tenant_id null) claiming a tenant", async () => {
    getAuthProfileMock.mockResolvedValue({ id: "user-1", tenant_id: null });

    await expect(assertTenantOwnership("tenant-A")).rejects.toBeInstanceOf(
      TenantMismatchError,
    );
  });

  test("error is typed so call sites can map it to a friendly message", async () => {
    getAuthProfileMock.mockResolvedValue({ id: "user-1", tenant_id: "tenant-A" });

    const err = await assertTenantOwnership("tenant-B").catch((e) => e);
    expect(err.name).toBe("TenantMismatchError");
    expect(err).toBeInstanceOf(Error);
  });
});

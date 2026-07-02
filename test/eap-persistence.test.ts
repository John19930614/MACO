/**
 * EAP persistence — mock-mode round-trip + live-mode error surface.
 *
 * Covers the fix for saveEap() returning {ok:true} in mock mode without
 * writing to the store (edits were lost on reload), and verifies the
 * live-mode path still returns {ok:false, error} instead of throwing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getServerTenantId: vi.fn(async () => "tenant-1"),
}));

// Chainable Supabase query stub: every builder method returns itself; the
// terminal awaits resolve with whatever the test configured.
function makeQueryStub(results: { single?: unknown; write?: unknown }) {
  const write = () => Promise.resolve(results.write ?? { error: null });
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    chain[m] = () => chain;
  }
  chain.single = () => Promise.resolve(results.single ?? { data: null, error: null });
  chain.update = () => ({ eq: write });
  chain.insert = write;
  return { from: () => chain };
}

describe("EAP mock-mode persistence", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ MOCK_MODE: true }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: vi.fn(() => {
        throw new Error("Supabase must not be touched in mock mode");
      }),
    }));
    const { resetStore } = await import("@/lib/data/store");
    resetStore();
  });

  it("returns the seeded fixture before any save", async () => {
    const { getEap } = await import("@/lib/actions/eap");
    const eap = await getEap();
    expect(eap?.facility_name).toBe("BioStar Research Facility");
  });

  it("persists a save so it reads back after 'reload'", async () => {
    const { getEap, saveEap } = await import("@/lib/actions/eap");
    const result = await saveEap({
      facility_name: "Cortexa Main Campus",
      primary_muster_point: "Dock 4",
    });
    expect(result.ok).toBe(true);

    const eap = await getEap();
    expect(eap?.facility_name).toBe("Cortexa Main Campus");
    expect(eap?.primary_muster_point).toBe("Dock 4");
    // Unedited fields survive the merge with the fixture defaults.
    expect(eap?.hospital_name).toBe("SF General Hospital");
  });

  it("merges successive saves instead of clobbering earlier edits", async () => {
    const { getEap, saveEap } = await import("@/lib/actions/eap");
    await saveEap({ facility_name: "First Edit" });
    await saveEap({ aed_location: "Front desk" });
    const eap = await getEap();
    expect(eap?.facility_name).toBe("First Edit");
    expect(eap?.aed_location).toBe("Front desk");
  });

  it("writes into the shared mock store slot", async () => {
    const { saveEap } = await import("@/lib/actions/eap");
    const { getStore } = await import("@/lib/data/store");
    expect(getStore().eap).toBeNull();
    await saveEap({ facility_name: "Store Check" });
    expect(getStore().eap?.facility_name).toBe("Store Check");
  });

  it("resetStore clears saved edits back to the fixture", async () => {
    const { getEap, saveEap } = await import("@/lib/actions/eap");
    const { resetStore } = await import("@/lib/data/store");
    await saveEap({ facility_name: "Ephemeral" });
    resetStore();
    const eap = await getEap();
    expect(eap?.facility_name).toBe("BioStar Research Facility");
  });
});

describe("EAP live-mode error surface", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ MOCK_MODE: false }));
  });

  it("returns ok:false when the database client is unavailable", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: () => null,
    }));
    const { saveEap } = await import("@/lib/actions/eap");
    const result = await saveEap({ facility_name: "X" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Database not available.");
  });

  it("returns ok:false with the message when the insert fails", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: () =>
        makeQueryStub({
          single: { data: null, error: null },          // getEap: no existing row
          write: { error: { message: "insert failed" } },
        }),
    }));
    const { saveEap } = await import("@/lib/actions/eap");
    const result = await saveEap({ facility_name: "X" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("insert failed");
  });

  it("returns ok:true when the insert succeeds (no regression)", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: () =>
        makeQueryStub({ single: { data: null, error: null }, write: { error: null } }),
    }));
    const { saveEap } = await import("@/lib/actions/eap");
    const result = await saveEap({ facility_name: "X" });
    expect(result.ok).toBe(true);
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { getStore, resetStore } from "@/lib/data/store";
import { EHS_MODULES } from "@/lib/constants";
import {
  ALL_MODULE_KEYS,
  getTenantModuleAccess,
  isModuleAccessibleForTenant,
} from "@/lib/modules/moduleAccess";
import { setTenantModuleAccess } from "@/lib/actions/tenant-module-access";

// Tests run in MOCK_MODE (see vitest.config.ts), which has no live Supabase
// session — so tenant_module_access is never queried and every module falls
// back to its default (enabled). That exercises the two acceptance criteria
// that don't require a live database:
//   1. the "no row yet → enabled" regression guard, and
//   2. platform-wide maintenance overriding a company's toggle — maintenance
//      state lives in the in-memory Module Control Panel store (store.ts),
//      which MOCK_MODE and live mode share.
// Toggling a company's own override (setTenantModuleAccess actually writing a
// row) requires a live Supabase project and is out of scope for this suite —
// see docs/company-module-access.md for the manual QA checklist that covers it.

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  resetStore();
});

describe("ALL_MODULE_KEYS", () => {
  it("covers exactly the 10 EHS modules, matching constants.ts", () => {
    expect(ALL_MODULE_KEYS).toEqual(EHS_MODULES);
    expect(ALL_MODULE_KEYS).toHaveLength(10);
  });
});

describe("getTenantModuleAccess — defaults and count accuracy", () => {
  it("defaults every module to enabled when no per-tenant row exists (regression guard)", async () => {
    const statuses = await getTenantModuleAccess(TENANT_A);
    expect(statuses).toHaveLength(10);
    expect(statuses.every((s) => s.tenantEnabled)).toBe(true);
    expect(statuses.every((s) => s.effectiveAccess)).toBe(true);
    // "X of Y modules included" — with no overrides, X === Y.
    expect(statuses.filter((s) => s.tenantEnabled).length).toBe(statuses.length);
  });

  it("isModuleAccessibleForTenant matches the effectiveAccess entry for that module", async () => {
    const accessible = await isModuleAccessibleForTenant(TENANT_A, "incidents");
    expect(accessible).toBe(true);
  });
});

describe("platform-wide maintenance overrides the company toggle", () => {
  it("sets effectiveAccess=false and platformUnderMaintenance=true when a module is under platform maintenance, even though the company-level default is enabled", async () => {
    const store = getStore();
    store.moduleStates["waste"] = {
      enabled: false,
      maintenanceNote: "Scheduled DB migration",
      disabledAt: new Date(0).toISOString(),
      disabledBy: "reliance-ops",
    };

    const statuses = await getTenantModuleAccess(TENANT_A);
    const waste = statuses.find((s) => s.moduleKey === "waste")!;
    expect(waste.tenantEnabled).toBe(true); // company toggle is still "on"
    expect(waste.platformUnderMaintenance).toBe(true);
    expect(waste.effectiveAccess).toBe(false); // platform maintenance wins
    expect(waste.maintenanceNote).toBe("Scheduled DB migration");

    // Isolation: only the maintained module is affected, every other module on
    // this tenant (and any other tenant) is untouched.
    const others = statuses.filter((s) => s.moduleKey !== "waste");
    expect(others.every((s) => s.effectiveAccess)).toBe(true);

    const statusesForTenantB = await getTenantModuleAccess(TENANT_B);
    expect(statusesForTenantB.find((s) => s.moduleKey === "waste")!.effectiveAccess).toBe(false);
  });

  it("restores effectiveAccess=true once platform maintenance is cleared", async () => {
    const store = getStore();
    store.moduleStates["capa"] = {
      enabled: false,
      maintenanceNote: "",
      disabledAt: new Date().toISOString(),
      disabledBy: "reliance-ops",
    };
    let statuses = await getTenantModuleAccess(TENANT_A);
    expect(statuses.find((s) => s.moduleKey === "capa")!.effectiveAccess).toBe(false);

    store.moduleStates["capa"] = { enabled: true, maintenanceNote: "", disabledAt: null, disabledBy: "" };
    statuses = await getTenantModuleAccess(TENANT_A);
    const capa = statuses.find((s) => s.moduleKey === "capa")!;
    expect(capa.effectiveAccess).toBe(true);
    expect(capa.maintenanceNote).toBeNull();
  });
});

describe("setTenantModuleAccess — permission gate", () => {
  it("rejects the write when there is no authenticated superadmin session, and writes nothing", async () => {
    // MOCK_MODE has no live Supabase session client, so this always takes the
    // "no session" branch of the same gate a real non-superadmin caller would
    // hit — see src/lib/actions/tenant-module-access.ts getSaCtx().
    const res = await setTenantModuleAccess({
      tenantId: TENANT_A,
      moduleKey: "incidents",
      isEnabled: false,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();

    // No side effect — the tenant's access is unchanged.
    const statuses = await getTenantModuleAccess(TENANT_A);
    expect(statuses.find((s) => s.moduleKey === "incidents")!.tenantEnabled).toBe(true);
  });

  it("rejects an unknown module key before attempting any write", async () => {
    const res = await setTenantModuleAccess({
      tenantId: TENANT_A,
      // @ts-expect-error — intentionally invalid to exercise the guard
      moduleKey: "not_a_real_module",
      isEnabled: false,
    });
    expect(res.ok).toBe(false);
  });
});

import "server-only";
import { cache } from "react";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/data/store";
import { EHS_MODULES, MODULE_META, type EhsModule } from "@/lib/constants";

export type ModuleKey = EhsModule;
export const ALL_MODULE_KEYS: readonly ModuleKey[] = EHS_MODULES;

export interface ModuleEffectiveStatus {
  moduleKey: ModuleKey;
  label: string;
  tenantEnabled: boolean; // per-tenant toggle (tenant_module_access.is_enabled; default true)
  platformUnderMaintenance: boolean; // platform-wide Module Control Panel status
  maintenanceNote: string | null; // set only when platformUnderMaintenance
  disabledAt: string | null; // set only when platformUnderMaintenance
  effectiveAccess: boolean; // final answer used by nav + the module route gate
}

// Reads platform-wide maintenance state from the existing Module Control Panel
// data source (src/lib/data/store.ts moduleStates — the same in-memory store
// /api/platform/modules and the /sa/modules console read and write). This is
// the single source of truth for "is this module under platform maintenance" —
// intentionally not duplicated into a second table.
function getPlatformMaintenanceState(): Record<
  ModuleKey,
  { underMaintenance: boolean; maintenanceNote: string | null; disabledAt: string | null }
> {
  const states = getStore().moduleStates;
  const result = {} as Record<
    ModuleKey,
    { underMaintenance: boolean; maintenanceNote: string | null; disabledAt: string | null }
  >;
  for (const key of EHS_MODULES) {
    const s = states[key];
    result[key] = {
      underMaintenance: s ? !s.enabled : false,
      maintenanceNote: s?.maintenanceNote || null,
      disabledAt: s?.disabledAt ?? null,
    };
  }
  return result;
}

/**
 * Resolves per-module access for a tenant by combining:
 * 1. Per-tenant toggle (tenant_module_access.is_enabled; missing row = enabled)
 * 2. Platform-wide maintenance flag (Module Control Panel)
 * Platform maintenance always wins: if a module is under platform-wide
 * maintenance, effectiveAccess is false regardless of the tenant toggle.
 */
export const getTenantModuleAccess = cache(
  async (tenantId: string): Promise<ModuleEffectiveStatus[]> => {
    const platformState = getPlatformMaintenanceState();

    const overrides = new Map<ModuleKey, boolean>();
    if (!MOCK_MODE) {
      const client = await createSupabaseServerClient();
      if (client) {
        const { data } = await client
          .from("tenant_module_access")
          .select("module_key, is_enabled")
          .eq("tenant_id", tenantId);
        for (const row of data ?? []) {
          overrides.set(row.module_key as ModuleKey, row.is_enabled as boolean);
        }
      }
    }

    return EHS_MODULES.map((moduleKey) => {
      const tenantEnabled = overrides.get(moduleKey) ?? true;
      const platform = platformState[moduleKey];
      const platformUnderMaintenance = platform?.underMaintenance ?? false;
      return {
        moduleKey,
        label: MODULE_META[moduleKey].label,
        tenantEnabled,
        platformUnderMaintenance,
        maintenanceNote: platformUnderMaintenance ? platform.maintenanceNote : null,
        disabledAt: platformUnderMaintenance ? platform.disabledAt : null,
        effectiveAccess: tenantEnabled && !platformUnderMaintenance,
      };
    });
  },
);

/** Convenience check for route guards rendering a single module page. */
export async function isModuleAccessibleForTenant(
  tenantId: string,
  moduleKey: ModuleKey,
): Promise<boolean> {
  const all = await getTenantModuleAccess(tenantId);
  return all.find((m) => m.moduleKey === moduleKey)?.effectiveAccess ?? false;
}

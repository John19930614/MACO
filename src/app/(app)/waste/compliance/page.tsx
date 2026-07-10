import { PageHeader } from "@/components/ui/primitives";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeHierarchy, type HierarchyRow } from "@/lib/waste/hierarchy";
import type { GeneratorCategory } from "@/lib/waste/generator-category";
import { HazardousWasteGenerator, type ProgramRow, type SiteOption } from "./HazardousWasteGenerator";
import { WasteModuleTabs } from "../WasteModuleTabs";

export const dynamic = "force-dynamic";

const CATEGORY_RANK: Record<GeneratorCategory, number> = { VSQG: 0, SQG: 1, LQG: 2 };

async function fetchData(tenantId: string) {
  const client = await createSupabaseServerClient();
  const empty = {
    headlineCategory: null as GeneratorCategory | null,
    split: summarizeHierarchy([]),
    openActions: 0,
    programs: [] as ProgramRow[],
    sites: [] as SiteOption[],
    wasteStreamOptions: [] as string[],
  };
  if (!client) return empty;

  const year = new Date().getFullYear();

  const [sitesRes, hierarchyRes, actionsRes, programsRes, streamsRes] = await Promise.all([
    client
      .from("sites")
      .select("id, name, current_generator_category")
      .eq("tenant_id", tenantId)
      .order("name"),
    client
      .from("waste_hierarchy_record")
      .select("eliminated_kg, substituted_kg, reduced_kg, reused_kg, recycled_kg, treated_kg, landfilled_kg")
      .eq("tenant_id", tenantId)
      .eq("period_year", year),
    client
      .from("waste_compliance_action")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "open"),
    client
      .from("waste_minimization_program")
      .select("id, name, waste_stream, due_date, status, approval_status, reduction_target_pct, estimated_roi_pct")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true }),
    client
      .from("waste_streams")
      .select("waste_name")
      .eq("tenant_id", tenantId)
      .order("waste_name", { ascending: true }),
  ]);

  const wasteStreamOptions = Array.from(
    new Set(
      ((streamsRes.data ?? []) as { waste_name: string | null }[])
        .map((s) => s.waste_name?.trim())
        .filter((n): n is string => !!n),
    ),
  );

  const sites = (sitesRes.data ?? []) as SiteOption[];
  const headlineCategory = sites
    .map((s) => s.current_generator_category)
    .filter((c): c is GeneratorCategory => c === "VSQG" || c === "SQG" || c === "LQG")
    .sort((a, b) => CATEGORY_RANK[b] - CATEGORY_RANK[a])[0] ?? null;

  return {
    headlineCategory,
    split: summarizeHierarchy((hierarchyRes.data ?? []) as HierarchyRow[]),
    openActions: actionsRes.count ?? 0,
    programs: (programsRes.data ?? []) as ProgramRow[],
    sites,
    wasteStreamOptions,
  };
}

export default async function WasteCompliancePage() {
  const tenantId = await getEffectiveTenantId();
  const data = await fetchData(tenantId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Hazardous Waste & Minimization"
        subtitle="Track your site's EPA generator status and waste-reduction programs in one place."
      />
      <WasteModuleTabs active="compliance" />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <HazardousWasteGenerator
          headlineCategory={data.headlineCategory}
          split={data.split}
          openActions={data.openActions}
          programs={data.programs}
          sites={data.sites}
          wasteStreamOptions={data.wasteStreamOptions}
        />
      </div>
    </div>
  );
}

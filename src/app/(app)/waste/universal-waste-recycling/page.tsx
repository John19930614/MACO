import { PageHeader } from "@/components/ui/primitives";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UniversalWasteRecycling } from "./UniversalWasteRecycling";
import { WasteModuleTabs } from "../WasteModuleTabs";
import type {
  Determination, UwItem, NonhazRecord, VendorLite, Certificate, RejectedLoad,
} from "./types";

export const dynamic = "force-dynamic";

async function fetchData(tenantId: string) {
  const client = await createSupabaseServerClient();
  const empty = {
    determinations: [] as Determination[],
    uwItems: [] as UwItem[],
    nonhazRecords: [] as NonhazRecord[],
    vendors: [] as VendorLite[],
    certificates: [] as Certificate[],
    rejectedLoads: [] as RejectedLoad[],
  };
  if (!client) return empty;

  const [dets, items, records, vendors, certs, rejects] = await Promise.all([
    client.from("waste_determinations").select("*").eq("tenant_id", tenantId).order("determined_at", { ascending: false }),
    client.from("universal_waste_items").select("*").eq("tenant_id", tenantId).order("accumulation_deadline", { ascending: true }),
    client.from("nonhaz_recycling_records").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("waste_vendors").select("id,name,permit_expiry,insurance_expiry,recycler_authorization_expiry,status").eq("tenant_id", tenantId).order("name"),
    client.from("recycling_certificates").select("*").eq("tenant_id", tenantId).order("issued_date", { ascending: false }),
    client.from("rejected_loads").select("*").eq("tenant_id", tenantId).is("resolved_at", null).order("rejected_at", { ascending: false }),
  ]);

  return {
    determinations: (dets.data ?? []) as Determination[],
    uwItems: (items.data ?? []) as UwItem[],
    nonhazRecords: (records.data ?? []) as NonhazRecord[],
    vendors: (vendors.data ?? []) as VendorLite[],
    certificates: (certs.data ?? []) as Certificate[],
    rejectedLoads: (rejects.data ?? []) as RejectedLoad[],
  };
}

export default async function UniversalWasteRecyclingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "nonhaz_recycling" ? "nonhaz_recycling" : "universal_waste";
  const tenantId = await getEffectiveTenantId();
  const data = await fetchData(tenantId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Waste & Recycling Tracking"
        subtitle="Universal Waste (hazardous) and Nonhazardous Recycling — tracked separately, with certificates, deadlines, and diversion handled for you."
      />
      <WasteModuleTabs active={initialTab === "nonhaz_recycling" ? "nonhaz_recycling" : "universal_waste"} />
      <div className="iq-scroll flex-1 overflow-y-auto">
        <UniversalWasteRecycling {...data} initialTab={initialTab} />
      </div>
    </div>
  );
}

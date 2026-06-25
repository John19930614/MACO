import { getWasteStreams, getChemicals, getWasteVendors, getWastePickups, getWasteInspections, getWasteProfiles } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { Trash2 } from "lucide-react";
import { AddWasteButton } from "./AddWasteButton";
import { WasteExportButton } from "./WasteExportButton";
import { WasteDashboard } from "./WasteDashboard";

export default async function WastePage() {
  const tenantId = await getEffectiveTenantId();
  const [streams, chemicals, vendors, pickups, inspections, profiles] = await Promise.all([
    getWasteStreams(tenantId),
    getChemicals(tenantId),
    getWasteVendors(tenantId),
    getWastePickups(tenantId),
    getWasteInspections(tenantId),
    getWasteProfiles(tenantId),
  ]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Waste Management"
        subtitle="Waste Command Center · SAA/CAA manager · AI profiles · Manifest/LDR · Vendor/TSDF · Inspections · Training &amp; Compliance"
        actions={
          <div className="flex gap-2">
            <WasteExportButton streams={streams} />
            <AddWasteButton />
          </div>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {streams.length === 0 ? (
          <EmptyState
            icon={<Trash2 className="h-6 w-6" />}
            title="No waste streams yet"
            description="Add a hazardous waste stream with the button above. SafetyIQ can also suggest waste profiles from your chemical inventory and track 90-day accumulation limits automatically."
          />
        ) : (
          <WasteDashboard
            streams={streams}
            chemicals={chemicals}
            vendors={vendors}
            pickups={pickups}
            inspections={inspections}
            profiles={profiles}
          />
        )}
      </div>
    </div>
  );
}

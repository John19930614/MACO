import { getWasteStreams, getChemicals } from "@/lib/data/ehsRepo";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader } from "@/components/ui/primitives";
import { AddWasteButton } from "./AddWasteButton";
import { WasteExportButton } from "./WasteExportButton";
import { WasteDashboard } from "./WasteDashboard";

export default async function WastePage() {
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;
  const [streams, chemicals] = await Promise.all([getWasteStreams(tenantId), getChemicals(tenantId)]);

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
        <WasteDashboard streams={streams} chemicals={chemicals} />
      </div>
    </div>
  );
}

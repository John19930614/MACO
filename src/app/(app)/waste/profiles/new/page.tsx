import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getChemicals, getWasteStreams } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { WasteProfileWizard } from "./WasteProfileWizard";

export const metadata = { title: "New Waste Profile · SafetyIQ" };

export default async function NewWasteProfilePage() {
  const tenantId = await getEffectiveTenantId();
  const [chemicals, streams] = await Promise.all([
    getChemicals(tenantId),
    getWasteStreams(tenantId),
  ]);
  // Only active inventory can be characterized into a waste profile.
  const active = chemicals.filter((c) => c.status === "active");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="New Waste Profile"
        subtitle="Guided characterization — pick chemicals from inventory, set the mix, answer a few questions, and let SafetyIQ draft the profile for EHS approval"
        actions={
          <Link
            href="/waste"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Waste
          </Link>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <WasteProfileWizard chemicals={active} streams={streams} />
      </div>
    </div>
  );
}

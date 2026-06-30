import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { getEap } from "@/lib/actions/eap";
import { EapEditForm } from "./EapEditForm";

export default async function EmergencyEditPage() {
  const eap = await getEap();
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Edit Emergency Action Plan"
        subtitle="Configure your facility emergency contacts, equipment locations, and response procedures"
        actions={
          <Link
            href="/emergency"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Plan
          </Link>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <EapEditForm eap={eap} />
        </div>
      </div>
    </div>
  );
}

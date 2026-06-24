import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { getStagedRows } from "@/lib/actions/ehs";
import { ImportClient } from "./ImportClient";

export const metadata = { title: "Import Documents | SafetyIQ" };

export default async function ImportPage() {
  const tenantId = await getEffectiveTenantId();
  const staged = await getStagedRows();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Import Documents"
        subtitle="Upload documents any time — AI extracts the data, you review & approve before it goes live"
        actions={
          <Link href="/documents" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Back to Documents
          </Link>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <ImportClient tenantId={tenantId} staged={staged} />
        </div>
      </div>
    </div>
  );
}

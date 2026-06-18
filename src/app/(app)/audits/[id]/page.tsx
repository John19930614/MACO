import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuditById } from "@/lib/data/ehsRepo";
import { PageHeader } from "@/components/ui/primitives";
import { AuditStatusBadge } from "@/components/ui/badges";
import { EditAuditForm } from "./EditAuditForm";

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = await getAuditById(id);
  if (!audit) notFound();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={audit.title}
        subtitle={`Audit · ${audit.type.charAt(0).toUpperCase() + audit.type.slice(1)}`}
        actions={
          <Link
            href="/audits"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Audits
          </Link>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Edit Audit</h2>
              <AuditStatusBadge status={audit.status} />
            </div>
            <EditAuditForm audit={audit} />
          </div>
        </div>
      </div>
    </div>
  );
}

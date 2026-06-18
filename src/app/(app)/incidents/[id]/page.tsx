import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getIncidentById } from "@/lib/data/ehsRepo";
import { PageHeader } from "@/components/ui/primitives";
import { SeverityBadge } from "@/components/ui/badges";
import type { Severity } from "@/lib/constants";
import { EditIncidentForm } from "./EditIncidentForm";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident = await getIncidentById(id);
  if (!incident) notFound();

  const occurred = new Date(incident.occurred_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={incident.title}
        subtitle={`Incident · ${incident.location ?? ""} · ${occurred}`}
        actions={
          <Link
            href="/incidents"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Incidents
          </Link>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Edit Incident</h2>
              <SeverityBadge severity={incident.severity as Severity} />
            </div>
            <EditIncidentForm incident={incident} />
          </div>
        </div>
      </div>
    </div>
  );
}

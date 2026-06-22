import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLegalById, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { ComplianceStatusBadge } from "@/components/ui/badges";
import { EditLegalForm } from "./EditLegalForm";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";

const CATEGORY_LABEL: Record<string, string> = {
  chemical: "Chemical", training: "Training", emergency: "Emergency",
  waste: "Waste", air: "Air", water: "Water", biosafety: "Biosafety", general: "General",
};

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function LegalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;
  const [req, profiles] = await Promise.all([getLegalById(id), getProfiles(tenantId)]);
  if (!req) notFound();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={req.regulation_ref}
        subtitle={req.title}
        actions={
          <Link
            href="/legal"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Legal Register
          </Link>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Summary card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Jurisdiction</div>
                <div className="mt-1 text-sm text-slate-700">{req.jurisdiction}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</div>
                <div className="mt-1">
                  <Pill className="bg-slate-100 text-slate-600 text-xs">{CATEGORY_LABEL[req.category] ?? req.category}</Pill>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</div>
                <div className="mt-1"><ComplianceStatusBadge status={req.status} /></div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next Review</div>
                <div className="mt-1 text-sm text-slate-700">{fmt(req.next_review_date)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</div>
                <div className="mt-1 text-sm text-slate-700">
                  {req.owner_id ? (profileMap[req.owner_id] ?? "—") : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review Frequency</div>
                <div className="mt-1 text-sm text-slate-700">
                  {req.review_frequency_days ? `Every ${Math.round(req.review_frequency_days / 30)} months` : "—"}
                </div>
              </div>
              {req.description && (
                <div className="col-span-2 sm:col-span-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</div>
                  <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{req.description}</div>
                </div>
              )}
            </div>
          </div>

          {/* Edit form */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-slate-800">Edit Requirement</h2>
            <EditLegalForm req={req} />
          </div>
        </div>
      </div>
    </div>
  );
}

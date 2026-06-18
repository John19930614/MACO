import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDocumentById, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { EditDocumentForm } from "./EditDocumentForm";

const CATEGORY_LABEL: Record<string, string> = {
  sop: "SOP", policy: "Policy", procedure: "Procedure",
  form: "Form", permit: "Permit", msds: "SDS",
  plan: "Plan", guideline: "Guideline",
};

const DOC_STATUS_STYLE: Record<string, string> = {
  active:       "bg-emerald-100 text-emerald-700",
  draft:        "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  superseded:   "bg-slate-100 text-slate-500",
  obsolete:     "bg-slate-100 text-slate-400",
};

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc, profiles] = await Promise.all([getDocumentById(id), getProfiles()]);
  if (!doc) notFound();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={doc.title}
        subtitle={`v${doc.version} · ${CATEGORY_LABEL[doc.category] ?? doc.category}`}
        actions={
          <Link
            href="/documents"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Link>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Summary */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</div>
                <div className="mt-1">
                  <Pill className="bg-slate-100 text-slate-600 text-xs">
                    {CATEGORY_LABEL[doc.category] ?? doc.category}
                  </Pill>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Version</div>
                <div className="mt-1 font-mono text-sm text-slate-800">{doc.version}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</div>
                <div className="mt-1">
                  <Pill className={DOC_STATUS_STYLE[doc.status] ?? "bg-slate-100 text-slate-600 text-xs"}>
                    {doc.status.replace(/_/g, " ")}
                  </Pill>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Effective Date</div>
                <div className="mt-1 text-sm text-slate-700">{fmt(doc.effective_date)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review Date</div>
                <div className="mt-1 text-sm text-slate-700">{fmt(doc.review_date)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</div>
                <div className="mt-1 text-sm text-slate-700">
                  {doc.owner_id ? (profileMap[doc.owner_id] ?? "—") : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Acknowledgment Required</div>
                <div className="mt-1 text-sm text-slate-700">{doc.acknowledgment_required ? "Yes" : "No"}</div>
              </div>
            </div>
          </div>

          {/* Edit */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-slate-800">Edit Document</h2>
            <EditDocumentForm doc={doc} />
          </div>
        </div>
      </div>
    </div>
  );
}

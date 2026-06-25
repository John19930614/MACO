import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDocumentById, getProfiles, getTenantName, getEstablishment } from "@/lib/data/ehsRepo";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { EditDocumentForm } from "./EditDocumentForm";
import { DocSections, DocControlBlock, type DocControlRow } from "./DocSections";
import { DocumentExportButton } from "./DocumentExportButton";
import { getEffectiveTenantId } from "@/lib/auth/session";

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
  const tenantId = await getEffectiveTenantId();
  const [doc, profiles, company, establishment] = await Promise.all([
    getDocumentById(id), getProfiles(tenantId), getTenantName(tenantId), getEstablishment(tenantId),
  ]);
  if (!doc) notFound();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const ownerName = doc.owner_id ? (profileMap[doc.owner_id] ?? "—") : "—";
  const humanizeStatus = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Section 1 — Document Control, built from live metadata so it always matches
  // the document's real owner / dates / version (and stays in sync when edited).
  const controlRows: DocControlRow[] = [
    { field: "Document Title", value: doc.title },
    { field: "Document Type", value: CATEGORY_LABEL[doc.category] ?? doc.category },
    { field: "Regulatory Basis", value: doc.regulation_ref ?? "—" },
    { field: "Company", value: company },
    { field: "Site / Location", value: doc.site_id ? (establishment.siteName ?? "Assigned site") : (establishment.siteName ?? "All sites") },
    { field: "Document Owner", value: ownerName },
    { field: "Revision", value: doc.version },
    { field: "Status", value: humanizeStatus(doc.status) },
    { field: "Effective Date", value: fmt(doc.effective_date) },
    { field: "Next Review Date", value: fmt(doc.review_date) },
    { field: "Acknowledgment Required", value: doc.acknowledgment_required ? "Yes" : "No" },
  ];

  // Drop any legacy "Document Control" section the AI may have authored before
  // it became a live block, to avoid duplication.
  const bodySections = (doc.content ?? []).filter((s) => !/^document control$/i.test(s.heading.trim()));

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

          {/* Program / SOP body */}
          {(doc.content?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-800">Document Content</h2>
                <div className="flex items-center gap-2">
                  {doc.generated && (
                    <Pill className="bg-purple-100 text-purple-700 text-[11px]">✨ AI-authored</Pill>
                  )}
                  {doc.regulation_ref && (
                    <Pill className="bg-blue-100 text-blue-700 text-[11px]">{doc.regulation_ref}</Pill>
                  )}
                  <DocumentExportButton
                    title={doc.title}
                    category={doc.category}
                    company={company}
                    controlRows={controlRows}
                    sections={bodySections}
                    generatedNote={
                      (doc.source_doc_paths?.length ?? 0) > 0
                        ? `Authored from ${doc.source_doc_paths!.length} uploaded source document(s) + live EHS data.`
                        : undefined
                    }
                  />
                </div>
              </div>
              <div className="space-y-6">
                <DocControlBlock number={1} rows={controlRows} />
                <DocSections sections={bodySections} startNumber={2} />
              </div>
              {(doc.source_doc_paths?.length ?? 0) > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                  Authored from {doc.source_doc_paths!.length} uploaded source document(s) + your live EHS data.
                </div>
              )}
            </div>
          )}

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

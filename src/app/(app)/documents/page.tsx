import Link from "next/link";
import { getDocuments, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { AddDocumentButton } from "./AddDocumentButton";

const CATEGORY_LABEL: Record<string, string> = {
  sop:        "SOP", policy:    "Policy", procedure: "Procedure",
  form:       "Form", permit:   "Permit", msds:      "SDS",
  plan:       "Plan", guideline:"Guideline",
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

function isReviewDue(s: string): boolean {
  return new Date(s) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export default async function DocumentsPage() {
  const docs     = await getDocuments();
  const profiles = await getProfiles();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const current   = docs.filter((d) => d.status === "active").length;
  const draft     = docs.filter((d) => d.status === "draft").length;
  const reviewDue = docs.filter((d) => d.status === "under_review" || (d.status === "active" && isReviewDue(d.review_date))).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Documents & Programs"
        subtitle="SOPs, policies, permits, and EHS program documentation"
        actions={<AddDocumentButton />}
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Documents"  value={docs.length}  hint="All EHS docs"        />
          <Stat label="Current"          value={current}      hint="Active versions"       accent="#10b981" />
          <Stat label="In Draft"         value={draft}        hint="Pending approval"      accent="#2563eb" />
          <Stat label="Review Due"       value={reviewDue}    hint="Within 30 days"        accent={reviewDue > 0 ? "#f59e0b" : "#10b981"} />
        </div>

        {/* Documents table */}
        <Card>
          <CardHeader title="Document Register" subtitle={`${docs.length} documents`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Title</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Version</th>
                  <th className="px-4 py-2.5 text-left">Effective</th>
                  <th className="px-4 py-2.5 text-left">Review</th>
                  <th className="px-4 py-2.5 text-left">Owner</th>
                  <th className="px-4 py-2.5 text-center">Ack. Req.</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docs.map((d) => {
                  const reviewDue_ = isReviewDue(d.review_date);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 max-w-64">
                        <Link href={`/documents/${d.id}`} className="font-medium text-blue-600 hover:underline">
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Pill className="bg-slate-100 text-slate-600 text-xs">
                          {CATEGORY_LABEL[d.category] ?? d.category}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{d.version}</td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(d.effective_date)}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        <span className={reviewDue_ && d.status === "active" ? "font-semibold text-amber-600" : "text-slate-600"}>
                          {fmt(d.review_date)}
                        </span>
                        {reviewDue_ && d.status === "active" && (
                          <div className="text-[10px] text-amber-500 font-medium">Due soon</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {d.owner_id ? (profileMap[d.owner_id] ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.acknowledgment_required ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill className={DOC_STATUS_STYLE[d.status] ?? "bg-slate-100 text-slate-600"}>
                          {d.status.replace(/_/g, " ")}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                      No documents uploaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

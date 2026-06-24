import Link from "next/link";
import { getDocuments, getProfiles, getChemicals, getBiosafetyLabs, getWasteStreams } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { AddDocumentButton } from "./AddDocumentButton";
import { DocumentsExportButton } from "./DocumentsExportButton";
import { DocumentLibrary } from "./DocumentLibrary";
import { ExpirationTracker } from "./ExpirationTracker";
import { DocumentGeneratorButton } from "./DocumentGeneratorButton";
import { ProgramBuilderPanel } from "./ProgramBuilderPanel";
import { requiredPrograms } from "@/lib/ai/programBuilder";
import { DOCUMENT_LIBRARY } from "./libraryTemplates";

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

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const tenantId = await getEffectiveTenantId();
  const { view } = await searchParams;
  const showLibrary = view === "library";
  const showTracker = view === "tracker";

  const [docs, profiles, chemicals, biosafetyLabs, wasteStreams] = await Promise.all([
    getDocuments(tenantId),
    getProfiles(tenantId),
    getChemicals(tenantId),
    getBiosafetyLabs(tenantId),
    getWasteStreams(tenantId),
  ]);

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  // Which EHS programs the company is required to maintain, and whether one exists.
  const existingRefs = new Set(docs.map((d) => d.regulation_ref).filter(Boolean));
  const existingTitles = new Set(docs.map((d) => d.title));
  const programs = requiredPrograms({ chemicals, biosafetyLabs, wasteStreams }).map((p) => ({
    ...p,
    exists: existingRefs.has(p.regulation) || existingTitles.has(p.title),
  }));

  const current   = docs.filter((d) => d.status === "active").length;
  const draft     = docs.filter((d) => d.status === "draft").length;
  const reviewDue = docs.filter((d) => d.status === "under_review" || (d.status === "active" && isReviewDue(d.review_date))).length;
  const needsAck  = docs.filter((d) => d.acknowledgment_required && d.status === "active").length;

  // ── Review urgency ────────────────────────────────────────────────────────
  const nowMs = Date.now();
  function daysUntil(s: string) {
    return Math.ceil((new Date(s).getTime() - nowMs) / 86400000);
  }
  const reviewOverdue = docs.filter((d) => d.status === "active" && daysUntil(d.review_date) < 0).length;
  const reviewIn30    = docs.filter((d) => d.status === "active" && daysUntil(d.review_date) >= 0 && daysUntil(d.review_date) <= 30).length;
  const reviewIn90    = docs.filter((d) => d.status === "active" && daysUntil(d.review_date) > 30 && daysUntil(d.review_date) <= 90).length;

  // Category breakdown
  const byCategory: Record<string, number> = {};
  docs.forEach((d) => { byCategory[d.category] = (byCategory[d.category] ?? 0) + 1; });
  const catRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCat  = Math.max(...catRows.map(([, n]) => n), 1);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Documents & Programs"
        subtitle="SOPs, policies, permits, and EHS program documentation"
        actions={
          <div className="flex gap-2">
            <DocumentsExportButton documents={docs} profiles={profiles} />
            <DocumentGeneratorButton chemicals={chemicals} profiles={profiles} />
            <AddDocumentButton profiles={profiles} />
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Documents"  value={docs.length}  hint="All EHS docs"        />
          <Stat label="Current"          value={current}      hint="Active versions"       accent="#10b981" />
          <Stat label="In Draft"         value={draft}        hint="Pending approval"      accent="#2563eb" />
          <Stat label="Review Due"       value={reviewDue}    hint="Within 30 days"        accent={reviewDue > 0 ? "#f59e0b" : "#10b981"} />
        </div>

        {/* Analytics strip */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Review urgency */}
          <Card>
            <CardHeader title="Review Schedule" subtitle={`${current} active documents`} />
            <div className="px-4 pb-4 space-y-2.5">
              {[
                { label: "Overdue",       count: reviewOverdue, bar: "bg-red-500",     bg: "text-red-600" },
                { label: "Due ≤ 30 days", count: reviewIn30,    bar: "bg-amber-400",   bg: "text-amber-700" },
                { label: "Due ≤ 90 days", count: reviewIn90,    bar: "bg-blue-400",    bg: "text-blue-700" },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <div className="w-24 shrink-0 text-[10.5px] text-slate-500">{r.label}</div>
                  <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${r.bar} transition-all`} style={{ width: `${current > 0 ? Math.max((r.count / current) * 100, r.count > 0 ? 8 : 0) : 0}%` }} />
                  </div>
                  <div className={`w-4 text-xs font-bold text-right ${r.bg}`}>{r.count}</div>
                </div>
              ))}
              {reviewOverdue === 0 && reviewIn30 === 0 && (
                <div className="text-xs text-emerald-600 font-medium mt-1">All reviews on schedule</div>
              )}
            </div>
          </Card>

          {/* Acknowledgment status */}
          <Card>
            <CardHeader title="Acknowledgment Status" subtitle="Documents requiring sign-off" />
            <div className="px-4 pb-4">
              <div className="flex items-end gap-3 mb-3">
                <div className="text-4xl font-black text-purple-600">{needsAck}</div>
                <div className="mb-1 text-xs text-slate-400">of {current} active docs</div>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-2">
                <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${current > 0 ? (needsAck / current) * 100 : 0}%` }} />
              </div>
              <div className="text-[10px] text-slate-400">
                {needsAck > 0 ? `${needsAck} document${needsAck > 1 ? "s" : ""} require team acknowledgment` : "No acknowledgment requirements set"}
              </div>
            </div>
          </Card>

          {/* Category breakdown */}
          <Card>
            <CardHeader title="Documents by Category" subtitle={`${docs.length} total`} />
            <div className="px-4 pb-4 space-y-2">
              {catRows.slice(0, 5).map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className="w-20 shrink-0 text-[10.5px] text-slate-500 dark:text-slate-400">{CATEGORY_LABEL[cat] ?? cat}</div>
                  <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${Math.max((count / maxCat) * 100, 8)}%` }} />
                  </div>
                  <div className="w-4 text-xs font-bold text-slate-700 dark:text-slate-200 text-right">{count}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* AI Program Builder — author required programs from the company's manuals + live data */}
        {!showLibrary && !showTracker && programs.length > 0 && (
          <ProgramBuilderPanel programs={programs} />
        )}

        {/* View tabs */}
        <div className="mb-5 flex gap-0 border-b border-slate-200 dark:border-slate-700">
          <Link
            href="/documents"
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              !showLibrary && !showTracker
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Document Register
          </Link>
          <Link
            href="/documents?view=library"
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              showLibrary
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Document Library
            <span className="ml-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
              {DOCUMENT_LIBRARY.length}
            </span>
          </Link>
          <Link
            href="/documents?view=tracker"
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              showTracker
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Expiration Tracker
            {(() => {
              const now = Date.now();
              const alertCount = docs.filter((d) => d.status === "active" && Math.ceil((new Date(d.review_date).getTime() - now) / 86400000) <= 30).length;
              return alertCount > 0 ? (
                <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                  {alertCount}
                </span>
              ) : null;
            })()}
          </Link>
        </div>

        {showLibrary ? (
          <DocumentLibrary />
        ) : showTracker ? (
          <ExpirationTracker docs={docs} profiles={profiles} />
        ) : (
          <Card>
          <CardHeader title="Document Register" subtitle={`${docs.length} documents`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2.5 text-left">Title</th>
                  <th className="px-4 py-2.5 text-left">Regulation</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Version</th>
                  <th className="px-4 py-2.5 text-left">Effective</th>
                  <th className="px-4 py-2.5 text-left">Review</th>
                  <th className="px-4 py-2.5 text-left">Owner</th>
                  <th className="px-4 py-2.5 text-center">Ack. Req.</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {docs.map((d) => {
                  const reviewDue_ = isReviewDue(d.review_date);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-3 max-w-64">
                        <Link href={`/documents/${d.id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {d.regulation_ref ? (
                          <span className="rounded bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                            {d.regulation_ref}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                          {CATEGORY_LABEL[d.category] ?? d.category}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{d.version}</td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600 dark:text-slate-300">{fmt(d.effective_date)}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        <span className={reviewDue_ && d.status === "active" ? "font-semibold text-amber-600" : "text-slate-600 dark:text-slate-300"}>
                          {fmt(d.review_date)}
                        </span>
                        {reviewDue_ && d.status === "active" && (
                          <div className="text-[10px] text-amber-500 font-medium">Due soon</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
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
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                      No documents uploaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        )}
      </div>
    </div>
  );
}


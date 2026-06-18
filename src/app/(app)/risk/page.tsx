import Link from "next/link";
import { getRiskAssessments, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { RiskLevelBadge } from "@/components/ui/badges";
import type { RiskLevel } from "@/lib/constants";
import { AddRiskButton } from "./AddRiskButton";

function fmt(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function RiskPage() {
  const assessments = await getRiskAssessments();
  const profiles    = await getProfiles();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const extreme = assessments.filter((r) => r.risk_level === "extreme").length;
  const high    = assessments.filter((r) => r.risk_level === "high").length;
  const medium  = assessments.filter((r) => r.risk_level === "medium").length;
  const low     = assessments.filter((r) => r.risk_level === "negligible" || r.risk_level === "low").length;

  const sorted = [...assessments].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Risk Intelligence"
        subtitle="Risk register — likelihood × consequence matrix, AI-powered scoring"
        actions={
          <AddRiskButton />
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Extreme / High Risks" value={extreme + high}  hint="Priority action"     accent={(extreme + high) > 0 ? "#dc2626" : "#10b981"} />
          <Stat label="Medium Risks"          value={medium}          hint="Monitor & action"    accent="#f59e0b" />
          <Stat label="Low / Negligible"       value={low}             hint="Controlled"          accent="#10b981" />
          <Stat label="Total Assessments"      value={assessments.length} hint="In register" />
        </div>

        {/* Alert for extreme risks */}
        {extreme > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-red-700 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-900">
              {extreme} Extreme Risk{extreme > 1 ? "s" : ""} — Stop Work Authority May Apply
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              {assessments
                .filter((r) => r.risk_level === "extreme")
                .map((r) => r.title)
                .join(" · ")}
            </div>
          </div>
        )}

        {/* Risk register table */}
        <Card>
          <CardHeader title="Risk Register" subtitle={`${assessments.length} assessments — sorted by risk score`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Risk</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-center">L</th>
                  <th className="px-4 py-2.5 text-center">C</th>
                  <th className="px-4 py-2.5 text-center">Score</th>
                  <th className="px-4 py-2.5 text-left">Level</th>
                  <th className="px-4 py-2.5 text-left">Owner</th>
                  <th className="px-4 py-2.5 text-left">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 max-w-64">
                      <Link href={`/risk/${r.id}`} className="font-medium text-blue-700 hover:underline">
                        {r.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{r.activity}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-100 text-slate-600 text-xs capitalize">{r.category}</Pill>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{r.likelihood_score}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{r.consequence_score}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                        {r.risk_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskLevelBadge level={r.risk_level as RiskLevel} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.owner_id ? (profileMap[r.owner_id] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                      {fmt(r.review_date)}
                    </td>
                  </tr>
                ))}
                {assessments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                      No risk assessments.
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

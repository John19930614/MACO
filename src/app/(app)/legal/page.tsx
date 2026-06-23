import { getLegalRequirements, getProfiles, getComplianceScores, getAudits, getCapaActions, getEquipment } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Stat, Card, CardHeader } from "@/components/ui/primitives";
import { LegalTable } from "./LegalTable";
import { ComplianceCalendar } from "./ComplianceCalendar";
import { AddLegalButton } from "./AddLegalButton";
import { LegalExportButton } from "./LegalExportButton";

export default async function LegalPage() {
  const tenantId = await getEffectiveTenantId();
  const [requirements, profiles, scores, audits, capas, equipment] = await Promise.all([
    getLegalRequirements(tenantId),
    getProfiles(tenantId),
    getComplianceScores(tenantId),
    getAudits(tenantId),
    getCapaActions(tenantId),
    getEquipment(tenantId),
  ]);
  const legalScore    = scores.find((s) => s.module === "legal");

  const compliant    = requirements.filter((r) => r.status === "compliant").length;
  const gaps         = requirements.filter((r) => r.status === "minor_gap" || r.status === "major_gap").length;
  const nonCompliant = requirements.filter((r) => r.status === "non_compliant").length;

  // ── Analytics ──────────────────────────────────────────────────────────────
  // Compliance breakdown by category
  const byCat: Record<string, { total: number; compliant: number }> = {};
  requirements.forEach((r) => {
    if (!byCat[r.category]) byCat[r.category] = { total: 0, compliant: 0 };
    byCat[r.category].total++;
    if (r.status === "compliant") byCat[r.category].compliant++;
  });
  const catRows = Object.entries(byCat)
    .map(([cat, { total, compliant: comp }]) => ({
      cat,
      total,
      pct: Math.round((comp / total) * 100),
    }))
    .sort((a, b) => a.pct - b.pct); // lowest compliance first

  // Compliance by jurisdiction
  const byJuris: Record<string, number> = {};
  requirements.forEach((r) => { byJuris[r.jurisdiction] = (byJuris[r.jurisdiction] ?? 0) + 1; });
  const jurisRows = Object.entries(byJuris).sort((a, b) => b[1] - a[1]);

  // CAPA linkage for legal requirements
  const capasByReq: Record<string, number> = {};
  capas.forEach((c) => {
    if (c.source_type === "legal_requirement" && c.source_id) {
      capasByReq[c.source_id] = (capasByReq[c.source_id] ?? 0) + 1;
    }
  });
  const reqsWithCapas = Object.keys(capasByReq).length;

  // Status distribution (donut data)
  const statusCounts = [
    { label: "Compliant",    count: compliant,    cls: "bg-emerald-500" },
    { label: "Minor Gap",    count: requirements.filter(r => r.status === "minor_gap").length,   cls: "bg-amber-400" },
    { label: "Major Gap",    count: requirements.filter(r => r.status === "major_gap").length,   cls: "bg-orange-500" },
    { label: "Non-Compliant", count: nonCompliant, cls: "bg-red-600" },
    { label: "N/A",          count: requirements.filter(r => r.status === "not_applicable").length, cls: "bg-slate-300" },
  ].filter(s => s.count > 0);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Legal Register"
        subtitle="Regulatory obligations, owners, evidence, and review schedule"
        actions={
          <div className="flex gap-2">
            <LegalExportButton requirements={requirements} profiles={profiles} />
            <AddLegalButton />
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Total Requirements"
            value={requirements.length}
            hint={legalScore ? `${legalScore.percentage}% module compliance` : "All tracked obligations"}
          />
          <Stat
            label="Compliant"
            value={compliant}
            hint="Obligations met"
            accent="#10b981"
          />
          <Stat
            label="Gaps (Minor + Major)"
            value={gaps}
            hint="Require attention"
            accent="#f59e0b"
          />
          <Stat
            label="Non-Compliant"
            value={nonCompliant}
            hint="Immediate action needed"
            accent={nonCompliant > 0 ? "#dc2626" : "#10b981"}
          />
        </div>

        {/* Non-compliant alert */}
        {nonCompliant > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-900">
              {nonCompliant} Non-Compliant Obligation{nonCompliant > 1 ? "s" : ""} — Immediate Action Required
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              Review the requirements marked Non-Compliant below and create CAPA actions to resolve.
            </div>
          </div>
        )}

        {/* Analytics strip */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Compliance by category */}
          <Card>
            <CardHeader title="Compliance by Category" subtitle="Lowest scores shown first" />
            <div className="px-4 pb-4 space-y-2">
              {catRows.slice(0, 5).map((r) => (
                <div key={r.cat} className="flex items-center gap-2">
                  <div className="w-28 shrink-0 text-[10px] capitalize text-slate-500 dark:text-slate-400 truncate">
                    {r.cat.replace(/_/g, " ")}
                  </div>
                  <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${r.pct >= 80 ? "bg-emerald-400" : r.pct >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                      style={{ width: `${Math.max(r.pct, r.total > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                  <div className={`w-9 text-xs font-bold text-right ${r.pct >= 80 ? "text-emerald-700 dark:text-emerald-400" : r.pct >= 50 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}`}>
                    {r.pct}%
                  </div>
                </div>
              ))}
              {catRows.length === 0 && <div className="text-xs text-slate-400">No requirements.</div>}
            </div>
          </Card>

          {/* Status distribution */}
          <Card>
            <CardHeader title="Status Distribution" subtitle={`${requirements.length} total requirements`} />
            <div className="px-4 pb-4 space-y-2">
              {statusCounts.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.cls}`} />
                  <div className="flex-1 text-xs text-slate-600 dark:text-slate-300">{s.label}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{s.count}</div>
                  <div className="text-[10px] text-slate-400 w-8 text-right">
                    {Math.round((s.count / requirements.length) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Jurisdiction + CAPA linkage */}
          <Card>
            <CardHeader title="By Jurisdiction" subtitle={`${reqsWithCapas} reqs with linked CAPAs`} />
            <div className="px-4 pb-4 space-y-2 mb-3">
              {jurisRows.map(([jur, count]) => (
                <div key={jur} className="flex items-center gap-2">
                  <div className="w-20 shrink-0 text-[10.5px] capitalize text-slate-500 dark:text-slate-400">{jur.replace(/_/g, " ")}</div>
                  <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all"
                      style={{ width: `${Math.max((count / requirements.length) * 100, 8)}%` }}
                    />
                  </div>
                  <div className="w-4 text-xs font-bold text-slate-700 dark:text-slate-200 text-right">{count}</div>
                </div>
              ))}
            </div>
            {reqsWithCapas > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-700 px-4 pt-2.5">
                <div className="text-[10px] text-slate-400">
                  {reqsWithCapas} obligation{reqsWithCapas > 1 ? "s" : ""} have linked CAPA actions for remediation.
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Compliance Calendar */}
        <Card className="mb-5">
          <CardHeader
            title="Compliance Calendar"
            subtitle="Upcoming review dates, audits, CAPA deadlines, and equipment calibrations — next 90 days"
          />
          <ComplianceCalendar
            requirements={requirements}
            audits={audits}
            capas={capas}
            equipment={equipment}
          />
        </Card>

        {/* Requirements table */}
        <Card>
          <CardHeader
            title="Regulatory Requirements"
            subtitle={`${requirements.length} total · ${compliant} compliant · ${gaps} gaps · ${nonCompliant} non-compliant`}
          />
          <LegalTable requirements={requirements} profiles={profiles} />
        </Card>
      </div>
    </div>
  );
}


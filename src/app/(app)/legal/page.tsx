import { getLegalRequirements, getProfiles, getComplianceScores, getAudits, getCapaActions, getEquipment } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader } from "@/components/ui/primitives";
import { LegalTable } from "./LegalTable";
import { ComplianceCalendar } from "./ComplianceCalendar";
import { AddLegalButton } from "./AddLegalButton";

export default async function LegalPage() {
  const [requirements, profiles, scores, audits, capas, equipment] = await Promise.all([
    getLegalRequirements(),
    getProfiles(),
    getComplianceScores(),
    getAudits(),
    getCapaActions(),
    getEquipment(),
  ]);
  const legalScore    = scores.find((s) => s.module === "legal");

  const compliant    = requirements.filter((r) => r.status === "compliant").length;
  const gaps         = requirements.filter((r) => r.status === "minor_gap" || r.status === "major_gap").length;
  const nonCompliant = requirements.filter((r) => r.status === "non_compliant").length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Legal Register"
        subtitle="Regulatory obligations, owners, evidence, and review schedule"
        actions={<AddLegalButton />}
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

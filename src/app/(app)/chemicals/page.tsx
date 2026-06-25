import { getChemicals, getTrainingCourses, getSdsDocuments } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { FlaskConical } from "lucide-react";
import { AddChemicalButton } from "./AddChemicalButton";
import { ChemicalExportButton } from "./ChemicalExportButton";
import { ChemicalsDashboard } from "./ChemicalsDashboard";
import { SdsUploadButton } from "./SdsUploadButton";
import { SdsQueue } from "./SdsQueue";

export const maxDuration = 60;

function sdsStatus(c: { sds_url: string | null; sds_expiry: string | null }): "on_file" | "expiring" | "expired" | "missing" {
  if (!c.sds_url) return "missing";
  if (!c.sds_expiry) return "on_file";
  const exp = new Date(c.sds_expiry);
  const now = new Date();
  if (exp < now) return "expired";
  if (exp.getTime() - now.getTime() < 90 * 24 * 60 * 60 * 1000) return "expiring";
  return "on_file";
}

// GHS hazard class grouping from H-statement codes
function hazardClassLabel(h: string): string | null {
  if (/^H2[2-6]/.test(h)) return "Flammable";
  if (/^H271/.test(h) || /^H272/.test(h)) return "Oxidizing";
  if (/^H(300|301|310|311|330|331)/.test(h)) return "Acute Toxic";
  if (/^H(302|312|332)/.test(h)) return "Harmful";
  if (/^H314/.test(h)) return "Corrosive";
  if (/^H(315|317|318|319)/.test(h)) return "Irritant";
  if (/^H(334|335)/.test(h)) return "Resp. Sensitizer";
  if (/^H(340|341)/.test(h)) return "Mutagen";
  if (/^H(350|351)/.test(h)) return "Carcinogen";
  if (/^H(360|361)/.test(h)) return "Repro. Hazard";
  if (/^H(370|371|372|373)/.test(h)) return "Organ Toxin";
  if (/^H(280|281)/.test(h)) return "Cryogenic / Gas";
  if (/^H290/.test(h)) return "Water Reactive";
  if (/^H4/.test(h)) return "Environmental";
  return null;
}

export default async function ChemicalsPage() {
  const tenantId = await getEffectiveTenantId();
  const [chemicals, courses, sdsDocs] = await Promise.all([
    getChemicals(tenantId),
    getTrainingCourses(tenantId),
    getSdsDocuments(tenantId),
  ]);

  const active = chemicals.filter((c) => c.status === "active");

  // ── Analytics ────────────────────────────────────────────────────────────────

  // Hazard class distribution across all hazard_statements
  const hazardCounts: Record<string, number> = {};
  for (const chem of active) {
    const seen = new Set<string>();
    for (const h of chem.hazard_statements) {
      const label = hazardClassLabel(h);
      if (label && !seen.has(label)) {
        seen.add(label);
        hazardCounts[label] = (hazardCounts[label] ?? 0) + 1;
      }
    }
  }
  const hazardRows = Object.entries(hazardCounts).sort((a, b) => b[1] - a[1]);
  const maxHazard = Math.max(...hazardRows.map((r) => r[1]), 1);

  // SDS coverage breakdown
  const sdsBuckets = [
    { label: "Missing",         count: active.filter((c) => sdsStatus(c) === "missing").length,  cls: "bg-red-500",     txt: "text-red-700" },
    { label: "Expired",         count: active.filter((c) => sdsStatus(c) === "expired").length,  cls: "bg-orange-500",  txt: "text-orange-700" },
    { label: "Expiring < 90d",  count: active.filter((c) => sdsStatus(c) === "expiring").length, cls: "bg-amber-400",   txt: "text-amber-700" },
    { label: "Current",         count: active.filter((c) => sdsStatus(c) === "on_file").length,  cls: "bg-emerald-400", txt: "text-emerald-700" },
  ];
  const totalSds = active.length;
  const sdsOk = sdsBuckets.find((b) => b.label === "Current")?.count ?? 0;
  const sdsCovPct = totalSds > 0 ? Math.round((sdsOk / totalSds) * 100) : 0;

  // Scheduled / controlled substances
  const scheduled = active.filter((c) => c.is_scheduled);
  const schedByRef: Record<string, number> = {};
  for (const c of scheduled) {
    const ref = c.schedule_ref ?? "Scheduled (unspecified)";
    schedByRef[ref] = (schedByRef[ref] ?? 0) + 1;
  }
  const schedRows = Object.entries(schedByRef).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Chemical Management"
        subtitle="Chemical inventory · SDS library · Hazard class mapping · Storage compatibility · AI high-hazard flags · PPE &amp; exposure controls"
        actions={
          <div className="flex gap-2">
            <ChemicalExportButton chemicals={chemicals} />
            <SdsUploadButton />
            <AddChemicalButton />
          </div>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <SdsQueue docs={sdsDocs} />

        {chemicals.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="h-6 w-6" />}
            title="No chemicals in your inventory yet"
            description="Add your first chemical with the button above, or upload an SDS PDF to auto-populate the record using AI extraction."
          />
        ) : (
          <>

        {/* Analytics strip */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Hazard class breakdown */}
          <Card>
            <CardHeader title="Hazard Class Breakdown" subtitle={`${active.length} active chemicals · GHS classes`} />
            <div className="space-y-2 px-4 pb-4">
              {hazardRows.slice(0, 7).map(([label, count]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-28 shrink-0 truncate text-[10px] text-slate-500">{label}</div>
                  <div className="flex-1 h-3.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-rose-400 transition-all"
                      style={{ width: `${Math.max((count / maxHazard) * 100, 8)}%` }}
                    />
                  </div>
                  <div className="w-5 text-right text-xs font-bold text-slate-700">{count}</div>
                </div>
              ))}
              {hazardRows.length === 0 && <div className="text-xs text-slate-400">No hazard statements recorded.</div>}
            </div>
          </Card>

          {/* SDS coverage */}
          <Card>
            <CardHeader title="SDS Coverage" subtitle="Safety Data Sheet filing status" />
            <div className="px-4 pb-4">
              <div className="mb-3 text-center">
                <span className={`text-3xl font-bold ${sdsCovPct >= 80 ? "text-emerald-600" : sdsCovPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {sdsCovPct}%
                </span>
                <span className="ml-1 text-[10px] text-slate-400">current</span>
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${sdsCovPct >= 80 ? "bg-emerald-400" : sdsCovPct >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                  style={{ width: `${sdsCovPct}%` }}
                />
              </div>
              <div className="space-y-1.5">
                {sdsBuckets.filter((b) => b.count > 0).map((b) => (
                  <div key={b.label} className="flex items-center gap-2">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${b.cls}`} />
                    <div className="flex-1 text-xs text-slate-600">{b.label}</div>
                    <div className={`text-xs font-bold ${b.txt}`}>{b.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Scheduled / controlled substances */}
          <Card>
            <CardHeader
              title="Scheduled Substances"
              subtitle={scheduled.length > 0 ? `${scheduled.length} controlled chemical${scheduled.length !== 1 ? "s" : ""} in inventory` : "No scheduled substances"}
            />
            <div className="px-4 pb-4">
              {scheduled.length > 0 ? (
                <div className="space-y-2">
                  {schedRows.slice(0, 5).map(([ref, count]) => (
                    <div key={ref} className="flex items-start gap-2">
                      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                      <div className="flex-1 text-[10px] text-slate-600 leading-tight">{ref}</div>
                      <div className="text-xs font-bold text-violet-700">{count}</div>
                    </div>
                  ))}
                  <div className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-[10px] text-violet-700">
                    Regulated substances require enhanced controls, additional SDS, and regulatory reporting.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">0</div>
                  <div className="text-[10px] text-slate-400">No scheduled substances in active inventory</div>
                </div>
              )}
            </div>
          </Card>

        </div>

        <ChemicalsDashboard chemicals={chemicals} courses={courses} />
          </>
        )}
      </div>
    </div>
  );
}


import Link from "next/link";
import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { QuickReportsPanel } from "./QuickReportsPanel";
import { ReportsHeaderActions } from "./ReportsHeaderActions";
import { SavedReportsPanel } from "./SavedReportsPanel";
import {
  getCapaActions, getIncidents, getTrainingRecords, getTrainingCourses,
  getLegalRequirements, getDocuments, getBiosafetyLabs, getEquipment,
  getWasteStreams, getAuditFindings, getChemicals, getProfiles,
  getOshaCases, getRiskAssessments, getComplianceScores,
} from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID, MOCK_TENANTS_ALL } from "@/lib/data/mock";

const TREND_BASELINE = [
  { month: "Jan", score: 71 },
  { month: "Feb", score: 74 },
  { month: "Mar", score: 73 },
  { month: "Apr", score: 78 },
  { month: "May", score: 82 },
];

function scoreColor(s: number) {
  if (s >= 85) return "text-emerald-600";
  if (s >= 70) return "text-amber-600";
  return "text-red-600";
}
function scoreBar(s: number) {
  if (s >= 85) return "bg-emerald-500";
  if (s >= 70) return "bg-amber-500";
  return "bg-red-500";
}
function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")   return <TrendingUp   className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-slate-100 text-slate-600",
};
const RISK_STYLE: Record<string, string> = {
  extreme:    "bg-red-100 text-red-700",
  high:       "bg-orange-100 text-orange-700",
  medium:     "bg-amber-100 text-amber-700",
  low:        "bg-green-100 text-green-700",
  negligible: "bg-slate-100 text-slate-500",
};
const COMPLIANCE_STYLE: Record<string, string> = {
  compliant:       "bg-emerald-100 text-emerald-700",
  minor_gap:       "bg-amber-100 text-amber-700",
  major_gap:       "bg-orange-100 text-orange-700",
  non_compliant:   "bg-red-100 text-red-700",
  not_applicable:  "bg-slate-100 text-slate-400",
};

const TABS = [
  { key: "executive",  label: "Executive"       },
  { key: "compliance", label: "Compliance"      },
  { key: "risk",       label: "Risk & CAPA"     },
  { key: "training",   label: "Training"        },
  { key: "chemical",   label: "Chemical / Waste"},
  { key: "audit",      label: "Audit"           },
  { key: "export",     label: "Export"          },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const tenantId = await getEffectiveTenantId();
  const tenantName = MOCK_TENANTS_ALL.find((t) => t.id === tenantId)?.name ?? "Your Company";
  const { view } = await searchParams;
  const tab = view ?? "executive";

  const [capas, incidents, trainingRecs, courses, legal, docs, labs, equipment, waste, auditFindings, chemicals, profiles, oshaCases, riskItems, complianceScores] =
    await Promise.all([
      getCapaActions(tenantId),
      getIncidents(tenantId),
      getTrainingRecords(tenantId),
      getTrainingCourses(tenantId),
      getLegalRequirements(tenantId),
      getDocuments(tenantId),
      getBiosafetyLabs(tenantId),
      getEquipment(tenantId),
      getWasteStreams(tenantId),
      getAuditFindings(tenantId),
      getChemicals(tenantId),
      getProfiles(tenantId),
      getOshaCases(tenantId),
      getRiskAssessments(tenantId),
      getComplianceScores(tenantId),
    ]);

  const courseMap  = Object.fromEntries(courses.map((c) => [c.id, c.title]));
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  function latestDate(dates: (string | null | undefined)[]): string {
    const valid = dates.filter(Boolean) as string[];
    if (!valid.length) return new Date().toISOString().slice(0, 10);
    return valid.sort((a, b) => b.localeCompare(a))[0].slice(0, 10);
  }
  const today = new Date().toISOString().slice(0, 10);
  const lastIncidentDate  = latestDate(incidents.map((i) => i.occurred_at));
  const lastCapaDate      = latestDate(capas.map((c) => c.created_at));
  const lastTrainingDate  = latestDate(trainingRecs.map((r) => r.created_at));
  const lastChemicalDate  = latestDate(chemicals.map((c) => c.updated_at));

  const SAVED_REPORTS = [
    { name: "Q2 2026 EHS Compliance Summary",    type: "Compliance", generated: today,           pages: 12 },
    { name: "Chemical Inventory Audit Report",    type: "Chemical",   generated: lastChemicalDate, pages: 8  },
    { name: "CAPA Aging Analysis — June",         type: "CAPA",       generated: lastCapaDate,     pages: 5  },
    { name: "Training Completion Rate — H1 2026", type: "Training",   generated: lastTrainingDate, pages: 6  },
    { name: "Incident Root Cause Analysis Q2",    type: "Incidents",  generated: lastIncidentDate, pages: 9  },
  ];

  const scoreByModule = Object.fromEntries(complianceScores.map((s) => [s.module, s.percentage]));
  function liveScore(key: string, fallback: number) { return scoreByModule[key] ?? fallback; }

  const now = new Date();
  const openCapas    = capas.filter((c) => c.status === "open" || c.status === "in_progress").length;
  const overdueCapas = capas.filter((c) => c.due_date && new Date(c.due_date) < now && !["closed","pending_verification"].includes(c.status)).length;
  const incidentsYtd = incidents.filter((i) => new Date(i.occurred_at).getFullYear() === 2026).length;
  const passedRecs   = trainingRecs.filter((r) => r.passed).length;
  const totalCourses = courses.length;
  const trainingPct  = trainingRecs.length > 0 ? Math.round((passedRecs / trainingRecs.length) * 100) : 0;

  const MODULE_SCORES = [
    { module: "Chemical Management",    score: liveScore("chemical",   91), trend: "up",   delta: "+4",  openIssues: chemicals.filter((c) => !c.sds_url).length,              issueLabel: "missing SDS"   },
    { module: "Training & Competency",  score: liveScore("training",   88), trend: "up",   delta: "+6",  openIssues: Math.max(0, totalCourses - passedRecs),                  issueLabel: "courses uncovered" },
    { module: "Audits & Assessments",   score: liveScore("audits",     83), trend: "up",   delta: "+2",  openIssues: auditFindings.filter((f) => f.status === "open" || f.status === "in_progress").length, issueLabel: "open findings" },
    { module: "Biosafety & Lab Safety", score: liveScore("biosafety",  82), trend: "up",   delta: "+1",  openIssues: labs.filter((l) => l.status !== "compliant").length,      issueLabel: "non-compliant labs" },
    { module: "CAPA Management",        score: liveScore("capa",       79), trend: "up",   delta: "+3",  openIssues: openCapas,                                                issueLabel: "open CAPAs"    },
    { module: "Legal & Compliance",     score: liveScore("legal",      76), trend: "down", delta: "−2",  openIssues: legal.filter((l) => l.status !== "compliant" && l.status !== "not_applicable").length, issueLabel: "gaps" },
    { module: "Documents & Programs",   score: liveScore("documents",  85), trend: "flat", delta: "0",   openIssues: docs.filter((d) => d.status !== "active").length,         issueLabel: "inactive"      },
    { module: "Waste Management",       score: liveScore("waste",      74), trend: "up",   delta: "+5",  openIssues: waste.filter((w) => w.status === "pending").length,       issueLabel: "pending disposal" },
    { module: "Monitoring & Equipment", score: liveScore("equipment",  69), trend: "down", delta: "−4",  openIssues: equipment.filter((e) => e.status !== "operational").length, issueLabel: "not operational" },
    { module: "Ergonomics & MSD",       score: liveScore("ergonomics", 65), trend: "up",   delta: "+2",  openIssues: 3,                                                        issueLabel: "MSD risk assessments pending" },
    { module: "OSHA Recordkeeping",     score: liveScore("osha",       78), trend: "flat", delta: "0",   openIssues: oshaCases.filter((c) => c.date.startsWith("2026")).length, issueLabel: "recordable cases YTD" },
    { module: "Risk Intelligence",      score: liveScore("risk",       72), trend: "up",   delta: "+3",  openIssues: riskItems.filter((r) => r.risk_level === "high" || r.risk_level === "extreme").length, issueLabel: "high/extreme risks open" },
    { module: "Incident Management",    score: liveScore("incidents",  80), trend: "up",   delta: "+5",  openIssues: incidents.filter((i) => i.status === "reported" || i.status === "under_investigation").length, issueLabel: "incidents under investigation" },
  ];

  const overallScore = Math.round(MODULE_SCORES.reduce((s, m) => s + m.score, 0) / MODULE_SCORES.length);

  const currentMonth = new Date().toLocaleString("en-US", { month: "short" });
  const COMPLIANCE_TREND = [
    ...TREND_BASELINE,
    { month: currentMonth, score: overallScore },
  ];

  const MODULE_LINKS: Record<string, string> = {
    "Chemical Management":    "/chemicals",
    "Training & Competency":  "/training",
    "Audits & Assessments":   "/audits",
    "Biosafety & Lab Safety": "/biosafety",
    "CAPA Management":        "/capa",
    "Legal & Compliance":     "/legal",
    "Documents & Programs":   "/documents",
    "Waste Management":       "/waste",
    "Monitoring & Equipment": "/monitoring",
    "Ergonomics & MSD":       "/ergonomics",
    "OSHA Recordkeeping":     "/osha",
    "Risk Intelligence":      "/risk",
    "Incident Management":    "/incidents",
  };

  const minS = Math.min(...COMPLIANCE_TREND.map((t) => t.score));
  const maxS = Math.max(...COMPLIANCE_TREND.map((t) => t.score));
  const cW = 280, cH = 80, pX = 30, pY = 10;
  const iH = cH - pY * 2, iW = cW - pX * 2;
  const pts = COMPLIANCE_TREND.map((d, i) => {
    const x = pX + (i / (COMPLIANCE_TREND.length - 1)) * iW;
    const y = pY + (1 - (d.score - minS + 5) / (maxS - minS + 10)) * iH;
    return [x, y] as [number, number];
  });

  const printDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Tab-specific derived data ──────────────────────────────────────────────

  // Compliance tab
  const legalByStatus = {
    compliant:     legal.filter((l) => l.status === "compliant").length,
    minor_gap:     legal.filter((l) => l.status === "minor_gap").length,
    major_gap:     legal.filter((l) => l.status === "major_gap").length,
    non_compliant: legal.filter((l) => l.status === "non_compliant").length,
    not_applicable:legal.filter((l) => l.status === "not_applicable").length,
  };
  const legalGaps = legal.filter((l) => l.status === "non_compliant" || l.status === "major_gap" || l.status === "minor_gap");

  // Risk tab
  const riskByLevel = {
    extreme:    riskItems.filter((r) => r.risk_level === "extreme").length,
    high:       riskItems.filter((r) => r.risk_level === "high").length,
    medium:     riskItems.filter((r) => r.risk_level === "medium").length,
    low:        riskItems.filter((r) => r.risk_level === "low").length,
    negligible: riskItems.filter((r) => r.risk_level === "negligible").length,
  };
  const openCapaList = capas
    .filter((c) => c.status === "open" || c.status === "in_progress")
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    })
    .slice(0, 10);

  // Training tab
  const expiringRecs = trainingRecs.filter((r) => {
    if (!r.expiry_date) return false;
    const d = Math.ceil((new Date(r.expiry_date).getTime() - now.getTime()) / 86400000);
    return d >= 0 && d <= 30;
  });
  const courseCompletion = courses.map((c) => {
    const recs = trainingRecs.filter((r) => r.course_id === c.id);
    const passed = recs.filter((r) => r.passed).length;
    return { course: c.title, total: recs.length, passed, pct: recs.length > 0 ? Math.round((passed / recs.length) * 100) : 0 };
  }).sort((a, b) => a.pct - b.pct);

  // Chemical/Waste tab
  const hazardClassCounts: Record<string, number> = {};
  chemicals.forEach((c) => {
    const cls = c.ghs_classes[0] ?? "Unclassified";
    hazardClassCounts[cls] = (hazardClassCounts[cls] ?? 0) + 1;
  });
  const hazardRows = Object.entries(hazardClassCounts).sort((a, b) => b[1] - a[1]);
  const maxHazard = Math.max(...hazardRows.map(([, n]) => n), 1);
  const missingSds = chemicals.filter((c) => !c.sds_url);
  const wasteByStatus = {
    pending:        waste.filter((w) => w.status === "pending").length,
    pending_pickup: waste.filter((w) => w.status === "pending_pickup").length,
    accumulating:   waste.filter((w) => w.status === "accumulating").length,
    manifested:     waste.filter((w) => w.status === "manifested").length,
    disposed:       waste.filter((w) => w.status === "disposed").length,
  };

  // Audit tab
  const findingsBySeverity = {
    critical: auditFindings.filter((f) => f.severity === "critical").length,
    high:     auditFindings.filter((f) => f.severity === "high").length,
    medium:   auditFindings.filter((f) => f.severity === "medium").length,
    low:      auditFindings.filter((f) => f.severity === "low").length,
  };
  const openFindings   = auditFindings.filter((f) => f.status === "open" || f.status === "in_progress");
  const closedFindings = auditFindings.filter((f) => f.status === "closed");
  const recentFindings = auditFindings
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="print-only mb-6 border-b-2 border-slate-800 pb-3">
        <div className="text-xl font-extrabold text-slate-900">{tenantName} — EHS Compliance Report</div>
        <div className="text-sm text-slate-500">SafetyIQ · Generated {printDate} · Reliance Predictive Safety Technologies</div>
      </div>

      <PageHeader
        title="Reports & Analytics"
        subtitle="Compliance trends, module scorecards, and downloadable EHS reports"
        actions={
          <ReportsHeaderActions
            capas={capas}
            incidents={incidents}
            trainingRecs={trainingRecs}
            legal={legal}
            chemicals={chemicals}
            moduleScores={MODULE_SCORES}
            overallScore={overallScore}
          />
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto">
        {/* Tab nav */}
        <div className="flex gap-0 border-b border-slate-200 px-5 pt-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "executive" ? "/reports" : `/reports?view=${t.key}`}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="p-5">

          {/* ── EXECUTIVE ─────────────────────────────────────────────────── */}
          {tab === "executive" && (
            <>
              <div className="mb-5 grid grid-cols-4 gap-4">
                {[
                  { label: "Overall Compliance",  value: `${overallScore}%`, sub: "Avg of module assessments",                    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
                  { label: "Open CAPAs",          value: String(openCapas),  sub: overdueCapas > 0 ? `${overdueCapas} overdue` : "None overdue", color: "text-orange-700", bg: "bg-orange-50 border-orange-100" },
                  { label: "Incidents YTD",       value: String(incidentsYtd), sub: "Calendar year 2026",                         color: "text-blue-700",    bg: "bg-blue-50 border-blue-100" },
                  { label: "Training Records",    value: `${trainingPct}%`,  sub: `${passedRecs} of ${trainingRecs.length} records passed`, color: "text-purple-700", bg: "bg-purple-50 border-purple-100" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
                    <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 flex flex-col gap-5">
                  <Card>
                    <CardHeader
                      title="Compliance Score Trend"
                      subtitle="Overall EHS compliance — last 6 months"
                      right={<Pill className="bg-emerald-100 text-emerald-700">▲ +15 pts YTD</Pill>}
                    />
                    <div className="px-4 py-4">
                      <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full overflow-visible" style={{ height: "100px" }}>
                        <defs>
                          <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                          </linearGradient>
                        </defs>
                        {[60, 70, 80, 90].map((v) => {
                          const y = pY + (1 - (v - minS + 5) / (maxS - minS + 10)) * iH;
                          return (
                            <g key={v}>
                              <line x1={pX} y1={y} x2={pX + iW} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
                              <text x={pX - 4} y={y + 3} textAnchor="end" fontSize="7" fill="#94a3b8">{v}</text>
                            </g>
                          );
                        })}
                        <polygon
                          points={`${pX},${pY + iH} ${pts.map(([x, y]) => `${x},${y}`).join(" ")} ${pX + iW},${pY + iH}`}
                          fill="url(#cg2)"
                        />
                        <polyline
                          points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
                          fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"
                        />
                        {COMPLIANCE_TREND.map((d, i) => {
                          const [x, y] = pts[i];
                          return (
                            <g key={d.month}>
                              <circle cx={x} cy={y} r="3" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
                              <text x={x} y={y - 6} textAnchor="middle" fontSize="8" fontWeight="600" fill="#1e40af">{d.score}%</text>
                              <text x={x} y={cH - 2} textAnchor="middle" fontSize="7" fill="#94a3b8">{d.month}</text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader
                      title="Module Compliance Scorecards"
                      subtitle="Assessment score by EHS module — live open issues shown"
                      right={<BarChart3 className="h-4 w-4 text-slate-400" />}
                    />
                    <div className="divide-y divide-slate-50">
                      {MODULE_SCORES.sort((a, b) => b.score - a.score).map((mod) => (
                        <Link
                          key={mod.module}
                          href={MODULE_LINKS[mod.module] ?? "#"}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="w-44 shrink-0">
                            <div className="text-xs font-medium text-slate-700 group-hover:text-blue-700 transition-colors">{mod.module}</div>
                            {mod.openIssues > 0 ? (
                              <div className="text-[10px] text-amber-600 font-medium">{mod.openIssues} {mod.issueLabel}</div>
                            ) : (
                              <div className="text-[10px] text-emerald-600 font-medium">No open issues</div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="h-2 w-full rounded-full bg-slate-100">
                              <div className={`h-2 rounded-full ${scoreBar(mod.score)}`} style={{ width: `${mod.score}%` }} />
                            </div>
                          </div>
                          <div className={`w-10 text-right text-sm font-bold ${scoreColor(mod.score)}`}>{mod.score}%</div>
                          <div className="flex w-12 items-center justify-end gap-0.5">
                            <TrendIcon trend={mod.trend} />
                            <span className={`text-[11px] font-semibold ${mod.trend === "up" ? "text-emerald-600" : mod.trend === "down" ? "text-red-500" : "text-slate-400"}`}>{mod.delta}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="flex flex-col gap-5">
                  <Card>
                    <CardHeader title="Live Data Summary" subtitle="Current counts across modules" />
                    <div className="p-4 space-y-2">
                      {[
                        { label: "Total Chemicals",    value: chemicals.length },
                        { label: "Legal Requirements", value: legal.length },
                        { label: "CAPA Records",       value: capas.length },
                        { label: "Training Records",   value: trainingRecs.length },
                        { label: "Incidents on File",  value: incidents.length },
                        { label: "Registered Labs",    value: labs.length },
                        { label: "Equipment Units",    value: equipment.length },
                        { label: "Waste Streams",      value: waste.length },
                        { label: "Audit Findings",     value: auditFindings.length },
                        { label: "Risk Assessments",   value: riskItems.length },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{item.label}</span>
                          <span className="font-semibold text-slate-800">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* ── COMPLIANCE ────────────────────────────────────────────────── */}
          {tab === "compliance" && (
            <>
              <div className="mb-5 grid grid-cols-4 gap-4">
                {[
                  { label: "Overall Compliance", value: `${overallScore}%`, sub: "Avg of 13 modules", color: overallScore >= 85 ? "text-emerald-700" : overallScore >= 70 ? "text-amber-700" : "text-red-700", bg: "bg-slate-50 border-slate-200" },
                  { label: "Legal Compliant",    value: String(legalByStatus.compliant), sub: `of ${legal.length} requirements`, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
                  { label: "Compliance Gaps",    value: String(legalGaps.length), sub: "Non-compliant + gaps", color: legalGaps.length > 0 ? "text-red-700" : "text-emerald-700", bg: legalGaps.length > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100" },
                  { label: "Documents Current",  value: String(docs.filter((d) => d.status === "active").length), sub: `of ${docs.length} total docs`, color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
                    <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2">
                  <Card>
                    <CardHeader title="Legal Requirements — Gap Summary" subtitle="Requirements with compliance gaps, sorted by severity" />
                    {legalGaps.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-emerald-600 font-medium">All legal requirements are compliant</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                              <th className="px-4 py-2.5 text-left">Requirement</th>
                              <th className="px-4 py-2.5 text-left">Regulation</th>
                              <th className="px-4 py-2.5 text-left">Category</th>
                              <th className="px-4 py-2.5 text-left">Status</th>
                              <th className="px-4 py-2.5 text-left">Next Review</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {legalGaps.slice(0, 15).map((l) => (
                              <tr key={l.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <Link href={`/legal/${l.id}`} className="text-xs font-medium text-blue-600 hover:underline line-clamp-2">{l.title}</Link>
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-slate-500">{l.regulation_ref}</td>
                                <td className="px-4 py-3">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 capitalize">{l.category}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${COMPLIANCE_STYLE[l.status] ?? "bg-slate-100 text-slate-600"}`}>
                                    {l.status.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(l.next_review_date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>

                <div className="flex flex-col gap-5">
                  <Card>
                    <CardHeader title="Requirements by Status" subtitle={`${legal.length} total requirements`} />
                    <div className="p-4 space-y-3">
                      {[
                        { label: "Compliant",      count: legalByStatus.compliant,     bar: "bg-emerald-500", text: "text-emerald-700" },
                        { label: "Minor Gap",       count: legalByStatus.minor_gap,     bar: "bg-amber-400",   text: "text-amber-700" },
                        { label: "Major Gap",       count: legalByStatus.major_gap,     bar: "bg-orange-500",  text: "text-orange-700" },
                        { label: "Non-Compliant",   count: legalByStatus.non_compliant, bar: "bg-red-500",     text: "text-red-700" },
                        { label: "Not Applicable",  count: legalByStatus.not_applicable,bar: "bg-slate-300",   text: "text-slate-500" },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center gap-2">
                          <div className="w-28 shrink-0 text-[11px] text-slate-500">{r.label}</div>
                          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${legal.length > 0 ? Math.max((r.count / legal.length) * 100, r.count > 0 ? 6 : 0) : 0}%` }} />
                          </div>
                          <div className={`w-5 text-xs font-bold text-right ${r.text}`}>{r.count}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="Module Scores" subtitle="Compliance by area" />
                    <div className="divide-y divide-slate-50">
                      {MODULE_SCORES.sort((a, b) => a.score - b.score).slice(0, 6).map((mod) => (
                        <Link key={mod.module} href={MODULE_LINKS[mod.module] ?? "#"} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 group">
                          <div className="flex-1 text-xs text-slate-600 group-hover:text-blue-600">{mod.module}</div>
                          <div className={`text-xs font-bold ${scoreColor(mod.score)}`}>{mod.score}%</div>
                        </Link>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* ── RISK & CAPA ───────────────────────────────────────────────── */}
          {tab === "risk" && (
            <>
              <div className="mb-5 grid grid-cols-4 gap-4">
                {[
                  { label: "Open CAPAs",         value: String(openCapas),    sub: `${overdueCapas} overdue`, color: openCapas > 0 ? "text-orange-700" : "text-emerald-700", bg: "bg-orange-50 border-orange-100" },
                  { label: "Overdue CAPAs",       value: String(overdueCapas), sub: "Past due date",          color: overdueCapas > 0 ? "text-red-700" : "text-emerald-700",  bg: overdueCapas > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100" },
                  { label: "High / Extreme Risks",value: String(riskByLevel.high + riskByLevel.extreme), sub: `${riskByLevel.extreme} extreme`, color: "text-red-700", bg: "bg-red-50 border-red-100" },
                  { label: "Incidents YTD",       value: String(incidentsYtd), sub: "Calendar year 2026",     color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
                    <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2">
                  <Card>
                    <CardHeader title="Open CAPAs — By Due Date" subtitle="Sorted by urgency, earliest first" />
                    {openCapaList.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-emerald-600 font-medium">No open CAPAs</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                              <th className="px-4 py-2.5 text-left">Title</th>
                              <th className="px-4 py-2.5 text-left">Severity</th>
                              <th className="px-4 py-2.5 text-left">Owner</th>
                              <th className="px-4 py-2.5 text-left">Status</th>
                              <th className="px-4 py-2.5 text-left">Due Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {openCapaList.map((c) => {
                              const isOverdue = c.due_date && new Date(c.due_date) < now;
                              return (
                                <tr key={c.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3">
                                    <Link href={`/capa/${c.id}`} className="text-xs font-medium text-blue-600 hover:underline line-clamp-1">{c.title}</Link>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${SEVERITY_STYLE[c.severity] ?? "bg-slate-100 text-slate-500"}`}>{c.severity}</span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{c.owner_id ? (profileMap[c.owner_id] ?? "—") : "—"}</td>
                                  <td className="px-4 py-3">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.status === "in_progress" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                      {c.status.replace(/_/g, " ")}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs">
                                    <span className={isOverdue ? "font-semibold text-red-600" : "text-slate-500"}>{fmtDate(c.due_date)}</span>
                                    {isOverdue && <div className="text-[10px] text-red-500 font-medium">Overdue</div>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>

                <div className="flex flex-col gap-5">
                  <Card>
                    <CardHeader title="Risk Register by Level" subtitle={`${riskItems.length} active assessments`} />
                    <div className="p-4 space-y-3">
                      {[
                        { label: "Extreme", count: riskByLevel.extreme,    bar: "bg-red-600",     text: "text-red-700" },
                        { label: "High",    count: riskByLevel.high,       bar: "bg-orange-500",  text: "text-orange-700" },
                        { label: "Medium",  count: riskByLevel.medium,     bar: "bg-amber-400",   text: "text-amber-700" },
                        { label: "Low",     count: riskByLevel.low,        bar: "bg-green-400",   text: "text-green-700" },
                        { label: "Negligible", count: riskByLevel.negligible, bar: "bg-slate-300", text: "text-slate-500" },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center gap-2">
                          <div className="w-20 shrink-0 text-[11px] text-slate-500">{r.label}</div>
                          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${riskItems.length > 0 ? Math.max((r.count / riskItems.length) * 100, r.count > 0 ? 6 : 0) : 0}%` }} />
                          </div>
                          <div className={`w-5 text-xs font-bold text-right ${r.text}`}>{r.count}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="Top Risk Items" subtitle="Highest-level open risks" />
                    <div className="divide-y divide-slate-50">
                      {riskItems
                        .filter((r) => r.risk_level === "extreme" || r.risk_level === "high")
                        .slice(0, 6)
                        .map((r) => (
                          <Link key={r.id} href={`/risk/${r.id}`} className="block px-4 py-2.5 hover:bg-slate-50 group">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-medium text-slate-700 group-hover:text-blue-600 line-clamp-1">{r.title}</div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${RISK_STYLE[r.risk_level]}`}>{r.risk_level}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{r.category}</div>
                          </Link>
                        ))}
                      {riskItems.filter((r) => r.risk_level === "extreme" || r.risk_level === "high").length === 0 && (
                        <div className="px-4 py-6 text-center text-xs text-emerald-600 font-medium">No high or extreme risks</div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* ── TRAINING ─────────────────────────────────────────────────── */}
          {tab === "training" && (
            <>
              <div className="mb-5 grid grid-cols-4 gap-4">
                {[
                  { label: "Completion Rate", value: `${trainingPct}%`, sub: `${passedRecs} of ${trainingRecs.length} records`, color: trainingPct >= 85 ? "text-emerald-700" : trainingPct >= 70 ? "text-amber-700" : "text-red-700", bg: "bg-slate-50 border-slate-200" },
                  { label: "Passed Records",  value: String(passedRecs), sub: "Total passed completions", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
                  { label: "Courses Active",  value: String(totalCourses), sub: "Training programs", color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
                  { label: "Expiring ≤ 30d",  value: String(expiringRecs.length), sub: "Certifications expiring soon", color: expiringRecs.length > 0 ? "text-orange-700" : "text-emerald-700", bg: expiringRecs.length > 0 ? "bg-orange-50 border-orange-100" : "bg-emerald-50 border-emerald-100" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
                    <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2">
                  <Card>
                    <CardHeader title="Completion Rate by Course" subtitle="Courses with lowest pass rate shown first" />
                    {courseCompletion.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-slate-400">No training records</div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {courseCompletion.map((c) => (
                          <div key={c.course} className="flex items-center gap-3 px-4 py-3">
                            <div className="w-52 shrink-0">
                              <div className="text-xs font-medium text-slate-700 line-clamp-1">{c.course}</div>
                              <div className="text-[10px] text-slate-400">{c.passed} passed of {c.total} records</div>
                            </div>
                            <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${c.pct >= 85 ? "bg-emerald-500" : c.pct >= 70 ? "bg-amber-400" : "bg-red-500"}`}
                                style={{ width: `${Math.max(c.pct, c.total > 0 ? 3 : 0)}%` }}
                              />
                            </div>
                            <div className={`w-10 text-right text-sm font-bold ${c.pct >= 85 ? "text-emerald-600" : c.pct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                              {c.total > 0 ? `${c.pct}%` : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                <div className="flex flex-col gap-5">
                  <Card>
                    <CardHeader title="Expiring Certifications" subtitle="Within 30 days" />
                    {expiringRecs.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-emerald-600 font-medium">No certifications expiring soon</div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {expiringRecs.slice(0, 8).map((r) => (
                          <div key={r.id} className="px-4 py-2.5">
                            <div className="text-xs font-medium text-slate-700">{profileMap[r.profile_id] ?? "Unknown"}</div>
                            <div className="text-[10px] text-slate-400">{courseMap[r.course_id] ?? "Unknown course"}</div>
                            <div className="text-[10px] text-orange-600 font-medium mt-0.5">Expires {fmtDate(r.expiry_date)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <CardHeader title="Training by Type" subtitle="Active course breakdown" />
                    <div className="p-4 space-y-2">
                      {Object.entries(
                        courses.reduce((acc, c) => {
                          acc[c.course_type] = (acc[c.course_type] ?? 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 capitalize">{type.replace(/_/g, " ")}</span>
                          <span className="font-semibold text-slate-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* ── CHEMICAL / WASTE ─────────────────────────────────────────── */}
          {tab === "chemical" && (
            <>
              <div className="mb-5 grid grid-cols-4 gap-4">
                {[
                  { label: "Total Chemicals",    value: String(chemicals.length), sub: "Active inventory", color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
                  { label: "Missing SDS",        value: String(missingSds.length), sub: "No SDS on file", color: missingSds.length > 0 ? "text-red-700" : "text-emerald-700", bg: missingSds.length > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100" },
                  { label: "Waste Streams",      value: String(waste.length), sub: "Registered streams", color: "text-purple-700", bg: "bg-purple-50 border-purple-100" },
                  { label: "Pending Disposal",   value: String(wasteByStatus.pending + wasteByStatus.pending_pickup), sub: "Awaiting pickup or disposal", color: (wasteByStatus.pending + wasteByStatus.pending_pickup) > 0 ? "text-orange-700" : "text-emerald-700", bg: "bg-orange-50 border-orange-100" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
                    <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 flex flex-col gap-5">
                  {missingSds.length > 0 && (
                    <Card>
                      <CardHeader title="Chemicals Missing SDS" subtitle="Compliance gap — SDS required for all hazardous materials" right={<Pill className="bg-red-100 text-red-700">{missingSds.length} gap{missingSds.length !== 1 ? "s" : ""}</Pill>} />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                              <th className="px-4 py-2.5 text-left">Chemical</th>
                              <th className="px-4 py-2.5 text-left">CAS Number</th>
                              <th className="px-4 py-2.5 text-left">Hazard Class</th>
                              <th className="px-4 py-2.5 text-left">Location</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {missingSds.slice(0, 10).map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <Link href={`/chemicals/${c.id}`} className="text-xs font-medium text-blue-600 hover:underline">{c.name}</Link>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.cas_number ?? "—"}</td>
                                <td className="px-4 py-3 text-xs text-slate-600">{c.ghs_classes[0] ?? "—"}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{c.storage_location}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  <Card>
                    <CardHeader title="Waste Streams" subtitle={`${waste.length} registered streams`} />
                    {waste.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-slate-400">No waste streams registered</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                              <th className="px-4 py-2.5 text-left">Waste Name</th>
                              <th className="px-4 py-2.5 text-left">Classification</th>
                              <th className="px-4 py-2.5 text-left">Qty</th>
                              <th className="px-4 py-2.5 text-left">Status</th>
                              <th className="px-4 py-2.5 text-left">Disposal Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {waste.slice(0, 10).map((w) => (
                              <tr key={w.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <Link href={`/waste/${w.id}`} className="text-xs font-medium text-blue-600 hover:underline">{w.waste_name}</Link>
                                  {w.waste_code && <div className="text-[10px] font-mono text-slate-400">{w.waste_code}</div>}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 capitalize">{w.classification.replace(/_/g, " ")}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-600">{w.quantity} {w.unit}</td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                                    w.status === "disposed" ? "bg-emerald-100 text-emerald-700" :
                                    w.status === "pending" || w.status === "pending_pickup" ? "bg-orange-100 text-orange-700" :
                                    "bg-blue-100 text-blue-700"
                                  }`}>{w.status.replace(/_/g, " ")}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(w.disposal_date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>

                <div className="flex flex-col gap-5">
                  <Card>
                    <CardHeader title="Chemicals by Hazard Class" subtitle={`${chemicals.length} total`} />
                    <div className="p-4 space-y-2.5">
                      {hazardRows.slice(0, 8).map(([cls, count]) => (
                        <div key={cls} className="flex items-center gap-2">
                          <div className="w-28 shrink-0 text-[10.5px] text-slate-500 line-clamp-1">{cls}</div>
                          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max((count / maxHazard) * 100, 6)}%` }} />
                          </div>
                          <div className="w-5 text-xs font-bold text-slate-700 text-right">{count}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="Waste Status Breakdown" subtitle={`${waste.length} total streams`} />
                    <div className="p-4 space-y-2">
                      {[
                        { label: "Pending",        count: wasteByStatus.pending,        color: "text-orange-700" },
                        { label: "Pending Pickup", count: wasteByStatus.pending_pickup, color: "text-amber-700" },
                        { label: "Accumulating",   count: wasteByStatus.accumulating,   color: "text-blue-700" },
                        { label: "Manifested",     count: wasteByStatus.manifested,     color: "text-purple-700" },
                        { label: "Disposed",       count: wasteByStatus.disposed,       color: "text-emerald-700" },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{r.label}</span>
                          <span className={`font-semibold ${r.color}`}>{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* ── AUDIT ────────────────────────────────────────────────────── */}
          {tab === "audit" && (
            <>
              <div className="mb-5 grid grid-cols-4 gap-4">
                {[
                  { label: "Total Findings",    value: String(auditFindings.length), sub: "All time", color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
                  { label: "Open Findings",     value: String(openFindings.length), sub: `${auditFindings.filter((f) => f.severity === "critical" || f.severity === "high").length} critical/high`, color: openFindings.length > 0 ? "text-orange-700" : "text-emerald-700", bg: "bg-orange-50 border-orange-100" },
                  { label: "Critical / High",   value: String(findingsBySeverity.critical + findingsBySeverity.high), sub: "Highest severity findings", color: (findingsBySeverity.critical + findingsBySeverity.high) > 0 ? "text-red-700" : "text-emerald-700", bg: "bg-red-50 border-red-100" },
                  { label: "Closed Findings",   value: String(closedFindings.length), sub: "Resolved and closed", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
                    <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2">
                  <Card>
                    <CardHeader title="Audit Findings" subtitle="Recent findings sorted by severity" />
                    {recentFindings.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-slate-400">No audit findings recorded</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                              <th className="px-4 py-2.5 text-left">Finding</th>
                              <th className="px-4 py-2.5 text-left">Category</th>
                              <th className="px-4 py-2.5 text-left">Severity</th>
                              <th className="px-4 py-2.5 text-left">Status</th>
                              <th className="px-4 py-2.5 text-left">Due Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {recentFindings
                              .sort((a, b) => {
                                const sOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                                return (sOrder[a.severity as keyof typeof sOrder] ?? 4) - (sOrder[b.severity as keyof typeof sOrder] ?? 4);
                              })
                              .map((f) => (
                              <tr key={f.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <div className="text-xs font-medium text-slate-700 line-clamp-1">{f.title}</div>
                                  <div className="text-[10px] text-slate-400 line-clamp-1">{f.description}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 capitalize">{f.category}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${SEVERITY_STYLE[f.severity] ?? "bg-slate-100 text-slate-500"}`}>{f.severity}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    f.status === "closed" ? "bg-emerald-100 text-emerald-700" :
                                    f.status === "in_progress" ? "bg-amber-100 text-amber-700" :
                                    "bg-blue-100 text-blue-700"
                                  }`}>{f.status.replace(/_/g, " ")}</span>
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  {f.due_date ? (
                                    <span className={new Date(f.due_date) < now && f.status !== "closed" ? "font-semibold text-red-600" : "text-slate-500"}>
                                      {fmtDate(f.due_date)}
                                    </span>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>

                <div className="flex flex-col gap-5">
                  <Card>
                    <CardHeader title="Findings by Severity" subtitle={`${auditFindings.length} total`} />
                    <div className="p-4 space-y-3">
                      {[
                        { label: "Critical", count: findingsBySeverity.critical, bar: "bg-red-600",    text: "text-red-700" },
                        { label: "High",     count: findingsBySeverity.high,     bar: "bg-orange-500", text: "text-orange-700" },
                        { label: "Medium",   count: findingsBySeverity.medium,   bar: "bg-amber-400",  text: "text-amber-700" },
                        { label: "Low",      count: findingsBySeverity.low,      bar: "bg-slate-400",  text: "text-slate-600" },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center gap-2">
                          <div className="w-16 shrink-0 text-[11px] text-slate-500">{r.label}</div>
                          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${auditFindings.length > 0 ? Math.max((r.count / auditFindings.length) * 100, r.count > 0 ? 6 : 0) : 0}%` }} />
                          </div>
                          <div className={`w-5 text-xs font-bold text-right ${r.text}`}>{r.count}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="Status Breakdown" subtitle="All findings" />
                    <div className="p-4 space-y-2">
                      {[
                        { label: "Open",          count: auditFindings.filter((f) => f.status === "open").length,          color: "text-blue-700" },
                        { label: "In Progress",   count: auditFindings.filter((f) => f.status === "in_progress").length,   color: "text-amber-700" },
                        { label: "Closed",        count: auditFindings.filter((f) => f.status === "closed").length,        color: "text-emerald-700" },
                        { label: "Accepted Risk", count: auditFindings.filter((f) => f.status === "accepted_risk").length, color: "text-slate-500" },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{r.label}</span>
                          <span className={`font-semibold ${r.color}`}>{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="Findings by Category" subtitle="Top 5 categories" />
                    <div className="p-4 space-y-2">
                      {Object.entries(
                        auditFindings.reduce((acc, f) => {
                          acc[f.category] = (acc[f.category] ?? 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]) => (
                        <div key={cat} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 capitalize">{cat}</span>
                          <span className="font-semibold text-slate-700">{count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* ── EXPORT ───────────────────────────────────────────────────── */}
          {tab === "export" && (
            <>
              <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-5 py-3.5">
                <div className="text-sm font-semibold text-blue-900">Export Center</div>
                <p className="mt-0.5 text-xs text-blue-700">
                  Generate CSV exports for any module, or use the Print button above to create a full executive PDF summary.
                  Saved reports below reflect the most recently generated outputs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <Card>
                  <CardHeader title="Quick Reports" subtitle="One-click CSV export by module" />
                  <QuickReportsPanel
                    capas={capas}
                    incidents={incidents}
                    trainingRecs={trainingRecs}
                    courseMap={courseMap}
                    profileMap={profileMap}
                    legal={legal}
                    chemicals={chemicals}
                    moduleScores={MODULE_SCORES}
                  />
                </Card>

                <Card>
                  <CardHeader title="Recent Reports" subtitle="Previously generated reports" />
                  <SavedReportsPanel
                    reports={SAVED_REPORTS}
                    capas={capas}
                    incidents={incidents}
                    trainingRecs={trainingRecs}
                    chemicals={chemicals}
                    moduleScores={MODULE_SCORES}
                    courseMap={courseMap}
                    profileMap={profileMap}
                  />
                </Card>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { BarChart3, PieChart, Download, FileText, TrendingUp, TrendingDown, Minus, Filter } from "lucide-react";
import {
  getCapaActions, getIncidents, getTrainingRecords, getTrainingCourses,
  getLegalRequirements, getDocuments, getBiosafetyLabs, getEquipment,
  getWasteStreams, getAuditFindings, getChemicals,
} from "@/lib/data/ehsRepo";

const SAVED_REPORTS = [
  { name: "Q2 2026 EHS Compliance Summary",    type: "Compliance", generated: "2026-06-15", pages: 12 },
  { name: "Chemical Inventory Audit Report",    type: "Chemical",   generated: "2026-06-10", pages: 8  },
  { name: "CAPA Aging Analysis — June",         type: "CAPA",       generated: "2026-06-08", pages: 5  },
  { name: "Training Completion Rate — H1 2026", type: "Training",   generated: "2026-06-01", pages: 6  },
  { name: "Incident Root Cause Analysis Q2",    type: "Incidents",  generated: "2026-05-31", pages: 9  },
];

// Fixed compliance trend — needs historical data in DB to be dynamic
const COMPLIANCE_TREND = [
  { month: "Jan", score: 71 },
  { month: "Feb", score: 74 },
  { month: "Mar", score: 73 },
  { month: "Apr", score: 78 },
  { month: "May", score: 82 },
  { month: "Jun", score: 86 },
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
function typeColor(t: string) {
  const map: Record<string, string> = {
    Compliance: "bg-blue-100 text-blue-700",
    Chemical:   "bg-amber-100 text-amber-700",
    CAPA:       "bg-orange-100 text-orange-700",
    Training:   "bg-green-100 text-green-700",
    Incidents:  "bg-red-100 text-red-700",
  };
  return map[t] ?? "bg-slate-100 text-slate-600";
}

export default async function ReportsPage() {
  const [capas, incidents, trainingRecs, courses, legal, docs, labs, equipment, waste, auditFindings, chemicals] =
    await Promise.all([
      getCapaActions(),
      getIncidents(),
      getTrainingRecords(),
      getTrainingCourses(),
      getLegalRequirements(),
      getDocuments(),
      getBiosafetyLabs(),
      getEquipment(),
      getWasteStreams(),
      getAuditFindings(),
      getChemicals(),
    ]);

  // ── KPI counts (live) ──────────────────────────────────────────────────────
  const now = new Date();
  const openCapas     = capas.filter((c) => c.status === "open" || c.status === "in_progress").length;
  const overdueCapas  = capas.filter((c) => c.due_date && new Date(c.due_date) < now && !["closed","verified"].includes(c.status)).length;
  const incidentsYtd  = incidents.filter((i) => new Date(i.occurred_at).getFullYear() === 2026).length;
  const passedRecs    = trainingRecs.filter((r) => r.passed).length;
  const totalCourses  = courses.length;
  const trainingPct   = totalCourses > 0 ? Math.round((passedRecs / totalCourses) * 100) : 0;

  // Overall compliance: average of module assessment scores (below)
  const MODULE_SCORES = [
    { module: "Chemical Management",    score: 91, trend: "up",   delta: "+4",  openIssues: chemicals.filter((c) => !c.sds_url).length,              issueLabel: "missing SDS"   },
    { module: "Training & Competency",  score: 88, trend: "up",   delta: "+6",  openIssues: Math.max(0, totalCourses - passedRecs),                  issueLabel: "courses uncovered" },
    { module: "Audits & Assessments",   score: 83, trend: "up",   delta: "+2",  openIssues: auditFindings.filter((f) => f.status === "open" || f.status === "in_progress").length, issueLabel: "open findings" },
    { module: "Biosafety & Lab Safety", score: 82, trend: "up",   delta: "+1",  openIssues: labs.filter((l) => l.status !== "compliant").length,      issueLabel: "non-compliant labs" },
    { module: "CAPA Management",        score: 79, trend: "up",   delta: "+3",  openIssues: openCapas,                                                issueLabel: "open CAPAs"    },
    { module: "Legal & Compliance",     score: 76, trend: "down", delta: "−2",  openIssues: legal.filter((l) => l.status !== "compliant" && l.status !== "not_applicable").length, issueLabel: "gaps" },
    { module: "Documents & Programs",   score: 85, trend: "flat", delta: "0",   openIssues: docs.filter((d) => d.status !== "active").length,         issueLabel: "inactive"      },
    { module: "Waste Management",       score: 74, trend: "up",   delta: "+5",  openIssues: waste.filter((w) => w.status === "pending").length,       issueLabel: "pending disposal" },
    { module: "Monitoring & Equipment", score: 69, trend: "down", delta: "−4",  openIssues: equipment.filter((e) => e.status !== "operational").length, issueLabel: "not operational" },
  ];

  const overallScore = Math.round(MODULE_SCORES.reduce((s, m) => s + m.score, 0) / MODULE_SCORES.length);

  // ── Trend chart geometry ───────────────────────────────────────────────────
  const minS = Math.min(...COMPLIANCE_TREND.map((t) => t.score));
  const maxS = Math.max(...COMPLIANCE_TREND.map((t) => t.score));
  const cW = 280, cH = 80, pX = 30, pY = 10;
  const iH = cH - pY * 2, iW = cW - pX * 2;
  const pts = COMPLIANCE_TREND.map((d, i) => {
    const x = pX + (i / (COMPLIANCE_TREND.length - 1)) * iW;
    const y = pY + (1 - (d.score - minS + 5) / (maxS - minS + 10)) * iH;
    return [x, y] as [number, number];
  });

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Compliance trends, module scorecards, and downloadable EHS reports"
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* KPI strip — all live data */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Overall Compliance",  value: `${overallScore}%`, sub: "Avg of module assessments",                    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
            { label: "Open CAPAs",          value: String(openCapas),  sub: overdueCapas > 0 ? `${overdueCapas} overdue` : "None overdue", color: "text-orange-700", bg: "bg-orange-50 border-orange-100" },
            { label: "Incidents YTD",       value: String(incidentsYtd), sub: "Calendar year 2026",                         color: "text-blue-700",    bg: "bg-blue-50 border-blue-100" },
            { label: "Training Records",    value: `${trainingPct}%`,  sub: `${passedRecs} of ${totalCourses} courses passed`, color: "text-purple-700", bg: "bg-purple-50 border-purple-100" },
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
            {/* Trend chart */}
            <Card>
              <CardHeader
                title="Compliance Score Trend"
                subtitle="Overall EHS compliance — last 6 months"
                right={<Pill className="bg-emerald-100 text-emerald-700">▲ +15 pts YTD</Pill>}
              />
              <div className="px-4 py-4">
                <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full overflow-visible">
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

            {/* Module scorecards — assessment scores + live open-issue counts */}
            <Card>
              <CardHeader
                title="Module Compliance Scorecards"
                subtitle="Assessment score by EHS module — live open issues shown"
                right={<BarChart3 className="h-4 w-4 text-slate-400" />}
              />
              <div className="divide-y divide-slate-50">
                {MODULE_SCORES.sort((a, b) => b.score - a.score).map((mod) => (
                  <div key={mod.module} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-44 shrink-0">
                      <div className="text-xs font-medium text-slate-700">{mod.module}</div>
                      {mod.openIssues > 0 && (
                        <div className="text-[10px] text-amber-600 font-medium">{mod.openIssues} {mod.issueLabel}</div>
                      )}
                      {mod.openIssues === 0 && (
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
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            {/* Quick reports */}
            <Card>
              <CardHeader title="Quick Reports" subtitle="One-click export" />
              <div className="p-3 space-y-1.5">
                {[
                  { label: "Compliance Summary",    icon: BarChart3, color: "bg-blue-50 text-blue-600" },
                  { label: "CAPA Status Report",    icon: FileText,  color: "bg-orange-50 text-orange-600" },
                  { label: "Incident Analysis",     icon: BarChart3, color: "bg-red-50 text-red-600" },
                  { label: "Training Report",       icon: PieChart,  color: "bg-green-50 text-green-600" },
                  { label: "Regulatory Gap Report", icon: FileText,  color: "bg-purple-50 text-purple-600" },
                ].map((r) => {
                  const Icon = r.icon;
                  return (
                    <button key={r.label} className="flex w-full items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2 text-left transition hover:bg-slate-50">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${r.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="flex-1 text-xs font-medium text-slate-700">{r.label}</span>
                      <Download className="h-3.5 w-3.5 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Saved reports */}
            <Card>
              <CardHeader title="Recent Reports" subtitle="Previously generated" />
              <div className="divide-y divide-slate-50">
                {SAVED_REPORTS.map((r) => (
                  <div key={r.name} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50/60">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-medium text-slate-800 leading-snug">{r.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Pill className={typeColor(r.type)} style={{ fontSize: "9.5px" }}>{r.type}</Pill>
                        <span className="text-[10px] text-slate-400">{r.generated} · {r.pages}p</span>
                      </div>
                    </div>
                    <button className="shrink-0 text-slate-300 hover:text-blue-500">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Live data summary */}
            <Card>
              <CardHeader title="Live Data Summary" subtitle="Current counts across modules" />
              <div className="p-4 space-y-2">
                {[
                  { label: "Total Chemicals",   value: chemicals.length },
                  { label: "Legal Requirements",value: legal.length },
                  { label: "CAPA Records",       value: capas.length },
                  { label: "Training Records",   value: trainingRecs.length },
                  { label: "Incidents on File",  value: incidents.length },
                  { label: "Registered Labs",    value: labs.length },
                  { label: "Equipment Units",    value: equipment.length },
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
      </div>
    </div>
  );
}

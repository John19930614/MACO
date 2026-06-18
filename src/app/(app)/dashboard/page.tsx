import Link from "next/link";
import {
  getChemicals, getCapaActions, getAiFindings, getTrainingRecords,
  getEquipment, getComplianceScores, getAudits, getIncidents,
  overallComplianceScore, latestPredictabilityRun,
} from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader } from "@/components/ui/primitives";
import { CapaStatusBadge, ReviewStatusBadge } from "@/components/ui/badges";
import type { AiAnalysisOutput } from "@/lib/types";
import { formatDate, relativeTime } from "@/lib/utils";
import {
  FlaskConical, BrainCircuit, Clock,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

export default async function DashboardPage() {
  const [chemicals, capas, aiFindings, trainingRecords, equipment, complianceScores, audits, incidents] =
    await Promise.all([
      getChemicals(), getCapaActions(), getAiFindings(), getTrainingRecords(),
      getEquipment(), getComplianceScores(), getAudits(), getIncidents(),
    ]);

  const overall = await overallComplianceScore();
  const latestRun = await latestPredictabilityRun();

  // Derived counts
  const openCapas       = capas.filter((c) => c.status !== "closed" && c.status !== "rejected");
  const overdueCapas    = capas.filter((c) => c.status === "overdue");
  const pendingFindings = aiFindings.filter((f) => f.review_status === "pending");
  // High-risk chemicals: scheduled substances or bearing carcinogen/acute-toxic H-statements
  const HIGH_HAZARD_H = ["H350", "H351", "H300", "H310", "H311", "H330", "H331"];
  const highRiskChems = chemicals.filter(
    (c) => c.is_scheduled || c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh))),
  );
  const today           = new Date();
  const expiringTraining = trainingRecords.filter((r) => {
    if (!r.expiry_date) return false;
    const exp = new Date(r.expiry_date);
    const days = (exp.getTime() - today.getTime()) / 86400000;
    return days >= 0 && days <= 30;
  });
  const overdueEquipment = equipment.filter((e) =>
    e.status === "calibration_due" || e.status === "inspection_due",
  );
  const upcomingAudits = audits
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
    .slice(0, 3);
  const openIncidents   = incidents.filter((i) => i.status !== "closed");
  const criticalAlerts  = incidents.filter((i) =>
    (i.severity === "critical" || i.severity === "high") && i.status !== "closed",
  ).length;

  // Compliance by module sorted by score ascending (lowest = most at risk)
  const moduleScores = [...complianceScores].sort((a, b) => a.percentage - b.percentage);

  // Trend icon helper
  const TrendIcon = latestRun?.forecast_data?.compliance_trend === "improving"
    ? TrendingUp : latestRun?.forecast_data?.compliance_trend === "declining"
    ? TrendingDown : Minus;
  const trendColor = latestRun?.forecast_data?.compliance_trend === "improving"
    ? "text-emerald-600" : latestRun?.forecast_data?.compliance_trend === "declining"
    ? "text-red-600" : "text-slate-400";

  return (
    <>
      <PageHeader
        title="Command Center"
        subtitle="EHS Command Center · AI-powered compliance overview"
        actions={
          <Link
            href="/ai"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <BrainCircuit className="h-4 w-4" /> Run P-Engine Scan
          </Link>
        }
      />

      <div className="iq-scroll flex-1 overflow-auto p-6">
        {/* ── KPI Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Overall Compliance Score"
            value={`${overall}%`}
            accent="#2563eb"
            hint="Avg across all EHS modules"
            icon="🛡"
            strip="linear-gradient(90deg,#2563eb,#60a5fa)"
            trend={{ label: "AI-powered score", direction: overall >= 80 ? "up" : overall >= 60 ? "flat" : "down" }}
          />
          <Stat
            label="Critical Risk Alerts"
            value={criticalAlerts}
            accent="#ef4444"
            hint={criticalAlerts > 0 ? "High/critical severity open" : "No critical alerts"}
            icon="⚠"
            strip="linear-gradient(90deg,#ef4444,#f87171)"
            trend={{ label: criticalAlerts > 0 ? "Requires immediate action" : "All clear", direction: criticalAlerts > 0 ? "down" : "flat" }}
          />
          <Stat
            label="Open CAPA Actions"
            value={openCapas.length}
            accent="#f97316"
            hint={overdueCapas.length > 0 ? `${overdueCapas.length} overdue` : "All on schedule"}
            icon="⚙"
            strip="linear-gradient(90deg,#f97316,#fb923c)"
            trend={{ label: overdueCapas.length > 0 ? `${overdueCapas.length} overdue` : "All on schedule", direction: overdueCapas.length > 0 ? "down" : "flat" }}
          />
          <Stat
            label="Training Gaps (30d)"
            value={expiringTraining.length}
            accent="#f59e0b"
            hint="Certifications expiring soon"
            icon="🎓"
            strip="linear-gradient(90deg,#f59e0b,#fcd34d)"
            trend={{ label: "Within 30 days", direction: expiringTraining.length > 0 ? "down" : "flat" }}
          />
        </div>

        {/* ── P-Engine Status + Compliance by Module ──────────────── */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* P-Engine */}
          <Card>
            <CardHeader
              title="P-Engine — Predictability Status"
              subtitle="AI compliance forecast"
              right={
                <Link href="/ai" className="text-xs font-medium text-blue-600 hover:underline">
                  Full report →
                </Link>
              }
            />
            {latestRun ? (
              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-medium text-slate-500">Current stage</span>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 capitalize">
                    {latestRun.stage}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-medium text-slate-500">Items scanned</span>
                  <span className="text-sm font-semibold text-slate-800">{latestRun.items_scanned}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-medium text-slate-500">Signals found</span>
                  <span className="text-sm font-semibold text-slate-800">{latestRun.signals_found}</span>
                </div>
                {latestRun.forecast_data && (
                  <>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs font-medium text-slate-500">30-day forecast</span>
                      <span className="text-sm font-bold text-slate-800">
                        {latestRun.forecast_data.predicted_compliance_score_30d}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs font-medium text-slate-500">Trend</span>
                      <span className={`flex items-center gap-1 text-sm font-semibold capitalize ${trendColor}`}>
                        <TrendIcon className="h-4 w-4" />
                        {latestRun.forecast_data.compliance_trend}
                      </span>
                    </div>
                  </>
                )}
                <div className="px-4 py-2 text-[11px] text-slate-400">
                  Last run: {relativeTime(latestRun.created_at)}
                </div>
              </div>
            ) : (
              <Empty>No P-Engine runs yet. Click &ldquo;Run P-Engine Scan&rdquo; to start.</Empty>
            )}
          </Card>

          {/* Compliance by module */}
          <Card className="lg:col-span-2">
            <CardHeader title="Compliance by EHS Module" subtitle="Lowest scores = highest priority" />
            <div className="divide-y divide-slate-100">
              {moduleScores.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-28 shrink-0 text-xs font-medium capitalize text-slate-600">
                    {s.module.replace(/_/g, " ")}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${s.percentage}%`,
                          background:
                            s.percentage >= 80 ? "var(--color-safe)"
                            : s.percentage >= 60 ? "var(--color-warning)"
                            : "var(--color-hazard)",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    className="w-10 text-right text-sm font-bold"
                    style={{
                      color:
                        s.percentage >= 80 ? "var(--color-safe)"
                        : s.percentage >= 60 ? "var(--color-warning)"
                        : "var(--color-hazard)",
                    }}
                  >
                    {s.percentage}%
                  </div>
                </div>
              ))}
              {moduleScores.length === 0 && <Empty>No compliance scores yet.</Empty>}
            </div>
          </Card>
        </div>

        {/* ── Alert Row: High-risk chemicals + overdue equipment ────── */}
        {(highRiskChems.length > 0 || overdueEquipment.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {highRiskChems.map((c) => (
              <Link
                key={c.id}
                href="/chemicals"
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {c.name}{c.is_scheduled ? " — scheduled substance" : " — high-hazard"}
              </Link>
            ))}
            {overdueEquipment.map((e) => (
              <Link
                key={e.id}
                href="/monitoring"
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
              >
                <Clock className="h-3.5 w-3.5" />
                {e.name} — {e.status.replace("_", " ")}
              </Link>
            ))}
          </div>
        )}

        {/* ── Bottom Grid ──────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Open CAPAs */}
          <Card>
            <CardHeader
              title="Open CAPA Actions"
              subtitle="Corrective & preventive actions requiring attention"
              right={
                <Link href="/capa" className="text-xs font-medium text-blue-600 hover:underline">
                  All CAPAs →
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {openCapas.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <CapaStatusBadge status={c.status} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{c.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {c.due_date ? formatDate(c.due_date) : "No due date"}
                  </span>
                </div>
              ))}
              {openCapas.length === 0 && <Empty>All CAPAs closed.</Empty>}
            </div>
          </Card>

          {/* AI Findings pending */}
          <Card>
            <CardHeader
              title="AI Findings — Pending Review"
              subtitle="P-Engine output awaiting human acceptance"
              right={
                <Link href="/ai" className="text-xs font-medium text-blue-600 hover:underline">
                  All findings →
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {pendingFindings.map((f) => {
                const output = f.output as AiAnalysisOutput;
                return (
                  <div key={f.id} className="flex items-center gap-2 px-4 py-2.5">
                    <ReviewStatusBadge status={f.review_status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {f.job.replace(/_/g, " ")} — {f.source_type}
                    </span>
                    <span
                      className="shrink-0 text-xs font-semibold capitalize"
                      style={{
                        color: output.risk_level === "extreme" ? "var(--color-hazard)"
                          : output.risk_level === "high" ? "var(--color-accent)"
                          : output.risk_level === "medium" ? "var(--color-warning)"
                          : "var(--color-safe)",
                      }}
                    >
                      {output.risk_level}
                    </span>
                  </div>
                );
              })}
              {pendingFindings.length === 0 && <Empty>No findings pending review.</Empty>}
            </div>
          </Card>

          {/* Upcoming audits */}
          <Card>
            <CardHeader
              title="Upcoming Audits"
              subtitle="Scheduled inspections and compliance audits"
              right={
                <Link href="/audits" className="text-xs font-medium text-blue-600 hover:underline">
                  All audits →
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {upcomingAudits.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {a.type.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{a.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDate(a.scheduled_date)}
                  </span>
                </div>
              ))}
              {upcomingAudits.length === 0 && <Empty>No upcoming audits scheduled.</Empty>}
            </div>
          </Card>

          {/* Open incidents */}
          <Card>
            <CardHeader
              title="Open Incidents"
              subtitle="Reported incidents requiring follow-up"
              right={
                <Link href="/incidents" className="text-xs font-medium text-blue-600 hover:underline">
                  All incidents →
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {openIncidents.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                  <AlertTriangle
                    className="h-4 w-4 shrink-0"
                    style={{
                      color: i.severity === "critical" ? "var(--color-hazard)"
                        : i.severity === "high" ? "var(--color-accent)"
                        : "var(--color-warning)",
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{i.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{relativeTime(i.occurred_at)}</span>
                </div>
              ))}
              {openIncidents.length === 0 && <Empty>No open incidents.</Empty>}
            </div>
          </Card>
        </div>

        {/* ── Module quick-links ───────────────────────────────────── */}
        <Card className="mt-4">
          <CardHeader title="EHS Modules" subtitle="Navigate to any module" />
          <div className="grid grid-cols-3 gap-px bg-slate-100 sm:grid-cols-4 md:grid-cols-6">
            {[
              { href: "/legal",      label: "Legal Register",        icon: "⚖" },
              { href: "/risk",       label: "Risk Intelligence",      icon: "▲" },
              { href: "/audits",     label: "Audits & Assessments",   icon: "≡" },
              { href: "/capa",       label: "Corrective Actions",     icon: "⚙" },
              { href: "/training",   label: "Training & Competency",  icon: "🎓" },
              { href: "/documents",  label: "Documents & Programs",   icon: "📄" },
              { href: "/chemicals",  label: "Chemical Management",    icon: "⚗" },
              { href: "/biosafety",  label: "Biosafety & Lab Safety", icon: "🔬" },
              { href: "/waste",      label: "Waste Management",       icon: "♻" },
              { href: "/monitoring", label: "Monitoring & Equipment", icon: "📡" },
              { href: "/incidents",  label: "Incident Reporting",     icon: "⚠" },
              { href: "/reports",    label: "Reports & Analytics",    icon: "📊" },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1.5 bg-white px-3 py-4 text-center hover:bg-slate-50"
              >
                <span className="text-xl leading-none">{icon}</span>
                <span className="text-[10.5px] font-medium text-slate-600 leading-snug">{label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3 text-xs text-slate-400">{children}</p>;
}

import Link from "next/link";
import {
  getChemicals, getCapaActions, getAiFindings, getTrainingRecords,
  getEquipment, getComplianceScores, getAudits, getIncidents,
  getOshaCases, overallComplianceScore, latestPredictabilityRun, getTenantName,
} from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { oshaRate, OSHA_DART_BENCHMARK } from "@/lib/osha";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, Stat, Card, CardHeader } from "@/components/ui/primitives";
import { ScoreGauge, DonutChart, Legend, TrendArea, type Segment, type TrendPoint } from "@/components/charts/Charts";
import { CapaStatusBadge, ReviewStatusBadge } from "@/components/ui/badges";
import { OnboardingWelcomeBanner } from "@/components/dashboard/OnboardingWelcomeBanner";
import type { AiAnalysisOutput } from "@/lib/types";
import { formatDate, relativeTime } from "@/lib/utils";
import {
  FlaskConical, BrainCircuit, Clock,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const params      = await searchParams;
  const justOnboarded = params.onboarding === "complete";

  const tenantId   = await getEffectiveTenantId();
  const tenantName = await getTenantName(tenantId);

  // Check onboarding status and fetch welcome-banner data (live mode only)
  let onboardingComplete   = true;
  let onboardingData: Record<string, unknown> = {};
  let companyName          = tenantName;

  if (!MOCK_MODE) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, onboarding_completed_at, onboarding_data")
        .eq("id", tenantId)
        .single();
      onboardingComplete = !!tenant?.onboarding_completed_at;
      onboardingData     = (tenant?.onboarding_data as Record<string, unknown>) ?? {};
      companyName        = (tenant?.name as string) || tenantName;
    }
  }

  const seededCounts         = (onboardingData.seeded_counts        as Record<string, number>)  ?? {};
  const extractedEmployees   = (onboardingData.extracted_employees  as { display_name: string; email?: string | null; job_title?: string | null; department?: string | null }[]) ?? [];

  const [chemicals, capas, aiFindings, trainingRecords, equipment, complianceScores, audits, incidents, oshaCases] =
    await Promise.all([
      getChemicals(tenantId), getCapaActions(tenantId), getAiFindings(tenantId), getTrainingRecords(tenantId),
      getEquipment(tenantId), getComplianceScores(tenantId), getAudits(tenantId), getIncidents(tenantId), getOshaCases(tenantId),
    ]);

  const overall = await overallComplianceScore(tenantId);
  const latestRun = await latestPredictabilityRun(tenantId);

  // Derived counts
  const openCapas       = capas.filter((c) => c.status !== "closed" && c.status !== "rejected");
  const overdueCapas    = capas.filter((c) => c.due_date != null && new Date(c.due_date) < new Date() && !["closed", "rejected", "pending_verification"].includes(c.status));
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

  // OSHA safety rates — calculated from confirmed OSHA 300 log entries
  const oshaCasesYtd = oshaCases.filter((c) => c.date.startsWith("2026"));
  const trir = oshaRate(oshaCasesYtd.length);
  const dartCases = oshaCasesYtd.filter((c) => c.classification === "days_away" || c.classification === "restricted");
  const dart = oshaRate(dartCases.length);
  const severeOsha = oshaCasesYtd.filter((c) => c.isSevereInjury || c.classification === "fatality").length;

  // Compliance by module sorted by score ascending (lowest = most at risk)
  const moduleScores = [...complianceScores].sort((a, b) => a.percentage - b.percentage);

  // ── Chart data (all derived from live records) ───────────────────────────────
  const isOverdueCapa = (c: typeof capas[number]) =>
    c.due_date != null && new Date(c.due_date) < new Date() && !["closed", "rejected", "pending_verification"].includes(c.status);
  const capaSegments: Segment[] = [
    { label: "Overdue",              value: capas.filter(isOverdueCapa).length,                                          color: "#dc2626" },
    { label: "Open",                 value: capas.filter((c) => c.status === "open" && !isOverdueCapa(c)).length,        color: "#3b82f6" },
    { label: "In Progress",          value: capas.filter((c) => c.status === "in_progress" && !isOverdueCapa(c)).length, color: "#f59e0b" },
    { label: "Pending Verification", value: capas.filter((c) => c.status === "pending_verification").length,             color: "#7c3aed" },
    { label: "Closed",               value: capas.filter((c) => c.status === "closed").length,                           color: "#10b981" },
  ].filter((s) => s.value > 0);

  const severitySegments: Segment[] = [
    { label: "Critical", value: incidents.filter((i) => i.severity === "critical").length, color: "#991b1b" },
    { label: "High",     value: incidents.filter((i) => i.severity === "high").length,     color: "#dc2626" },
    { label: "Medium",   value: incidents.filter((i) => i.severity === "medium").length,   color: "#f59e0b" },
    { label: "Low",      value: incidents.filter((i) => i.severity === "low").length,      color: "#10b981" },
  ].filter((s) => s.value > 0);

  // Incidents per month over the trailing 12 months.
  const incidentTrend: TrendPoint[] = (() => {
    const now = new Date();
    const out: TrendPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        label: d.toLocaleDateString("en-US", { month: "short" }),
        value: incidents.filter((it) => (it.occurred_at || "").slice(0, 7) === key).length,
      });
    }
    return out;
  })();

  // Trend icon helper
  const TrendIcon = latestRun?.forecast_data?.compliance_trend === "improving"
    ? TrendingUp : latestRun?.forecast_data?.compliance_trend === "declining"
    ? TrendingDown : Minus;
  const trendColor = latestRun?.forecast_data?.compliance_trend === "improving"
    ? "text-emerald-600" : latestRun?.forecast_data?.compliance_trend === "declining"
    ? "text-red-600" : "text-slate-400";

  const MODULE_LABEL: Record<string, string> = {
    chemical:  "Chemical Management",
    legal:     "Legal Register",
    audits:    "Audits & Assessments",
    capa:      "Corrective Actions",
    training:  "Training & Competency",
    documents: "Documents & Programs",
    waste:     "Waste Management",
    equipment: "Monitoring & Equipment",
    risk:        "Risk Intelligence",
    incidents:   "Incident Reporting",
    ergonomics:  "Ergonomics & MSD",
  };

  const MODULE_HREF: Record<string, string> = {
    chemical:    "/chemicals",
    legal:       "/legal",
    audits:      "/audits",
    capa:        "/capa",
    training:    "/training",
    documents:   "/documents",
    waste:       "/waste",
    equipment:   "/monitoring",
    risk:        "/risk",
    incidents:   "/incidents",
    ergonomics:  "/ergonomics",
  };

  return (
    <>
      <div data-tour="command-center">
      <PageHeader
        title="Command Center"
        subtitle="EHS Command Center · AI-powered compliance overview"
        actions={
          <Link
            href="/ai"
            data-tour="p-engine-btn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <BrainCircuit className="h-4 w-4" /> Run P-Engine Scan
          </Link>
        }
      />
      </div>

      <div className="iq-scroll flex-1 overflow-auto p-6">
        {/* ── Welcome banner (shown once after onboarding completes) ─ */}
        {justOnboarded && (
          <OnboardingWelcomeBanner
            companyName={companyName}
            seededCounts={seededCounts}
            extractedEmployees={extractedEmployees}
          />
        )}

        {/* ── Onboarding nudge (shown until onboarding is done) ────── */}
        {!onboardingComplete && !justOnboarded && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-blue-700 px-5 py-4 shadow-sm">
            <div>
              <div className="text-sm font-bold text-white">Complete your company onboarding</div>
              <div className="mt-0.5 text-xs text-blue-100">
                Set up your company profile, upload your documents, and let AI seed your platform in minutes.
              </div>
            </div>
            <Link
              href="/onboarding"
              className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 whitespace-nowrap"
            >
              Start Onboarding &rarr;
            </Link>
          </div>
        )}

        {/* ── KPI Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link href="/legal" className="block">
            <Stat
              label="Overall Compliance Score"
              value={`${overall}%`}
              accent="#2563eb"
              hint="Avg across all EHS modules"
              icon="🛡"
              strip="linear-gradient(90deg,#2563eb,#60a5fa)"
              trend={{ label: "AI-powered score", direction: overall >= 80 ? "up" : overall >= 60 ? "flat" : "down" }}
            />
          </Link>
          <Link href="/incidents" className="block">
            <Stat
              label="Critical Risk Alerts"
              value={criticalAlerts}
              accent="#ef4444"
              hint={criticalAlerts > 0 ? "High/critical severity open" : "No critical alerts"}
              icon="⚠"
              strip="linear-gradient(90deg,#ef4444,#f87171)"
              trend={{ label: criticalAlerts > 0 ? "Requires immediate action" : "All clear", direction: criticalAlerts > 0 ? "down" : "flat" }}
            />
          </Link>
          <Link href="/capa" className="block">
            <Stat
              label="Open CAPA Actions"
              value={openCapas.length}
              accent="#f97316"
              hint={overdueCapas.length > 0 ? `${overdueCapas.length} overdue` : "All on schedule"}
              icon="⚙"
              strip="linear-gradient(90deg,#f97316,#fb923c)"
              trend={{ label: overdueCapas.length > 0 ? `${overdueCapas.length} overdue` : "All on schedule", direction: overdueCapas.length > 0 ? "down" : "flat" }}
            />
          </Link>
          <Link href="/training" className="block">
            <Stat
              label="Training Gaps (30d)"
              value={expiringTraining.length}
              accent="#f59e0b"
              hint="Certifications expiring soon"
              icon="🎓"
              strip="linear-gradient(90deg,#f59e0b,#fcd34d)"
              trend={{ label: "Within 30 days", direction: expiringTraining.length > 0 ? "down" : "flat" }}
            />
          </Link>
        </div>

        {/* ── Visual analytics row ────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* Overall compliance gauge */}
          <Card>
            <CardHeader title="Overall Compliance" subtitle="Across all EHS modules" />
            <div className="flex items-center justify-center px-4 py-5">
              <ScoreGauge value={overall} label="Compliant" />
            </div>
          </Card>

          {/* CAPA status donut */}
          <Card>
            <CardHeader title="CAPA Status" subtitle="Corrective & preventive actions" />
            <div className="flex items-center gap-4 px-4 py-5">
              {capaSegments.length > 0 ? (
                <>
                  <DonutChart segments={capaSegments} centerValue={capas.length} centerLabel="CAPAs" size={116} />
                  <div className="flex-1"><Legend segments={capaSegments} /></div>
                </>
              ) : (
                <Empty>No CAPAs recorded.</Empty>
              )}
            </div>
          </Card>

          {/* Incident 12-month trend */}
          <Card className="lg:col-span-2">
            <CardHeader title="Incident Trend" subtitle="Reported incidents · trailing 12 months" />
            <div className="px-3 py-4">
              <TrendArea points={incidentTrend} color="#2563eb" fill="#dbeafe" />
              {severitySegments.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-50 px-2 pt-2.5">
                  {severitySegments.map((s) => (
                    <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
                      <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                      <span className="text-slate-500">{s.label}</span>
                      <span className="font-semibold text-slate-700">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
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
              {moduleScores.map((s) => {
                const href = MODULE_HREF[s.module];
                const label = MODULE_LABEL[s.module] ?? s.module.replace(/_/g, " ");
                const row = (
                  <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <div className="w-36 shrink-0 text-xs font-medium text-slate-600">
                      {label}
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
                );
                return href
                  ? <Link key={s.id} href={href} className="block">{row}</Link>
                  : <div key={s.id}>{row}</div>;
              })}
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
                href={`/chemicals/${c.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {c.name}{c.is_scheduled ? " — scheduled substance" : " — high-hazard"}
              </Link>
            ))}
            {overdueEquipment.map((e) => (
              <Link
                key={e.id}
                href={`/monitoring/${e.id}`}
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
                <Link key={c.id} href={`/capa/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <CapaStatusBadge status={c.status} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{c.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {c.due_date ? formatDate(c.due_date) : "No due date"}
                  </span>
                </Link>
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
                <Link key={a.id} href={`/audits/${a.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {a.type.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{a.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDate(a.scheduled_date)}
                  </span>
                </Link>
              ))}
              {upcomingAudits.length === 0 && <Empty>No upcoming audits scheduled.</Empty>}
            </div>
          </Card>

          {/* OSHA Safety Rates */}
          <Card>
            <CardHeader
              title="OSHA Safety Rates"
              subtitle="From OSHA 300 Log — confirmed recordable cases YTD"
              right={
                <Link href="/osha" className="text-xs font-medium text-blue-600 hover:underline">
                  OSHA Logs →
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {[
                { label: "TRIR", value: trir, sub: "Total Recordable Incident Rate · per 100 FTE", warn: parseFloat(trir) > 3.0 },
                { label: "DART Rate", value: dart, sub: "Days Away/Restricted/Transfer · per 100 FTE", warn: parseFloat(dart) > 1.8 },
                { label: "Recordable Cases YTD", value: String(oshaCasesYtd.length), sub: `${dartCases.length} days-away or restricted`, warn: false },
                { label: "Severe Injuries (24-hr reportable)", value: String(severeOsha), sub: "Hospitalizations, fatalities", warn: severeOsha > 0 },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700">{row.label}</div>
                    <div className="text-[10.5px] text-slate-400 leading-snug">{row.sub}</div>
                  </div>
                  <div className={`shrink-0 text-lg font-extrabold tabular-nums ${row.warn ? "text-red-600" : "text-slate-800"}`}>
                    {row.value}
                    {row.warn && <span className="ml-1 text-xs font-normal text-red-400">⚠</span>}
                  </div>
                </div>
              ))}
              {/* DART benchmark comparison */}
              <div className="px-4 py-3 bg-slate-50/60">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2.5">DART vs. Industry (R&amp;D Biotech avg {OSHA_DART_BENCHMARK})</div>
                {[
                  { label: tenantName.split(" ")[0], val: parseFloat(dart), color: parseFloat(dart) <= OSHA_DART_BENCHMARK ? "bg-emerald-500" : "bg-red-500" },
                  { label: "Industry", val: OSHA_DART_BENCHMARK, color: "bg-slate-400" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2 mb-1.5">
                    <div className="w-14 text-[10.5px] text-slate-600">{row.label}</div>
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.color} transition-all`} style={{ width: `${Math.min((row.val / 4) * 100, 100)}%` }} />
                    </div>
                    <div className="w-7 text-xs font-bold text-right text-slate-700">{row.val.toFixed(2)}</div>
                  </div>
                ))}
                <div className="text-[9px] text-slate-400 mt-1">
                  {parseFloat(dart) <= OSHA_DART_BENCHMARK ? "✓ Below industry average — favorable" : "⚠ Above industry average — monitor"}
                </div>
              </div>
            </div>
          </Card>

          {/* Team Action Backlog */}
          <Card>
            <CardHeader title="Team Action Backlog" subtitle="Pending items across all modules" />
            <div className="divide-y divide-slate-100">
              {[
                { label: "Open CAPAs",           count: openCapas.length,       warn: overdueCapas.length > 0, sub: overdueCapas.length > 0 ? `${overdueCapas.length} overdue` : "On track", href: "/capa" },
                { label: "Open Incidents",        count: openIncidents.length,   warn: openIncidents.length > 3, sub: openIncidents.filter(i=>i.status==="under_investigation").length + " under investigation", href: "/incidents" },
                { label: "AI Findings to Review", count: pendingFindings.length, warn: pendingFindings.length > 5, sub: "Awaiting human acceptance", href: "/ai" },
                { label: "Overdue Equipment",     count: overdueEquipment.length, warn: overdueEquipment.length > 0, sub: "Calibration or inspection due", href: "/monitoring" },
                { label: "Training Expiring (30d)", count: expiringTraining.length, warn: expiringTraining.length > 0, sub: "Certifications expiring soon", href: "/training" },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700">{item.label}</div>
                    <div className="text-[10.5px] text-slate-400">{item.sub}</div>
                  </div>
                  <div className={`shrink-0 text-lg font-extrabold tabular-nums ${item.warn ? "text-red-600" : item.count === 0 ? "text-emerald-600" : "text-slate-800"}`}>
                    {item.count}
                  </div>
                </Link>
              ))}
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
                <Link key={i.id} href={`/incidents/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
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
                </Link>
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
              { href: "/osha",       label: "OSHA Logs",              icon: "📋" },
              { href: "/ai",         label: "AI Assistant",           icon: "🧠" },
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

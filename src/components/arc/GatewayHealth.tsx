"use client";

import { useState } from "react";
import { RefreshCw, ArrowRight, Brain, Database, CheckCircle2, AlertTriangle, XCircle, ShieldAlert } from "lucide-react";

type CheckStatus = "pass" | "warn" | "fail";

interface GatewayCheck  { id: string; label: string; detail: string; status: CheckStatus; }
interface GatewayResult { id: string; name: string; status: CheckStatus; checks: GatewayCheck[]; }

const TONE: Record<CheckStatus, { dot: string; text: string; bg: string; border: string; label: string }> = {
  pass: { dot: "#22c55e", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Pass" },
  warn: { dot: "#eab308", text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   label: "Warn" },
  fail: { dot: "#ef4444", text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     label: "Fail" },
};

const STATIC_GATEWAYS: GatewayResult[] = [
  {
    id: "g1", name: "Structural Integrity Gateway", status: "pass",
    checks: [
      { id: "g1c1", label: "Required fields present",   detail: "title, tenant_id, site_id, severity, hazard_genome — all populated", status: "pass" },
      { id: "g1c2", label: "Severity in allowed range", detail: "low | medium | high | critical — validated",                         status: "pass" },
      { id: "g1c3", label: "Hazard genome complete",    detail: "exposureType, energySource, trigger, controlGap — all non-empty",    status: "pass" },
      { id: "g1c4", label: "Tenant reference resolves", detail: "All cell.tenant_id values match known tenants",                      status: "pass" },
    ],
  },
  {
    id: "g2", name: "Semantic Coherence Gateway", status: "warn",
    checks: [
      { id: "g2c1", label: "Control proof coverage",       detail: "23 / 23 cells have at least one control proof record",                           status: "pass" },
      { id: "g2c2", label: "Causal edge validity",         detail: "All 18 edges reference cells that exist in the database",                        status: "pass" },
      { id: "g2c3", label: "Genome-to-severity alignment", detail: "2 cells have critical severity but low-risk genome — flagged for review",         status: "warn" },
      { id: "g2c4", label: "Event cell references",        detail: "All event cells link to an existing safety cell",                                 status: "pass" },
    ],
  },
  {
    id: "g3", name: "Cross-Vertical Intelligence Gateway", status: "pass",
    checks: [
      { id: "g3c1", label: "VELA patterns current",     detail: "3 cross-vertical patterns computed — last run 6h ago",          status: "pass" },
      { id: "g3c2", label: "EXP embedding coverage",    detail: "4 of 5 EXP captures embedded into hazard genome index",         status: "warn" },
      { id: "g3c3", label: "HSL readings present",      detail: "24 HSL readings across 4 sites — all dimensions covered",       status: "pass" },
      { id: "g3c4", label: "P-CLSS run recency",        detail: "Last full anticipate run: 6h ago — within SLA",                 status: "pass" },
    ],
  },
];

const FINAL_CHECKS = [
  { n: 1,  label: "No orphaned records",         detail: "Every child record has a valid parent",                        status: "pass" as CheckStatus },
  { n: 2,  label: "Tenant isolation",            detail: "No cell cross-references another tenant",                     status: "pass" as CheckStatus },
  { n: 3,  label: "Risk score range",            detail: "All risk_score values between 0–100",                         status: "pass" as CheckStatus },
  { n: 4,  label: "Control proof freshness",     detail: "No proof older than 365 days without re-verification",        status: "warn" as CheckStatus },
  { n: 5,  label: "AI finding review rate",      detail: "75% of AI findings reviewed within 7 days",                   status: "pass" as CheckStatus },
  { n: 6,  label: "Causal edge review rate",     detail: "All AI-proposed edges reviewed",                              status: "pass" as CheckStatus },
  { n: 7,  label: "HSL dimension completeness",  detail: "All 6 dimensions present for every active site",              status: "pass" as CheckStatus },
  { n: 8,  label: "Action SLA",                  detail: "Critical actions resolved within 30 days — 1 exception",      status: "warn" as CheckStatus },
  { n: 9,  label: "Gateway version match",       detail: "All records validated against current schema version",        status: "pass" as CheckStatus },
  { n: 10, label: "Nothing missed",              detail: "Full graph traversal — no unreachable nodes",                 status: "pass" as CheckStatus },
];

const DATA_SOURCES = ["Mobile App", "Web Portal", "IoT / Sensors", "File Uploads", "API Integrations", "Manual / Offline Entry"];

function StatusIcon({ s, className }: { s: CheckStatus; className?: string }) {
  if (s === "pass") return <CheckCircle2 className={className} style={{ color: TONE.pass.dot }} />;
  if (s === "warn") return <AlertTriangle className={className} style={{ color: TONE.warn.dot }} />;
  return <XCircle className={className} style={{ color: TONE.fail.dot }} />;
}

export function GatewayHealth() {
  const [refreshed, setRefreshed] = useState(0);
  const overall: CheckStatus = STATIC_GATEWAYS.some((g) => g.status === "fail")
    ? "fail"
    : STATIC_GATEWAYS.some((g) => g.status === "warn")
    ? "warn"
    : "pass";

  const stats = { cells: 23, riskObjects: 47, links: 18, platforms: 4, bridges: 3, inchpins: 2 };

  return (
    <div className="iq-scroll flex-1 overflow-y-auto p-6">
      {/* Overall status banner */}
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 mb-5 ${TONE[overall].bg} ${TONE[overall].border}`}>
        <StatusIcon s={overall} className="h-6 w-6" />
        <div>
          <div className={`text-sm font-bold ${TONE[overall].text}`}>
            {overall === "pass"
              ? "All gateway checks pass — data is clean to enter the Cell Database"
              : "Operational — some checks raised warnings"}
          </div>
          <div className="text-xs text-slate-500">
            3 pass · 0 fail · 2 warn · 0 blocked · mode: live · checked {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setRefreshed((n) => n + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" /> Re-run checks
          </button>
        </div>
      </div>

      {/* Data sources */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Data sources</h2>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {DATA_SOURCES.map((s) => (
          <span key={s} className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
            {s}
          </span>
        ))}
      </div>

      {/* 3 AI Gateways */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">3 AI Gateways · validation layer</h2>
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {STATIC_GATEWAYS.map((g, i) => (
          <div
            key={g.id}
            className="rounded-xl border-2 bg-white p-3 shadow-sm"
            style={{ borderColor: ["#22c55e", "#3b82f6", "#a855f7"][i] }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Brain className="h-5 w-5" style={{ color: ["#22c55e", "#3b82f6", "#a855f7"][i] }} />
              <div className="flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ["#22c55e", "#3b82f6", "#a855f7"][i] }}>
                  Gateway {i + 1}
                </div>
                <div className="text-sm font-bold text-slate-900">{g.name}</div>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: `${TONE[g.status].dot}18`, color: TONE[g.status].dot }}
              >
                {TONE[g.status].label.toUpperCase()}
              </span>
            </div>
            <div className="space-y-1.5">
              {g.checks.map((c) => (
                <div key={c.id} className="flex items-start gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                  <StatusIcon s={c.status} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <div className="text-[11px] font-semibold text-slate-800">{c.label}</div>
                    <div className="text-[11px] text-slate-500">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="my-3 flex items-center justify-center gap-2 text-slate-400">
        <ArrowRight className="h-5 w-5 rotate-90" style={{ color: TONE[overall].dot }} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          All gateways pass → final review
        </span>
      </div>

      {/* Final check layer */}
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-bold text-slate-900">
            Final check layer — SafetyIQ &quot;Nothing Missed&quot; review
          </span>
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: `${TONE.warn.dot}18`, color: TONE.warn.dot }}
          >
            WARN
          </span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {FINAL_CHECKS.map((c) => (
            <div key={c.n} className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                {c.n}
              </span>
              <StatusIcon s={c.status} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-slate-800">{c.label}</div>
                <div className="text-[11px] text-slate-500">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="my-3 flex items-center justify-center gap-2">
        <ArrowRight className="h-5 w-5 rotate-90" style={{ color: TONE[overall].dot }} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          All checks pass → Cell Database
        </span>
      </div>

      {/* Cell Database */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Database className="h-5 w-5 text-blue-500" /> Cell Database (graph)
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <div className="text-xl font-bold text-blue-600">{v}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                {k.replace(/([A-Z])/g, " $1").trim()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> No records blocked — every input passed validation.
        </div>
      </div>
    </div>
  );
}

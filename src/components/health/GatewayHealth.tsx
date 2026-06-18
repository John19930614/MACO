"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, ArrowRight, Brain, Database, CheckCircle2, AlertTriangle, XCircle, Loader2, ShieldAlert, RotateCw, Ban } from "lucide-react";
import type { GatewayReport, GatewayResult, GatewayCheck, FinalCheck, CheckStatus } from "@/lib/gateway/pipeline";
import { canManage, type Role } from "@/lib/constants";

const TONE: Record<CheckStatus, { dot: string; text: string; bg: string; label: string }> = {
  pass: { dot: "#1f9d55", text: "text-emerald-700", bg: "bg-emerald-50", label: "Pass" },
  warn: { dot: "#d9a400", text: "text-amber-700",   bg: "bg-amber-50",   label: "Warn" },
  fail: { dot: "#e02424", text: "text-red-700",     bg: "bg-red-50",     label: "Fail" },
};

const GATEWAY_ACCENT: Record<GatewayResult["id"], string> = {
  g1: "#22c55e",
  g2: "#3b82f6",
  g3: "#a855f7",
};

const DATA_SOURCES = [
  "Incident Reports", "CAPA Actions", "Risk Assessments", "Audit Records",
  "Chemical Inventory", "Waste Streams", "Equipment & Monitoring",
];

function StatusIcon({ s, className }: { s: CheckStatus; className?: string }) {
  if (s === "pass") return <CheckCircle2 className={className} style={{ color: TONE.pass.dot }} />;
  if (s === "warn") return <AlertTriangle className={className} style={{ color: TONE.warn.dot }} />;
  return <XCircle className={className} style={{ color: TONE.fail.dot }} />;
}

function CheckRow({ c }: { c: GatewayCheck | FinalCheck }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <StatusIcon s={c.status} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold text-slate-800">{c.label}</div>
        <div className="truncate text-[10px] text-slate-400">{c.detail}</div>
      </div>
    </div>
  );
}

function GatewayCard({ g, index }: { g: GatewayResult; index: number }) {
  const accent = GATEWAY_ACCENT[g.id];
  return (
    <div className="rounded-xl border-2 bg-[var(--color-ink-2)] p-3" style={{ borderColor: accent }}>
      <div className="mb-2 flex items-center gap-2">
        <Brain className="h-5 w-5" style={{ color: accent }} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>Gateway {index + 1}</div>
          <div className="truncate text-sm font-bold text-white">{g.name}</div>
        </div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${TONE[g.status].dot}22`, color: TONE[g.status].dot }}>
          {TONE[g.status].label.toUpperCase()}
        </span>
      </div>
      <div className="space-y-1.5">{g.checks.map((c) => <CheckRow key={c.id} c={c} />)}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
      <div className="text-xl font-bold" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

export function GatewayHealth({ role = "admin" }: { role?: Role }) {
  const canSteward = canManage(role);
  const [report, setReport] = useState<GatewayReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/health", { cache: "no-store" });
    setReport(await res.json());
    setLoading(false);
  }, []);

  async function actOnReject(id: string, action: "revalidate" | "dismiss") {
    setActing(id);
    setNote(null);
    const res = await fetch("/api/gateway/rejects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const j = await res.json().catch(() => null);
    setActing(null);
    if (action === "revalidate" && j && j.ok === false) {
      setNote(`Still blocked: ${j.reason ?? "fails the gateway"}`);
    } else if (action === "revalidate") {
      setNote("Re-validated — record admitted to the EHS Database.");
    } else {
      setNote("Record dismissed from the queue.");
    }
    await load();
  }

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [auto, load]);

  const overall = report?.overall ?? "pass";

  return (
    <div className="iq-scroll flex-1 overflow-auto p-6">
      {/* Overall banner */}
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 ${TONE[overall].bg}`}>
        <StatusIcon s={overall} className="h-6 w-6" />
        <div>
          <div className={`text-sm font-bold ${TONE[overall].text}`}>
            {overall === "pass"
              ? "All gateway checks pass — EHS data is clean and validated"
              : overall === "warn"
              ? "Operational — some checks raised warnings requiring attention"
              : "A gateway check failed — records are being blocked into the reject queue"}
          </div>
          {report && (
            <div className="text-xs text-slate-500">
              {report.counts.pass} pass · {report.counts.warn} warn · {report.counts.fail} fail · {report.rejectQueue.length} blocked · mode: {report.mode} · checked {new Date(report.generatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[var(--color-pclss)]" /> auto-refresh
          </label>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-pclss)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Re-run checks
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* EHS data sources */}
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">EHS Data Sources</h2>
          <div className="flex flex-wrap gap-1.5">
            {DATA_SOURCES.map((s) => (
              <span key={s} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">{s}</span>
            ))}
          </div>

          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">3 AI Gateways · validation layer</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {report.gateways.map((g, i) => <GatewayCard key={g.id} g={g} index={i} />)}
          </div>

          <div className="my-3 flex items-center justify-center gap-2 text-slate-400">
            <ArrowRight className="h-5 w-5 rotate-90" style={{ color: TONE[overall].dot }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">All gateways pass → final review</span>
          </div>

          {/* Final "Nothing Missed" review */}
          <div className="rounded-xl border-2 border-[var(--color-pclss)] bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[var(--color-pclss)]" />
              <span className="text-sm font-bold text-slate-800">Final check layer — SafetyIQ &ldquo;Nothing Missed&rdquo; review</span>
              <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${TONE[report.finalStatus].dot}22`, color: TONE[report.finalStatus].dot }}>
                {TONE[report.finalStatus].label.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {report.finalReview.map((c) => (
                <div key={c.id} className="flex items-start gap-2 rounded-md border border-slate-200 px-2 py-1.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">{c.n}</span>
                  <StatusIcon s={c.status} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-slate-800">{c.label}</div>
                    <div className="truncate text-[10px] text-slate-400">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* EHS Database stats */}
          <div className="my-3 flex items-center justify-center gap-2 text-slate-400">
            <ArrowRight className="h-5 w-5 rotate-90" style={{ color: TONE[overall].dot }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">All checks pass → EHS Database</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Database className="h-5 w-5 text-[var(--color-pclss)]" /> EHS Database
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Stat label="Incidents"    value={report.stats.incidents}       accent="var(--color-pclss)" />
              <Stat label="Open CAPAs"  value={report.stats.openCapas}       accent={report.stats.openCapas > 0 ? "#f59e0b" : undefined} />
              <Stat label="Risk Assmts" value={report.stats.riskAssessments} accent="var(--color-pclss)" />
              <Stat label="Active Audits" value={report.stats.activeAudits}  />
              <Stat label="Chemicals"   value={report.stats.chemicals}       />
              <Stat label="Equipment"   value={report.stats.equipment}       />
            </div>
          </div>

          {/* Reject queue / exception log */}
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Reject queue / exception log</h2>
          <div className={`rounded-xl border p-3 ${report.rejectQueue.length ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            {report.rejectQueue.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> No records blocked — every EHS record passed validation.
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-red-800">{report.rejectQueue.length} record(s) blocked from the EHS Database</span>
                  {note && <span className="text-[11px] text-slate-500">· {note}</span>}
                </div>
                {report.rejectQueue.map((e) => (
                  <div key={e.recordId} className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs">
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    <span className="font-mono text-[11px] text-slate-700">{e.recordKind} {e.recordId}</span>
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">{e.category}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{e.reason}</span>
                    {e.resolvable && canSteward && (
                      <span className="flex shrink-0 items-center gap-1">
                        <button onClick={() => actOnReject(e.recordId, "revalidate")} disabled={acting === e.recordId} title="Re-run the gateway over this record and admit it if it now passes" className="inline-flex items-center gap-1 rounded border border-[var(--color-curve)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-curve)] hover:bg-[var(--color-curve-soft)] disabled:opacity-50">
                          {acting === e.recordId ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />} Re-validate
                        </button>
                        <button onClick={() => actOnReject(e.recordId, "dismiss")} disabled={acting === e.recordId} title="Dismiss this record from the queue" className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                          <Ban className="h-3 w-3" /> Dismiss
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            Every EHS record passes 3 AI gateways then the 10-check &ldquo;Nothing Missed&rdquo; review before it enters the EHS Database. Hit <span className="font-mono">/api/health</span> for the machine-readable report (503 if any hard check fails) — point an uptime monitor at it.
          </p>
        </>
      )}
    </div>
  );
}

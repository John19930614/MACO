"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, AlertOctagon, Info, Wrench,
} from "lucide-react";
import { runGatewayAgentCheck } from "@/lib/actions/gatewayAgent";
import type { GatewayHealthSnapshot, FindingSeverity } from "@/lib/gateway/agent";

const STATUS_META = {
  healthy:  { label: "Healthy",  cls: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: <ShieldCheck className="h-4 w-4" /> },
  degraded: { label: "Degraded", cls: "border-amber-200 bg-amber-50 text-amber-700",       icon: <ShieldAlert className="h-4 w-4" /> },
  critical: { label: "Critical", cls: "border-red-200 bg-red-50 text-red-700",             icon: <ShieldX className="h-4 w-4" /> },
} as const;

const SEV_META: Record<FindingSeverity, { cls: string; icon: React.ReactNode }> = {
  critical: { cls: "border-red-200 bg-red-50", icon: <AlertOctagon className="h-4 w-4 text-red-500" /> },
  warning:  { cls: "border-amber-200 bg-amber-50", icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
  info:     { cls: "border-slate-200 bg-slate-50", icon: <Info className="h-4 w-4 text-slate-400" /> },
};

export default function GatewayAgentPanel({ live, history }: { live: GatewayHealthSnapshot | null; history: GatewayHealthSnapshot[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  if (!live) return null;
  const meta = STATUS_META[live.overall_status];

  const chips = [
    { label: "Gateway", value: (live.gateway_overall ?? "—").toUpperCase() },
    { label: "Pass/Warn/Fail", value: `${live.pass_count}/${live.warn_count}/${live.fail_count}` },
    { label: "Reject Queue", value: `${live.reject_queue_count}`, warn: live.reject_queue_count > 0 },
    { label: "Review Backlog", value: `${live.human_review_queue + live.csp_pending_reviews}`, warn: (live.human_review_queue + live.csp_pending_reviews) >= 5 },
    { label: "AI Fallback", value: `${Math.round(live.ai_fallback_rate * 100)}%`, warn: live.ai_fallback_rate >= 0.25 },
    { label: "Anomalies", value: `${live.anomaly_count}`, warn: live.anomaly_count > 0 },
  ];

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">AI Gateway Agent — Monitor &amp; Maintain</div>
            <div className="text-xs text-slate-500">Watches the gateway pipeline, AI engine, and review backlog · last check {new Date(live.checked_at).toLocaleString()}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${meta.cls}`}>{meta.icon}{meta.label}</span>
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
          <button
            onClick={() => start(async () => { const r = await runGatewayAgentCheck(); setMsg(`Logged — ${r.status}, ${r.findings} finding(s)`); router.refresh(); })}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} /> {pending ? "Checking…" : "Run & log check"}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Metric chips */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {chips.map((c) => (
            <div key={c.label} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-center">
              <div className={`text-base font-bold ${c.warn ? "text-amber-600" : "text-slate-800"}`}>{c.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Findings */}
        {live.findings.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> No maintenance issues — the gateway is healthy and within tolerances.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><Wrench className="h-3.5 w-3.5" /> Maintenance findings</div>
            {live.findings.map((f, i) => {
              const s = SEV_META[f.severity];
              return (
                <div key={i} className={`rounded-lg border px-3 py-2.5 ${s.cls}`}>
                  <div className="flex items-start gap-2">
                    {s.icon}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{f.title}</div>
                      <p className="mt-0.5 text-xs text-slate-600">{f.detail}</p>
                      <p className="mt-1 text-xs text-slate-700"><span className="font-semibold">Recommended:</span> {f.recommendation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
              {showHistory ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Health history ({history.length})
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1">
                {history.map((h) => {
                  const m = STATUS_META[h.overall_status];
                  return (
                    <div key={h.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-1.5 text-xs">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${m.cls}`}>{m.label}</span>
                      <span className="text-slate-500">{new Date(h.checked_at).toLocaleString()}</span>
                      <span className="ml-auto text-slate-400">{h.findings.length} finding(s) · gw {(h.gateway_overall ?? "—").toUpperCase()} · reject {h.reject_queue_count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

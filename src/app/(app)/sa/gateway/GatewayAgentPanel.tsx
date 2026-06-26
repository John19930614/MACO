"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, AlertOctagon, Info, Wrench, Settings, GitBranch, StickyNote, Download, Plus,
  Award, GraduationCap,
} from "lucide-react";
import { runGatewayAgentCheck, updateGatewaySettings, addGatewayNote } from "@/lib/actions/gatewayAgent";
import type { GatewayHealthSnapshot, FindingSeverity, GatewaySettings, GatewayVersion, GatewayNote, GatewayQualification } from "@/lib/gateway/agent";

function exportSnapshotsCsv(rows: GatewayHealthSnapshot[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["checked_at", "overall_status", "gateway_overall", "pass", "warn", "fail", "reject_queue", "review_backlog", "ai_fallback_rate", "anomalies", "findings"];
  const body = rows.map((r) => [
    r.checked_at, r.overall_status, r.gateway_overall ?? "", r.pass_count, r.warn_count, r.fail_count,
    r.reject_queue_count, r.human_review_queue + r.csp_pending_reviews, r.ai_fallback_rate, r.anomaly_count, r.findings.length,
  ].map(esc).join(","));
  const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "gateway-health-log.csv"; a.click();
  URL.revokeObjectURL(url);
}

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

export default function GatewayAgentPanel({
  live, history, settings, versions, notes, qualifications, positioning,
}: {
  live: GatewayHealthSnapshot | null;
  history: GatewayHealthSnapshot[];
  settings: GatewaySettings | null;
  versions: GatewayVersion[];
  notes: GatewayNote[];
  qualifications: GatewayQualification[];
  positioning: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

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

        {/* Profile & qualifications (modeled on the HSE agent) */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button onClick={() => setShowProfile((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
            {showProfile ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} <Award className="h-3.5 w-3.5" /> Profile &amp; qualifications ({qualifications.filter((q) => q.status === "active").length})
          </button>
          {showProfile && (
            <div className="mt-2">
              <div className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-slate-600">{positioning}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {qualifications.map((q) => (
                  <div key={q.id} className={`rounded-lg border px-3 py-2 ${q.status === "active" ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {q.kind === "certification" ? <Award className="h-3.5 w-3.5 text-amber-500" /> : <GraduationCap className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="text-sm font-semibold text-slate-800">{q.title}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{q.kind}</span>
                      {q.grants_autonomy
                        ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">flags autonomously</span>
                        : <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">recommend only</span>}
                    </div>
                    {q.description && <p className="mt-0.5 text-xs text-slate-500">{q.description}</p>}
                    {q.scope.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.scope.map((s) => <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{s.replace(/_/g, " ")}</span>)}
                      </div>
                    )}
                  </div>
                ))}
                {qualifications.length === 0 && <div className="text-xs text-slate-400">No qualifications configured.</div>}
              </div>
            </div>
          )}
        </div>

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

        {/* Maintenance & configuration */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setShowConfig((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
              {showConfig ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} <Settings className="h-3.5 w-3.5" /> Maintenance &amp; configuration
            </button>
            <button
              onClick={() => exportSnapshotsCsv([live, ...history].filter(Boolean) as GatewayHealthSnapshot[])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          {showConfig && (
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <SettingsCard settings={settings} />
              <NotesCard notes={notes} />
              <div className="lg:col-span-2"><VersionsCard versions={versions} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ settings }: { settings: GatewaySettings | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateGatewaySettings, null as null | { ok: boolean; error?: string });
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  const s = settings;
  const fields: { name: string; label: string; def: number }[] = [
    { name: "fallback_warn_pct", label: "AI fallback warn %", def: 25 },
    { name: "fallback_critical_pct", label: "AI fallback critical %", def: 50 },
    { name: "reject_queue_warn", label: "Reject queue warn", def: 10 },
    { name: "review_backlog_warn", label: "Review backlog warn", def: 5 },
    { name: "review_backlog_critical", label: "Review backlog critical", def: 15 },
  ];
  return (
    <form action={action} className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><Settings className="h-3.5 w-3.5" /> Thresholds</div>
      <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="enabled" defaultChecked={s?.enabled ?? true} className="accent-indigo-600" /> Automated daily check enabled
      </label>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <label key={f.name} className="text-[11px] text-slate-500">
            {f.label}
            <input type="number" name={f.name} defaultValue={(s as unknown as Record<string, number>)?.[f.name] ?? f.def}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-800" />
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? "Saving…" : "Save thresholds"}</button>
        {state?.error && <span className="text-xs text-red-500">{state.error}</span>}
      </div>
    </form>
  );
}

function NotesCard({ notes }: { notes: GatewayNote[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addGatewayNote, null as null | { ok: boolean; error?: string });
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><StickyNote className="h-3.5 w-3.5" /> Maintenance notes</div>
      <form action={action} className="flex gap-2">
        <input name="note" placeholder="How a finding was resolved…" className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm text-slate-800" />
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Add</button>
      </form>
      {state?.error && <span className="text-xs text-red-500">{state.error}</span>}
      <div className="mt-2 max-h-40 space-y-1.5 overflow-auto">
        {notes.map((n) => (
          <div key={n.id} className="rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
            {n.note}
            <span className="ml-1 text-slate-400">— {n.author ?? "—"}, {new Date(n.created_at).toLocaleDateString()}</span>
          </div>
        ))}
        {notes.length === 0 && <div className="text-xs text-slate-400">No notes yet.</div>}
      </div>
    </div>
  );
}

function VersionsCard({ versions }: { versions: GatewayVersion[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><GitBranch className="h-3.5 w-3.5" /> Version history</div>
      <div className="space-y-1.5">
        {versions.map((v) => (
          <div key={v.id} className="rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs">
            <span className="font-mono font-semibold text-slate-700">{v.gateway_version}</span>
            <span className="mx-1 text-slate-400">·</span>
            <span className="font-mono text-blue-600">{v.rule_version}</span>
            {v.active && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">active</span>}
            {v.change_summary && <p className="mt-0.5 text-slate-500">{v.change_summary}</p>}
          </div>
        ))}
        {versions.length === 0 && <div className="text-xs text-slate-400">No version history.</div>}
      </div>
    </div>
  );
}

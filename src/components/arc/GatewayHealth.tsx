"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ArrowRight, Brain, Database, CheckCircle2, AlertTriangle, XCircle, ShieldAlert } from "lucide-react";
import type { GatewayReport, CheckStatus } from "@/lib/gateway/pipeline";

const TONE: Record<CheckStatus, { dot: string; text: string; bg: string; border: string; label: string }> = {
  pass: { dot: "#22c55e", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Pass" },
  warn: { dot: "#eab308", text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   label: "Warn" },
  fail: { dot: "#ef4444", text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     label: "Fail" },
};

const GATEWAY_COLORS = ["#22c55e", "#3b82f6", "#a855f7"];
const DATA_SOURCES = ["Mobile App", "Web Portal", "IoT / Sensors", "File Uploads", "API Integrations", "Manual / Offline Entry"];

// Cell Database stat tiles, mapped from the live EHS report stats.
const STAT_TILES: { key: keyof GatewayReport["stats"]; label: string }[] = [
  { key: "cells",           label: "Cells"        },
  { key: "riskObjects",     label: "Risk Objects" },
  { key: "incidents",       label: "Incidents"    },
  { key: "openCapas",       label: "Open CAPAs"   },
  { key: "platforms",       label: "Sites"        },
  { key: "chemicals",       label: "Chemicals"    },
];

function StatusIcon({ s, className }: { s: CheckStatus; className?: string }) {
  if (s === "pass") return <CheckCircle2 className={className} style={{ color: TONE.pass.dot }} />;
  if (s === "warn") return <AlertTriangle className={className} style={{ color: TONE.warn.dot }} />;
  return <XCircle className={className} style={{ color: TONE.fail.dot }} />;
}

export function GatewayHealth({ report }: { report: GatewayReport | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!report) {
    return (
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Gateway health check unavailable — ensure the EHS data layer is connected.
        </div>
      </div>
    );
  }

  const overall = report.overall;
  const blocked = report.rejectQueue.length;
  const checkedAt = new Date(report.generatedAt).toLocaleTimeString();

  return (
    <div className="iq-scroll flex-1 overflow-y-auto p-6">
      {/* Overall status banner */}
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 mb-5 ${TONE[overall].bg} ${TONE[overall].border}`}>
        <StatusIcon s={overall} className="h-6 w-6" />
        <div>
          <div className={`text-sm font-bold ${TONE[overall].text}`}>
            {overall === "pass"
              ? "All gateway checks pass — data is clean to enter the Cell Database"
              : overall === "warn"
              ? "Operational — some checks raised warnings"
              : "Check failures detected — records are being blocked from the Cell Database"}
          </div>
          <div className="text-xs text-slate-500">
            {report.counts.pass} pass · {report.counts.fail} fail · {report.counts.warn} warn · {blocked} blocked · mode: {report.mode} · checked {checkedAt}
          </div>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} /> Re-run checks
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
        {report.gateways.map((g, i) => {
          const color = GATEWAY_COLORS[i] ?? GATEWAY_COLORS[0];
          return (
            <div key={g.id} className="rounded-xl border-2 bg-white p-3 shadow-sm" style={{ borderColor: color }}>
              <div className="mb-2 flex items-center gap-2">
                <Brain className="h-5 w-5" style={{ color }} />
                <div className="flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
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
          );
        })}
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
            style={{ background: `${TONE[report.finalStatus].dot}18`, color: TONE[report.finalStatus].dot }}
          >
            {TONE[report.finalStatus].label.toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {report.finalReview.map((c) => (
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
          {STAT_TILES.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <div className="text-xl font-bold text-blue-600">{report.stats[key]}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Reject queue summary */}
      {blocked === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> No records blocked — every input passed validation.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-red-700">
            <XCircle className="h-4 w-4" /> {blocked} record{blocked === 1 ? "" : "s"} blocked from the Cell Database
          </div>
          <div className="space-y-1">
            {report.rejectQueue.slice(0, 5).map((r) => (
              <div key={`${r.recordKind}-${r.recordId}`} className="flex items-start gap-2 rounded-md border border-red-100 bg-white px-2 py-1.5 text-[11px]">
                <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">{r.recordKind}</span>
                <span className="text-slate-600"><span className="font-medium text-slate-700">{r.category}</span> — {r.reason}</span>
              </div>
            ))}
            {blocked > 5 && (
              <div className="text-[11px] text-red-600">+{blocked - 5} more in the reject queue</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

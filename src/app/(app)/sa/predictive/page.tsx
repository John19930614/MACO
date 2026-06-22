"use client";

import { useState } from "react";
import { DarkPageHeader, DarkCard, DarkCardHeader, DarkStat, Pill } from "@/components/ui/primitives";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

interface ModulePrediction {
  module: string;
  current: number;
  predicted30d: number;
  trend: "up" | "down" | "stable";
  confidence: number;
  riskSignals: number;
}

const INITIAL_PREDICTIONS: ModulePrediction[] = [
  { module: "Chemical Management", current: 74, predicted30d: 71, trend: "down",   confidence: 87, riskSignals: 4 },
  { module: "Legal Register",      current: 63, predicted30d: 68, trend: "up",     confidence: 82, riskSignals: 2 },
  { module: "CAPA",                current: 68, predicted30d: 65, trend: "down",   confidence: 91, riskSignals: 5 },
  { module: "Training",            current: 78, predicted30d: 81, trend: "up",     confidence: 89, riskSignals: 1 },
  { module: "Audits",              current: 82, predicted30d: 82, trend: "stable", confidence: 94, riskSignals: 0 },
  { module: "Documents",           current: 86, predicted30d: 84, trend: "down",   confidence: 78, riskSignals: 2 },
  { module: "Waste",               current: 88, predicted30d: 90, trend: "up",     confidence: 85, riskSignals: 0 },
  { module: "Incidents",           current: 90, predicted30d: 88, trend: "down",   confidence: 80, riskSignals: 3 },
];

const MODEL_VERSIONS = [
  { version: "v3.2.1", date: "2026-06-10", accuracy: 91.4, status: "active"   },
  { version: "v3.1.0", date: "2026-05-22", accuracy: 88.7, status: "retired"  },
  { version: "v3.0.3", date: "2026-04-15", accuracy: 85.2, status: "retired"  },
  { version: "v2.9.0", date: "2026-03-01", accuracy: 81.0, status: "retired"  },
];

const STATUS_STYLE: Record<string, string> = {
  active:  "bg-emerald-900/50 text-emerald-300",
  retired: "bg-slate-800 text-slate-400",
  staging: "bg-amber-900/50 text-amber-300",
};

function trendIcon(t: "up" | "down" | "stable") {
  if (t === "up")     return <span className="text-emerald-400 font-bold">↑</span>;
  if (t === "down")   return <span className="text-red-400 font-bold">↓</span>;
  return <span className="text-slate-400">→</span>;
}

function scoreColor(s: number) {
  if (s >= 85) return "text-emerald-400";
  if (s >= 70) return "text-amber-400";
  return "text-red-400";
}

function fmt(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SAPredictivePage() {
  const [predictions, setPredictions] = useState<ModulePrediction[]>(INITIAL_PREDICTIONS);
  const [running, setRunning]         = useState(false);
  const [toast, setToast]             = useState("");
  const [lastRun, setLastRun]         = useState("2026-06-17T09:22:00");

  const avgCurrent    = Math.round(predictions.reduce((s, p) => s + p.current, 0) / predictions.length);
  const avg30d        = Math.round(predictions.reduce((s, p) => s + p.predicted30d, 0) / predictions.length);
  const totalSignals  = predictions.reduce((s, p) => s + p.riskSignals, 0);
  const avgConfidence = Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length);

  function runModel() {
    setRunning(true);
    setTimeout(() => {
      setPredictions(prev => prev.map(p => ({
        ...p,
        predicted30d: Math.min(100, Math.max(40, p.predicted30d + Math.round((Math.random() * 6) - 2))),
        confidence:   Math.min(98, Math.max(70, p.confidence + Math.round((Math.random() * 4) - 1))),
      })));
      setLastRun(new Date().toISOString());
      setRunning(false);
      setToast("P-Engine predictive run complete");
      setTimeout(() => setToast(""), 3500);
    }, 2500);
  }

  return (
    <div className="flex flex-1 flex-col">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}

      <DarkPageHeader
        title="Predictive Model"
        subtitle="P-Engine compliance forecasting — 30-day risk predictions across all tenant modules"
        actions={
          <button onClick={runModel} disabled={running}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            {running
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Running Model…</>
              : <><RefreshCw className="h-3.5 w-3.5" /> Run P-Engine</>}
          </button>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">

        {/* Last run banner */}
        <div className="mb-5 flex items-center gap-3 rounded-xl border bg-violet-900/20 border-violet-800/50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-violet-400 shrink-0" />
          <div className="text-xs text-violet-300">
            <span className="font-semibold">Last run:</span>{" "}
            {new Date(lastRun).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {" · "}Model v3.2.1 · BioStar Research Inc.
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DarkStat label="Avg Compliance Now"    value={`${avgCurrent}%`}    hint="Across all modules"     />
          <DarkStat label="30-Day Forecast"       value={`${avg30d}%`}        hint="Predicted avg score"    accent="#7c3aed" />
          <DarkStat label="Risk Signals"          value={totalSignals}         hint="Flagged for attention"  accent="#dc2626" />
          <DarkStat label="Model Confidence"      value={`${avgConfidence}%`} hint="Prediction accuracy"    accent="#2563eb" />
        </div>

        {/* Module predictions */}
        <DarkCard className="mb-5">
          <DarkCardHeader
            title="30-Day Compliance Forecast by Module"
            subtitle="BioStar Research Inc. — active tenant"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Module</th>
                  <th className="px-4 py-2.5 text-center">Current Score</th>
                  <th className="px-4 py-2.5 text-center">30-Day Forecast</th>
                  <th className="px-4 py-2.5 text-center">Trend</th>
                  <th className="px-4 py-2.5 text-center">Confidence</th>
                  <th className="px-4 py-2.5 text-center">Risk Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {predictions.map(p => (
                  <tr key={p.module} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-medium text-white">{p.module}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${scoreColor(p.current)}`}>{p.current}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${scoreColor(p.predicted30d)}`}>{p.predicted30d}%</span>
                    </td>
                    <td className="px-4 py-3 text-center text-base">
                      {trendIcon(p.trend)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-800/60">
                          <div
                            className="h-1.5 rounded-full bg-violet-500"
                            style={{ width: `${p.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-300">{p.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.riskSignals > 0
                        ? <span className="flex items-center justify-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-400" />
                            <span className="text-xs font-bold text-amber-400">{p.riskSignals}</span>
                          </span>
                        : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DarkCard>

        {/* Model versions */}
        <DarkCard>
          <DarkCardHeader title="Model Version History" subtitle="P-Engine release log" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Version</th>
                  <th className="px-4 py-2.5 text-left">Released</th>
                  <th className="px-4 py-2.5 text-center">Accuracy</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MODEL_VERSIONS.map(v => (
                  <tr key={v.version} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-200">{v.version}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-300">{fmt(v.date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${scoreColor(v.accuracy)}`}>{v.accuracy}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={STATUS_STYLE[v.status] ?? "bg-slate-800 text-slate-400"}>{v.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DarkCard>

      </div>
    </div>
  );
}

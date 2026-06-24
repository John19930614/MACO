"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Check, Loader2, FileText, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { buildProgramFromDocs } from "@/lib/actions/ehs";

interface RequiredProgram {
  key: string;
  title: string;
  category: string;
  regulation: string;
  reason: string;
  exists: boolean;
}

export function ProgramBuilderPanel({ programs }: { programs: RequiredProgram[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});

  async function build(key: string) {
    setBusy(key);
    setErr((e) => ({ ...e, [key]: "" }));
    try {
      const res = await buildProgramFromDocs(key);
      if (res.ok) {
        setDone((d) => ({ ...d, [key]: res.grounded > 0 ? `Drafted from ${res.grounded} source doc(s)` : "Drafted" }));
        router.refresh();
      } else {
        setErr((e) => ({ ...e, [key]: res.error || "Failed to build." }));
      }
    } catch {
      setErr((e) => ({ ...e, [key]: "Failed to build — please retry." }));
    } finally {
      setBusy(null);
    }
  }

  const missing = programs.filter((p) => !p.exists).length;

  return (
    <Card className="mb-5 border-purple-200">
      <CardHeader
        title="AI Program Builder"
        subtitle={
          missing > 0
            ? `${missing} required program${missing > 1 ? "s" : ""} not yet in your library — AI can author them from your uploaded manuals + live data`
            : "All required programs are in your library"
        }
        right={<Wand2 className="h-4 w-4 text-purple-600" />}
      />
      <div className="divide-y divide-slate-50 dark:divide-slate-700">
        {programs.map((p) => (
          <div key={p.key} className="flex items-center gap-4 px-5 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30">
              {p.category === "emergency_procedure" ? <ShieldCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.title}</span>
                <span className="font-mono text-[10px] text-slate-400">{p.regulation}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{p.reason}</div>
              {err[p.key] && <div className="mt-0.5 text-xs text-red-600">{err[p.key]}</div>}
            </div>
            {p.exists ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <Check className="h-3 w-3" /> In library
              </span>
            ) : done[p.key] ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <Check className="h-3 w-3" /> {done[p.key]}
              </span>
            ) : (
              <button
                onClick={() => build(p.key)}
                disabled={busy !== null}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                {busy === p.key ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Authoring…</> : <><Wand2 className="h-3.5 w-3.5" /> Build with AI</>}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 px-5 py-2.5 text-[10px] text-slate-400 dark:border-slate-700">
        Generated programs are saved as <strong>drafts</strong> for your review, linked to the regulation they satisfy, and populate where the platform references them.
      </div>
    </Card>
  );
}

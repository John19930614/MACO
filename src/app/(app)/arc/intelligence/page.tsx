import { getPclssRuns, getExpCaptures, getVelaInsights, getSites } from "@/lib/data/repo";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { PCLSS, EXP, VELA } from "@/lib/arc/arc";
import { relativeTime } from "@/lib/utils";
import { MessageSquare, Network } from "lucide-react";
import { PclssRunButton } from "@/components/arc/PclssRunButton";

const STAGE_TONE: Record<string, string> = {
  anticipate: "bg-blue-100 text-blue-700",
  hunt: "bg-indigo-100 text-indigo-700",
  forecast: "bg-sky-100 text-sky-700",
  preempt: "bg-emerald-100 text-emerald-700",
  evolve: "bg-violet-100 text-violet-700",
};

export default async function IntelligencePage() {
  const [runs, captures, insights, sites] = await Promise.all([
    getPclssRuns(), getExpCaptures(), getVelaInsights(), getSites(),
  ]);
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;

  return (
    <>
      <PageHeader title="P-CLSS · EXP · VELA" subtitle="The proactive engine, the knowledge ghost, and cross-vertical master intelligence." />
      <div className="amaya-scroll flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* P-CLSS */}
          <Card>
            <CardHeader title={`${PCLSS.code} — ${PCLSS.title}`} subtitle={PCLSS.summary} right={<PclssRunButton />} />
            <div className="divide-y divide-slate-100">
              {runs.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STAGE_TONE[r.stage]}`}>{r.stage}</span>
                    <span className="text-xs text-slate-400">{siteName(r.site_id)} · {relativeTime(r.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{r.summary}</p>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {r.cells_scanned} scanned · {r.signals_found} signals · {r.actions_proposed} actions proposed
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* EXP */}
          <Card>
            <CardHeader title={`${EXP.code} — ${EXP.title}`} subtitle={EXP.summary} right={<MessageSquare className="h-4 w-4 text-[var(--color-exp)]" />} />
            <div className="divide-y divide-slate-100">
              {captures.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">{c.source.replace(/_/g, " ")}</span>
                    <span className="text-xs font-medium text-slate-600">{c.subject}</span>
                    {c.embedded ? (
                      <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">embedded</span>
                    ) : (
                      <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">capturing</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{c.summary}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* VELA */}
        <Card className="mt-4">
          <CardHeader title={`${VELA.code} — ${VELA.title}`} subtitle={VELA.summary} right={<Network className="h-4 w-4 text-slate-500" />} />
          <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-3">
            {insights.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-800">{v.pattern}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  origin: {v.origin_vertical} · {Math.round(v.confidence * 100)}% confidence
                </div>
                <p className="mt-1.5 text-xs text-slate-600">{v.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {v.applies_to.map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

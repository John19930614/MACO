import Link from "next/link";
import { getRiskGraph, getEvents, getBehaviors, getCells, getSites, currentUser } from "@/lib/data/repo";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { SeverityBadge } from "@/components/ui/badges";
import { ArrowRight, RotateCw } from "lucide-react";
import { RISK_OBJECT_TYPES, RISK_OBJECT_META } from "@/lib/constants";
import { proposeLearning } from "@/lib/risk/derive";
import { LogEventForm } from "@/components/risk/LogEventForm";
import { relativeTime } from "@/lib/utils";

// Reliance Risk Intelligence Framework (build manual §6) — the six connected
// risk objects, with live counts and the Event/Behavior cells made explicit.
export default async function FrameworkPage() {
  const [graph, events, behaviors, cells, sites] = await Promise.all([getRiskGraph(), getEvents(), getBehaviors(), getCells(), getSites()]);
  const cellTitle = (id: string | null) => (id ? cells.find((c) => c.id === id)?.title ?? id : null);
  // Close the loop: each outcome proposes a Learning Cell.
  const learnByEvent = new Map(proposeLearning(events, cells).map((l) => [l.event_id, l]));

  return (
    <>
      <PageHeader
        title="Risk Intelligence Framework"
        subtitle="Reliance as a living system of six connected risk objects (manual §6)."
        actions={
          <div className="flex items-center gap-2">
            <LogEventForm role={currentUser().role} sites={sites.map((s) => ({ id: s.id, name: s.name }))} cells={cells.map((c) => ({ id: c.id, title: c.title, site_id: c.site_id }))} />
            <Link href="/web3d" className="rounded-lg bg-[var(--color-pclss)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
              View in 3D
            </Link>
          </div>
        }
      />
      <div className="amaya-scroll flex-1 overflow-auto p-6">
        {/* The ARC continuous loop — how a signal moves through the six objects
            and feeds back into anticipation. */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {RISK_OBJECT_TYPES.map((t, i) => (
              <div key={t} className="flex shrink-0 items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: `${RISK_OBJECT_META[t].color}1a`, color: RISK_OBJECT_META[t].color }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: RISK_OBJECT_META[t].color }} />
                  {RISK_OBJECT_META[t].label.replace(" Cell", "")}
                </span>
                {i < RISK_OBJECT_TYPES.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />}
              </div>
            ))}
            <RotateCw className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The ARC continuous loop — early signals move through controls, failures, behaviors, and events; each outcome feeds learning back into anticipation.
          </p>
        </div>

        {/* The six objects — mirrors the manual table, color-coded, with live counts. */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {RISK_OBJECT_TYPES.map((t) => {
            const meta = RISK_OBJECT_META[t];
            return (
              <div key={t} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: `${meta.color}14`, borderBottom: `2px solid ${meta.color}` }}>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: meta.color }} />
                    <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: meta.color }}>{graph.counts[t]}</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-slate-700">{meta.represents}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">{meta.whyItMatters}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* What this creates — the manual's closing callout. */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm font-semibold text-amber-900">What this creates</div>
          <p className="mt-1 text-sm text-amber-800">
            A risk intelligence model that connects daily records to the controls, actions, outcomes, and learning needed to improve prevention.
          </p>
        </div>

        {/* The two newly first-class objects, made explicit and traceable. */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Event Cells" subtitle="Outcomes traced back to the precursor that warned of them" right={<Count n={events.length} color={RISK_OBJECT_META.event.color} />} />
            <div className="divide-y divide-slate-100">
              {events.map((e) => {
                const precursor = cellTitle(e.cell_id);
                return (
                  <div key={e.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={e.severity} />
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${RISK_OBJECT_META.event.color}1a`, color: RISK_OBJECT_META.event.color }}>
                        {e.kind.replace(/_/g, " ")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{e.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">{relativeTime(e.occurred_at)}</span>
                    </div>
                    {e.cell_id && (
                      <Link href={`/cells/${e.cell_id}`} className="mt-1 inline-block text-xs text-[var(--color-pclss)] hover:underline">
                        ← traces to: {precursor}
                      </Link>
                    )}
                    {learnByEvent.get(e.id) && (
                      <div className="mt-1 flex items-start gap-1.5 text-xs" style={{ color: RISK_OBJECT_META.learning.color }}>
                        <span className="shrink-0 font-semibold">→ learning:</span>
                        <span className="text-slate-600">{learnByEvent.get(e.id)!.title}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {events.length === 0 && <Empty>No events recorded.</Empty>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Behavior Cells" subtitle="Repeated human / organizational patterns to coach" right={<Count n={behaviors.length} color={RISK_OBJECT_META.behavior.color} />} />
            <div className="divide-y divide-slate-100">
              {behaviors.map((b) => (
                <div key={b.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${RISK_OBJECT_META.behavior.color}1a`, color: RISK_OBJECT_META.behavior.color }}>
                      {b.pattern.replace(/_/g, " ")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{b.title}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">×{b.occurrences}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {b.cell_ids.map((cid) => (
                      <Link key={cid} href={`/cells/${cid}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">
                        {cellTitle(cid)}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {behaviors.length === 0 && <Empty>No behavior patterns yet.</Empty>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Count({ n, color }: { n: number; color: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-sm font-bold" style={{ background: `${color}1a`, color }}>
      {n}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3 text-xs text-slate-400">{children}</p>;
}

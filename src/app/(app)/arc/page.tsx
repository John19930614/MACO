import Image from "next/image";
import { Card } from "@/components/ui/primitives";
import { ARC_LAYERS, GUS, VELA, LEARNING_CURVE, ARC_TAGLINE, type ArcLayer } from "@/lib/arc/arc";

const LAYER_BG: Record<string, string> = {
  exp: "var(--color-exp)",
  pclss: "var(--color-pclss)",
  hsl: "var(--color-hsl)",
  curve: "var(--color-curve)",
  engine: "var(--color-engine)",
};

export default function ArcMethodPage() {
  return (
    <>
      <div className="amaya-scroll flex-1 overflow-auto">
        {/* Hero */}
        <div className="bg-[var(--color-ink-2)] px-6 py-8 text-white">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-2xl font-black tracking-tight">ARC — Adaptive Risk Continuum</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-loop)]">{ARC_TAGLINE}</p>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              ARC is the methodology AMAYA implements. The Safety Cell product captures and proves risk;
              ARC is the intelligence loop that makes those cells compound in value over time. Every reviewed
              outcome feeds back to <span className="font-semibold text-white">Anticipate</span> — the moat widens with use.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* The method diagram */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Full method overview</h2>
              <p className="text-xs text-slate-500">The published ARC diagram — EXP → P-CLSS → HSL → continuous learning curve, powered by GUS &amp; VELA.</p>
            </div>
            <div className="flex justify-center bg-slate-50 p-4">
              <Image src="/arc-method.svg" alt="ARC — Adaptive Risk Continuum method diagram" width={680} height={1060} className="h-auto w-full max-w-[680px]" priority />
            </div>
          </Card>

          {/* Layer cards */}
          <div className="mt-6 space-y-4">
            {ARC_LAYERS.map((layer) => (
              <LayerCard key={layer.key} layer={layer} bg={LAYER_BG[layer.color]} />
            ))}
          </div>

          {/* Learning curve */}
          <Card className="mt-4 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: LAYER_BG.curve }}>
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold text-white">CURVE</span>
              <span className="text-sm font-semibold text-white">{LEARNING_CURVE.title}</span>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600">{LEARNING_CURVE.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {LEARNING_CURVE.milestones.map((m) => (
                  <div key={m.at} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-700">{m.at}</div>
                    <div className="text-[11px] text-slate-500">{m.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* GUS + VELA */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EngineCard code={GUS.code} title={GUS.title} subtitle={GUS.subtitle} summary={GUS.summary} href="/arc/verticals" />
            <EngineCard code={VELA.code} title={VELA.title} subtitle={VELA.subtitle} summary={VELA.summary} href="/arc/intelligence" />
          </div>
        </div>
      </div>
    </>
  );
}

function LayerCard({ layer, bg }: { layer: ArcLayer; bg: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: bg }}>
        <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold text-white">{layer.code}</span>
        <span className="text-sm font-semibold text-white">{layer.title}</span>
      </div>
      <div className="p-4">
        <p className="text-sm text-slate-600">{layer.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {layer.stages.map((s) => (
            <div key={s.key} className="rounded-lg border border-slate-200 px-3 py-1.5">
              <div className="text-xs font-semibold text-slate-700">{s.name}</div>
              <div className="text-[11px] text-slate-400">{s.blurb}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">In AMAYA: </span>
          <span className="text-xs text-slate-600">{layer.amayaMapping}</span>
        </div>
      </div>
    </Card>
  );
}

function EngineCard({ code, title, subtitle, summary, href }: { code: string; title: string; subtitle: string; summary: string; href: string }) {
  return (
    <a href={href} className="block">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--color-engine)" }}>
          <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold text-white">{code}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="ml-auto text-[11px] text-slate-300">{subtitle}</span>
        </div>
        <p className="p-4 text-sm text-slate-600">{summary}</p>
      </Card>
    </a>
  );
}

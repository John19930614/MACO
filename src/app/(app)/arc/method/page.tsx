import { ARC_LAYERS, GUS, GUS_VERTICALS, VELA, LEARNING_CURVE } from "@/lib/arc/arc";
import { PageHeader, Card } from "@/components/ui/primitives";

export const metadata = { title: "ARC Method — SafetyIQ" };

const LAYER_COLORS: Record<string, { badge: string; text: string; bg: string }> = {
  exp:   { badge: "bg-sky-100 text-sky-700",     text: "text-sky-600",     bg: "bg-sky-50"     },
  pclss: { badge: "bg-indigo-100 text-indigo-700", text: "text-indigo-600", bg: "bg-indigo-50"  },
  hsl:   { badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-600", bg: "bg-emerald-50" },
};

export default function MethodPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="ARC Method"
        subtitle="Adaptive Risk Continuum — the methodology SafetyIQ implements."
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Three ARC layer cards */}
        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {ARC_LAYERS.map(layer => {
            const meta = LAYER_COLORS[layer.key] ?? {
              badge: "bg-slate-100 text-slate-700",
              text:  "text-slate-600",
              bg:    "bg-slate-50",
            };
            return (
              <Card key={layer.key}>
                <div className="p-5">
                  {/* Code badge + title */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold tracking-wider ${meta.badge}`}>
                      {layer.code}
                    </span>
                    <h2 className="text-sm font-semibold text-slate-800">{layer.title}</h2>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{layer.summary}</p>

                  {/* Stages */}
                  <div className="space-y-1.5">
                    {layer.stages.map((stage, i) => (
                      <div key={stage.key} className="flex items-center gap-2.5">
                        <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border-2 ${meta.badge} border-current`}>
                          <span className={`${meta.text} text-[11px] font-bold`}>{i + 1}</span>
                        </span>
                        <div className="min-w-0">
                          <span className={`text-[11px] font-semibold ${meta.text}`}>{stage.name}</span>
                          <span className="ml-2 text-[11px] text-slate-500">{stage.blurb}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mapping note */}
                  <div className={`mt-4 rounded-lg px-3 py-2 ${meta.bg}`}>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{layer.amayaMapping}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Learning Curve + GUS + VELA row */}
        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Learning Curve */}
          <Card>
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="rounded px-2 py-0.5 text-[11px] font-bold tracking-wider bg-teal-100 text-teal-700">
                  {LEARNING_CURVE.code}
                </span>
                <h2 className="text-sm font-semibold text-slate-800">{LEARNING_CURVE.title}</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">{LEARNING_CURVE.summary}</p>
              <div className="space-y-2">
                {LEARNING_CURVE.milestones.map((m, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-teal-700">{m.at}</p>
                      <p className="text-[11px] text-slate-500">{m.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* GUS engine */}
          <Card>
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="rounded px-2 py-0.5 text-[11px] font-bold tracking-wider bg-amber-100 text-amber-700">
                  {GUS.code}
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">{GUS.title}</h2>
                  <p className="text-[11px] text-amber-600 font-medium">{GUS.subtitle}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">{GUS.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                {GUS_VERTICALS.map(v => (
                  <span
                    key={v.slug}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-medium"
                  >
                    {v.name}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* VELA engine */}
          <Card>
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="rounded px-2 py-0.5 text-[11px] font-bold tracking-wider bg-violet-100 text-violet-700">
                  {VELA.code}
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">{VELA.title}</h2>
                  <p className="text-[11px] text-violet-600 font-medium">{VELA.subtitle}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">{VELA.summary}</p>
              <div className="space-y-1.5">
                {["Mining pattern →", "Construction warning", "Manufacturing insight", "Cross-sector learning"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                    <span className="text-[11px] text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2">
                <p className="text-[11px] text-violet-700 font-medium">
                  Cross-vertical master intelligence — patterns no single vertical could see alone.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Full stack overview */}
        <Card>
          <div className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">ARC Layer Stack</h2>
            <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-slate-200">
              {[
                { code: "EXP",    label: "Experience Intelligence Protocol",           color: "#0ea5e9", desc: "Elicit · Convert · Embed"                             },
                { code: "P-CLSS", label: "Proactive Continuous Learning Safety System", color: "#6366f1", desc: "Anticipate · Hunt · Forecast · Pre-empt · Evolve"   },
                { code: "HSL",    label: "Human Signal Layer",                          color: "#10b981", desc: "6 human dimensions measured continuously"             },
                { code: "GUS",    label: "Per-vertical AI engine",                      color: "#f59e0b", desc: `${GUS_VERTICALS.length} industry verticals`           },
                { code: "VELA",   label: "Master cross-vertical intelligence",          color: "#a855f7", desc: "Learns patterns no single vertical sees alone"        },
              ].map((row) => (
                <div
                  key={row.code}
                  className="flex items-center gap-4 bg-white px-4 py-2.5 border-b border-slate-100 last:border-0"
                  style={{ borderLeft: `3px solid ${row.color}` }}
                >
                  <span
                    className="w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-bold"
                    style={{ background: `${row.color}18`, color: row.color }}
                  >
                    {row.code}
                  </span>
                  <span className="flex-1 text-xs font-medium text-slate-700">{row.label}</span>
                  <span className="text-[11px] text-slate-500 hidden sm:block">{row.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

import ExpIntakeForm from "@/components/arc/ExpIntakeForm";
import { EXP_CAPTURES, ARC_SITES } from "@/lib/data/mock";
import { EXP } from "@/lib/arc/arc";
import { PageHeader } from "@/components/ui/primitives";

export default function IntakePage() {
  const recentCaptures = [...EXP_CAPTURES]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const sites = ARC_SITES.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`${EXP.code} Intake`}
        subtitle="Describe any observation in plain language. The AI extracts the hazard genome and drafts a structured Safety Cell for your review."
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* EXP stage strip */}
        <div className="mb-5 flex flex-wrap gap-2">
          {EXP.stages.map((stage) => (
            <div
              key={stage.key}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm"
            >
              <span className="font-semibold text-slate-800">{stage.name}</span>
              <span className="ml-2 text-slate-500">· {stage.blurb}</span>
            </div>
          ))}
        </div>

        <ExpIntakeForm sites={sites} recentCaptures={recentCaptures} />
      </div>
    </div>
  );
}

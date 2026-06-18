import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";

const KANBAN = [
  {
    stage: "Prospect",
    color: "bg-slate-200",
    items: [
      { name: "PharmaLink Corp", note: "Demo scheduled Jun 25" },
    ],
  },
  {
    stage: "Scoping",
    color: "bg-blue-200",
    items: [],
  },
  {
    stage: "Data Collection",
    color: "bg-amber-200",
    items: [
      {
        name: "NovaChem Solutions",
        note: "Chemical inventory review in progress",
        checks: ["Document request list sent & received ✓", "Chemical inventory review — in progress", "Legal register template sent ✓", "Training records import pending"],
      },
      {
        name: "GenTech Biopharma",
        note: "SDS import queued",
        checks: ["Document request list sent & received ✓", "Chemical inventory review ✓", "Legal register template sent — pending return", "Training records import pending"],
      },
    ],
  },
  {
    stage: "Configuration",
    color: "bg-violet-200",
    items: [
      { name: "Meridian Diagnostics", note: "P-Engine configured" },
    ],
  },
  {
    stage: "Live",
    color: "bg-emerald-200",
    items: [
      { name: "BioStar Research Inc.", note: "Fully live · v0.6" },
    ],
  },
];

export default function SAImplPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Implementation Tracker"
        subtitle="Client onboarding pipeline — Kanban view"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="flex gap-4 overflow-x-auto pb-2">
          {KANBAN.map((col) => (
            <div key={col.stage} className="min-w-56 flex-1">
              <div className={`mb-3 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ${col.color}`}>
                {col.stage} ({col.items.length})
              </div>
              <div className="space-y-2">
                {col.items.map((item) => {
                  const checks = "checks" in item ? item.checks : null;
                  return (
                    <div key={item.name} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.note}</div>
                      {checks && (
                        <ul className="mt-2 space-y-0.5">
                          {checks.map((c: string) => (
                            <li key={c} className={`text-[11px] ${c.endsWith("✓") ? "text-emerald-600" : "text-slate-500"}`}>
                              {c.endsWith("✓") ? "✓" : "○"} {c.replace(" ✓", "")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {col.items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

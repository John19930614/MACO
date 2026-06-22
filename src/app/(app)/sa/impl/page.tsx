import { DarkPageHeader } from "@/components/ui/primitives";

interface KanbanItem {
  name: string;
  note: string;
  expected?: string;
  checks?: string[];
}

interface KanbanCol {
  stage: string;
  color: string;
  headerText: string;
  items: KanbanItem[];
}

const KANBAN: KanbanCol[] = [
  {
    stage: "Prospect",
    color: "bg-slate-700/60",
    headerText: "text-slate-200",
    items: [
      { name: "PharmaLink Corp", note: "Demo scheduled", expected: "Jun 25, 2026" },
    ],
  },
  {
    stage: "Scoping",
    color: "bg-blue-900/50",
    headerText: "text-blue-300",
    items: [],
  },
  {
    stage: "Data Collection",
    color: "bg-amber-900/50",
    headerText: "text-amber-300",
    items: [
      {
        name: "NovaChem Solutions",
        note: "Chemical inventory in progress",
        expected: "Jul 10, 2026",
        checks: [
          "Document request list sent & received ✓",
          "Chemical inventory review — in progress",
          "Legal register template sent ✓",
          "Training records import pending",
        ],
      },
      {
        name: "GenTech Biopharma",
        note: "SDS import queued",
        expected: "Jul 20, 2026",
        checks: [
          "Document request list sent & received ✓",
          "Chemical inventory review ✓",
          "Legal register template sent — pending return",
          "Training records import pending",
        ],
      },
    ],
  },
  {
    stage: "Configuration",
    color: "bg-violet-900/50",
    headerText: "text-violet-300",
    items: [
      {
        name: "Meridian Diagnostics",
        note: "P-Engine configured",
        expected: "Jun 30, 2026",
        checks: [
          "Module configuration complete ✓",
          "P-Engine trained on tenant data ✓",
          "User accounts created ✓",
          "Acceptance testing in progress",
        ],
      },
    ],
  },
  {
    stage: "Live",
    color: "bg-emerald-900/50",
    headerText: "text-emerald-300",
    items: [
      {
        name: "BioStar Research Inc.",
        note: "Fully live · v0.6",
        expected: "Launched Apr 2026",
        checks: [
          "All modules live ✓",
          "Team trained ✓",
          "P-Engine running ✓",
          "QBR scheduled ✓",
        ],
      },
    ],
  },
];

function completionPct(checks: string[]) {
  const done = checks.filter(c => c.endsWith("✓")).length;
  return Math.round((done / checks.length) * 100);
}

function ChecklistBar({ checks }: { checks: string[] }) {
  const pct = completionPct(checks);
  const color = pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-400";
  return (
    <div className="mt-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Checklist</span>
        <span className={`text-[11px] font-bold ${pct === 100 ? "text-emerald-400" : "text-slate-400"}`}>{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-slate-800/60">
        <div className={`h-1 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {checks.map((c) => {
          const done = c.endsWith("✓");
          const label = c.replace(" ✓", "").replace(" — in progress", " (in progress)").replace(" — pending return", " (pending return)");
          return (
            <li key={c} className={`flex items-start gap-1 text-[11px] ${done ? "text-emerald-400" : "text-slate-400"}`}>
              <span className="mt-0.5 shrink-0">{done ? "✓" : "○"}</span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function SAImplPage() {
  const totalClients = KANBAN.flatMap(c => c.items).length;
  const liveClients  = KANBAN.find(c => c.stage === "Live")?.items.length ?? 0;
  const inProgress   = KANBAN.filter(c => !["Prospect", "Live"].includes(c.stage)).flatMap(c => c.items).length;

  return (
    <div className="flex flex-1 flex-col">
      <DarkPageHeader
        title="Implementation Tracker"
        subtitle="Client onboarding pipeline — Kanban view"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Stats bar */}
        <div className="mb-5 grid grid-cols-3 gap-4 sm:grid-cols-5">
          {[
            { label: "Total Clients", value: totalClients,          color: "text-white" },
            { label: "Live",          value: liveClients,           color: "text-emerald-400" },
            { label: "In Progress",   value: inProgress,            color: "text-blue-400"    },
            { label: "Prospect",      value: KANBAN[0].items.length, color: "text-slate-400"  },
            { label: "Stages",        value: KANBAN.length,          color: "text-violet-400" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-slate-900/60 px-3 py-2.5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
              <div className={`mt-1 text-2xl font-black ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Kanban board */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {KANBAN.map((col) => (
            <div key={col.stage} className="min-w-60 flex-1">
              <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-1.5 ${col.color}`}>
                <span className={`text-xs font-bold uppercase tracking-wide ${col.headerText}`}>{col.stage}</span>
                <span className={`rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold ${col.headerText}`}>{col.items.length}</span>
              </div>
              <div className="space-y-3">
                {col.items.map((item) => (
                  <div key={item.name} className="rounded-xl border border-white/8 bg-slate-900/60 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-white">{item.name}</div>
                      {col.stage === "Live" && (
                        <span className="shrink-0 rounded-full bg-emerald-900/50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">LIVE</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">{item.note}</div>
                    {item.expected && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        {col.stage === "Live" ? "📅 " : "🎯 "}{item.expected}
                      </div>
                    )}
                    {item.checks && <ChecklistBar checks={item.checks} />}
                  </div>
                ))}
                {col.items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/8 p-4 text-center text-xs text-slate-400">
                    No clients in this stage
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

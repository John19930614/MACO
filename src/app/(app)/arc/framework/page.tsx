import { getCells, getProofs, getEvents, getBehaviors } from "@/lib/data/repo";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";

export const metadata = { title: "Risk Intelligence Framework — SafetyIQ" };

const GOOD_PROOF_STATUSES = new Set(["proven", "weak_proof", "not_applicable"]);
const BAD_PROOF_STATUSES  = new Set(["missing", "expired", "conflicting", "not_checked"]);

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#94a3b8",
};

export default async function FrameworkPage() {
  const [cells, proofs, events, behaviors] = await Promise.all([
    getCells(), getProofs(), getEvents(), getBehaviors(),
  ]);

  const provenCount   = proofs.filter(p => GOOD_PROOF_STATUSES.has(p.status)).length;
  const failureCount  = proofs.filter(p => BAD_PROOF_STATUSES.has(p.status)).length;
  const learningCount = cells.filter(c => c.status === "closed").length;

  const objects = [
    { type: "precursor", color: "#eab308", label: "Precursor", count: cells.filter(c => c.cell_type === "precursor").length, description: "The early-warning signal — a condition that precedes harm if uncontrolled." },
    { type: "control",   color: "#22c55e", label: "Control",   count: provenCount,       description: "A safeguard that is verified and active — the system is working." },
    { type: "failure",   color: "#ef4444", label: "Failure",   count: failureCount,      description: "A control that is missing, expired, or bypassed — the gap in the defence." },
    { type: "behavior",  color: "#a855f7", label: "Behavior",  count: behaviors.length,  description: "A recurring human or organisational pattern that amplifies risk." },
    { type: "event",     color: "#3b82f6", label: "Event",     count: events.length,     description: "An outcome: incident, near-miss, claim, or audit finding." },
    { type: "learning",  color: "#14b8a6", label: "Learning",  count: learningCount,     description: "An insight that folds back into the model to prevent recurrence." },
  ];

  const totalObjects = objects.reduce((s, o) => s + o.count, 0);

  const svgNodes = [
    { key: "precursor", label: "Precursor", color: "#eab308", cx: 220, cy: 60  },
    { key: "event",     label: "Event",     color: "#3b82f6", cx: 380, cy: 130 },
    { key: "failure",   label: "Failure",   color: "#ef4444", cx: 380, cy: 260 },
    { key: "learning",  label: "Learning",  color: "#14b8a6", cx: 220, cy: 330 },
    { key: "control",   label: "Control",   color: "#22c55e", cx: 60,  cy: 260 },
    { key: "behavior",  label: "Behavior",  color: "#a855f7", cx: 60,  cy: 130 },
  ];

  const polyPoints = svgNodes.map(n => `${n.cx},${n.cy}`).join(" ");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Risk Intelligence Framework"
        subtitle="Reliance as a living system of six connected risk objects."
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex flex-wrap gap-3">
          {objects.map(obj => (
            <div key={obj.type} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: obj.color }} />
              <span className="text-xs font-semibold text-slate-700">{obj.label}</span>
              <span className="text-sm font-bold" style={{ color: obj.color }}>{obj.count}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <span className="text-xs font-semibold text-slate-500">Total objects</span>
            <span className="text-sm font-bold text-slate-900">{totalObjects}</span>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {objects.map(obj => (
            <Card key={obj.type}>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className="h-3 w-3 rounded-full shrink-0 mt-1" style={{ background: obj.color }} />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: obj.color }}>{obj.label}</p>
                    <p className="mt-0.5 text-2xl font-extrabold text-slate-900 leading-none">{obj.count}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed">{obj.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="ARC Continuous Loop" />
            <div className="flex justify-center px-4 pb-4">
              <svg viewBox="0 0 440 390" width="320" height="280" xmlns="http://www.w3.org/2000/svg">
                <polygon points={polyPoints} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />
                {svgNodes.map(node => (
                  <g key={node.key}>
                    <circle cx={node.cx} cy={node.cy} r="28" fill="white" stroke={node.color} strokeWidth="1.5" />
                    <text x={node.cx} y={node.cy - 4} textAnchor="middle" fill={node.color} fontSize="10" fontWeight="700" fontFamily="system-ui,sans-serif">{node.label}</text>
                    <text x={node.cx} y={node.cy + 9} textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="800" fontFamily="system-ui,sans-serif">{objects.find(o => o.type === node.key)?.count ?? 0}</text>
                  </g>
                ))}
                <text x="220" y="192" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="system-ui,sans-serif" fontWeight="600">ARC</text>
                <text x="220" y="203" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="system-ui,sans-serif">living system</text>
              </svg>
            </div>
            <p className="px-4 pb-4 text-center text-xs text-slate-500">Each object class connects causally — the loop is continuous.</p>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Event Cells"
                right={<span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "#3b82f618", color: "#3b82f6" }}>{events.length}</span>}
              />
              <div className="space-y-2 px-4 pb-4">
                {events.length === 0 && <p className="text-xs text-slate-400">No events recorded yet.</p>}
                {events.slice(0, 5).map(evt => (
                  <div key={evt.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{evt.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500 capitalize">{evt.kind.replace(/_/g, " ")}</p>
                    </div>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase" style={{ background: `${SEVERITY_COLORS[evt.severity] ?? "#94a3b8"}18`, color: SEVERITY_COLORS[evt.severity] ?? "#94a3b8" }}>{evt.severity}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Behavior Cells"
                right={<span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "#a855f718", color: "#a855f7" }}>{behaviors.length}</span>}
              />
              <div className="space-y-2 px-4 pb-4">
                {behaviors.length === 0 && <p className="text-xs text-slate-400">No behavior patterns detected yet.</p>}
                {behaviors.slice(0, 4).map(beh => (
                  <div key={beh.id} className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-800">{beh.title}</p>
                      <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700">{beh.occurrences}× seen</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{beh.description}</p>
                    <p className="mt-1 text-[11px] text-slate-500 capitalize">{beh.pattern.replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

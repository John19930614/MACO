import { CELLS, PROOFS } from "@/lib/data/mock";
import { PageHeader, Card, CardHeader, Stat } from "@/components/ui/primitives";
import type { ProofStatus } from "@/lib/types";

export const metadata = { title: "Control Proof Ledger — SafetyIQ" };

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#94a3b8",
};

const PROOF_BADGE: Record<ProofStatus, { bg: string; text: string; label: string }> = {
  proven:         { bg: "#16a34a18", text: "#16a34a", label: "Proven"      },
  weak_proof:     { bg: "#65a30d18", text: "#65a30d", label: "Weak proof"  },
  not_applicable: { bg: "#47556918", text: "#64748b", label: "N/A"         },
  missing:        { bg: "#ef444418", text: "#ef4444", label: "Missing"     },
  expired:        { bg: "#f9731618", text: "#f97316", label: "Expired"     },
  conflicting:    { bg: "#ef444418", text: "#ef4444", label: "Conflicting" },
  not_checked:    { bg: "#47556918", text: "#64748b", label: "Not checked" },
};

const PROOF_ORDER: ProofStatus[] = [
  "missing", "expired", "conflicting", "not_checked", "weak_proof", "not_applicable", "proven",
];
const proofRank = (status: ProofStatus) => PROOF_ORDER.indexOf(status);
const BAD_STATUSES: Set<ProofStatus> = new Set(["missing", "expired", "conflicting", "not_checked"]);

export default function ProofPage() {
  const cellById = Object.fromEntries(CELLS.map(c => [c.id, c]));

  const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...PROOFS].sort((a, b) => {
    const rankDiff = proofRank(a.status as ProofStatus) - proofRank(b.status as ProofStatus);
    if (rankDiff !== 0) return rankDiff;
    const cellA = cellById[a.cell_id];
    const cellB = cellById[b.cell_id];
    return (SEVERITY_RANK[cellA?.severity ?? "low"] ?? 3) - (SEVERITY_RANK[cellB?.severity ?? "low"] ?? 3);
  });

  const total   = PROOFS.length;
  const bad     = PROOFS.filter(p => BAD_STATUSES.has(p.status as ProofStatus)).length;
  const proven  = PROOFS.filter(p => p.status === "proven").length;
  const pending = PROOFS.filter(p => p.status === "not_checked").length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Control Proof Ledger"
        subtitle="Verification state for every required control."
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Proofs"      value={total}   strip="#94a3b8" />
          <Stat label="Missing / Expired" value={bad}     accent="#ef4444" strip="#ef4444" />
          <Stat label="Proven"            value={proven}  accent="#22c55e" strip="#22c55e" />
          <Stat label="Pending Review"    value={pending} accent="#eab308" strip="#eab308" />
        </div>

        {/* Proof table */}
        <Card>
          <CardHeader
            title="Proof Status by Control"
            subtitle="Worst status shown first"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Cell</th>
                  <th className="px-4 py-2.5 text-left">Required control</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map(proof => {
                  const cell    = cellById[proof.cell_id];
                  const badge   = PROOF_BADGE[proof.status as ProofStatus] ?? PROOF_BADGE.not_checked;
                  const sevColor = SEVERITY_COLORS[cell?.severity ?? "low"] ?? "#94a3b8";
                  return (
                    <tr key={proof.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 max-w-[220px]">
                        {cell ? (
                          <span className="font-medium leading-snug" style={{ color: sevColor }}>
                            {cell.title}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unknown cell</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[240px]">
                        <span className="leading-snug">{proof.control}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex rounded px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cell ? (
                          <span
                            className="inline-flex rounded px-2 py-0.5 text-[11px] font-semibold capitalize"
                            style={{ background: `${sevColor}18`, color: sevColor }}
                          >
                            {cell.severity}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sorted.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                No control proofs recorded yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

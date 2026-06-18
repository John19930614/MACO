import Link from "next/link";
import { getProofs, getCells } from "@/lib/data/repo";
import { PageHeader, Stat } from "@/components/ui/primitives";
import { ProofBadge } from "@/components/ui/badges";
import { relativeTime } from "@/lib/utils";
import { PROOF_STATUSES } from "@/lib/constants";

// Control Proof Ledger (manual §5.9). Weak/missing proof is a RISK signal,
// not just a documentation gap — so it is surfaced and sorted to the top.
export default async function ProofPage() {
  const [proofs, cells] = await Promise.all([getProofs(), getCells()]);
  const cellById = new Map(cells.map((c) => [c.id, c]));

  const weight: Record<string, number> = {
    missing: 0, conflicting: 1, expired: 2, weak_proof: 3, not_checked: 4, not_applicable: 5, proven: 6,
  };
  const sorted = [...proofs].sort((a, b) => (weight[a.status] ?? 9) - (weight[b.status] ?? 9));

  const count = (s: string) => proofs.filter((p) => p.status === s).length;
  const atRisk = count("missing") + count("weak_proof") + count("expired") + count("conflicting");

  return (
    <>
      <PageHeader title="Control Proof Ledger" subtitle="Verification state for every required control" />
      <div className="amaya-scroll flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Controls tracked" value={proofs.length} />
          <Stat label="At-risk proof" value={atRisk} accent="var(--color-sev-high)" hint="missing · weak · expired · conflicting" />
          <Stat label="Proven" value={count("proven")} accent="var(--color-sev-low)" />
          <Stat label="Missing" value={count("missing")} accent="var(--color-sev-critical)" />
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Control</th>
                <th className="px-4 py-2.5">Safety Cell</th>
                <th className="px-4 py-2.5">Proof</th>
                <th className="px-4 py-2.5">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((p) => {
                const cell = cellById.get(p.cell_id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p.control}</div>
                      {p.evidence_summary && <div className="text-xs text-slate-400">{p.evidence_summary}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {cell ? (
                        <Link href={`/cells/${cell.id}`} className="text-slate-600 hover:text-[var(--color-pclss)] hover:underline">
                          {cell.title}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3"><ProofBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{p.verified_at ? relativeTime(p.verified_at) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Statuses: {PROOF_STATUSES.map((s) => s.replace(/_/g, " ")).join(" · ")}. Change proof state from a cell&apos;s record; every change is written to the audit log.
        </p>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { X, Sparkles, ExternalLink, Loader2, Check, Ban } from "lucide-react";
import type { CellBundle, AiFinding, AiAnalysisOutput, ControlProof } from "@/lib/types";
import { SeverityBadge, StatusBadge, ProofBadge } from "@/components/ui/badges";
import { PROOF_STATUSES, PROOF_META, canWrite, canCreateActions, type ProofStatus, type Role } from "@/lib/constants";
import { relativeTime, writeFailMessage } from "@/lib/utils";

export function CellDrawer({ cellId, role, onClose }: { cellId: string | null; role: Role; onClose: () => void }) {
  const canEditProof = canWrite(role);
  const canReview = canCreateActions(role);
  const [bundle, setBundle] = useState<CellBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/cells/${id}`);
    const json = await res.json();
    setBundle(json.bundle ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (cellId) load(cellId);
    else setBundle(null);
  }, [cellId, load]);

  async function analyze() {
    if (!cellId) return;
    setAnalyzing(true);
    await fetch("/api/ai/analyze-cell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cell_id: cellId }),
    });
    await load(cellId);
    setAnalyzing(false);
  }

  async function setProof(p: ControlProof, status: ProofStatus) {
    setWriteError(null);
    const res = await fetch("/api/proof", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, status }),
    });
    if (!res.ok) { setWriteError(writeFailMessage(res, "Could not update the control proof.")); return; }
    if (cellId) load(cellId);
  }

  async function reviewFinding(f: AiFinding, review_status: "accepted" | "rejected") {
    setWriteError(null);
    const res = await fetch("/api/ai/findings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, review_status }),
    });
    if (!res.ok) { setWriteError(writeFailMessage(res, "Could not record the review.")); return; }
    if (cellId) load(cellId);
  }

  if (!cellId) return null;

  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-[420px] max-w-[90vw] flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Safety Cell</span>
        <button onClick={onClose} aria-label="Close panel" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading || !bundle ? (
        <div className="flex flex-1 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="amaya-scroll flex-1 overflow-y-auto px-4 py-3">
          {writeError && <p role="alert" className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">{writeError}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={bundle.cell.severity} />
            <StatusBadge status={bundle.cell.status} />
            <span className="text-xs text-slate-400">risk {bundle.cell.risk_score}</span>
          </div>
          <h2 className="mt-2 text-base font-semibold text-slate-900">{bundle.cell.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{bundle.cell.description}</p>
          <div className="mt-1 text-xs text-slate-400">
            {bundle.location.label} · {bundle.site.name} · {relativeTime(bundle.cell.created_at)}
          </div>

          {/* Hazard genome */}
          <Section title="Hazard genome">
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {Object.entries(bundle.cell.hazard_genome).map(([k, v]) =>
                v ? (
                  <div key={k} className="rounded-md bg-slate-50 px-2 py-1">
                    <span className="text-slate-400">{k}: </span>
                    <span className="font-medium text-slate-700">{String(v).replace(/_/g, " ")}</span>
                  </div>
                ) : null,
              )}
            </div>
          </Section>

          {/* Control proof ledger */}
          <Section title={`Control proof (${bundle.proofs.length})`}>
            {bundle.proofs.length === 0 && <Empty>No controls recorded yet.</Empty>}
            <div className="space-y-2">
              {bundle.proofs.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700">{p.control}</span>
                    <ProofBadge status={p.status} />
                  </div>
                  {p.evidence_summary && <p className="mt-1 text-xs text-slate-500">{p.evidence_summary}</p>}
                  <select
                    value={p.status}
                    onChange={(e) => setProof(p, e.target.value as ProofStatus)}
                    disabled={!canEditProof}
                    aria-label={`Set status for ${p.control}`}
                    title={canEditProof ? undefined : "Requires contributor role or above"}
                    className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {PROOF_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        Set: {PROOF_META[s].label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Section>

          {/* AI engine */}
          <Section
            title="AMAYA Causality Engine"
            right={
              <button
                onClick={analyze}
                disabled={analyzing}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--color-exp)] px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Analyze
              </button>
            }
          >
            {bundle.findings.length === 0 && <Empty>No analysis yet. Run the engine — results are stored as pending review.</Empty>}
            <div className="space-y-2">
              {bundle.findings.map((f) => {
                const out = f.output as AiAnalysisOutput;
                return (
                  <div key={f.id} className="rounded-lg border border-violet-200 bg-violet-50/40 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                        {f.review_status === "pending" ? "Pending review" : f.review_status} · {Math.round(f.confidence * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400">{f.model}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{out.plain_language_summary}</p>
                    {out.prevention?.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {out.prevention.map((p, i) => (
                          <li key={i} className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">→ {p.action}.</span> {p.counterfactual}
                          </li>
                        ))}
                      </ul>
                    )}
                    {f.review_status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => reviewFinding(f, "accepted")}
                          disabled={!canReview}
                          title={canReview ? undefined : "Requires supervisor role or above"}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" /> Accept
                        </button>
                        <button
                          onClick={() => reviewFinding(f, "rejected")}
                          disabled={!canReview}
                          title={canReview ? undefined : "Requires supervisor role or above"}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Ban className="h-3 w-3" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Actions */}
          <Section title={`Actions (${bundle.actions.length})`}>
            {bundle.actions.length === 0 && <Empty>No actions assigned.</Empty>}
            <div className="space-y-1.5">
              {bundle.actions.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                  <span className="text-slate-700">{a.title}</span>
                  <span className="text-slate-400">{a.status}</span>
                </div>
              ))}
            </div>
          </Section>

          <Link
            href={`/cells/${bundle.cell.id}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-pclss)] hover:underline"
          >
            Open full record <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </aside>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {right}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-slate-50 px-2 py-2 text-xs text-slate-400">{children}</p>;
}

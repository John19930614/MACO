"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Check, Ban, Sparkles, Network, Loader2, Database } from "lucide-react";
import type { AiFinding, CausalEdge, SafetyCell, AiAnalysisOutput, StagedRecord } from "@/lib/types";
import { EDGE_META, SEVERITY_META, canCreateActions, type EdgeType, type Role, type Severity } from "@/lib/constants";
import { Stat } from "@/components/ui/primitives";
import { relativeTime, writeFailMessage } from "@/lib/utils";

export function ReviewQueue({ role }: { role: Role }) {
  const canReview = canCreateActions(role);
  const [findings, setFindings] = useState<AiFinding[]>([]);
  const [edges, setEdges] = useState<CausalEdge[]>([]);
  const [cells, setCells] = useState<SafetyCell[]>([]);
  const [staged, setStaged] = useState<StagedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [f, g, c, s] = await Promise.all([
      fetch("/api/ai/findings").then((r) => r.json()),
      fetch("/api/graph").then((r) => r.json()),
      fetch("/api/cells").then((r) => r.json()),
      fetch("/api/staged").then((r) => r.json()),
    ]);
    setFindings(f.findings ?? []);
    setEdges(g.edges ?? []);
    setCells(c.cells ?? []);
    setStaged(s.staged ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const title = (id: string) => cells.find((c) => c.id === id)?.title ?? id;

  async function actOnStaged(id: string, action: "approve" | "reject") {
    setReviewError(null);
    const res = await fetch("/api/staged", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    if (!res.ok) { setReviewError(writeFailMessage(res, "Could not action the staged record.")); return; }
    load();
  }

  async function reviewFinding(id: string, review_status: "accepted" | "rejected") {
    setReviewError(null);
    const res = await fetch("/api/ai/findings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, review_status }) });
    if (!res.ok) { setReviewError(writeFailMessage(res, "Could not record the review.")); return; }
    load();
  }
  async function reviewEdge(id: string, review_status: "accepted" | "rejected") {
    setReviewError(null);
    const res = await fetch("/api/graph/edges", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, review_status }) });
    if (!res.ok) { setReviewError(writeFailMessage(res, "Could not record the review.")); return; }
    load();
  }

  const pendingF = findings.filter((f) => f.review_status === "pending");
  const pendingE = edges.filter((e) => e.review_status === "pending");
  const queue = pendingF.length + pendingE.length;

  // Leading indicators (ARC Evolve): oldest item age + AI acceptance rate.
  const oldest = [...pendingF.map((f) => f.created_at), ...pendingE.map((e) => e.created_at)].sort()[0];
  const reviewed = [...findings, ...edges].filter((x) => x.review_status === "accepted" || x.review_status === "rejected");
  const accepted = reviewed.filter((x) => x.review_status === "accepted").length;
  const acceptanceRate = reviewed.length ? Math.round((accepted / reviewed.length) * 100) : 0;

  return (
    <div className="amaya-scroll flex-1 overflow-auto p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="In queue" value={queue} accent="var(--color-exp)" />
        <Stat label="Oldest pending" value={oldest ? relativeTime(oldest) : "—"} hint="review SLA signal" />
        <Stat label="AI acceptance rate" value={`${acceptanceRate}%`} accent="var(--color-curve)" hint="accepted of reviewed" />
        <Stat label="Reviewed to date" value={reviewed.length} />
      </div>

      {!canReview && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          You can review the queue but not action it — accepting or rejecting AI suggestions requires supervisor role or above.
        </p>
      )}
      {reviewError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{reviewError}</p>}

      {/* Pending admission — gateway-validated records awaiting human approval
          before they enter the live Cell Database (map / graph / 3D web). */}
      <div className="mt-5 rounded-xl border-2 border-[var(--color-pclss)] bg-[var(--color-pclss-soft)] p-3">
        <div className="mb-2 flex items-center gap-2">
          <Database className="h-5 w-5 text-[var(--color-pclss-deep)]" />
          <span className="text-sm font-bold text-[var(--color-pclss-deep)]">Pending admission — awaiting human review</span>
          <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--color-pclss-deep)]">{staged.length}</span>
        </div>
        {staged.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing waiting — every gateway-validated record has been reviewed. New submissions appear here before they reach the database.</p>
        ) : (
          <div className="space-y-1.5">
            {staged.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "var(--color-pclss-soft)", color: "var(--color-pclss-deep)" }}>
                  {s.kind === "safety_cell" ? "Safety Cell" : "Event Cell"}
                </span>
                {"severity" in s.payload && (
                  <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_META[s.payload.severity as Severity]?.color }} />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{s.title}</span>
                <span className="shrink-0 text-[10px] text-slate-400">{relativeTime(s.submitted_at)}</span>
                {canReview ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <button onClick={() => actOnStaged(s.id, "approve")} title="Admit into the live Cell Database" className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:opacity-90">
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button onClick={() => actOnStaged(s.id, "reject")} title="Reject — never enters the database" className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300">
                      <Ban className="h-3 w-3" /> Reject
                    </button>
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-slate-400">supervisor approval required</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-6 flex justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : queue === 0 ? (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Review queue is clear — every AI suggestion has been actioned.</p>
      ) : (
        <div className="mt-5 space-y-2">
          {pendingF.map((f) => {
            const out = f.output as AiAnalysisOutput;
            return (
              <div key={f.id} className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--color-exp)]" />
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">AI finding</span>
                  <Link href={`/cells/${f.cell_id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 hover:underline">{title(f.cell_id)}</Link>
                  <span className="text-[10px] text-slate-400">{relativeTime(f.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{out.plain_language_summary}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => reviewFinding(f.id, "accepted")} disabled={!canReview} title={canReview ? undefined : "Requires supervisor role or above"} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-3 w-3" /> Accept</button>
                  <button onClick={() => reviewFinding(f.id, "rejected")} disabled={!canReview} title={canReview ? undefined : "Requires supervisor role or above"} className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"><Ban className="h-3 w-3" /> Reject</button>
                </div>
              </div>
            );
          })}
          {pendingE.map((e) => (
            <div key={e.id} className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-3">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-fuchsia-600" />
                <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-fuchsia-700">Causal link</span>
                <span className="text-[11px] font-medium" style={{ color: EDGE_META[e.type as EdgeType]?.color }}>{EDGE_META[e.type as EdgeType]?.label} · {Math.round(e.confidence * 100)}%</span>
                <span className="ml-auto text-[10px] text-slate-400">{relativeTime(e.created_at)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                <Link href={`/cells/${e.source_cell_id}`} className="font-medium hover:underline">{title(e.source_cell_id)}</Link> → <Link href={`/cells/${e.target_cell_id}`} className="font-medium hover:underline">{title(e.target_cell_id)}</Link>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{e.rationale}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => reviewEdge(e.id, "accepted")} disabled={!canReview} title={canReview ? undefined : "Requires supervisor role or above"} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-3 w-3" /> Accept</button>
                <button onClick={() => reviewEdge(e.id, "rejected")} disabled={!canReview} title={canReview ? undefined : "Requires supervisor role or above"} className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"><Ban className="h-3 w-3" /> Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

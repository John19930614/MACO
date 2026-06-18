"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Check, Ban, FileText, GitBranch, MessageSquare, Send, Plus, AlertTriangle } from "lucide-react";
import type { CellBundle, AiAnalysisOutput, ControlProof, AiFinding, SafetyCell, Profile, ActionStatus } from "@/lib/types";

interface SimHit { cell: SafetyCell; score: number; reasons: string[] }
interface OutcomeT { event: { id: string; title: string; kind: string; severity: SafetyCell["severity"] }; similarity: number; reasons: string[]; sourceCellId: string; sourceTitle: string }
interface CommentT { id: string; author_name: string; body: string; created_at: string }
const ACTION_STATUSES: ActionStatus[] = ["open", "in_progress", "blocked", "closed"];
import { Card, CardHeader } from "@/components/ui/primitives";
import { SeverityBadge, StatusBadge, ProofBadge, AiPendingBadge } from "@/components/ui/badges";
import { PROOF_STATUSES, PROOF_META, canCreateActions, canWrite, type ProofStatus, type Role } from "@/lib/constants";
import { relativeTime } from "@/lib/utils";

// Turn a failed write Response into a user-facing message (403 → permission).
const writeFailMessage = (res: Response, fallback: string) =>
  res.status === 403 ? "You don't have permission for this action." : fallback;

export function CellDetail({ id, role }: { id: string; role: Role }) {
  const canAct = canCreateActions(role);
  const canComment = canWrite(role);
  const [bundle, setBundle] = useState<CellBundle | null>(null);
  const [similar, setSimilar] = useState<SimHit[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeT[]>([]);
  const [comments, setComments] = useState<CommentT[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [draft, setDraft] = useState("");
  const [newAction, setNewAction] = useState({ title: "", owner_id: "", kind: "preventive" as "preventive" | "corrective", due_date: "" });
  const [analyzing, setAnalyzing] = useState(false);
  const [creatingRec, setCreatingRec] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [findingError, setFindingError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r1, r2, r3, r4, r5] = await Promise.all([
      fetch(`/api/cells/${id}`),
      fetch(`/api/cells/${id}/similar`),
      fetch(`/api/cells/${id}/comments`),
      fetch(`/api/profiles`),
      fetch(`/api/cells/${id}/outcomes`),
    ]);
    setBundle((await r1.json()).bundle ?? null);
    setSimilar((await r2.json()).similar ?? []);
    setComments((await r3.json()).comments ?? []);
    setProfiles((await r4.json()).profiles ?? []);
    setOutcomes((await r5.json()).outcomes ?? []);
  }, [id]);

  async function postComment() {
    if (!draft.trim()) return;
    setCommentError(null);
    const res = await fetch(`/api/cells/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) });
    if (!res.ok) {
      setCommentError(writeFailMessage(res, "Could not post the comment."));
      return;
    }
    setDraft("");
    load();
  }
  async function addAction() {
    if (!newAction.title.trim()) return;
    setActionError(null);
    const res = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cell_id: id, ...newAction, owner_id: newAction.owner_id || null, due_date: newAction.due_date || null }) });
    if (!res.ok) {
      setActionError(writeFailMessage(res, "Could not create the action."));
      return;
    }
    setNewAction({ title: "", owner_id: "", kind: "preventive", due_date: "" });
    load();
  }
  // One-click: turn an AI prevention recommendation into a tracked preventive action.
  async function createActionFromRec(key: string, title: string) {
    setCreatingRec(key);
    setActionError(null);
    const res = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cell_id: id, title, kind: "preventive", owner_id: null, due_date: null }) });
    setCreatingRec(null);
    if (!res.ok) {
      setActionError(writeFailMessage(res, "Could not create the action."));
      return;
    }
    await load();
  }
  async function setActionStatus(actionId: string, status: ActionStatus) {
    setActionError(null);
    const res = await fetch("/api/actions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: actionId, status, closed_with_proof: status === "closed" }) });
    if (!res.ok) {
      setActionError(writeFailMessage(res, "Could not update the action."));
      return;
    }
    load();
  }
  const ownerName = (uid: string | null) => (uid ? profiles.find((p) => p.id === uid)?.display_name ?? "—" : "Unassigned");

  useEffect(() => {
    load();
  }, [load]);

  async function analyze() {
    setAnalyzing(true);
    await fetch("/api/ai/analyze-cell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cell_id: id }) });
    await load();
    setAnalyzing(false);
  }
  async function setProof(p: ControlProof, status: ProofStatus) {
    await fetch("/api/proof", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, status }) });
    load();
  }
  async function reviewFinding(f: AiFinding, review_status: "accepted" | "rejected") {
    setFindingError(null);
    const res = await fetch("/api/ai/findings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id, review_status }) });
    if (!res.ok) {
      setFindingError(writeFailMessage(res, "Could not record the review."));
      return;
    }
    load();
  }

  if (!bundle) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  const { cell } = bundle;

  return (
    <div className="amaya-scroll flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={cell.severity} />
          <StatusBadge status={cell.status} />
          <span className="text-xs text-slate-400">risk {cell.risk_score} · likelihood {cell.likelihood}/5 · {relativeTime(cell.created_at)}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{cell.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{cell.description}</p>
          <p className="mt-1 text-xs text-slate-400">
            {bundle.location.label} · {bundle.site.name} · {cell.task}
            {cell.company ? ` · ${cell.company}` : ""}
            {cell.permit_ref ? ` · ${cell.permit_ref}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Hazard genome" subtitle="Structured risk fingerprint" />
            <div className="grid grid-cols-2 gap-2 p-4 text-sm">
              {Object.entries(cell.hazard_genome).map(([k, v]) =>
                v ? (
                  <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">{k}</div>
                    <div className="font-medium text-slate-700">{String(v).replace(/_/g, " ")}</div>
                  </div>
                ) : null,
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Control Proof Ledger"
              subtitle="Proof state, not a checkbox"
              right={<span className="text-xs text-slate-400">{bundle.proofs.length} controls</span>}
            />
            <div className="space-y-2 p-4">
              {bundle.proofs.length === 0 && <p className="text-xs text-slate-400">No controls recorded.</p>}
              {bundle.proofs.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700">{p.control}</span>
                    <ProofBadge status={p.status} />
                  </div>
                  {p.evidence_summary && <p className="mt-1 text-xs text-slate-500">{p.evidence_summary}</p>}
                  <select value={p.status} onChange={(e) => setProof(p, e.target.value as ProofStatus)} className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                    {PROOF_STATUSES.map((s) => (
                      <option key={s} value={s}>Set: {PROOF_META[s].label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="AMAYA Causality Engine"
            subtitle="Advisory only · stored as pending until a human reviews"
            right={
              <button onClick={analyze} disabled={analyzing} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-exp)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Run analysis
              </button>
            }
          />
          <div className="space-y-3 p-4">
            {bundle.findings.length === 0 && <p className="text-sm text-slate-400">No analysis yet.</p>}
            {bundle.findings.map((f) => {
              const out = f.output as AiAnalysisOutput;
              return (
                <div key={f.id} className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                  <div className="flex items-center justify-between">
                    {f.review_status === "pending" ? <AiPendingBadge /> : <span className="text-xs font-semibold text-slate-600">{f.review_status}</span>}
                    <span className="text-[10px] text-slate-400">{f.model} · {Math.round(f.confidence * 100)}%</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{out.plain_language_summary}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Detail label="Causal factors" items={out.causal_factors} />
                    <Detail label="Missing data" items={out.missing_data} />
                  </div>
                  {out.prevention?.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Counterfactual prevention</div>
                      <ul className="mt-1 space-y-1">
                        {out.prevention.map((p, i) => {
                          const key = `${f.id}-${i}`;
                          return (
                            <li key={i} className="flex items-start gap-2 rounded-md bg-white px-2 py-1 text-xs text-slate-600">
                              <span className="min-w-0 flex-1">
                                <span className="font-semibold text-slate-800">→ {p.action}.</span> {p.counterfactual}
                              </span>
                              <button
                                onClick={() => createActionFromRec(key, p.action)}
                                disabled={creatingRec === key || !canAct}
                                title={canAct ? "Create a tracked preventive action from this recommendation" : "Requires supervisor role or above"}
                                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-curve)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-curve)] hover:bg-[var(--color-curve-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {creatingRec === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Create action
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {f.review_status === "pending" && (
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={() => reviewFinding(f, "accepted")} disabled={!canAct} title={canAct ? undefined : "Requires supervisor role or above"} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                        <Check className="h-3 w-3" /> Accept
                      </button>
                      <button onClick={() => reviewFinding(f, "rejected")} disabled={!canAct} title={canAct ? undefined : "Requires supervisor role or above"} className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <Ban className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {findingError && <p role="alert" className="px-4 pb-3 text-xs text-red-600">{findingError}</p>}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Similar cells — EXP knowledge ghost"
            subtitle="Prior risk with a resembling hazard genome or location"
            right={<GitBranch className="h-4 w-4 text-[var(--color-exp)]" />}
          />
          <div className="divide-y divide-slate-100">
            {similar.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No resembling cells yet — as more risk is captured, the knowledge ghost grows.</p>}
            {similar.map((s) => (
              <Link key={s.cell.id} href={`/cells/${s.cell.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <span className="w-10 shrink-0 text-sm font-bold text-[var(--color-exp)]">{Math.round(s.score * 100)}%</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-700">{s.cell.title}</span>
                  <span className="block truncate text-[11px] text-slate-400">{s.reasons.join(" · ")}</span>
                </span>
                <SeverityBadge severity={s.cell.severity} />
              </Link>
            ))}
          </div>
        </Card>

        {outcomes.length > 0 && (
          <Card>
            <CardHeader
              title="Similar past outcomes"
              subtitle="What happened last time a situation looked like this"
              right={<AlertTriangle className="h-4 w-4" style={{ color: "#b45309" }} />}
            />
            <div className="divide-y divide-slate-100">
              {outcomes.map((o) => (
                <Link key={o.event.id} href={`/cells/${o.sourceCellId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <span className="w-10 shrink-0 text-sm font-bold" style={{ color: "#b45309" }}>{Math.round(o.similarity * 100)}%</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700">{o.event.title}</span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {o.event.kind.replace(/_/g, " ")} · at {o.sourceTitle} · {o.reasons.join(" · ")}
                    </span>
                  </span>
                  <SeverityBadge severity={o.event.severity} />
                </Link>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Evidence" right={<span className="text-xs text-slate-400">{bundle.evidence.length} files</span>} />
            <div className="space-y-1.5 p-4">
              {bundle.evidence.length === 0 && <p className="text-xs text-slate-400">No evidence attached.</p>}
              {bundle.evidence.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-700">{e.name}</span>
                  <span className="ml-auto text-[10px] uppercase text-slate-400">{e.kind}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Actions" right={<span className="text-xs text-slate-400">{bundle.actions.length}</span>} />
            <div className="space-y-1.5 p-4">
              {bundle.actions.length === 0 && <p className="text-xs text-slate-400">No actions assigned.</p>}
              {bundle.actions.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{a.title}</span>
                    <select value={a.status} onChange={(e) => setActionStatus(a.id, e.target.value as ActionStatus)} disabled={!canAct} aria-label={`Status for ${a.title}`} title={canAct ? undefined : "Requires supervisor role or above"} className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60">
                      {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {a.kind} · {ownerName(a.owner_id)} {a.due_date ? `· due ${relativeTime(a.due_date)}` : ""} {a.closed_with_proof ? "· closed with proof" : ""}
                  </div>
                </div>
              ))}
              {/* Assign / create */}
              <div className="mt-2 space-y-1.5 rounded-lg border border-dashed border-slate-300 p-2">
                <input value={newAction.title} onChange={(e) => setNewAction((s) => ({ ...s, title: e.target.value }))} aria-label="New action title" placeholder="New preventive/corrective action…" className="w-full rounded border border-slate-200 px-2 py-1 text-xs" />
                <div className="flex gap-1.5">
                  <select value={newAction.owner_id} onChange={(e) => setNewAction((s) => ({ ...s, owner_id: e.target.value }))} aria-label="Action owner" className="min-w-0 flex-1 rounded border border-slate-200 px-1 py-1 text-[11px]">
                    <option value="">Unassigned</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                  </select>
                  <select value={newAction.kind} onChange={(e) => setNewAction((s) => ({ ...s, kind: e.target.value as "preventive" | "corrective" }))} aria-label="Action kind" className="rounded border border-slate-200 px-1 py-1 text-[11px]">
                    <option value="preventive">preventive</option>
                    <option value="corrective">corrective</option>
                  </select>
                  <input type="date" value={newAction.due_date} onChange={(e) => setNewAction((s) => ({ ...s, due_date: e.target.value }))} aria-label="Action due date" className="rounded border border-slate-200 px-1 py-1 text-[11px]" />
                  <button onClick={addAction} disabled={!canAct} aria-label="Add action" title={canAct ? undefined : "Requires supervisor role or above"} className="inline-flex items-center gap-1 rounded bg-[var(--color-pclss)] px-2 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-3 w-3" /></button>
                </div>
                {actionError && <p role="alert" className="text-[11px] text-red-600">{actionError}</p>}
              </div>
            </div>
          </Card>
        </div>

        {/* Comments */}
        <Card>
          <CardHeader title="Discussion" subtitle="Comments build the team record on this cell" right={<MessageSquare className="h-4 w-4 text-slate-400" />} />
          <div className="space-y-2 p-4">
            {comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{c.author_name}</span>
                  <span className="text-[10px] text-slate-400">{relativeTime(c.created_at)}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{c.body}</p>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && postComment()}
                disabled={!canComment}
                aria-label="Add a comment"
                placeholder={canComment ? "Add a comment…" : "Requires contributor role or above"}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--color-pclss)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pclss)] disabled:cursor-not-allowed disabled:bg-slate-50"
              />
              <button onClick={postComment} disabled={!canComment} title={canComment ? undefined : "Requires contributor role or above"} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-pclss)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </div>
            {commentError && <p role="alert" className="text-xs text-red-600">{commentError}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
        {items?.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

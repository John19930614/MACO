"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { EVENT_KINDS, SEVERITIES, SEVERITY_META, RISK_OBJECT_META, canCreateEvents, type Role } from "@/lib/constants";

interface CellRef { id: string; title: string; site_id: string }

/**
 * Operator UI to log an Event Cell (an outcome). Posts to /api/events and
 * refreshes — the new event then flows through the framework page, the map
 * pins, the risk graph, and the event→learning loop.
 */
export function LogEventForm({ role, sites, cells }: { role: Role; sites: { id: string; name: string }[]; cells: CellRef[] }) {
  const router = useRouter();
  const allowed = canCreateEvents(role);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [kind, setKind] = useState<(typeof EVENT_KINDS)[number]>("incident");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("high");
  const [title, setTitle] = useState("");
  const [cellId, setCellId] = useState("");
  const [description, setDescription] = useState("");

  const siteCells = useMemo(() => cells.filter((c) => c.site_id === siteId), [cells, siteId]);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId, kind, severity, title, cell_id: cellId || null, description: description || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.status === 403) {
        setError("You don't have permission to log events — supervisor role or above is required.");
      } else if (res.status === 422) {
        const j = await res.json().catch(() => null);
        setError(j?.rejections?.[0]?.reason ? `Blocked by the gateway: ${j.rejections[0].reason}` : "Blocked by the gateway.");
      } else {
        setError("Could not log the event — check the title and site.");
      }
      return;
    }
    setTitle("");
    setCellId("");
    setDescription("");
    setOpen(false);
    setSubmitted(true);
    router.refresh();
  }

  if (!open) {
    if (submitted) {
      return (
        <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
          Logged — pending human review
          <button onClick={() => setSubmitted(false)} className="font-medium text-emerald-700 underline">Log another</button>
        </span>
      );
    }
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={!allowed}
        title={allowed ? undefined : "Requires supervisor role or above"}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: RISK_OBJECT_META.event.color }}
      >
        <Plus className="h-4 w-4" /> Log event
      </button>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="log-event-title" className="w-[min(92vw,420px)] rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl">
      <div id="log-event-title" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <AlertTriangle className="h-4 w-4" style={{ color: RISK_OBJECT_META.event.color }} /> Log an event (outcome)
      </div>
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="What happened"
          placeholder="What happened? (e.g. Dropped tool reached the exclusion zone)"
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setCellId(""); }} aria-label="Site" className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm">
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} aria-label="Severity" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm">
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
          </select>
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Event kind" className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm">
          {EVENT_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
        </select>
        <select value={cellId} onChange={(e) => setCellId(e.target.value)} aria-label="Traces to precursor cell" className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm">
          <option value="">Traces to precursor cell… (optional)</option>
          {siteCells.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Detail"
          placeholder="Detail (optional)"
          rows={2}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || title.trim().length < 4}
            aria-busy={busy}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50"
            style={{ background: RISK_OBJECT_META.event.color }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log event
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { MOCK_MODE } from "@/lib/env";
import { createSupportTicket, updateSupportTicket } from "@/lib/actions/sa";
import type { SupportTicket } from "@/lib/types";
import {
  Plus, Search, CheckCircle2, AlertCircle, Clock, RefreshCw,
  ChevronRight, MessageSquare, X, Send, ArrowRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Priority = "critical" | "high" | "medium" | "low";
type TicketStatus = "open" | "in_progress" | "waiting" | "resolved";

type QaStatus = "pass" | "warn" | "fail" | "running";

interface QaCheck {
  id: string;
  check: string;
  category: string;
  status: QaStatus;
  detail: string;
  last_run: string;
}

// ── Mock QA data (client-only demo simulation — NOT persisted) ───────────────────

const MOCK_QA: QaCheck[] = [
  { id: "qa1",  check: "AI Engine (SafetyIQ) uptime (30d)",   category: "Engine",    status: "pass", detail: "99.97% uptime · last restart 18d ago",                       last_run: "2026-06-19" },
  { id: "qa2",  check: "EHS record referential integrity",     category: "Data",      status: "pass", detail: "0 orphaned CAPA/incident/audit references across all tenants", last_run: "2026-06-19" },
  { id: "qa3",  check: "AI hazard flag false-positive rate",   category: "Engine",    status: "pass", detail: "2.1% (target < 5%) · 48 chemical flags reviewed",            last_run: "2026-06-18" },
  { id: "qa4",  check: "Predictive Engine calibration",        category: "Engine",    status: "pass", detail: "Brier score 0.09 (excellent) across all EHS modules",        last_run: "2026-06-18" },
  { id: "qa5",  check: "AI Gateway throughput (all 3 gates)",  category: "Gateway",   status: "pass", detail: "Avg 340 ms end-to-end · p95 720 ms",                         last_run: "2026-06-19" },
  { id: "qa6",  check: "Multi-tenant data isolation",          category: "Security",  status: "pass", detail: "Cross-tenant query test: 0 leaks detected",                  last_run: "2026-06-17" },
  { id: "qa7",  check: "EHS sync freshness (all tenants)",     category: "Data",      status: "warn", detail: "LabCore last EHS data sync 38h ago (threshold: 24h)",         last_run: "2026-06-19" },
  { id: "qa8",  check: "CAPA email notification delivery",     category: "Workflow",  status: "fail", detail: "0/6 closure emails delivered in last 24h test run",           last_run: "2026-06-19" },
  { id: "qa9",  check: "PDF export output quality",            category: "Output",    status: "warn", detail: "2 reports with table overflow on A4 layout",                  last_run: "2026-06-17" },
  { id: "qa10", check: "TypeScript build — zero errors",       category: "Build",     status: "pass", detail: "Build clean · 1 836 modules compiled",                       last_run: "2026-06-19" },
];

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const STATUSES: TicketStatus[] = ["open", "in_progress", "waiting", "resolved"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityBadge(p: string) {
  const cls: Record<string, string> = {
    critical: "bg-red-100 text-red-700",
    high:     "bg-orange-100 text-orange-700",
    medium:   "bg-amber-100 text-amber-700",
    low:      "bg-slate-100 text-slate-600",
  };
  return cls[p] ?? "bg-slate-100 text-slate-600";
}

function statusBadge(s: string) {
  const cls: Record<string, string> = {
    open:        "bg-red-50 text-red-700 border border-red-200",
    in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
    waiting:     "bg-amber-50 text-amber-700 border border-amber-200",
    resolved:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
  return cls[s] ?? "bg-slate-50 text-slate-600 border border-slate-200";
}

function qaStatusStyle(s: QaStatus) {
  if (s === "pass")    return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" };
  if (s === "warn")    return { icon: Clock,         color: "text-amber-600",   bg: "bg-amber-50"   };
  if (s === "fail")    return { icon: AlertCircle,   color: "text-red-600",     bg: "bg-red-50"     };
  return                      { icon: RefreshCw,     color: "text-blue-600",    bg: "bg-blue-50"    };
}

function fmtDate(iso: string) {
  return iso ? iso.slice(0, 10) : "";
}

// ── New Ticket Modal ──────────────────────────────────────────────────────────

function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [tenantId, setTenantId] = useState("");
  const [subject, setSubject]   = useState("");
  const [body, setBody]         = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assignee, setAssignee] = useState("");
  const [requester, setRequester] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setSaving(true);
    setError("");
    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("subject", subject.trim());
    fd.set("body", body.trim());
    fd.set("status", "open");
    fd.set("priority", priority);
    fd.set("requester", requester);
    fd.set("assignee", assignee);
    const res = await createSupportTicket(null, fd);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Failed to create ticket."); return; }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-semibold text-slate-900">New Support Ticket</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tenant ID</label>
              <input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="tenant uuid (optional)"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Requester</label>
              <input value={requester} onChange={e => setRequester(e.target.value)} placeholder="name / email"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject <span className="text-red-500">*</span></label>
            <input required value={subject} onChange={e => setSubject(e.target.value)} placeholder="One-line description of the issue…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Details</label>
            <textarea rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Steps to reproduce, expected vs actual behaviour…"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                {PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Assign To</label>
              <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="assignee (optional)"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || !subject.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ticket Detail Panel ───────────────────────────────────────────────────────

function TicketDetail({
  ticket, onClose, onChanged,
}: {
  ticket: SupportTicket;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [assignee, setAssignee] = useState(ticket.assignee ?? "");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");

  // Build a FormData carrying the full current ticket state, with the given patch applied.
  async function patch(fields: Partial<Record<"status" | "priority" | "assignee" | "requester" | "subject" | "body", string>>) {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("subject", fields.subject ?? ticket.subject);
    fd.set("body", fields.body ?? ticket.body);
    fd.set("status", fields.status ?? ticket.status);
    fd.set("priority", fields.priority ?? ticket.priority);
    fd.set("requester", fields.requester ?? ticket.requester ?? "");
    fd.set("assignee", fields.assignee ?? ticket.assignee ?? "");
    const res = await updateSupportTicket(ticket.id, fd);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Update failed."); return; }
    onChanged();
  }

  const NEXT_STATUSES: Record<string, TicketStatus[]> = {
    open:        ["in_progress", "resolved"],
    in_progress: ["waiting", "resolved"],
    waiting:     ["in_progress", "resolved"],
    resolved:    ["open"],
  };
  const nextStatuses = NEXT_STATUSES[ticket.status] ?? STATUSES;

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs text-slate-400">{ticket.id.slice(0, 8)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityBadge(ticket.priority)}`}>{ticket.priority}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(ticket.status)}`}>{ticket.status.replace(/_/g, " ")}</span>
          </div>
          <div className="text-sm font-semibold text-slate-900 leading-snug">{ticket.subject}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            {ticket.tenant_id ? `tenant ${ticket.tenant_id.slice(0, 8)}` : "platform"}
            {ticket.requester ? ` · from ${ticket.requester}` : ""}
            {ticket.assignee ? ` · assigned to ${ticket.assignee}` : " · unassigned"}
          </div>
        </div>
        <button onClick={onClose} className="mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}
        {ticket.body && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Description</div>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ticket.body}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-400">
          <div><span className="font-semibold uppercase tracking-wide">Created</span><div className="mt-0.5 text-slate-600">{fmtDate(ticket.created_at)}</div></div>
          <div><span className="font-semibold uppercase tracking-wide">Updated</span><div className="mt-0.5 text-slate-600">{fmtDate(ticket.updated_at)}</div></div>
        </div>

        {/* Priority + assignee editors */}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Priority</div>
          <select value={ticket.priority} disabled={busy} onChange={e => patch({ priority: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50">
            {PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assignee</div>
          <div className="flex items-center gap-2">
            <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="unassigned"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <button onClick={() => patch({ assignee })} disabled={busy || assignee === (ticket.assignee ?? "")}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40">
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Footer status actions */}
      <div className="shrink-0 border-t border-slate-100 px-5 py-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {nextStatuses.map(s => (
            <button key={s} onClick={() => patch({ status: s })} disabled={busy}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:brightness-95 disabled:opacity-50 ${statusBadge(s)}`}>
              <ArrowRight className="h-3 w-3" />
              {s === "in_progress" ? "Start work" : s === "waiting" ? "Mark waiting" : s === "resolved" ? "Resolve" : "Reopen"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── QA Panel (client-only demo simulation; not persisted) ───────────────────────

function QaPanel({ checks, onRun, simulated }: { checks: QaCheck[]; onRun: () => void; simulated: boolean }) {
  const categories = [...new Set(checks.map(c => c.category))];
  const passing    = checks.filter(c => c.status === "pass").length;
  const failing    = checks.filter(c => c.status === "fail").length;
  const warning    = checks.filter(c => c.status === "warn").length;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Platform QA Checks</div>
          {simulated && (
            <button onClick={onRun}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <RefreshCw className="h-3.5 w-3.5" /> Run All (demo)
            </button>
          )}
        </div>
        {checks.length > 0 && (
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span className="text-emerald-600 font-medium">{passing} passing</span>
            <span className="text-amber-600 font-medium">{warning} warnings</span>
            {failing > 0 && <span className="text-red-600 font-semibold">{failing} failing</span>}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {checks.length === 0 && (
          <div className="px-2 py-10 text-center text-xs text-slate-400">
            No QA checks connected — automated platform quality checks are not wired to a backend yet.
          </div>
        )}
        {categories.map(cat => (
          <div key={cat}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{cat}</div>
            <div className="space-y-1.5">
              {checks.filter(c => c.category === cat).map(c => {
                const { icon: Icon, color, bg } = qaStatusStyle(c.status);
                return (
                  <div key={c.id} className={`flex items-start gap-2.5 rounded-lg border border-slate-100 ${bg} px-3 py-2`}>
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color} ${c.status === "running" ? "animate-spin" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-800">{c.check}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{c.detail}</div>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold uppercase ${color}`}>{c.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {simulated && checks.length > 0 && (
        <div className="shrink-0 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          Demo data — QA checks are not connected to a live backend.
        </div>
      )}
    </div>
  );
}

// ── Main Client ─────────────────────────────────────────────────────────────────

type RightPanel = "ticket" | "qa";

export default function SupportClient({ initialTickets }: { initialTickets: SupportTicket[] }) {
  const router = useRouter();
  // QA is a client-only demo simulation (no backend); empty in production.
  const [qaChecks, setQaChecks]         = useState<QaCheck[]>(MOCK_MODE ? MOCK_QA : []);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [rightPanel, setRightPanel]     = useState<RightPanel>("qa");
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all");
  const [showNew, setShowNew]           = useState(false);

  const tickets = initialTickets;

  function handleRunQa() {
    setQaChecks(prev => prev.map(q => ({ ...q, status: "running" as QaStatus })));
    setTimeout(() => {
      const today = new Date().toISOString().slice(0, 10);
      setQaChecks(prev => prev.map(q => ({
        ...q,
        last_run: today,
        status: q.id === "qa8" ? "fail" as QaStatus : q.id === "qa7" || q.id === "qa9" ? "warn" as QaStatus : "pass" as QaStatus,
      })));
    }, 2200);
  }

  const filtered = useMemo(() => {
    let list = tickets;
    if (filterStatus !== "all") list = list.filter(t => t.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        (t.requester ?? "").toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, filterStatus, search]);

  const selectedTicket = tickets.find(t => t.id === selectedId) ?? null;

  const open       = tickets.filter(t => t.status === "open").length;
  const inProgress = tickets.filter(t => t.status === "in_progress").length;
  const resolved   = tickets.filter(t => t.status === "resolved").length;
  const qaFailing  = qaChecks.filter(q => q.status === "fail").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={() => router.refresh()} />}

      <PageHeader
        title="Support & QA"
        subtitle="Client support tickets and internal platform quality checks"
        actions={
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> New Ticket
          </button>
        }
      />

      {/* KPI strip */}
      <div className="shrink-0 grid grid-cols-4 gap-4 border-b border-slate-100 bg-white px-6 py-4">
        {[
          { label: "Open",          value: open,       color: "text-red-600",     sub: `${tickets.filter(t=>t.priority==="high"&&t.status==="open").length} high priority` },
          { label: "In progress",   value: inProgress, color: "text-blue-600",    sub: "active work items" },
          { label: "Resolved",      value: resolved,   color: "text-emerald-600", sub: "closed tickets" },
          { label: "Total tickets", value: tickets.length, color: "text-slate-600", sub: "all statuses" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Ticket list column */}
        <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
          {/* Search + filter */}
          <div className="shrink-0 border-b border-slate-100 px-3 py-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…"
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["all", "open", "in_progress", "waiting", "resolved"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                    filterStatus === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}>
                  {s === "all" ? "All" : s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filtered.map(t => (
              <button key={t.id} onClick={() => { setSelectedId(t.id); setRightPanel("ticket"); }}
                className={`w-full px-3 py-3 text-left transition hover:bg-slate-50 ${selectedId === t.id && rightPanel === "ticket" ? "bg-blue-50 border-r-2 border-blue-500" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-400">{t.id.slice(0, 8)}</span>
                      <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold uppercase ${priorityBadge(t.priority)}`}>{t.priority}</span>
                    </div>
                    <div className="line-clamp-2 text-xs font-medium text-slate-800">{t.subject}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{t.requester ?? (t.tenant_id ? `tenant ${t.tenant_id.slice(0, 8)}` : "platform")}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 mt-0.5">
                    <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${statusBadge(t.status)}`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                    <ChevronRight className="h-3 w-3 text-slate-300" />
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-slate-400">
                {tickets.length === 0 ? "No support tickets yet. Create one with the button above." : "No tickets match your filters."}
              </div>
            )}
          </div>

          {/* QA button */}
          <button onClick={() => { setRightPanel("qa"); setSelectedId(null); }}
            className={`shrink-0 flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-medium transition hover:bg-slate-50 ${rightPanel === "qa" ? "bg-blue-50 text-blue-700" : "text-slate-600"}`}>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Platform QA Checks
            </div>
            <div className="flex items-center gap-1">
              {qaFailing > 0 && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{qaFailing} fail</span>}
              <ChevronRight className="h-3 w-3 text-slate-300" />
            </div>
          </button>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-hidden">
          {rightPanel === "ticket" && selectedTicket ? (
            <TicketDetail
              ticket={selectedTicket}
              onClose={() => { setSelectedId(null); setRightPanel("qa"); }}
              onChanged={() => router.refresh()}
            />
          ) : (
            <QaPanel checks={qaChecks} onRun={handleRunQa} simulated={MOCK_MODE} />
          )}
        </div>
      </div>
    </div>
  );
}

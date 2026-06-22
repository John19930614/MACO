"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/primitives";
import {
  Plus, Search, CheckCircle2, AlertCircle, Clock, RefreshCw,
  ChevronRight, MessageSquare, X, Send, ArrowRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Priority = "critical" | "high" | "medium" | "low";
type TicketStatus = "open" | "in_progress" | "waiting" | "resolved";

interface TimelineEntry {
  id: string;
  type: "created" | "note" | "status_change" | "assignee_change";
  text: string;
  by: string;
  at: string;
}

interface Ticket {
  id: string;
  company: string;
  subject: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  created: string;
  updated: string;
  assignee: string;
  category: string;
  timeline: TimelineEntry[];
}

type QaStatus = "pass" | "warn" | "fail" | "running";

interface QaCheck {
  id: string;
  check: string;
  category: string;
  status: QaStatus;
  detail: string;
  last_run: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const INITIAL_TICKETS: Ticket[] = [
  {
    id: "TKT-2026-041",
    company: "BioStar Research Inc.",
    subject: "CAPA workflow not triggering email notifications on closure",
    description: "When a CAPA is marked 'closed' by the EHS manager, the assigned corrective action owner does not receive a notification email. The audit log shows the status change was recorded, but no outbound email is generated. Affects all CAPA types. Confirmed on Chrome and Edge.",
    priority: "high",
    status: "open",
    created: "2026-06-16",
    updated: "2026-06-16",
    assignee: "Maria Lopez",
    category: "Bug",
    timeline: [
      { id: "t1", type: "created",  text: "Ticket submitted via in-app support form",   by: "Sarah Chen",  at: "2026-06-16 09:14" },
      { id: "t2", type: "note",     text: "Confirmed: SMTP relay is healthy, the trigger is not firing. Investigating CAPA status listener in the workflow engine.", by: "Maria Lopez", at: "2026-06-16 10:02" },
    ],
  },
  {
    id: "TKT-2026-040",
    company: "Nexgen Pharma Ltd.",
    subject: "Training completion percentage shows 0% after import",
    description: "After importing training records via the bulk CSV upload, all employees show 0% completion even though the import summary reports successful rows. The Training page shows the employee list but course completion is blank.",
    priority: "medium",
    status: "in_progress",
    created: "2026-06-15",
    updated: "2026-06-17",
    assignee: "Dev Team",
    category: "Bug",
    timeline: [
      { id: "t1", type: "created",       text: "Ticket opened by client portal",                          by: "Kim Park",    at: "2026-06-15 14:30" },
      { id: "t2", type: "status_change", text: "Status changed: open → in_progress",                       by: "Maria Lopez",  at: "2026-06-16 09:00" },
      { id: "t3", type: "note",          text: "Root cause: completion_pct column expecting a decimal (0–1) but import normalised to 0–100. Fix in progress, will deploy this sprint.", by: "Dev Team", at: "2026-06-17 11:45" },
    ],
  },
  {
    id: "TKT-2026-039",
    company: "LabCore Diagnostics",
    subject: "Cannot upload SDS PDF — 10 MB size limit too restrictive",
    description: "Several SDS documents from the new vendor are 12–15 MB. The uploader rejects them with a generic 'file too large' error. Client requests either a raised limit or a compression option.",
    priority: "medium",
    status: "waiting",
    created: "2026-06-14",
    updated: "2026-06-15",
    assignee: "Maria Lopez",
    category: "Feature Request",
    timeline: [
      { id: "t1", type: "created",       text: "Ticket submitted by compliance officer",                   by: "Tom Reed",    at: "2026-06-14 11:20" },
      { id: "t2", type: "note",          text: "Storage limit is per-tenant config. We can raise BioStar to 25 MB immediately. Server-side compression for PDFs is on the product backlog.", by: "Maria Lopez", at: "2026-06-14 15:00" },
      { id: "t3", type: "status_change", text: "Status changed: open → waiting (pending client confirmation of workaround)", by: "Maria Lopez", at: "2026-06-15 09:00" },
    ],
  },
  {
    id: "TKT-2026-038",
    company: "MedTech Solutions",
    subject: "Request: custom field on Audit template for equipment serial number",
    description: "The Audits module does not have a serial number field on equipment audit templates. The client tracks 200+ instruments and needs this to link audit records to their CMMS. Willing to use a free-text field as a workaround in the interim.",
    priority: "low",
    status: "open",
    created: "2026-06-13",
    updated: "2026-06-13",
    assignee: "Unassigned",
    category: "Feature Request",
    timeline: [
      { id: "t1", type: "created", text: "Feature request submitted via support portal", by: "James Wu", at: "2026-06-13 16:04" },
    ],
  },
  {
    id: "TKT-2026-037",
    company: "BioStar Research Inc.",
    subject: "Predictive Engine risk score stuck at previous value after CAPA closure",
    description: "After closing CAPA-114 (high-confidence corrective action), the Predictive Engine compliance forecast for Chemical Management did not recalculate. Risk score remained at 78 for 48 h. Manual re-scan resolved it but the automatic recalculation trigger appears to not be firing.",
    priority: "high",
    status: "resolved",
    created: "2026-06-10",
    updated: "2026-06-12",
    assignee: "Maria Lopez",
    category: "Bug",
    timeline: [
      { id: "t1", type: "created",       text: "Reported by EHS Manager post-CAPA closure",                by: "Sarah Chen",  at: "2026-06-10 08:50" },
      { id: "t2", type: "status_change", text: "Status changed: open → in_progress",                       by: "Maria Lopez",  at: "2026-06-10 10:00" },
      { id: "t3", type: "note",          text: "Found the issue: Predictive Engine recalculation was only triggered on CAPA status → 'verified', not 'closed'. CAPA-114 was closed directly. Deploying fix.", by: "Dev Team", at: "2026-06-11 14:20" },
      { id: "t4", type: "status_change", text: "Status changed: in_progress → resolved",                   by: "Maria Lopez",  at: "2026-06-12 09:00" },
      { id: "t5", type: "note",          text: "Fix confirmed in production. Recalculation now triggers on both 'verified' and 'closed' transitions.", by: "Maria Lopez", at: "2026-06-12 09:30" },
    ],
  },
  {
    id: "TKT-2026-036",
    company: "Nexgen Pharma Ltd.",
    subject: "Legal register import: unclear CSV column mapping for jurisdiction field",
    description: "The bulk import template for the Legal Register does not clearly label which column maps to the jurisdiction field. Client uploaded with country name ('United Kingdom') but the system expected ISO code ('GB'), causing silent mapping failures.",
    priority: "low",
    status: "resolved",
    created: "2026-06-08",
    updated: "2026-06-09",
    assignee: "Support",
    category: "Documentation",
    timeline: [
      { id: "t1", type: "created",       text: "Client confused during onboarding import session",        by: "Kim Park",    at: "2026-06-08 13:00" },
      { id: "t2", type: "note",          text: "Updated the CSV template header to: 'jurisdiction_iso2 (e.g. GB, US, DE)'. Template live in SA → Templates.", by: "Support", at: "2026-06-09 10:30" },
      { id: "t3", type: "status_change", text: "Status changed: open → resolved",                        by: "Support",     at: "2026-06-09 10:31" },
    ],
  },
];

const INITIAL_QA: QaCheck[] = [
  { id: "qa1",  check: "AI Engine (Amaya) uptime (30d)",      category: "Engine",    status: "pass", detail: "99.97% uptime · last restart 18d ago",                       last_run: "2026-06-19" },
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

const COMPANIES = ["BioStar Research Inc.", "Nexgen Pharma Ltd.", "LabCore Diagnostics", "MedTech Solutions", "NovaChem Solutions"];
const ASSIGNEES = ["Maria Lopez", "Dev Team", "Support", "Unassigned"];
const CATEGORIES = ["Bug", "Feature Request", "Documentation", "Access", "Performance"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityBadge(p: Priority) {
  const cls: Record<Priority, string> = {
    critical: "bg-red-100 text-red-700",
    high:     "bg-orange-100 text-orange-700",
    medium:   "bg-amber-100 text-amber-700",
    low:      "bg-slate-100 text-slate-600",
  };
  return cls[p];
}

function statusBadge(s: TicketStatus) {
  const cls: Record<TicketStatus, string> = {
    open:        "bg-red-50 text-red-700 border border-red-200",
    in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
    waiting:     "bg-amber-50 text-amber-700 border border-amber-200",
    resolved:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
  return cls[s];
}

function qaStatusStyle(s: QaStatus) {
  if (s === "pass")    return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" };
  if (s === "warn")    return { icon: Clock,         color: "text-amber-600",   bg: "bg-amber-50"   };
  if (s === "fail")    return { icon: AlertCircle,   color: "text-red-600",     bg: "bg-red-50"     };
  return                      { icon: RefreshCw,     color: "text-blue-600",    bg: "bg-blue-50"    };
}

// ── New Ticket Modal ──────────────────────────────────────────────────────────

function NewTicketModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: Ticket) => void }) {
  const [company, setCompany]   = useState(COMPANIES[0]);
  const [subject, setSubject]   = useState("");
  const [desc, setDesc]         = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assignee, setAssignee] = useState("Unassigned");
  const [category, setCategory] = useState("Bug");
  const [saving, setSaving]     = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const now   = new Date().toISOString().slice(0, 16).replace("T", " ");
    const n     = 42 + INITIAL_TICKETS.length;
    setTimeout(() => {
      onAdd({
        id: `TKT-2026-0${n}`, company, subject: subject.trim(), description: desc.trim(),
        priority, status: "open", created: today, updated: today, assignee, category,
        timeline: [{ id: "t1", type: "created", text: "Ticket created via support portal", by: "Maria Lopez", at: now }],
      });
      onClose();
    }, 500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-semibold text-slate-900">New Support Ticket</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Company</label>
              <select value={company} onChange={e => setCompany(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject <span className="text-red-500">*</span></label>
            <input required value={subject} onChange={e => setSubject(e.target.value)} placeholder="One-line description of the issue…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Details</label>
            <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Steps to reproduce, expected vs actual behaviour, screenshots…"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Assign To</label>
              <select value={assignee} onChange={e => setAssignee(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
              </select>
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
  ticket, onClose, onUpdate,
}: {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Ticket>) => void;
}) {
  const [note, setNote]       = useState("");
  const [sending, setSending] = useState(false);

  function changeStatus(s: TicketStatus) {
    const now  = new Date().toISOString().slice(0, 16).replace("T", " ");
    const newEntry: TimelineEntry = {
      id:   `t${Date.now()}`,
      type: "status_change",
      text: `Status changed: ${ticket.status.replace(/_/g, " ")} → ${s.replace(/_/g, " ")}`,
      by:   "Maria Lopez",
      at:   now,
    };
    onUpdate(ticket.id, { status: s, updated: now.slice(0, 10), timeline: [...ticket.timeline, newEntry] });
  }

  function addNote() {
    if (!note.trim()) return;
    setSending(true);
    const now  = new Date().toISOString().slice(0, 16).replace("T", " ");
    const newEntry: TimelineEntry = {
      id:   `t${Date.now()}`,
      type: "note",
      text: note.trim(),
      by:   "Maria Lopez",
      at:   now,
    };
    setTimeout(() => {
      onUpdate(ticket.id, { updated: now.slice(0, 10), timeline: [...ticket.timeline, newEntry] });
      setNote("");
      setSending(false);
    }, 300);
  }

  const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
    open:        ["in_progress", "resolved"],
    in_progress: ["waiting", "resolved"],
    waiting:     ["in_progress", "resolved"],
    resolved:    ["open"],
  };

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs text-slate-400">{ticket.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityBadge(ticket.priority)}`}>{ticket.priority}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(ticket.status)}`}>{ticket.status.replace(/_/g, " ")}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{ticket.category}</span>
          </div>
          <div className="text-sm font-semibold text-slate-900 leading-snug">{ticket.subject}</div>
          <div className="mt-1 text-[11px] text-slate-400">{ticket.company} · assigned to {ticket.assignee}</div>
        </div>
        <button onClick={onClose} className="mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Description */}
        {ticket.description && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Description</div>
            <p className="text-sm text-slate-600 leading-relaxed">{ticket.description}</p>
          </div>
        )}

        {/* Timeline */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Timeline</div>
          <div className="space-y-3">
            {ticket.timeline.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className="mt-1 flex-shrink-0">
                  {e.type === "created"        && <div className="h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />}
                  {e.type === "note"           && <div className="h-2 w-2 rounded-full bg-slate-400 ring-2 ring-white" />}
                  {e.type === "status_change"  && <div className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white" />}
                  {e.type === "assignee_change"&& <div className="h-2 w-2 rounded-full bg-violet-400 ring-2 ring-white" />}
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-700 leading-relaxed">{e.text}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{e.by} · {e.at}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-slate-100 px-5 py-4 space-y-3">
        {/* Status transitions */}
        {ticket.status !== "resolved" && (
          <div className="flex gap-2 flex-wrap">
            {NEXT_STATUSES[ticket.status].map(s => (
              <button key={s} onClick={() => changeStatus(s)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:brightness-95 ${statusBadge(s)}`}>
                <ArrowRight className="h-3 w-3" />
                {s === "in_progress" ? "Start work" : s === "waiting" ? "Mark waiting" : "Resolve"}
              </button>
            ))}
          </div>
        )}

        {/* Add note */}
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note or reply…"
            className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button onClick={addNote} disabled={sending || !note.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QA Panel ─────────────────────────────────────────────────────────────────

function QaPanel({ checks, onRun }: { checks: QaCheck[]; onRun: () => void }) {
  const categories = [...new Set(checks.map(c => c.category))];
  const passing    = checks.filter(c => c.status === "pass").length;
  const failing    = checks.filter(c => c.status === "fail").length;
  const warning    = checks.filter(c => c.status === "warn").length;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Platform QA Checks</div>
          <button onClick={onRun}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-3.5 w-3.5" /> Run All
          </button>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="text-emerald-600 font-medium">{passing} passing</span>
          <span className="text-amber-600 font-medium">{warning} warnings</span>
          {failing > 0 && <span className="text-red-600 font-semibold">{failing} failing</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
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
      <div className="shrink-0 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
        Last full run: 2026-06-19 08:30 UTC
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type RightPanel = "ticket" | "qa";

export default function SupportQAPage() {
  const [tickets, setTickets]           = useState<Ticket[]>(INITIAL_TICKETS);
  const [qaChecks, setQaChecks]         = useState<QaCheck[]>(INITIAL_QA);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [rightPanel, setRightPanel]     = useState<RightPanel>("qa");
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all");
  const [showNew, setShowNew]           = useState(false);
  const [runningQa, setRunningQa]       = useState(false);
  const [toast, setToast]               = useState("");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function handleAddTicket(t: Ticket) {
    setTickets(prev => [t, ...prev]);
    setSelectedId(t.id);
    setRightPanel("ticket");
    showToast(`Ticket ${t.id} created`);
  }

  function handleUpdateTicket(id: string, patch: Partial<Ticket>) {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  function handleRunQa() {
    setRunningQa(true);
    setQaChecks(prev => prev.map(q => ({ ...q, status: "running" as QaStatus })));
    setTimeout(() => {
      const today = new Date().toISOString().slice(0, 10);
      setQaChecks(prev => prev.map(q => ({
        ...q,
        last_run: today,
        status: q.id === "qa8" ? "fail" as QaStatus : q.id === "qa7" || q.id === "qa9" ? "warn" as QaStatus : "pass" as QaStatus,
      })));
      setRunningQa(false);
      showToast("QA run complete — 1 failing, 2 warnings");
    }, 2200);
  }

  const filtered = useMemo(() => {
    let list = tickets;
    if (filterStatus !== "all") list = list.filter(t => t.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.company.toLowerCase().includes(q) ||
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
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} onAdd={handleAddTicket} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ {toast}
        </div>
      )}

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
          { label: "Resolved (30d)",value: resolved,   color: "text-emerald-600", sub: "avg 2.1 day SLA" },
          { label: "QA failures",   value: qaFailing,  color: qaFailing > 0 ? "text-red-600" : "text-emerald-600", sub: `${qaChecks.length} checks total` },
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
                      <span className="font-mono text-[10px] text-slate-400">{t.id}</span>
                      <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold uppercase ${priorityBadge(t.priority)}`}>{t.priority}</span>
                    </div>
                    <div className="line-clamp-2 text-xs font-medium text-slate-800">{t.subject}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{t.company}</div>
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
              <div className="px-4 py-10 text-center text-xs text-slate-400">No tickets match your filters.</div>
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
              onUpdate={handleUpdateTicket}
            />
          ) : (
            <QaPanel checks={qaChecks} onRun={handleRunQa} />
          )}
        </div>
      </div>
    </div>
  );
}

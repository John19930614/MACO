"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoUser } from "@/lib/context/demo-user";
import { X, Zap, AlertTriangle, CheckCircle2, ChevronRight, Send, Activity, Bell, Archive, RefreshCw } from "lucide-react";

// ─── Minimal prop shapes (duck-typed against ehsRepo return values) ───────────

type CapaRow     = { id: string; title: string; status: string; due_date?: string | null };
type IncidentRow = { id: string; title: string; severity: string; status: string };

export interface GusMaintenancePanelProps {
  capas:     CapaRow[];
  incidents: IncidentRow[];
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface PlatformIssue {
  id:       string;
  label:    string;
  detail:   string;
  severity: "critical" | "warning";
  action:   string;
  resolved: boolean;
}

interface LogEntry {
  id:   string;
  ts:   string;
  type: "info" | "success" | "warning" | "action";
  text: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let seq = 0;

function nowTs() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function mkLog(type: LogEntry["type"], text: string): LogEntry {
  return { id: `l${++seq}`, ts: nowTs(), type, text };
}

function detectIssues(capas: CapaRow[], incidents: IncidentRow[]): PlatformIssue[] {
  const out: PlatformIssue[] = [];

  const overdue = capas.filter((c) => c.status === "overdue");
  if (overdue.length) {
    out.push({
      id: "overdue-capas",
      label: `${overdue.length} CAPA${overdue.length > 1 ? "s" : ""} Overdue`,
      detail: overdue[0].title + (overdue.length > 1 ? ` · +${overdue.length - 1} more` : ""),
      severity: "critical",
      action: "Escalate",
      resolved: false,
    });
  }

  const critOpen = incidents.filter(
    (i) => i.severity === "critical" && (i.status === "reported" || i.status === "under_investigation")
  );
  if (critOpen.length) {
    out.push({
      id: "critical-incidents",
      label: `${critOpen.length} Critical Incident${critOpen.length > 1 ? "s" : ""} Open`,
      detail: critOpen[0].title,
      severity: "critical",
      action: "Flag",
      resolved: false,
    });
  }

  const week = new Date();
  week.setDate(week.getDate() + 7);
  const dueSoon = capas.filter(
    (c) =>
      c.status !== "closed" &&
      c.status !== "overdue" &&
      c.due_date != null &&
      new Date(c.due_date) <= week &&
      new Date(c.due_date) > new Date()
  );
  if (dueSoon.length) {
    out.push({
      id: "due-soon",
      label: `${dueSoon.length} CAPA${dueSoon.length > 1 ? "s" : ""} Due This Week`,
      detail: "Deadline approaching within 7 days",
      severity: "warning",
      action: "Remind",
      resolved: false,
    });
  }

  const highOpen = incidents.filter((i) => i.severity === "high" && i.status === "reported");
  if (highOpen.length) {
    out.push({
      id: "high-incidents",
      label: `${highOpen.length} High-Severity Incident${highOpen.length > 1 ? "s" : ""} Unassigned`,
      detail: highOpen[0].title,
      severity: "warning",
      action: "Assign",
      resolved: false,
    });
  }

  return out;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IssueRow({ issue, onResolve }: { issue: PlatformIssue; onResolve: () => void }) {
  return (
    <div
      className={`flex items-start gap-2 rounded border p-2 text-xs transition-opacity duration-500 ${
        issue.severity === "critical"
          ? "border-red-500/30 bg-red-950/20"
          : "border-amber-500/25 bg-amber-950/15"
      } ${issue.resolved ? "opacity-35" : ""}`}
    >
      {issue.resolved ? (
        <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0 text-emerald-400" />
      ) : (
        <AlertTriangle className={`h-3 w-3 mt-0.5 flex-shrink-0 ${issue.severity === "critical" ? "text-red-400" : "text-amber-400"}`} />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-[11px]">{issue.label}</div>
        <div className="text-[9px] text-slate-400 truncate mt-0.5">{issue.detail}</div>
      </div>
      {!issue.resolved && (
        <button
          onClick={onResolve}
          className="flex-shrink-0 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-cyan-300 hover:bg-cyan-500/20 transition-colors"
        >
          {issue.action}
        </button>
      )}
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const col =
    entry.type === "success" ? "text-emerald-400"
    : entry.type === "warning" ? "text-amber-400"
    : entry.type === "action"  ? "text-cyan-300"
    : "text-slate-400";
  return (
    <div className="gus-log-line flex gap-1.5 font-mono text-[10px] leading-relaxed">
      <span className="text-slate-600 flex-shrink-0 tabular-nums">{entry.ts}</span>
      <span className={`${col} break-all`}>{entry.text}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GusMaintenancePanel({ capas, incidents }: GusMaintenancePanelProps) {
  const { user } = useDemoUser();

  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const [issues,  setIssues]  = useState<PlatformIssue[]>(() => detectIssues(capas, incidents));
  const [log,     setLog]     = useState<LogEntry[]>([]);
  const [input,   setInput]   = useState("");
  const [busy,    setBusy]    = useState(false);
  const [opened,  setOpened]  = useState(false); // tracks if we've shown boot msgs

  const logRef = useRef<HTMLDivElement>(null);

  // Re-detect if data changes
  useEffect(() => {
    setIssues(detectIssues(capas, incidents));
  }, [capas, incidents]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function push(type: LogEntry["type"], text: string, delayMs = 0) {
    const entry = mkLog(type, text);
    if (delayMs === 0) {
      setLog((p) => [...p, entry]);
    } else {
      setTimeout(() => setLog((p) => [...p, entry]), delayMs);
    }
  }

  function openPanel() {
    setOpen(true);
    setClosing(false);
    if (!opened) {
      setOpened(true);
      push("action", "GUS Maintenance Mode active.", 80);
      push("info",   "Scanning platform for issues...", 380);
      setTimeout(() => {
        const n = issues.filter((i) => !i.resolved).length;
        push(
          n > 0 ? "warning" : "success",
          n > 0
            ? `${n} issue${n > 1 ? "s" : ""} detected. Ready for your instruction.`
            : "All systems nominal. No active issues."
        );
      }, 850);
    }
  }

  function closePanel() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 200);
  }

  function resolveIssue(id: string, action: string) {
    setIssues((p) => p.map((i) => (i.id === id ? { ...i, resolved: true } : i)));
    push("action", `▶ ${action} initiated...`);
    let detail = "";
    if (id === "overdue-capas") {
      const overdue = capas.filter((c) => c.status === "overdue");
      const names = overdue.slice(0, 2).map((c) => c.title).join("; ");
      detail = `${overdue.length} CAPA${overdue.length > 1 ? "s" : ""} escalated: ${names}${overdue.length > 2 ? ` · +${overdue.length - 2} more` : ""}`;
    } else if (id === "critical-incidents") {
      const crit = incidents.filter((i) => i.severity === "critical" && (i.status === "reported" || i.status === "under_investigation"));
      detail = `${crit.length} critical incident${crit.length > 1 ? "s" : ""} flagged for incident commander. ${crit[0]?.title ? `First: "${crit[0].title}"` : ""}`;
    } else if (id === "due-soon") {
      const week = new Date(); week.setDate(week.getDate() + 7);
      const soon = capas.filter((c) => c.status !== "closed" && c.status !== "overdue" && c.due_date != null && new Date(c.due_date) <= week && new Date(c.due_date) > new Date());
      detail = `Deadline reminders sent for ${soon.length} CAPA${soon.length > 1 ? "s" : ""} due within 7 days.`;
    } else if (id === "high-incidents") {
      const high = incidents.filter((i) => i.severity === "high" && i.status === "reported");
      detail = `${high.length} high-severity incident${high.length > 1 ? "s" : ""} assigned to responders.`;
    }
    push("success", detail || "Action completed.", 600);
  }

  // ── Quick actions ──────────────────────────────────────────────────────────

  function runHealthScan() {
    if (busy) return;
    setBusy(true);
    const overdueCapas   = capas.filter((c) => c.status === "overdue");
    const openCapas      = capas.filter((c) => c.status === "open" || c.status === "in_progress");
    const critIncidents  = incidents.filter((i) => i.severity === "critical" && (i.status === "reported" || i.status === "under_investigation"));
    push("action", "▶ Running full platform health scan...");
    push("info",   `Checking ${capas.length} CAPAs — ${overdueCapas.length} overdue, ${openCapas.length} open...`, 350);
    push("info",   `Scanning ${incidents.length} incidents — ${critIncidents.length} critical open...`, 700);
    push("info",   "Auditing P-Engine data quality...", 1050);
    push("info",   "Validating tenant module coverage...", 1400);
    setTimeout(() => {
      const freshIssues = detectIssues(capas, incidents);
      setIssues(freshIssues);
      const n = freshIssues.length;
      push(
        n > 0 ? "warning" : "success",
        n > 0
          ? `Scan complete. ${n} issue${n > 1 ? "s" : ""} detected: ${freshIssues.map((i) => i.label).join(" · ")}`
          : `Scan complete. ${capas.length} CAPAs checked, ${incidents.length} incidents reviewed. All clear.`
      );
      setBusy(false);
    }, 1900);
  }

  function sendDigest() {
    if (busy) return;
    setBusy(true);
    const overdueCount  = capas.filter((c) => c.status === "overdue").length;
    const openCapaCount = capas.filter((c) => c.status === "open" || c.status === "in_progress").length;
    const openIncCount  = incidents.filter((i) => i.status === "reported" || i.status === "under_investigation").length;
    const critCount     = incidents.filter((i) => i.severity === "critical").length;
    push("action", "▶ Compiling platform digest for tenant admins...");
    push("info",   `CAPAs: ${capas.length} total · ${openCapaCount} open · ${overdueCount} overdue`, 400);
    push("info",   `Incidents: ${incidents.length} total · ${openIncCount} open · ${critCount} critical`, 750);
    push("success", `Digest dispatched. ${openCapaCount + overdueCount} CAPA items and ${openIncCount} incident${openIncCount !== 1 ? "s" : ""} summarised.`, 1250);
    setTimeout(() => setBusy(false), 1300);
  }

  function syncAiFindings() {
    if (busy) return;
    setBusy(true);
    const openCapas = capas.filter((c) => c.status === "open" || c.status === "in_progress");
    push("action", "▶ Scanning AI findings for unlinked records...");
    push("info",   `Checking ${openCapas.length} open CAPA${openCapas.length !== 1 ? "s" : ""} for AI-generated insights...`, 450);
    setTimeout(() => {
      const linked = Math.min(openCapas.length, 3);
      push("success",
        linked > 0
          ? `${linked} AI insight${linked > 1 ? "s" : ""} linked to open CAPAs. P-Engine queue updated.`
          : "No unlinked AI findings. All insights are current."
      );
      setBusy(false);
    }, 1150);
  }

  function archiveResolved() {
    if (busy) return;
    setBusy(true);
    const closedCapas     = capas.filter((c) => c.status === "closed");
    const resolvedInc     = incidents.filter((i) => i.status === "closed" || i.status === "resolved");
    const total           = closedCapas.length + resolvedInc.length;
    push("action", "▶ Archiving completed records...");
    push("info",   `Found ${closedCapas.length} closed CAPA${closedCapas.length !== 1 ? "s" : ""} and ${resolvedInc.length} resolved incident${resolvedInc.length !== 1 ? "s" : ""}`, 500);
    setTimeout(() => {
      setIssues((prev) => prev.map((i) => ({ ...i, resolved: true })));
      push("success",
        total > 0
          ? `${total} record${total > 1 ? "s" : ""} archived. Resolved issues cleared from panel.`
          : "No archivable records found. Dataset is current."
      );
      setBusy(false);
    }, 1200);
  }

  // ── Free-text command ──────────────────────────────────────────────────────

  function handleCommand(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    setInput("");
    push("info", `> ${raw}`);
    const cmd = raw.toLowerCase();
    if      (/escalat|overdue|capa/.test(cmd))   setTimeout(() => resolveIssue("overdue-capas", "Escalate"),     200);
    else if (/scan|health|check|diagnos/.test(cmd)) setTimeout(runHealthScan, 200);
    else if (/digest|notify|remind|send/.test(cmd)) setTimeout(sendDigest,    200);
    else if (/sync|ai|finding/.test(cmd))           setTimeout(syncAiFindings, 200);
    else if (/archiv|clean|purge/.test(cmd))        setTimeout(archiveResolved, 200);
    else if (/status|report|summar/.test(cmd)) {
      const n             = issues.filter((i) => !i.resolved).length;
      const overdueCount  = capas.filter((c) => c.status === "overdue").length;
      const openCapaCount = capas.filter((c) => c.status === "open" || c.status === "in_progress").length;
      const openIncCount  = incidents.filter((i) => i.status === "reported" || i.status === "under_investigation").length;
      const critCount     = incidents.filter((i) => i.severity === "critical" && (i.status === "reported" || i.status === "under_investigation")).length;
      setTimeout(() =>
        push("info", `Platform: ${n} active issue${n !== 1 ? "s" : ""}. CAPAs: ${openCapaCount} open, ${overdueCount} overdue. Incidents: ${openIncCount} open, ${critCount} critical. P-Engine: OPERATIONAL.`),
      200);
    } else {
      setTimeout(() => push("info", "Instruction logged. I'll address that in my next maintenance cycle."), 200);
    }
  }

  if (!user.is_reliance) return null;

  const unresolved = issues.filter((i) => !i.resolved).length;

  return (
    <>
      <style>{`
        /* ─── Mini orb ─── */
        .gus-mini-orb {
          width:52px; height:52px; border-radius:50%;
          background:radial-gradient(circle at 50% 35%,
            rgba(255,255,255,.92) 0 20%, rgba(229,244,255,.82) 20% 42%,
            rgba(85,198,255,.18) 42% 60%, rgba(11,24,42,.9) 60% 100%);
          box-shadow:0 0 18px rgba(103,216,255,.3),0 0 0 1px rgba(103,216,255,.1);
          display:flex; align-items:center; justify-content:center;
          transition:box-shadow .2s, transform .15s;
        }
        .gus-mb:hover .gus-mini-orb {
          box-shadow:0 0 32px rgba(103,216,255,.7); transform:scale(1.07);
        }
        .gus-mini-head-sm {
          width:30px; height:34px;
          border-radius:48% 48% 42% 42%/40% 40% 54% 54%;
          background:linear-gradient(180deg,#fff,#eaf6ff);
          border:1.5px solid rgba(145,203,255,.5);
          position:relative;
        }
        .gus-mini-head-sm::before {
          content:""; position:absolute; top:-7px; left:50%; transform:translateX(-50%);
          width:6px; height:9px; border-radius:99px;
          background:linear-gradient(180deg,#f0f8ff,#b9dcff);
        }
        .gus-mini-head-sm::before { box-shadow:0 -4px 0 3px #67d8ff, 0 -4px 8px 2px rgba(103,216,255,.8); }
        .gus-mini-head-sm::after {
          content:""; position:absolute; top:9px; left:50%; transform:translateX(-50%);
          width:18px; height:10px; border-radius:8px;
          background:linear-gradient(180deg,#071a2d,#0d2c48);
        }
        @keyframes gus-issue-pulse {
          0%,100%{ box-shadow:0 0 18px rgba(103,216,255,.3),0 0 0 1px rgba(103,216,255,.1); }
          50%    { box-shadow:0 0 30px rgba(220,38,38,.55),0 0 0 1px rgba(220,38,38,.35); }
        }
        .gus-has-issues .gus-mini-orb { animation:gus-issue-pulse 2.4s ease-in-out infinite; }

        /* ─── Panel slide ─── */
        @keyframes gus-mp-in  { from{transform:translateY(14px) scale(.97);opacity:0} to{transform:none;opacity:1} }
        @keyframes gus-mp-out { from{transform:none;opacity:1} to{transform:translateY(14px) scale(.97);opacity:0} }
        .gus-mp-in  { animation:gus-mp-in  .22s ease forwards; }
        .gus-mp-out { animation:gus-mp-out .18s ease forwards; }

        /* ─── Log entry ─── */
        @keyframes gus-log-in { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:none} }
        .gus-log-line { animation:gus-log-in .25s ease forwards; }

        /* ─── Busy spinner ─── */
        @keyframes gus-spin { to{transform:rotate(360deg)} }
        .gus-spin { animation:gus-spin .8s linear infinite; }
      `}</style>

      {/* ── Floating button (hidden while panel open) ── */}
      {!open && (
        <button
          onClick={openPanel}
          className={`fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1 gus-mb ${unresolved > 0 ? "gus-has-issues" : ""}`}
        >
          {unresolved > 0 && (
            <span className="absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 font-mono text-[10px] font-bold text-white shadow-lg">
              {unresolved}
            </span>
          )}
          <div className="gus-mini-orb">
            <div className="gus-mini-head-sm" />
          </div>
          <span className="font-mono text-[8px] tracking-[0.22em] text-slate-500">GUS</span>
        </button>
      )}

      {/* ── Maintenance panel ── */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-40 flex w-80 flex-col rounded-lg border border-cyan-500/30 bg-slate-950 shadow-[0_0_48px_rgba(6,182,212,0.18)] overflow-hidden ${closing ? "gus-mp-out" : "gus-mp-in"}`}
          style={{
            maxHeight: "min(600px, calc(100vh - 80px))",
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(6,182,212,0.018) 27px,rgba(6,182,212,0.018) 28px)",
          }}
        >
          {/* HUD corners */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-0 h-4 w-4 border-l-2 border-t-2 border-cyan-400/50" />
            <div className="absolute top-0 right-0 h-4 w-4 border-r-2 border-t-2 border-cyan-400/50" />
            <div className="absolute bottom-0 left-0 h-4 w-4 border-l-2 border-b-2 border-cyan-400/50" />
            <div className="absolute bottom-0 right-0 h-4 w-4 border-r-2 border-b-2 border-cyan-400/50" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-cyan-500/20 px-3 py-2.5 flex-shrink-0">
            <div className="gus-mini-orb" style={{ width: 36, height: 36 }}>
              <div className="gus-mini-head-sm" style={{ width: 20, height: 23 }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] font-bold tracking-widest text-cyan-400">GUS MAINTENANCE</div>
              <div className="font-mono text-[8px] text-slate-500">
                {busy
                  ? <span className="flex items-center gap-1"><RefreshCw className="h-2.5 w-2.5 gus-spin inline" /> Running...</span>
                  : unresolved > 0
                    ? `${unresolved} issue${unresolved > 1 ? "s" : ""} active`
                    : "All systems nominal"}
              </div>
            </div>
            <button onClick={closePanel} className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* Issues */}
            {issues.length > 0 && (
              <div className="px-3 pt-3 pb-2">
                <div className="font-mono text-[8px] font-bold tracking-widest text-slate-500 uppercase mb-2">
                  Platform Issues
                </div>
                <div className="space-y-1.5">
                  {issues.map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      onResolve={() => resolveIssue(issue.id, issue.action)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="border-t border-slate-800/60 px-3 py-3">
              <div className="font-mono text-[8px] font-bold tracking-widest text-slate-500 uppercase mb-2">
                Quick Actions
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { label: "Health Scan",      Icon: Activity, fn: runHealthScan   },
                  { label: "Send Digest",       Icon: Bell,     fn: sendDigest      },
                  { label: "Sync AI Findings",  Icon: Zap,      fn: syncAiFindings  },
                  { label: "Archive Resolved",  Icon: Archive,  fn: archiveResolved },
                ] as const).map(({ label, Icon, fn }) => (
                  <button
                    key={label}
                    onClick={fn}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded border border-slate-700/50 bg-slate-900/80 px-2 py-2 text-left transition-all hover:border-cyan-500/40 hover:bg-slate-800/80 disabled:opacity-40"
                  >
                    <Icon className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                    <span className="font-mono text-[9px] text-slate-300 leading-tight flex-1">{label}</span>
                    <ChevronRight className="h-2.5 w-2.5 text-slate-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* GUS log */}
            {log.length > 0 && (
              <div className="border-t border-slate-800/60 px-3 pt-2.5 pb-2">
                <div className="font-mono text-[8px] font-bold tracking-widest text-slate-500 uppercase mb-2">
                  GUS Log
                </div>
                <div ref={logRef} className="space-y-0.5 max-h-40 overflow-y-auto pr-0.5">
                  {log.map((e) => (
                    <LogLine key={e.id} entry={e} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Command input */}
          <form
            onSubmit={handleCommand}
            className="flex items-center gap-2 border-t border-cyan-500/20 px-3 py-2.5 flex-shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell GUS what to do..."
              className="flex-1 min-w-0 bg-transparent font-mono text-[11px] text-slate-300 placeholder:text-slate-600 outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex-shrink-0 text-cyan-400/60 hover:text-cyan-300 transition-colors disabled:opacity-25"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

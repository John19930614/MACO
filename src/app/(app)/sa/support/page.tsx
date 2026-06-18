import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { Headphones, Plus, Search, Clock, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

const TICKETS = [
  { id: "TKT-2026-041", company: "BioStar Research Inc.", subject: "CAPA workflow not triggering email notifications", priority: "high", status: "open", created: "2026-06-16", assignee: "Maria Lopez" },
  { id: "TKT-2026-040", company: "Nexgen Pharma Ltd.", subject: "Training module showing incorrect completion %", priority: "medium", status: "in_progress", created: "2026-06-15", assignee: "Dev Team" },
  { id: "TKT-2026-039", company: "LabCore Diagnostics", subject: "Cannot upload SDS PDF — 10MB limit error", priority: "medium", status: "open", created: "2026-06-14", assignee: "Unassigned" },
  { id: "TKT-2026-038", company: "MedTech Solutions", subject: "Request: Add custom field to Audit template", priority: "low", status: "open", created: "2026-06-13", assignee: "Unassigned" },
  { id: "TKT-2026-037", company: "BioStar Research Inc.", subject: "AI finding confidence score appears as 0 for new scans", priority: "high", status: "resolved", created: "2026-06-10", assignee: "Maria Lopez" },
  { id: "TKT-2026-036", company: "Nexgen Pharma Ltd.", subject: "Legal register import CSV format question", priority: "low", status: "resolved", created: "2026-06-08", assignee: "Support" },
];

const QA_CHECKS = [
  { check: "All mock data fixtures up to date", status: "pass", last_run: "2026-06-17" },
  { check: "TypeScript build — zero errors", status: "pass", last_run: "2026-06-17" },
  { check: "CAPA status transitions validated", status: "pass", last_run: "2026-06-16" },
  { check: "PDF export output quality", status: "warn", last_run: "2026-06-15" },
  { check: "AI engine scan latency < 2s", status: "pass", last_run: "2026-06-15" },
  { check: "Multi-tenant data isolation test", status: "pass", last_run: "2026-06-14" },
  { check: "Email notification integration", status: "fail", last_run: "2026-06-16" },
];

function priorityColor(p: string) {
  if (p === "high")   return "bg-red-100 text-red-700";
  if (p === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function statusColor(s: string) {
  if (s === "resolved")    return "bg-emerald-100 text-emerald-700";
  if (s === "in_progress") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function qaColor(s: string) {
  if (s === "pass") return "text-emerald-600";
  if (s === "warn") return "text-amber-600";
  return "text-red-600";
}

function QaIcon({ s }: { s: string }) {
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === "warn") return <Clock className="h-4 w-4 text-amber-500" />;
  return <AlertCircle className="h-4 w-4 text-red-500" />;
}

export default function SupportQAPage() {
  return (
    <div className="flex flex-col overflow-hidden h-full">
      <PageHeader
        title="Support & QA"
        subtitle="Client support tickets and internal quality assurance checks"
        actions={
          <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Open Tickets",     value: "4",  sub: "1 high priority",  color: "text-red-700",    bg: "bg-red-50 border-red-100" },
            { label: "In Progress",      value: "1",  sub: "Dev team assigned", color: "text-blue-700",   bg: "bg-blue-50 border-blue-100" },
            { label: "Resolved (30d)",   value: "12", sub: "Avg 2.1 day SLA",  color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-100" },
            { label: "QA Checks",        value: "5/7",sub: "2 need attention",  color: "text-amber-700",  bg: "bg-amber-50 border-amber-100" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <Card>
              <CardHeader
                title="Support Tickets"
                subtitle="Client-submitted issues and requests"
                right={
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input placeholder="Search tickets…" className="rounded-lg border border-slate-200 bg-slate-50 py-1 pl-7 pr-3 text-xs outline-none focus:border-blue-400" />
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Ticket", "Company", "Subject", "Priority", "Status", "Assignee"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {TICKETS.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 text-[11px] font-mono text-slate-500">{t.id}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">{t.company}</td>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <div className="truncate text-xs font-medium text-slate-800">{t.subject}</div>
                          <div className="text-[10px] text-slate-400">{t.created}</div>
                        </td>
                        <td className="px-4 py-2.5"><Pill className={priorityColor(t.priority)}>{t.priority}</Pill></td>
                        <td className="px-4 py-2.5"><Pill className={statusColor(t.status)}>{t.status.replace(/_/g, " ")}</Pill></td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{t.assignee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader title="QA Checks" subtitle="Internal automated checks" right={<span className="text-[10px] text-slate-400">Last run: today</span>} />
              <div className="divide-y divide-slate-50">
                {QA_CHECKS.map((q) => (
                  <div key={q.check} className="flex items-start gap-2.5 px-3 py-2.5">
                    <QaIcon s={q.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-medium text-slate-800 leading-snug">{q.check}</div>
                      <div className="text-[10px] text-slate-400">Run: {q.last_run}</div>
                    </div>
                    <span className={`text-[11px] font-bold uppercase ${qaColor(q.status)}`}>{q.status}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 p-3">
                <button className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Run All Checks
                </button>
              </div>
            </Card>

            <Card>
              <CardHeader title="Recent Activity" subtitle="Support log" />
              <div className="divide-y divide-slate-50">
                {[
                  { action: "Resolved TKT-2026-037", by: "Maria Lopez", time: "2h ago", icon: CheckCircle2, color: "text-emerald-500" },
                  { action: "Replied to TKT-2026-040", by: "Dev Team", time: "5h ago", icon: MessageSquare, color: "text-blue-500" },
                  { action: "QA check failed: email notifications", by: "System", time: "1d ago", icon: AlertCircle, color: "text-red-500" },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <div key={a.action} className="flex items-start gap-2 px-3 py-2.5">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${a.color}`} />
                      <div>
                        <div className="text-[11.5px] font-medium text-slate-800">{a.action}</div>
                        <div className="text-[10px] text-slate-400">{a.by} · {a.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  Calendar, Clock, Bell, AlertTriangle, CheckSquare,
  GraduationCap, ArrowRight, User, FileText, Wrench, BookOpen,
} from "lucide-react";
import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import {
  getWorkspaceTasks, getCapaActions, getIncidents, getTrainingRecords,
  getAudits, getEquipment, getProfiles, getDocuments, getTrainingCourses,
  getDocumentAcknowledgments,
} from "@/lib/data/ehsRepo";
import { getEffectiveTenantId, getServerProfileId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { AddTaskButton } from "./AddTaskButton";
import { CompleteTaskButton } from "./CompleteTaskButton";
import { AcknowledgeDocButton } from "./AcknowledgeDocButton";

const PRIORITY_COLOR: Record<string, string> = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-slate-100 text-slate-600",
};

const TYPE_COLOR: Record<string, string> = {
  CAPA:       "bg-orange-100 text-orange-700",
  Training:   "bg-blue-100 text-blue-700",
  Waste:      "bg-green-100 text-green-700",
  Documents:  "bg-purple-100 text-purple-700",
  Audit:      "bg-teal-100 text-teal-700",
  Meeting:    "bg-indigo-100 text-indigo-700",
  Operations: "bg-slate-100 text-slate-700",
  Chemical:   "bg-yellow-100 text-yellow-700",
  Incident:   "bg-red-100 text-red-700",
  General:    "bg-slate-100 text-slate-600",
};

const CAPA_STATUS_COLOR: Record<string, string> = {
  open:                 "bg-red-100 text-red-700",
  in_progress:          "bg-amber-100 text-amber-700",
  pending_verification: "bg-blue-100 text-blue-700",
  overdue:              "bg-red-200 text-red-800",
  closed:               "bg-emerald-100 text-emerald-700",
  rejected:             "bg-slate-100 text-slate-600",
};

const AUDIT_STATUS_COLOR: Record<string, string> = {
  scheduled:   "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed:   "bg-emerald-100 text-emerald-700",
  cancelled:   "bg-slate-100 text-slate-500",
};

const AUDIT_TYPE_LABEL: Record<string, string> = {
  internal:   "Internal",
  external:   "External",
  regulatory: "Regulatory",
  supplier:   "Supplier",
  system:     "System",
  process:    "Process",
};

const AUDIT_TYPE_COLOR: Record<string, string> = {
  internal:   "bg-blue-100 text-blue-700",
  external:   "bg-violet-100 text-violet-700",
  regulatory: "bg-red-100 text-red-700",
  supplier:   "bg-amber-100 text-amber-700",
  system:     "bg-teal-100 text-teal-700",
  process:    "bg-orange-100 text-orange-700",
};

const SEVERITY_COLOR: Record<string, string> = {
  low:      "bg-slate-100 text-slate-600",
  medium:   "bg-amber-100 text-amber-700",
  high:     "bg-red-100 text-red-700",
  critical: "bg-red-200 text-red-800",
};

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtFull(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
function fmtShort(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function isThisWeek(s: string | null): boolean {
  if (!s) return false;
  const d = new Date(s);
  const now = new Date();
  return d >= now && d <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}
function isDue(s: string | null): boolean {
  if (!s) return false;
  return new Date(s) < new Date();
}
function trainingStatus(expiry: string | null): "current" | "expiring" | "expired" | "no_expiry" {
  if (!expiry) return "no_expiry";
  const d = new Date(expiry);
  const now = new Date();
  if (d < now) return "expired";
  if (d.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) return "expiring";
  return "current";
}

const TRAINING_STATUS_STYLE = {
  current:   "bg-emerald-100 text-emerald-700",
  expiring:  "bg-amber-100 text-amber-700",
  expired:   "bg-red-100 text-red-700",
  no_expiry: "bg-slate-100 text-slate-500",
};
const TRAINING_STATUS_LABEL = {
  current:   "Current",
  expiring:  "Expiring",
  expired:   "Expired",
  no_expiry: "No Expiry",
};

export default async function WorkspacePage() {
  const tenantId = await getEffectiveTenantId();
  const currentProfileId = await getServerProfileId();

  const [
    allTasks, capas, incidents, trainingRecords, audits, equipment,
    profiles, documents, courses, docAcks,
  ] = await Promise.all([
    getWorkspaceTasks(currentProfileId, tenantId),
    getCapaActions(tenantId),
    getIncidents(tenantId),
    getTrainingRecords(tenantId),
    getAudits(tenantId),
    getEquipment(tenantId),
    getProfiles(tenantId),
    getDocuments(tenantId),
    getTrainingCourses(tenantId),
    getDocumentAcknowledgments(currentProfileId, tenantId),
  ]);

  const currentUser     = profiles.find((p) => p.id === currentProfileId);
  const currentUserName = currentUser?.display_name ?? "EHS Manager";

  const pendingTasks   = allTasks.filter((t) => t.status !== "done");
  const completedTasks = allTasks.filter((t) => t.status === "done");

  // ── Items 2-5: my data filtered for current user ──────────────────────────
  const myCAPAs   = capas.filter((c) => c.owner_id === currentProfileId && c.status !== "closed" && c.status !== "pending_verification");
  const myAudits  = audits.filter((a) => a.lead_auditor_id === currentProfileId);
  const myTraining = trainingRecords.filter((r) => r.profile_id === currentProfileId);
  const ackedDocIds = new Set(docAcks.map((a) => a.document_id));
  const myDocAcks = documents.filter((d) => d.acknowledgment_required && !ackedDocIds.has(d.id));

  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.title]));

  // ── Derived alerts ─────────────────────────────────────────────────────────
  const openIncidents    = incidents.filter((i) => i.status === "reported" || i.status === "under_investigation");
  const overdueCAPAs     = capas.filter((c) => c.due_date && isDue(c.due_date) && c.status !== "closed" && c.status !== "pending_verification");
  const expiringTraining = trainingRecords.filter((r) => {
    if (!r.expiry_date) return false;
    const d = new Date(r.expiry_date);
    const now = new Date();
    return d > now && d.getTime() - now.getTime() < 14 * 24 * 60 * 60 * 1000;
  });
  const completedAudits = audits.filter((a) => a.status === "completed");

  const alerts: Array<{ id: string; Icon: React.ComponentType<{className?: string}>; color: string; text: string }> = [];
  if (openIncidents.length > 0)
    alerts.push({ id: "incidents", Icon: AlertTriangle, color: "text-red-500 bg-red-50",     text: `${openIncidents.length} incident${openIncidents.length > 1 ? "s" : ""} open — investigation report required` });
  if (overdueCAPAs.length > 0)
    alerts.push({ id: "capas",     Icon: Bell,           color: "text-amber-500 bg-amber-50", text: `${overdueCAPAs.length} CAPA action${overdueCAPAs.length > 1 ? "s" : ""} overdue — immediate attention required` });
  if (expiringTraining.length > 0)
    alerts.push({ id: "training",  Icon: GraduationCap,  color: "text-blue-500 bg-blue-50",  text: `${expiringTraining.length} training certificate${expiringTraining.length > 1 ? "s" : ""} expiring within 14 days` });
  if (completedAudits.length > 0)
    alerts.push({ id: "audits",    Icon: CheckSquare,    color: "text-emerald-500 bg-emerald-50", text: `${completedAudits.length} audit${completedAudits.length > 1 ? "s" : ""} completed — results ready for review` });

  // ── Upcoming ───────────────────────────────────────────────────────────────
  type UpcomingItem = { date: string; title: string; type: string; sortKey: string };
  const upcoming: UpcomingItem[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  for (const c of capas) {
    if (c.due_date && new Date(c.due_date) >= now && new Date(c.due_date) <= cutoff && c.status !== "closed")
      upcoming.push({ date: c.due_date, title: c.title, type: "CAPA", sortKey: c.due_date });
  }
  for (const a of audits) {
    if (a.scheduled_date && new Date(a.scheduled_date) >= now && new Date(a.scheduled_date) <= cutoff)
      upcoming.push({ date: a.scheduled_date, title: a.title, type: "Audit", sortKey: a.scheduled_date });
  }
  for (const e of equipment) {
    if (e.next_calibration_date && new Date(e.next_calibration_date) >= now && new Date(e.next_calibration_date) <= cutoff)
      upcoming.push({ date: e.next_calibration_date, title: `Calibrate: ${e.name}`, type: "Operations", sortKey: e.next_calibration_date });
  }
  upcoming.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const dueThisWeek = pendingTasks.filter((t) => isThisWeek(t.due_date)).length;
  const openActions = capas.filter((c) => c.status === "open" || c.status === "in_progress").length;

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <PageHeader
        title="My Workspace"
        subtitle="Your personal task hub — tasks, training, CAPAs, audits, and document acknowledgments"
        actions={<AddTaskButton currentProfileId={currentProfileId} profiles={profiles} />}
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-5">
        {/* Summary row */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Tasks Due This Week", value: dueThisWeek,        color: "text-red-600",     bg: "bg-red-50 border-red-100"      },
            { label: "Open Actions",        value: openActions,         color: "text-orange-600",  bg: "bg-orange-50 border-orange-100" },
            { label: "Alerts / Notices",    value: alerts.length,       color: "text-amber-600",   bg: "bg-amber-50 border-amber-100"  },
            { label: "My Open Tasks",       value: pendingTasks.length, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* ── Main column ─────────────────────────────────────────────────── */}
          <div className="col-span-2 flex flex-col gap-5">

            {/* 1. My Pending Tasks */}
            <Card>
              <CardHeader
                title="My Pending Tasks"
                subtitle={`${pendingTasks.length} task${pendingTasks.length !== 1 ? "s" : ""} assigned to you`}
                right={<ArrowRight className="h-3 w-3 text-blue-600" />}
              />
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                    <CompleteTaskButton
                      taskId={task.id}
                      taskTitle={task.title}
                      completedById={currentProfileId}
                      completedByName={currentUserName}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">{task.title}</div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <Pill className={TYPE_COLOR[task.type] ?? "bg-slate-100 text-slate-600"}>{task.type}</Pill>
                        <Pill className={PRIORITY_COLOR[task.priority]}>{task.priority} priority</Pill>
                        {task.due_date && (
                          <span className={`flex items-center gap-1 text-[11px] ${isDue(task.due_date) ? "font-semibold text-red-600" : "text-slate-400"}`}>
                            <Clock className="h-3 w-3" />
                            Due {fmt(task.due_date)}{isDue(task.due_date) && " — overdue"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {pendingTasks.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">No pending tasks — all caught up!</div>
                )}
              </div>
            </Card>

            {/* 2 & 3: My CAPA Actions + My Audit Assignments */}
            <div className="grid grid-cols-2 gap-5">
              {/* My CAPA Actions */}
              <Card>
                <CardHeader
                  title="My CAPA Actions"
                  subtitle={`${myCAPAs.length} open action${myCAPAs.length !== 1 ? "s" : ""} assigned to you`}
                  right={<Wrench className="h-3.5 w-3.5 text-orange-500" />}
                />
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {myCAPAs.slice(0, 5).map((c) => (
                    <Link key={c.id} href={`/capa/${c.id}`} className="block px-3 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                      <div className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{c.title}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <Pill className={CAPA_STATUS_COLOR[c.status] ?? "bg-slate-100 text-slate-600"}>
                          {c.status.replace(/_/g, " ")}
                        </Pill>
                        {c.severity && (
                          <Pill className={SEVERITY_COLOR[c.severity] ?? "bg-slate-100 text-slate-600"}>
                            {c.severity}
                          </Pill>
                        )}
                        {c.due_date && (
                          <span className={`text-[10.5px] ${isDue(c.due_date) ? "font-semibold text-red-600" : "text-slate-400"}`}>
                            Due {fmt(c.due_date)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                  {myCAPAs.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">No open CAPA actions</div>
                  )}
                </div>
              </Card>

              {/* My Audit Assignments */}
              <Card>
                <CardHeader
                  title="My Audit Assignments"
                  subtitle={`${myAudits.length} audit${myAudits.length !== 1 ? "s" : ""} assigned as lead auditor`}
                  right={<CheckSquare className="h-3.5 w-3.5 text-teal-500" />}
                />
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {myAudits.slice(0, 5).map((a) => (
                    <Link key={a.id} href={`/audits/${a.id}`} className="block px-3 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                      <div className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{a.title}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <Pill className={AUDIT_STATUS_COLOR[a.status] ?? "bg-slate-100 text-slate-600"}>
                          {a.status.replace(/_/g, " ")}
                        </Pill>
                        <Pill className={AUDIT_TYPE_COLOR[a.type] ?? "bg-teal-100 text-teal-700"}>
                          {AUDIT_TYPE_LABEL[a.type] ?? a.type}
                        </Pill>
                        {a.scheduled_date && (
                          <span className="text-[10.5px] text-slate-400">
                            {fmt(a.scheduled_date)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                  {myAudits.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">No audit assignments</div>
                  )}
                </div>
              </Card>
            </div>

            {/* 4 & 5: My Training + My Document Acknowledgments */}
            <div className="grid grid-cols-2 gap-5">
              {/* My Training */}
              <Card>
                <CardHeader
                  title="My Training"
                  subtitle={`${myTraining.length} training record${myTraining.length !== 1 ? "s" : ""} on file`}
                  right={<GraduationCap className="h-3.5 w-3.5 text-blue-500" />}
                />
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {myTraining.slice(0, 5).map((r) => {
                    const tStatus = trainingStatus(r.expiry_date);
                    return (
                      <div key={r.id} className="px-3 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                        <div className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-1">
                          {courseMap[r.course_id] ?? "Training Course"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <Pill className={TRAINING_STATUS_STYLE[tStatus]}>{TRAINING_STATUS_LABEL[tStatus]}</Pill>
                          {r.expiry_date && (
                            <span className={`text-[10.5px] ${tStatus === "expired" || tStatus === "expiring" ? "font-medium text-red-500" : "text-slate-400"}`}>
                              Exp {fmt(r.expiry_date)}
                            </span>
                          )}
                          {!r.expiry_date && (
                            <span className="text-[10.5px] text-slate-400">Completed {fmt(r.completed_date)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {myTraining.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">No training records on file</div>
                  )}
                </div>
              </Card>

              {/* My Document Acknowledgments */}
              <Card>
                <CardHeader
                  title="My Document Acknowledgments"
                  subtitle={`${myDocAcks.length} document${myDocAcks.length !== 1 ? "s" : ""} require${myDocAcks.length === 1 ? "s" : ""} your acknowledgment`}
                  right={<BookOpen className="h-3.5 w-3.5 text-purple-500" />}
                />
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {myDocAcks.slice(0, 5).map((d) => (
                    <div key={d.id} className="px-3 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                      <div className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-1">{d.title}</div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <Pill className="bg-purple-100 text-purple-700">{d.category}</Pill>
                        {d.review_date && (
                          <span className="text-[10.5px] text-slate-400">Review {fmt(d.review_date)}</span>
                        )}
                        <AcknowledgeDocButton
                          documentId={d.id}
                          documentTitle={d.title}
                          profileId={currentProfileId}
                        />
                      </div>
                    </div>
                  ))}
                  {myDocAcks.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">All documents acknowledged</div>
                  )}
                </div>
              </Card>
            </div>

            {/* Completed tasks with evidence */}
            {completedTasks.length > 0 && (
              <Card>
                <CardHeader
                  title="Completed Tasks"
                  subtitle={`${completedTasks.length} task${completedTasks.length !== 1 ? "s" : ""} completed — audit evidence on file`}
                  right={
                    <Pill className="bg-emerald-100 text-emerald-700 flex items-center gap-1">
                      <FileText className="h-2.5 w-2.5" />
                      Audit ready
                    </Pill>
                  }
                />
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {completedTasks.map((task) => {
                    const completedByProfile = profiles.find((p) => p.id === task.completed_by);
                    return (
                      <div key={task.id} className="px-4 py-3 hover:bg-slate-50/40 dark:hover:bg-slate-800/40">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <CheckSquare className="h-3 w-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-600 line-through decoration-slate-300">{task.title}</span>
                              <Pill className={TYPE_COLOR[task.type] ?? "bg-slate-100 text-slate-600"}>{task.type}</Pill>
                            </div>
                            {task.completion_notes && (
                              <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1">Completion Notes</div>
                                <div className="text-xs text-slate-700 leading-relaxed">{task.completion_notes}</div>
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-3 text-[10.5px] text-slate-400">
                              {completedByProfile && (
                                <span className="flex items-center gap-1"><User className="h-3 w-3" />{completedByProfile.display_name}</span>
                              )}
                              {task.completed_at && (
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtFull(task.completed_at)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* ── Right column ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Alerts */}
            <Card>
              <CardHeader title="My Alerts" subtitle="Derived from live module data" />
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {alerts.map((alert) => {
                  const Icon = alert.Icon;
                  return (
                    <div key={alert.id} className="flex items-start gap-2.5 px-3 py-2.5">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${alert.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] leading-snug text-slate-700">{alert.text}</div>
                      </div>
                    </div>
                  );
                })}
                {alerts.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">No active alerts</div>
                )}
              </div>
            </Card>

            {/* Upcoming */}
            <Card>
              <CardHeader title="Upcoming" subtitle="Next 60 days — CAPAs, audits, calibrations" right={<Calendar className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {upcoming.slice(0, 6).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-center">
                      <div className="text-[9px] font-bold uppercase text-blue-400">{fmtShort(item.date).split(" ")[0]}</div>
                      <div className="text-sm font-extrabold leading-none text-blue-700">{fmtShort(item.date).split(" ")[1]}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-slate-800">{item.title}</div>
                      <Pill className={TYPE_COLOR[item.type] ?? "bg-slate-100 text-slate-600"} style={{ fontSize: "9.5px" }}>{item.type}</Pill>
                    </div>
                  </div>
                ))}
                {upcoming.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">No upcoming items in the next 60 days</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, PageHeader, Stat, Pill } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DRILL_EVENT_TYPES,
  DRILL_EVENT_LABELS,
  type DrillEventType,
} from "@/lib/drill-compliance/helpers";
import {
  generateDrillCalendar,
  recordDrill,
  escalateOverdueDrills,
  type DrillRecordInput,
} from "@/lib/actions/evacuation-drill-compliance-calendar";

/* eslint-disable @typescript-eslint/no-explicit-any -- server rows arrive as
   loosely-typed jsonb; this presentational component reads a handful of known
   columns rather than importing a generated DB type that doesn't exist yet. */
type Row = Record<string, any>;

interface Props {
  siteId: string | null;
  profile: Row | null;
  calendar: Row[];
  requirements: Row[];
  wardens: Row[];
  actions: Row[];
  demo?: boolean;
}

// ── Status badge: icon + WORD, never colour alone (a11y) ───────────────────────
function DrillStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    scheduled: { label: "Scheduled", className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200", icon: Clock },
    completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
    overdue: { label: "Overdue", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: AlertTriangle },
    escalated: { label: "Escalated", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", icon: ShieldAlert },
  };
  const m = meta[status] ?? meta.scheduled;
  const Icon = m.icon;
  return (
    <Pill className={m.className}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {m.label}
    </Pill>
  );
}

export function EvacuationDrillCompliance({
  siteId,
  profile,
  calendar,
  requirements,
  wardens,
  actions,
  demo = false,
}: Props) {
  const [rows, setRows] = useState<Row[]>(calendar);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let onTrack = 0;
    let dueSoon = 0;
    let overdue = 0;
    for (const ev of rows) {
      if (ev.status === "completed") continue;
      if (ev.status === "overdue" || ev.status === "escalated" || (ev.due_date && ev.due_date < today)) {
        overdue += 1;
      } else if (ev.due_date && daysUntil(ev.due_date) <= 30) {
        dueSoon += 1;
      } else {
        onTrack += 1;
      }
    }
    const failed = actions.filter((a) => a.action_type === "failed_drill").length;
    return { onTrack, dueSoon, overdue, failed };
  }, [rows, actions]);

  const disabled = demo || !siteId;

  const onGenerate = () => {
    if (disabled) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await generateDrillCalendar(siteId!);
      if (res.ok) {
        setNotice(`Generated ${res.count} scheduled drill${res.count === 1 ? "" : "s"}. Refresh to view them.`);
      } else {
        setError(res.error);
      }
    });
  };

  const onEscalate = () => {
    if (disabled) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await escalateOverdueDrills();
      if (res.ok) {
        setNotice(`${res.escalated} overdue drill${res.escalated === 1 ? "" : "s"} escalated.`);
        setRows((prev) =>
          prev.map((r) =>
            r.status === "scheduled" && r.due_date < new Date().toISOString().slice(0, 10)
              ? { ...r, status: "overdue" }
              : r,
          ),
        );
      } else {
        setError(res.error);
      }
    });
  };

  const onSaveDrill = (formData: FormData) => {
    if (disabled) return;
    setError(null);
    setNotice(null);
    const input = parseDrillForm(formData, siteId!);
    if (!input) {
      setError("Please check the highlighted fields.");
      return;
    }
    startTransition(async () => {
      const res = await recordDrill(input);
      if (res.ok) {
        const flags: string[] = [];
        if (res.missingWardens) flags.push("no warden was logged");
        if (res.rosterMismatch) flags.push("roster/accountability mismatch");
        if (res.eapReviewRequired) flags.push("EAP review flagged");
        setNotice(
          flags.length ? `Drill recorded — alerts raised: ${flags.join(", ")}.` : "Drill recorded.",
        );
        setShowForm(false);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Evacuation Drill Compliance Calendar"
        subtitle="See which drills are due, log completed drills, and keep wardens up to date — by building and by shift."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEscalate}
              disabled={disabled || isPending}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Check overdue
            </button>
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              disabled={disabled || isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Log a drill
            </button>
          </div>
        }
      />

      <div className="iq-scroll flex-1 space-y-6 overflow-y-auto p-6">
        {demo && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Demo mode: drill records aren&apos;t saved. Connect a live site to record and schedule drills.
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
            {notice}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="On track" value={summary.onTrack} icon={<CheckCircle2 className="h-5 w-5" />} accent="#059669" />
          <Stat label="Due soon (30d)" value={summary.dueSoon} icon={<Clock className="h-5 w-5" />} accent="#2563eb" />
          <Stat label="Overdue" value={summary.overdue} icon={<AlertTriangle className="h-5 w-5" />} accent="#d97706" />
          <Stat label="Failed drills" value={summary.failed} icon={<XCircle className="h-5 w-5" />} accent="#dc2626" />
        </div>

        {/* Facility profile */}
        <Card>
          <CardHeader title="Facility profile" subtitle="Occupancy, shifts, hazards and systems for this site" />
          <div className="p-4 text-sm">
            {profile ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="AHJ (fire authority)" value={profile.ahj} />
                <Field label="Occupancy classification" value={profile.occupancy_classification} />
                <Field label="Shifts" value={(profile.shifts ?? []).map((s: Row) => s.name).join(", ") || "—"} />
                <Field label="High-hazard operations" value={profile.high_hazard_ops ? "Yes" : "No"} />
                <Field label="Hazmat inventory items" value={String((profile.hazmat_inventory ?? []).length)} />
                <Field label="Generator category" value={profile.generator_category} />
                <Field
                  label="Alarm & suppression"
                  value={(profile.alarm_suppression_systems ?? []).join(", ") || "—"}
                />
              </dl>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                No facility profile yet. A manager can add AHJ, occupancy class, shifts and systems to drive the schedule.
              </p>
            )}
          </div>
        </Card>

        {/* Frequency requirements: required vs company + legal source */}
        <Card>
          <CardHeader title="Drill frequency requirements" subtitle="Legally required cadence and any stricter company goal — the calendar uses whichever is more frequent" />
          <div className="overflow-x-auto p-4">
            {requirements.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No requirements set for this site yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-4">Event type</th>
                    <th className="pb-2 pr-4">Required</th>
                    <th className="pb-2 pr-4">Legal source</th>
                    <th className="pb-2 pr-4">Company goal</th>
                    <th className="pb-2 pr-4">Per shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {requirements.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 font-medium">{labelFor(r.event_type)}</td>
                      <td className="py-2 pr-4">{r.required_frequency}</td>
                      <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{r.legal_source}</td>
                      <td className="py-2 pr-4">{r.company_required_frequency ?? "—"}</td>
                      <td className="py-2 pr-4">{r.per_shift ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Calendar */}
        <Card>
          <CardHeader
            title="Drill calendar"
            subtitle="Upcoming, overdue and completed drills"
            right={
              rows.length > 0 ? (
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={disabled || isPending}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                >
                  Regenerate
                </button>
              ) : undefined
            }
          />
          <div className="p-4">
            {rows.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" />}
                title="No drills scheduled yet"
                description="Set your frequency requirements, then generate the calendar to schedule drills per occupancy, jurisdiction and shift."
                action={{ label: "Generate calendar", onClick: onGenerate }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-2 pr-4">Event type</th>
                      <th className="pb-2 pr-4">Shift</th>
                      <th className="pb-2 pr-4">Due date</th>
                      <th className="pb-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {rows.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-2 pr-4 font-medium">{labelFor(ev.event_type)}</td>
                        <td className="py-2 pr-4">{ev.shift_name ?? "All shifts"}</td>
                        <td className="py-2 pr-4">{ev.due_date}</td>
                        <td className="py-2 pr-4"><DrillStatusBadge status={ev.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* Wardens */}
        <Card>
          <CardHeader title="Wardens on duty" subtitle="Assigned per site and shift" />
          <div className="p-4 text-sm">
            {wardens.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">No wardens assigned yet.</p>
            ) : (
              <ul className="space-y-1">
                {wardens.map((w) => (
                  <li key={w.id} className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="font-medium">{w.role}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{w.shift_id ?? "all shifts"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Open alerts */}
        {actions.length > 0 && (
          <Card>
            <CardHeader title="Open compliance alerts" subtitle="Overdue drills, missing wardens and roster mismatches" />
            <div className="p-4">
              <ul className="space-y-2 text-sm">
                {actions.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <AlertTriangle
                      className={a.severity === "critical" ? "h-4 w-4 text-red-500" : "h-4 w-4 text-amber-500"}
                      aria-hidden="true"
                    />
                    <span className="font-medium">{humanizeAction(a.action_type)}</span>
                    <span className="text-slate-400">·</span>
                    <span className="uppercase text-xs text-slate-500 dark:text-slate-400">{a.severity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}

        {/* Log a drill form */}
        {showForm && (
          <Card>
            <CardHeader title="Log a drill" subtitle="Record what happened — this feeds CAPA, warden alerts and EAP review" />
            <form action={onSaveDrill} className="space-y-6 p-4">
              <FormSection title="Timing">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Event type</span>
                  <select name="eventType" required className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                    {DRILL_EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{DRILL_EVENT_LABELS[t]}</option>
                    ))}
                  </select>
                </label>
                <Text name="drillDate" label="Drill date" type="date" required />
                <Text name="startTime" label="Start time" type="time" />
                <Text name="endTime" label="End time" type="time" />
              </FormSection>

              <FormSection title="Participants & roster">
                <Text name="participants" label="Participants (comma-separated)" />
                <Text name="contractorsVisitorsPresent" label="Contractors / visitors present (comma-separated)" />
              </FormSection>

              <FormSection title="Alarm & response times">
                <Text name="alarmMethod" label="Alarm method" required placeholder="pull station, voice evac, PA…" />
                <Text name="evacuationTimeSeconds" label="Evacuation time (seconds)" type="number" />
                <Text name="assemblyTimeSeconds" label="Assembly time (seconds)" type="number" />
                <Text name="accountabilityTimeSeconds" label="Accountability time (seconds)" type="number" />
              </FormSection>

              <FormSection title="Routes & equipment">
                <Text name="blockedRoutes" label="Blocked / impassable routes (comma-separated)" />
                <Text name="equipmentPerformance" label="Equipment issues (item:status, comma-separated)" placeholder="alarm panel:ok, exit sign:dark" />
              </FormSection>

              <FormSection title="Wardens & observers">
                <Text name="wardens" label="Wardens on duty (comma-separated)" />
                <Text name="observers" label="Observers (comma-separated)" />
              </FormSection>

              <FormSection title="Problems & evidence">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium">Problems noted</span>
                  <textarea name="problemsNoted" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
                </label>
                <Text name="evidenceUrls" label="Evidence URLs (comma-separated)" />
              </FormSection>

              <FormSection title="Corrective actions & retraining">
                <Text name="correctiveActions" label="Corrective actions (one per line — description only)" />
                <Text name="planRevisionDate" label="Plan revision date" type="date" />
                <Text name="retrainingDate" label="Retraining date" type="date" />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Result</span>
                  <select name="result" required className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                    <option value="incomplete">Incomplete</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="realEmergencyTriggered" value="true" className="h-4 w-4" />
                  <span>This was triggered by a real emergency</span>
                </label>
              </FormSection>

              <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
                <button type="submit" disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isPending ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200">
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700 dark:text-slate-200">{value || "—"}</dd>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Text({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
  );
}

function labelFor(eventType: string): string {
  return DRILL_EVENT_LABELS[eventType as DrillEventType] ?? eventType;
}

function humanizeAction(t: string): string {
  return (
    {
      overdue_drill: "Overdue drill",
      missing_warden: "No warden logged",
      roster_accountability_mismatch: "Roster / accountability mismatch",
      failed_drill: "Failed drill",
      eap_review_required: "EAP review required",
    }[t] ?? t
  );
}

function daysUntil(isoDate: string): number {
  const now = new Date();
  const target = new Date(isoDate + "T00:00:00");
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

// ── FormData → recordDrill input ──────────────────────────────────────────────
function splitList(v: FormDataEntryValue | null): string[] {
  if (!v) return [];
  return String(v)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function numOrUndef(v: FormDataEntryValue | null): number | undefined {
  if (v === null || String(v).trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseDrillForm(fd: FormData, siteId: string): DrillRecordInput | null {
  const eventType = String(fd.get("eventType") ?? "");
  const drillDate = String(fd.get("drillDate") ?? "");
  const alarmMethod = String(fd.get("alarmMethod") ?? "");
  const result = String(fd.get("result") ?? "");
  if (!eventType || !drillDate || !alarmMethod || !result) return null;

  const equipmentPerformance = splitList(fd.get("equipmentPerformance")).map((entry) => {
    const [item, status] = entry.split(":").map((s) => s.trim());
    return { item: item || entry, status: status || "noted" };
  });

  const correctiveActions = splitList(fd.get("correctiveActions")).map((description) => ({ description }));

  return {
    siteId,
    eventType: eventType as DrillRecordInput["eventType"],
    drillDate,
    startTime: (fd.get("startTime") as string) || undefined,
    endTime: (fd.get("endTime") as string) || undefined,
    participants: splitList(fd.get("participants")),
    contractorsVisitorsPresent: splitList(fd.get("contractorsVisitorsPresent")),
    alarmMethod,
    evacuationTimeSeconds: numOrUndef(fd.get("evacuationTimeSeconds")),
    assemblyTimeSeconds: numOrUndef(fd.get("assemblyTimeSeconds")),
    accountabilityTimeSeconds: numOrUndef(fd.get("accountabilityTimeSeconds")),
    blockedRoutes: splitList(fd.get("blockedRoutes")),
    equipmentPerformance,
    wardens: splitList(fd.get("wardens")),
    observers: splitList(fd.get("observers")),
    problemsNoted: (fd.get("problemsNoted") as string) || undefined,
    evidenceUrls: splitList(fd.get("evidenceUrls")),
    correctiveActions,
    planRevisionDate: (fd.get("planRevisionDate") as string) || undefined,
    retrainingDate: (fd.get("retrainingDate") as string) || undefined,
    result: result as DrillRecordInput["result"],
    realEmergencyTriggered: fd.get("realEmergencyTriggered") === "true",
  };
}

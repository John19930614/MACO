"use client";

import { useState, useMemo } from "react";
import { useDemoUser } from "@/lib/context/demo-user";
import Link from "next/link";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, FlaskConical,
  FileText, Users, BarChart3, Shield, Printer, BookOpen,
  Award, ChevronRight, Bell, Check, UserCheck,
} from "lucide-react";
import type { TrainingCourse, TrainingRecord, Profile, Chemical } from "@/lib/types";
import { Pill } from "@/components/ui/primitives";
import { AddTrainingButton } from "./AddTrainingButton";
import { MarkCourseCompleteButton } from "./MarkCourseCompleteButton";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(s: string | null): number {
  if (!s) return 999;
  return Math.ceil((new Date(s).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function isExpired(s: string | null) {
  if (!s) return false;
  return new Date(s) < new Date();
}

function isExpiringSoon(s: string | null, days = 30) {
  if (!s) return false;
  const d = new Date(s);
  const now = new Date();
  return d > now && d.getTime() - now.getTime() < days * 24 * 60 * 60 * 1000;
}

type CellStatus = "complete" | "expiring" | "expired" | "failed" | "not_started" | "not_required";

function cellStatus(record: TrainingRecord | null, required: boolean): CellStatus {
  if (!required) return "not_required";
  if (!record) return "not_started";
  if (!record.passed) return "failed";
  if (isExpired(record.expiry_date)) return "expired";
  if (isExpiringSoon(record.expiry_date)) return "expiring";
  return "complete";
}

const STATUS_CELL: Record<CellStatus, { icon: React.ReactNode; bg: string; title: string }> = {
  complete:     { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, bg: "bg-emerald-50 dark:bg-emerald-900/20",  title: "Complete" },
  expiring:     { icon: <Clock className="h-4 w-4 text-amber-500" />,          bg: "bg-amber-50 dark:bg-amber-900/20",      title: "Expiring soon" },
  expired:      { icon: <XCircle className="h-4 w-4 text-red-500" />,          bg: "bg-red-50 dark:bg-red-900/20",          title: "Expired" },
  failed:       { icon: <XCircle className="h-4 w-4 text-red-500" />,          bg: "bg-red-50 dark:bg-red-900/20",          title: "Failed" },
  not_started:  { icon: <div className="h-3 w-3 rounded-full border-2 border-slate-300 dark:border-slate-600" />, bg: "bg-slate-50 dark:bg-slate-800", title: "Not started" },
  not_required: { icon: <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />, bg: "",               title: "Not required" },
};

// ── Required compliance designations by tenant ───────────────────────────────

interface RequiredDesignation {
  role: string;
  regulatory_basis: string;
  citation: string;
  assignee: string | null;
  status: "assigned" | "pending" | "vacant";
  notes?: string;
}

const REQUIRED_DESIGNATIONS: Record<string, RequiredDesignation[]> = {
  "t-biostar-001": [
    {
      role: "Chemical Hygiene Officer (CHO)",
      regulatory_basis: "OSHA Laboratory Standard — mandatory for any lab using hazardous chemicals",
      citation: "29 CFR 1910.1450(e)(3)(i)",
      assignee: "Dr. Kim Park",
      status: "pending",
      notes: "Formal designation letter pending. Kim Park is performing CHO duties.",
    },
    {
      role: "Biosafety Officer (BSO)",
      regulatory_basis: "NIH/CDC BMBL 6th Edition — required for BSL-2 operations and rDNA work",
      citation: "NIH Guidelines Section IV-B-7",
      assignee: "Dr. Kim Park",
      status: "assigned",
    },
    {
      role: "RCRA Emergency Coordinator",
      regulatory_basis: "EPA RCRA — SQG must designate an emergency coordinator available 24/7",
      citation: "EPA 40 CFR 262.17(a)(1)(ii)",
      assignee: "Tom Reed",
      status: "assigned",
    },
    {
      role: "First Aid / CPR Certified Personnel",
      regulatory_basis: "OSHA First Aid — certified person must be present when medical facility is not reasonably accessible",
      citation: "29 CFR 1910.151(b)",
      assignee: "Sarah Chen, Tom Reed",
      status: "assigned",
      notes: "Minimum 2 certified persons on site. Re-certification due Dec 2026.",
    },
    {
      role: "Workplace Violence Prevention Coordinator",
      regulatory_basis: "California SB 553 — employer must designate a WVPP coordinator responsible for implementation",
      citation: "Cal/OSHA 8 CCR 3342",
      assignee: null,
      status: "vacant",
      notes: "SB 553 WVPP required to be implemented. Coordinator not yet designated.",
    },
  ],
  "t-novabio-001": [
    {
      role: "Chemical Hygiene Officer (CHO)",
      regulatory_basis: "OSHA Laboratory Standard — mandatory for any lab using hazardous chemicals",
      citation: "29 CFR 1910.1450(e)(3)(i)",
      assignee: "David Kim",
      status: "pending",
      notes: "CHO duties assigned to EHS Manager pending formal training completion.",
    },
    {
      role: "RCRA Emergency Coordinator",
      regulatory_basis: "EPA RCRA — SQG must designate an emergency coordinator available 24/7",
      citation: "EPA 40 CFR 262.17(a)(1)(ii)",
      assignee: null,
      status: "vacant",
      notes: "Required before first hazardous waste accumulation period expires.",
    },
    {
      role: "Biosafety Officer (BSO)",
      regulatory_basis: "NIH/CDC BMBL 6th Edition — required if BSL-2 agents are used",
      citation: "NIH Guidelines Section IV-B-7",
      assignee: null,
      status: "vacant",
      notes: "BSO must be designated before BSL-2 work commences.",
    },
    {
      role: "Workplace Violence Prevention Coordinator",
      regulatory_basis: "California SB 553 — employer must designate a WVPP coordinator",
      citation: "Cal/OSHA 8 CCR 3342",
      assignee: null,
      status: "vacant",
    },
  ],
};

// ── Chemical-triggered training definitions ───────────────────────────────────

interface ChemTrigger {
  label: string;
  matchFn: (c: Chemical) => boolean;
  courseIds: string[];
  regulation: string;
  reason: string;
}

const CHEM_TRIGGERS: ChemTrigger[] = [
  {
    label: "Formaldehyde (OSHA 1910.1048)",
    matchFn: (c) =>
      c.schedule_ref?.includes("1910.1048") ||
      c.name.toLowerCase().includes("formaldehyde"),
    courseIds: ["course-001", "course-006"],
    regulation: "29 CFR 1910.1048",
    reason: "All potentially exposed employees must receive formaldehyde-specific training covering PEL limits, health effects, and controls.",
  },
  {
    label: "Carcinogens / Reproductive Toxicants (H350 / H351 / H340)",
    matchFn: (c) => c.ghs_classes.some((g) => ["H350", "H351", "H340", "H361"].includes(g)),
    courseIds: ["course-001", "course-002"],
    regulation: "29 CFR 1910.1450",
    reason: "OSHA Lab Standard requires training on category 1A/1B carcinogens and reproductive toxicants present in the workplace.",
  },
  {
    label: "Acute Highly Toxic — Fatal Routes (H300 / H310 / H330)",
    matchFn: (c) => c.ghs_classes.some((g) => ["H300", "H310", "H330"].includes(g)),
    courseIds: ["course-002"],
    regulation: "29 CFR 1910.1450",
    reason: "Substances that are fatal via ingestion, skin absorption, or inhalation require enhanced lab chemical safety training.",
  },
  {
    label: "Flammable Liquids (H225 / H226)",
    matchFn: (c) => c.ghs_classes.some((g) => ["H225", "H226"].includes(g)),
    courseIds: ["course-002"],
    regulation: "29 CFR 1910.1450 + NFPA 30",
    reason: "Flammable liquids training is required under the Lab Standard and NFPA 30 for personnel handling flash-point hazards.",
  },
  {
    label: "Cryogenic / Compressed Gas (H280 / H281)",
    matchFn: (c) => c.ghs_classes.some((g) => ["H280", "H281"].includes(g)),
    courseIds: ["course-008"],
    regulation: "29 CFR 1910.101",
    reason: "Cryogenic and compressed gas personnel must be trained on asphyxiation risks, PPE, and Dewar/cylinder handling.",
  },
  {
    label: "Oxidizers (H271 / H272)",
    matchFn: (c) => c.ghs_classes.some((g) => ["H271", "H272"].includes(g)),
    courseIds: ["course-002"],
    regulation: "29 CFR 1910.1450",
    reason: "Strong oxidizers present reactive chemical hazards that require dedicated safety training.",
  },
  {
    label: "Aquatic / Environmental Hazard (H400 / H410)",
    matchFn: (c) => c.ghs_classes.some((g) => ["H400", "H410"].includes(g)),
    courseIds: ["course-005"],
    regulation: "EPA 40 CFR 262",
    reason: "Chemicals with environmental toxicity classification trigger hazardous waste management training requirements.",
  },
];

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",        label: "Overview",             icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: "assignments",     label: "My Assignments",       icon: <Shield className="h-3.5 w-3.5" /> },
  { id: "matrix",          label: "Training Matrix",      icon: <Users className="h-3.5 w-3.5" /> },
  { id: "chemical",        label: "Chemical Training",    icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { id: "certs",           label: "Expiring Certs",       icon: <Bell className="h-3.5 w-3.5" /> },
  { id: "acknowledgments", label: "Acknowledgments",      icon: <Award className="h-3.5 w-3.5" /> },
  { id: "report",          label: "Completion Report",    icon: <Printer className="h-3.5 w-3.5" /> },
  { id: "courses",         label: "Course Catalogue",     icon: <BookOpen className="h-3.5 w-3.5" /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TrainingDashboard({
  courses,
  records,
  profiles,
  chemicals,
}: {
  courses: TrainingCourse[];
  records: TrainingRecord[];
  profiles: Profile[];
  chemicals: Chemical[];
}) {
  const { user } = useDemoUser();
  const [tab, setTab] = useState<TabId>("overview");
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  // Only tenant employees (exclude Reliance global operator)
  const employees = useMemo(
    () => profiles.filter((p) => p.active && p.tenant_id !== null),
    [profiles],
  );

  const activeCourses = useMemo(() => courses.filter((c) => c.active), [courses]);

  // recordLookup[profileId][courseId] → latest TrainingRecord
  const recordLookup = useMemo(() => {
    const map: Record<string, Record<string, TrainingRecord>> = {};
    for (const r of records) {
      const existing = map[r.profile_id]?.[r.course_id];
      if (!existing || new Date(r.completed_date) > new Date(existing.completed_date)) {
        map[r.profile_id] = map[r.profile_id] ?? {};
        map[r.profile_id][r.course_id] = r;
      }
    }
    return map;
  }, [records]);

  function latestRecord(profileId: string, courseId: string): TrainingRecord | null {
    return recordLookup[profileId]?.[courseId] ?? null;
  }

  // KPIs
  const passed    = records.filter((r) => r.passed).length;
  const expired   = records.filter((r) => isExpired(r.expiry_date)).length;
  const expiring  = records.filter((r) => isExpiringSoon(r.expiry_date)).length;
  const overdue   = expired + records.filter((r) => !r.passed).length;

  // Certs expiring within 90 days (not yet expired)
  const expiringCerts = useMemo(() =>
    records
      .filter((r) => r.passed && !isExpired(r.expiry_date) && isExpiringSoon(r.expiry_date, 90))
      .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime()),
    [records],
  );

  // Chemical triggers: find matching chemicals for each trigger
  const activeChemTriggers = useMemo(() =>
    CHEM_TRIGGERS.map((t) => ({
      ...t,
      matchedChemicals: chemicals.filter((c) => c.status === "active" && t.matchFn(c)),
    })).filter((t) => t.matchedChemicals.length > 0),
    [chemicals],
  );

  // ── Tab: Overview ───────────────────────────────────────────────────────────

  function OverviewTab() {
    return (
      <div className="space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Active Courses",      value: activeCourses.length,    hint: "In curriculum",       accent: "#3b82f6" },
            { label: "Completions",          value: passed,                  hint: "Passed records",      accent: "#10b981" },
            { label: "Expiring ≤30 days",    value: expiring,                hint: "Certificates due",    accent: expiring > 0 ? "#f59e0b" : "#10b981" },
            { label: "Expired / Failed",     value: overdue,                 hint: "Action required",     accent: overdue > 0 ? "#dc2626" : "#10b981" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</div>
              <div className="mt-1 text-3xl font-bold" style={{ color: s.accent }}>{s.value}</div>
              <div className="mt-0.5 text-xs text-slate-400">{s.hint}</div>
            </div>
          ))}
        </div>

        {/* Alert banners */}
        {expired > 0 && (
          <div className="rounded-xl border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-4">
            <div className="text-sm font-semibold text-red-900 dark:text-red-200">
              {expired} Certificate{expired !== 1 ? "s" : ""} Expired — Re-enrolment Required
            </div>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
              Expired training constitutes a regulatory compliance gap under OSHA training requirements. Go to <button onClick={() => setTab("certs")} className="underline">Expiring Certs</button> to action.
            </p>
          </div>
        )}
        {expiringCerts.length > 0 && (
          <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {expiringCerts.length} Certificate{expiringCerts.length !== 1 ? "s" : ""} Expiring Within 90 Days
            </div>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              Schedule renewals now to avoid compliance gaps.{" "}
              <button onClick={() => setTab("certs")} className="underline">View expiring certs →</button>
            </p>
          </div>
        )}

        {/* Inventory-triggered training alerts */}
        {activeChemTriggers.length > 0 && (
          <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Inventory-Triggered Training Requirements</h3>
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {activeChemTriggers.length} active
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              The following training courses are <strong>automatically required</strong> because of chemicals currently in your inventory. See the <button onClick={() => setTab("chemical")} className="text-blue-600 underline">Chemical Training</button> tab for full details.
            </p>
            <div className="space-y-2">
              {activeChemTriggers.map((t) => (
                <div key={t.label} className="flex items-start gap-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-700">{t.label}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {t.matchedChemicals.map((c) => (
                        <span key={c.id} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{c.name}</span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-slate-400">{t.regulation}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Required compliance designations */}
        {(() => {
          const designations = REQUIRED_DESIGNATIONS[user.tenant_id ?? ""] ?? [];
          if (designations.length === 0) return null;
          const vacantCount = designations.filter((d) => d.status === "vacant").length;
          const pendingCount = designations.filter((d) => d.status === "pending").length;
          return (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Required Compliance Designations</h3>
                </div>
                <div className="flex gap-1.5">
                  {vacantCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      {vacantCount} vacant
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Regulatory positions that must be formally designated for your facility's operating scope.
              </p>
              <div className="divide-y divide-slate-50">
                {designations.map((d) => (
                  <div key={d.role} className="flex items-start gap-3 py-3">
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      d.status === "assigned" ? "bg-emerald-100" :
                      d.status === "pending"  ? "bg-amber-100" :
                                                "bg-red-100"
                    }`}>
                      {d.status === "assigned"
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        : d.status === "pending"
                        ? <Clock className="h-3.5 w-3.5 text-amber-600" />
                        : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">{d.role}</span>
                        <span className="font-mono text-[10px] text-slate-400">{d.citation}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{d.regulatory_basis}</div>
                      {d.notes && (
                        <div className="mt-0.5 text-[11px] text-amber-700">{d.notes}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {d.assignee ? (
                        <div className="text-xs font-semibold text-slate-700">{d.assignee}</div>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Vacant</span>
                      )}
                      <div className={`mt-0.5 text-[10px] font-semibold capitalize ${
                        d.status === "assigned" ? "text-emerald-600" :
                        d.status === "pending"  ? "text-amber-600" :
                                                  "text-red-500"
                      }`}>
                        {d.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Employee compliance snapshot */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Employee Compliance Snapshot</h3>
          <div className="space-y-2">
            {employees.map((emp) => {
              const required = activeCourses.filter((c) => c.required_roles.includes(emp.role));
              const completed = required.filter((c) => {
                const r = latestRecord(emp.id, c.id);
                return r?.passed && !isExpired(r.expiry_date);
              });
              const pct = required.length ? Math.round((completed.length / required.length) * 100) : 100;
              return (
                <div key={emp.id} className="flex items-center gap-3">
                  <div className="w-32 truncate text-xs font-medium text-slate-700">{emp.display_name}</div>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={`w-12 text-right text-xs font-bold tabular-nums ${pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Tab: My Assignments ─────────────────────────────────────────────────────

  function AssignmentsTab() {
    const required = activeCourses.filter((c) => c.required_roles.includes(user.role));

    type AssignmentRow = { course: TrainingCourse; record: TrainingRecord | null; status: CellStatus };
    const rows: AssignmentRow[] = required.map((c) => {
      const r = latestRecord(user.id, c.id);
      return { course: c, record: r, status: cellStatus(r, true) };
    });

    const overdue    = rows.filter((a) => a.status === "expired" || a.status === "failed");
    const expiring   = rows.filter((a) => a.status === "expiring");
    const notStarted = rows.filter((a) => a.status === "not_started");
    const current    = rows.filter((a) => a.status === "complete");
    const compliant  = current.length;
    const pct        = required.length ? Math.round((compliant / required.length) * 100) : 100;

    const groups = [
      { label: "Overdue / Failed",       color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    rows: overdue },
      { label: "Expiring Soon",          color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  rows: expiring },
      { label: "Not Started",            color: "text-slate-700",  bg: "bg-slate-50",  border: "border-slate-200",  rows: notStarted },
      { label: "Current — No Action Required", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", rows: current },
    ].filter((g) => g.rows.length > 0);

    return (
      <div className="space-y-5">
        {/* Personal compliance header */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-400 text-lg font-bold text-white shadow-md">
              {user.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900">{user.display_name}</div>
              <div className="text-xs text-slate-500">{user.job_title}</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden max-w-[200px]">
                  <div
                    className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-sm font-bold tabular-nums ${pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                  {pct}% compliant
                </span>
                <span className="text-xs text-slate-400">{compliant}/{required.length} courses</span>
              </div>
            </div>
            {pct === 100 && (
              <div className="shrink-0 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
                <CheckCircle2 className="mx-auto mb-0.5 h-5 w-5 text-emerald-500" />
                <div className="text-[10px] font-semibold text-emerald-700">Fully current</div>
              </div>
            )}
          </div>
        </div>

        {required.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center text-sm text-slate-400">
            No required training courses are assigned to your role.
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className={`rounded-2xl border ${group.border} overflow-hidden`}>
            <div className={`${group.bg} border-b ${group.border} px-5 py-3 flex items-center justify-between`}>
              <span className={`text-sm font-semibold ${group.color}`}>{group.label}</span>
              <span className="text-xs text-slate-500">{group.rows.length} course{group.rows.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="bg-white divide-y divide-slate-50">
              {group.rows.map(({ course, record, status }) => {
                const cell = STATUS_CELL[status];
                const days = daysUntil(record?.expiry_date ?? null);
                return (
                  <div key={course.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cell.bg}`}>
                      {cell.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800">{course.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-3 text-[10px] text-slate-500">
                        <span className="font-mono">{course.regulatory_ref ?? "—"}</span>
                        <span>{course.duration_minutes} min</span>
                        {record && (
                          <span>
                            Completed {fmt(record.completed_date)}
                            {record.score != null && ` · ${record.score}%`}
                          </span>
                        )}
                      </div>
                    </div>
                    {record?.expiry_date && (
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] text-slate-400">
                          {status === "expired" ? "Expired" : "Expires"}
                        </div>
                        <div className={`text-xs font-semibold tabular-nums ${
                          status === "expired" ? "text-red-600" :
                          status === "expiring" ? "text-amber-600" :
                          "text-slate-600"
                        }`}>
                          {fmt(record.expiry_date)}
                        </div>
                        {status !== "complete" && (
                          <div className={`text-[9px] font-bold ${days < 0 ? "text-red-500" : "text-amber-500"}`}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="shrink-0">
                      {status === "complete" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Current
                        </span>
                      ) : (
                        <MarkCourseCompleteButton
                          courseId={course.id}
                          courseTitle={course.title}
                          profileId={user.id}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Tab: Training Matrix ────────────────────────────────────────────────────

  function MatrixTab() {
    const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));
    return (
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Role-Based Training Matrix</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Shows each employee&apos;s completion status for all required courses based on their role.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
            {(["complete", "expiring", "expired", "not_started"] as CellStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                {STATUS_CELL[s].icon}
                <span className="text-slate-500">{STATUS_CELL[s].title}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 min-w-[160px]">Employee</th>
                {activeCourses.map((c) => (
                  <th key={c.id} className="px-3 py-2.5 text-center min-w-[80px]">
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-tight max-w-[80px] mx-auto" title={c.title}>
                      {c.title.replace("Bloodborne Pathogens", "BBP").replace("Laboratory ", "Lab ").replace(" Control", "").slice(0, 22)}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{c.duration_minutes}min</div>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {employees.map((emp) => {
                const required = activeCourses.filter((c) => c.required_roles.includes(emp.role));
                const validCompleted = required.filter((c) => {
                  const r = latestRecord(emp.id, c.id);
                  return r?.passed && !isExpired(r.expiry_date);
                });
                const pct = required.length ? Math.round((validCompleted.length / required.length) * 100) : 100;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{emp.display_name}</div>
                      <div className="text-[10px] text-slate-400 capitalize">{emp.role.replace(/_/g, " ")}</div>
                    </td>
                    {activeCourses.map((c) => {
                      const isReq = c.required_roles.includes(emp.role);
                      const r = latestRecord(emp.id, c.id);
                      const st = cellStatus(r, isReq);
                      const cell = STATUS_CELL[st];
                      return (
                        <td key={c.id} className={`px-3 py-3 text-center ${cell.bg}`}>
                          <div className="flex justify-center items-center" title={`${cell.title}${r ? ` — expires ${fmt(r.expiry_date)}` : ""}`}>
                            {cell.icon}
                          </div>
                          {r && st !== "not_required" && (
                            <div className="mt-0.5 text-[9px] text-slate-400 tabular-nums">{fmt(r.expiry_date)}</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <div className={`text-sm font-bold tabular-nums ${pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                        {pct}%
                      </div>
                      <div className="text-[10px] text-slate-400">{validCompleted.length}/{required.length}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Tab: Chemical Training ──────────────────────────────────────────────────

  function ChemicalTab() {
    const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Inventory-Driven Training Assignments</h3>
              <p className="mt-1 text-xs text-slate-600">
                These training courses are <strong>automatically required</strong> based on chemicals in your active inventory. When a new hazardous chemical is added, the system identifies which OSHA, EPA, or CDC regulations apply and surfaces the required training.
              </p>
            </div>
          </div>
        </div>

        {activeChemTriggers.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center text-sm text-slate-400">
            No high-hazard chemicals in inventory that trigger specific training requirements.
          </div>
        )}

        {activeChemTriggers.map((trigger) => {
          const requiredCourses = trigger.courseIds.map((id) => courseMap[id]).filter(Boolean);
          return (
            <div key={trigger.label} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              {/* Trigger header */}
              <div className="border-b border-slate-100 bg-amber-50 px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="text-sm font-semibold text-slate-800">{trigger.label}</span>
                  </div>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-700">
                    {trigger.regulation}
                  </span>
                </div>
                <p className="mt-1 pl-6 text-[11px] text-slate-500">{trigger.reason}</p>
              </div>

              {/* Matched chemicals */}
              <div className="border-b border-slate-100 px-5 py-3 bg-slate-50">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Triggering Chemicals in Inventory</div>
                <div className="flex flex-wrap gap-2">
                  {trigger.matchedChemicals.map((c) => (
                    <span key={c.id} className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs">
                      <span className="font-semibold text-slate-700">{c.name}</span>
                      <span className="text-slate-400">{c.storage_location.split("—")[0].trim()}</span>
                      <span className="rounded bg-orange-100 px-1 text-[9px] font-bold text-orange-600">
                        {c.ghs_classes.filter((g) => ["H300","H310","H330","H225","H226","H271","H272","H280","H281","H350","H351","H340","H361","H400","H410"].includes(g)).join(" ")}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Required courses + employee status */}
              {requiredCourses.map((course) => (
                <div key={course.id} className="px-5 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-slate-700">{course.title}</span>
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono text-blue-600">{course.regulatory_ref}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          <th className="pb-1.5 text-left">Employee</th>
                          <th className="pb-1.5 text-left">Role</th>
                          <th className="pb-1.5 text-left">Last Completed</th>
                          <th className="pb-1.5 text-left">Expires</th>
                          <th className="pb-1.5 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {employees
                          .filter((emp) => course.required_roles.includes(emp.role))
                          .map((emp) => {
                            const r = latestRecord(emp.id, course.id);
                            const st = cellStatus(r, true);
                            const cell = STATUS_CELL[st];
                            return (
                              <tr key={emp.id} className="hover:bg-slate-50">
                                <td className="py-2 font-medium text-slate-700">{emp.display_name}</td>
                                <td className="py-2 capitalize text-slate-500">{emp.role.replace(/_/g, " ")}</td>
                                <td className="py-2 tabular-nums text-slate-600">{r ? fmt(r.completed_date) : "—"}</td>
                                <td className="py-2 tabular-nums">
                                  <span className={
                                    st === "expired" ? "font-semibold text-red-600" :
                                    st === "expiring" ? "font-semibold text-amber-600" :
                                    "text-slate-600"
                                  }>
                                    {r?.expiry_date ? fmt(r.expiry_date) : "—"}
                                  </span>
                                </td>
                                <td className="py-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cell.bg} ${
                                    st === "complete" ? "text-emerald-700" :
                                    st === "expiring" ? "text-amber-700" :
                                    st === "expired" || st === "failed" ? "text-red-700" :
                                    "text-slate-500"
                                  }`}>
                                    {cell.icon}
                                    {cell.title}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Tab: Expiring Certifications ────────────────────────────────────────────

  function CertsTab() {
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const courseMap  = Object.fromEntries(courses.map((c) => [c.id, c]));

    const expiredRecs = records.filter((r) => r.passed && isExpired(r.expiry_date))
      .sort((a, b) => new Date(b.expiry_date!).getTime() - new Date(a.expiry_date!).getTime());

    const buckets: { label: string; color: string; bg: string; border: string; recs: TrainingRecord[] }[] = [
      {
        label: "Critical — Expired",
        color: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
        recs: expiredRecs,
      },
      {
        label: "Urgent — Expiring within 7 days",
        color: "text-red-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        recs: expiringCerts.filter((r) => daysUntil(r.expiry_date) <= 7),
      },
      {
        label: "Warning — Expiring within 30 days",
        color: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200",
        recs: expiringCerts.filter((r) => daysUntil(r.expiry_date) > 7 && daysUntil(r.expiry_date) <= 30),
      },
      {
        label: "Advisory — Expiring within 90 days",
        color: "text-yellow-700",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        recs: expiringCerts.filter((r) => daysUntil(r.expiry_date) > 30),
      },
    ].filter((b) => b.recs.length > 0);

    if (buckets.length === 0) {
      return (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
          <div className="text-sm font-semibold text-emerald-700">All Certifications Current</div>
          <div className="mt-1 text-xs text-emerald-600">No certificates expiring within 90 days.</div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {buckets.map((bucket) => (
          <div key={bucket.label} className={`rounded-2xl border ${bucket.border} overflow-hidden`}>
            <div className={`${bucket.bg} px-5 py-3 border-b ${bucket.border}`}>
              <span className={`text-sm font-semibold ${bucket.color}`}>{bucket.label}</span>
              <span className="ml-2 text-xs text-slate-500">{bucket.recs.length} record{bucket.recs.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="bg-white dark:bg-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <th className="px-5 py-2.5 text-left">Employee</th>
                    <th className="px-4 py-2.5 text-left">Course</th>
                    <th className="px-4 py-2.5 text-left">Completed</th>
                    <th className="px-4 py-2.5 text-left">Expiry / Expired</th>
                    <th className="px-4 py-2.5 text-left">Days</th>
                    <th className="px-4 py-2.5 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {bucket.recs.map((r) => {
                    const days = daysUntil(r.expiry_date);
                    const emp = profileMap[r.profile_id];
                    const c   = courseMap[r.course_id];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-5 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">{emp?.display_name ?? r.profile_id}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{c?.title ?? r.course_id}</div>
                          <div className="text-[10px] font-mono text-slate-400">{c?.regulatory_ref ?? ""}</div>
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600 dark:text-slate-300">{fmt(r.completed_date)}</td>
                        <td className="px-4 py-3 text-xs tabular-nums font-semibold">
                          <span className={days < 0 ? "text-red-600" : days <= 7 ? "text-red-500" : days <= 30 ? "text-amber-600" : "text-yellow-700"}>
                            {fmt(r.expiry_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            days < 0 ? "bg-red-100 text-red-700" :
                            days <= 7 ? "bg-orange-100 text-orange-700" :
                            days <= 30 ? "bg-amber-100 text-amber-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                          </span>
                        </td>
                        <td className="px-4 py-3 flex items-center gap-2">
                          <button className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 transition">
                            Schedule Renewal
                          </button>
                          <Link href={`/training/${r.id}`} className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Tab: Employee Acknowledgments ───────────────────────────────────────────

  function AcknowledgmentsTab() {
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const courseMap  = Object.fromEntries(courses.map((c) => [c.id, c]));

    // Passed records in last 12 months that need acknowledgment
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    const pending = records
      .filter((r) => r.passed && new Date(r.completed_date) > cutoff)
      .sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime());

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-5">
          <div className="flex items-start gap-3">
            <Award className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Employee Training Acknowledgments</h3>
              <p className="mt-1 text-xs text-slate-600">
                Employees confirm they have received and understood required training. Click <strong>Acknowledge</strong> to record a digital sign-off, creating an auditable acknowledgment trail.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Training Completion Records</span>
              <span className="text-xs text-slate-400">{pending.length} records · last 12 months</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="px-5 py-2.5 text-left">Employee</th>
                <th className="px-4 py-2.5 text-left">Course</th>
                <th className="px-4 py-2.5 text-left">Completed</th>
                <th className="px-4 py-2.5 text-left">Score</th>
                <th className="px-4 py-2.5 text-left">Delivery</th>
                <th className="px-4 py-2.5 text-left">Acknowledgment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {pending.map((r) => {
                const isAcked = acknowledged.has(r.id);
                const hasNoteAck = r.notes?.toLowerCase().includes("acknowledg") ?? false;
                const acked = isAcked || hasNoteAck;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">
                      {profileMap[r.profile_id]?.display_name ?? r.profile_id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">{courseMap[r.course_id]?.title ?? r.course_id}</div>
                      <div className="text-[10px] font-mono text-slate-400">{courseMap[r.course_id]?.regulatory_ref ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(r.completed_date)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                      {r.score != null ? `${r.score}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-slate-600">
                      {r.delivery_method.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      {acked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <Check className="h-3 w-3" /> Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => setAcknowledged((prev) => new Set([...prev, r.id]))}
                          className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">No training records in the last 12 months.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Tab: Completion Report ──────────────────────────────────────────────────

  function ReportTab() {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Training Completion Report</h3>
            <p className="text-xs text-slate-500">Summary of required training completion by employee.</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition print:hidden"
          >
            <Printer className="h-4 w-4" /> Print Report
          </button>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6">
          <h1 className="text-xl font-bold text-slate-900">{user.company} — Training Completion Report</h1>
          <p className="text-sm text-slate-500 mt-1">Generated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        {/* Summary table */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Department</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Required</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Complete</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Expired</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Not Started</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Compliance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const required = activeCourses.filter((c) => c.required_roles.includes(emp.role));
                let complete = 0, expired_ = 0, notStarted = 0;
                for (const c of required) {
                  const r = latestRecord(emp.id, c.id);
                  if (!r) { notStarted++; continue; }
                  if (!r.passed || isExpired(r.expiry_date)) { expired_++; continue; }
                  complete++;
                }
                const pct = required.length ? Math.round((complete / required.length) * 100) : 100;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-5 py-3">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{emp.display_name}</div>
                      <div className="text-[10px] text-slate-400 capitalize">{emp.role.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{emp.department ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-sm tabular-nums text-slate-700 dark:text-slate-200">{required.length}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-emerald-600">{complete}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-red-600">{expired_}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-slate-500">{notStarted}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold ${
                        pct === 100 ? "bg-emerald-100 text-emerald-700" :
                        pct >= 70   ? "bg-amber-100 text-amber-700" :
                                      "bg-red-100 text-red-700"
                      }`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <td colSpan={2} className="px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">TOTALS</td>
                <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
                  {employees.reduce((sum, emp) => sum + activeCourses.filter((c) => c.required_roles.includes(emp.role)).length, 0)}
                </td>
                <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-emerald-600">{passed}</td>
                <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-red-600">{expired}</td>
                <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-slate-500">
                  {employees.reduce((sum, emp) => {
                    const req = activeCourses.filter((c) => c.required_roles.includes(emp.role));
                    return sum + req.filter((c) => !latestRecord(emp.id, c.id)).length;
                  }, 0)}
                </td>
                <td className="px-4 py-3 text-center">
                  {(() => {
                    const totalReq = employees.reduce((sum, emp) => sum + activeCourses.filter((c) => c.required_roles.includes(emp.role)).length, 0);
                    const totalComplete = employees.reduce((sum, emp) => {
                      return sum + activeCourses.filter((c) => {
                        if (!c.required_roles.includes(emp.role)) return false;
                        const r = latestRecord(emp.id, c.id);
                        return r?.passed && !isExpired(r.expiry_date);
                      }).length;
                    }, 0);
                    const pct = totalReq ? Math.round((totalComplete / totalReq) * 100) : 100;
                    return (
                      <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold ${
                        pct === 100 ? "bg-emerald-100 text-emerald-700" :
                        pct >= 70   ? "bg-amber-100 text-amber-700" :
                                      "bg-red-100 text-red-700"
                      }`}>{pct}%</span>
                    );
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Per-course summary */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-3.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Completion by Course</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="px-5 py-2.5 text-left">Course</th>
                <th className="px-4 py-2.5 text-left">Regulatory Ref.</th>
                <th className="px-4 py-2.5 text-center">Target</th>
                <th className="px-4 py-2.5 text-center">Complete</th>
                <th className="px-4 py-2.5 text-center">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {activeCourses.map((c) => {
                const targets = employees.filter((emp) => c.required_roles.includes(emp.role));
                const complete = targets.filter((emp) => {
                  const r = latestRecord(emp.id, c.id);
                  return r?.passed && !isExpired(r.expiry_date);
                });
                const pct = targets.length ? Math.round((complete.length / targets.length) * 100) : 100;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-5 py-3 text-xs font-medium text-slate-700 dark:text-slate-200">{c.title}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-slate-500 dark:text-slate-400">{c.regulatory_ref ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-xs tabular-nums text-slate-600 dark:text-slate-300">{targets.length}</td>
                    <td className="px-4 py-3 text-center text-xs font-semibold tabular-nums text-emerald-600">{complete.length}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums ${pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Tab: Course Catalogue ───────────────────────────────────────────────────

  function CoursesTab() {
    return (
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-3.5 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Course Catalogue</span>
            <span className="ml-2 text-xs text-slate-400">{courses.length} courses · {activeCourses.length} active</span>
          </div>
          <AddTrainingButton courses={courses} profiles={profiles.filter((p) => p.tenant_id !== null)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="px-5 py-2.5 text-left">Course</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Duration</th>
                <th className="px-4 py-2.5 text-left">Validity</th>
                <th className="px-4 py-2.5 text-left">Regulatory Ref.</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="text-xs font-semibold text-slate-800">{c.title}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400 line-clamp-1">{c.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Pill className="bg-blue-50 text-blue-700 text-[10px] capitalize">{c.course_type.replace(/_/g, " ")}</Pill>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{c.duration_minutes} min</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {c.validity_period_days ? `${Math.round(c.validity_period_days / 365)} yr` : "No expiry"}
                  </td>
                  <td className="px-4 py-3 text-[10px] font-mono text-slate-500">{c.regulatory_ref ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Pill className={c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                      {c.active ? "Active" : "Inactive"}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    {c.active && (
                      <MarkCourseCompleteButton courseId={c.id} courseTitle={c.title} profileId={user.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const expiredCount    = records.filter((r) => isExpired(r.expiry_date)).length;
  const expiringCount   = expiringCerts.length;
  const chemAlertCount  = activeChemTriggers.length;

  const myActionCount = useMemo(() => {
    return activeCourses.filter((c) => {
      if (!c.required_roles.includes(user.role)) return false;
      const r = latestRecord(user.id, c.id);
      const st = cellStatus(r, true);
      return st === "expired" || st === "failed" || st === "not_started" || st === "expiring";
    }).length;
  }, [activeCourses, user.id, user.role, recordLookup]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          let badge: number | null = null;
          if (t.id === "assignments" && myActionCount > 0) badge = myActionCount;
          if (t.id === "certs" && (expiredCount + expiringCount) > 0) badge = expiredCount + expiringCount;
          if (t.id === "chemical" && chemAlertCount > 0) badge = chemAlertCount;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-blue-300 bg-blue-600 text-white"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-100"
              }`}
            >
              {t.icon}
              {t.label}
              {badge != null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-red-100 text-red-600"}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview"        && <OverviewTab />}
      {tab === "assignments"     && <AssignmentsTab />}
      {tab === "matrix"          && <MatrixTab />}
      {tab === "chemical"        && <ChemicalTab />}
      {tab === "certs"           && <CertsTab />}
      {tab === "acknowledgments" && <AcknowledgmentsTab />}
      {tab === "report"          && <ReportTab />}
      {tab === "courses"         && <CoursesTab />}
    </div>
  );
}

"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { TrainingCourse, TrainingRecord, Profile } from "@/lib/types";
import {
  buildXls,
  titleBlock,
  kpiBlock,
  sectionRow,
  blankRow,
  theadRow,
  alt,
} from "@/lib/xlsExport";
import type { XlsRow, XlsCell } from "@/lib/xlsExport";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function expiryStatus(expiryDate: string | null, now: Date): { label: string; style: XlsCell["s"] } {
  if (!expiryDate) return { label: "No expiry", style: "good" };
  const days = Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / 86400000);
  if (days < 0)    return { label: `Expired ${Math.abs(days)}d ago — Renewal Required`, style: "danger" };
  if (days <= 7)   return { label: `Expires in ${days}d — CRITICAL`,                   style: "danger" };
  if (days <= 30)  return { label: `Expires in ${days}d — Schedule Renewal`,            style: "warn" };
  return { label: `Valid — expires ${fmtDate(expiryDate)}`, style: "good" };
}

export function TrainingExportButton({
  courses,
  records,
  profiles,
}: {
  courses: TrainingCourse[];
  records: TrainingRecord[];
  profiles: Profile[];
}) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);

    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
    const courseMap  = Object.fromEntries(courses.map((c) => [c.id, c]));

    const passed     = records.filter((r) => r.passed);
    const failed     = records.filter((r) => !r.passed);
    const expired    = records.filter((r) => r.expiry_date && new Date(r.expiry_date) < now);
    const expiring30 = records.filter((r) => {
      if (!r.expiry_date) return false;
      const days = Math.ceil((new Date(r.expiry_date).getTime() - now.getTime()) / 86400000);
      return days >= 0 && days <= 30;
    });
    const activeCourses = courses.filter((c) => c.active);

    // ── Sheet 1: Dashboard ────────────────────────────────────────────────────
    const D = 5;

    const completionBreakdown: [string, number][] = [
      ["Passed",         passed.length],
      ["Failed",         failed.length],
      ["Expired",        expired.length],
      ["Expiring ≤30d",  expiring30.length],
      ["No expiry",      records.filter((r) => !r.expiry_date).length],
    ];

    const dashRows: XlsRow[] = [
      ...titleBlock(user.company, "Training & Competency Register", "ISO 45001:2018 Clause 7.2 — Competence & Training Requirements", dateStr, D),
      ...kpiBlock([
        { label: "TOTAL RECORDS",     value: records.length,    style: "kpi_val" },
        { label: "PASSED",            value: passed.length,     style: passed.length > 0     ? "kpi_grn"   : "kpi_val" },
        { label: "FAILED",            value: failed.length,     style: failed.length > 0     ? "kpi_red"   : "kpi_val" },
        { label: "EXPIRED",           value: expired.length,    style: expired.length > 0    ? "kpi_red"   : "kpi_val" },
        { label: "EXPIRING ≤30 DAYS", value: expiring30.length, style: expiring30.length > 0 ? "kpi_amber" : "kpi_val" },
      ], D),
      sectionRow("COMPLETION BREAKDOWN", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...completionBreakdown.map(([label, count], i): XlsRow => ({
        cells: [
          { v: label, s: alt(i) },
          { v: count, s: alt(i), t: "Number" },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      sectionRow("ACTIVE COURSES", D),
      theadRow(["Course Title", "Type", "", "", ""]),
      ...activeCourses.map((course, i): XlsRow => ({
        cells: [
          { v: course.title,                s: alt(i) },
          { v: humanize(course.course_type), s: alt(i) },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      {
        cells: [{ v: "ISO 45001:2018 Clause 7.2 — Organizations shall ensure persons are competent through education, training, or experience.", s: "meta", m: 4 }] as XlsCell[],
        h: 16,
      },
    ];

    // ── Sheet 2: Training Records ─────────────────────────────────────────────
    const REC_COLS = [120, 200, 100, 85, 85, 140, 60, 70, 100];
    const NR = 9;

    const recordRows: XlsRow[] = [
      ...titleBlock(user.company, "Training & Competency Register", "ISO 45001:2018 Clause 7.2 — Competence & Training Requirements", dateStr, NR),
      theadRow(["Employee", "Course", "Course Type", "Completed", "Expiry Date", "Expiry Status", "Score", "Pass/Fail", "Method"]),
      ...records.map((r, i): XlsRow => {
        const a = alt(i);
        const course = courseMap[r.course_id];
        const expiry = expiryStatus(r.expiry_date, now);
        const passStyle: XlsCell["s"] = r.passed ? "good" : "danger";
        const cells: XlsCell[] = [
          { v: profileMap[r.profile_id] ?? r.profile_id,          s: a },
          { v: course?.title ?? r.course_id,                       s: a },
          { v: course ? humanize(course.course_type) : "—",        s: a },
          { v: fmtDate(r.completed_date),                          s: a },
          { v: r.expiry_date ? fmtDate(r.expiry_date) : "—",      s: expiry.style },
          { v: expiry.label,                                        s: expiry.style },
          { v: r.score != null ? `${r.score}%` : "—",             s: a },
          { v: r.passed ? "PASS" : "FAIL",                         s: passStyle },
          { v: humanize(r.delivery_method),                        s: a },
        ];
        return { cells };
      }),
    ];

    // ── Sheet 3: Employee Compliance ──────────────────────────────────────────
    const EMP_COLS = [160, 90, 80, 70, 90, 100];
    const NE = 6;
    const staffProfiles = profiles.filter((p) => p.tenant_id !== null);

    const empRows: XlsRow[] = [
      ...titleBlock(user.company, "Employee Compliance Summary", "ISO 45001:2018 Clause 7.2 — Competence & Training Requirements", dateStr, NE),
      theadRow(["Employee", "Completed", "Passed", "Expired", "Completion %", "Status"]),
      ...staffProfiles.map((p, i): XlsRow => {
        const a = alt(i);
        const empRecs    = records.filter((r) => r.profile_id === p.id);
        const empPassed  = empRecs.filter((r) => r.passed).length;
        const empExpired = empRecs.filter((r) => r.expiry_date && new Date(r.expiry_date) < now).length;
        const rate       = empRecs.length > 0 ? Math.round((empPassed / empRecs.length) * 100) : 0;

        let statusLabel: string;
        let statusStyle: XlsCell["s"];
        if (empExpired > 0)  { statusLabel = "Expired certs";    statusStyle = "danger"; }
        else if (rate === 100) { statusLabel = "Fully compliant";  statusStyle = "good"; }
        else if (rate >= 80)   { statusLabel = "Mostly compliant"; statusStyle = "info"; }
        else                   { statusLabel = "Needs attention";  statusStyle = "warn"; }

        const cells: XlsCell[] = [
          { v: p.display_name,      s: a },
          { v: empRecs.length,      s: a, t: "Number" },
          { v: empPassed,           s: a, t: "Number" },
          { v: empExpired,          s: empExpired > 0 ? "danger" : a, t: "Number" },
          { v: `${rate}%`,          s: rate === 100 ? "good" : rate >= 80 ? "info" : "warn" },
          { v: statusLabel,         s: statusStyle },
        ];
        return { cells };
      }),
    ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Training-Records-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",          cols: Array(D).fill(140), rows: dashRows,   freeze: 5 },
        { name: "Training Records",   cols: REC_COLS,           rows: recordRows, freeze: 6 },
        { name: "Employee Compliance", cols: EMP_COLS,          rows: empRows,    freeze: 6 },
      ],
    });
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" />
      Export Records
    </button>
  );
}

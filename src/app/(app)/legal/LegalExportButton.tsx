"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { LegalRequirement, Profile } from "@/lib/types";
import {
  buildXls,
  titleBlock,
  kpiBlock,
  sectionRow,
  blankRow,
  theadRow,
  alt,
  type XlsCell,
  type XlsRow,
  type StyleId,
} from "@/lib/xlsExport";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusStyle(status: string): StyleId {
  switch (status) {
    case "compliant":     return "good";
    case "non_compliant": return "danger";
    case "minor_gap":
    case "major_gap":     return "warn";
    case "not_assessed":  return "info";
    default:              return "d1";
  }
}

export function LegalExportButton({
  requirements,
  profiles,
}: {
  requirements: LegalRequirement[];
  profiles: Profile[];
}) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

    const compliant    = requirements.filter((r) => r.status === "compliant").length;
    const minorGap     = requirements.filter((r) => r.status === "minor_gap").length;
    const majorGap     = requirements.filter((r) => r.status === "major_gap").length;
    const nonCompliant = requirements.filter((r) => r.status === "non_compliant").length;
    const dueNext30    = requirements.filter((r) => {
      if (!r.next_review_date) return false;
      const days = Math.ceil((new Date(r.next_review_date).getTime() - now.getTime()) / 86400000);
      return days >= 0 && days <= 30;
    }).length;

    const D = 5;

    // ── Sheet 1: Dashboard ──────────────────────────────────────────────────────
    const byCat = [...new Set(requirements.map((r) => r.category))].sort();
    const byStatus: Array<[string, string, StyleId]> = [
      ["Compliant",     String(requirements.filter((r) => r.status === "compliant").length),     "good"],
      ["Minor Gap",     String(requirements.filter((r) => r.status === "minor_gap").length),     "warn"],
      ["Major Gap",     String(requirements.filter((r) => r.status === "major_gap").length),     "warn"],
      ["Non-Compliant", String(requirements.filter((r) => r.status === "non_compliant").length), "danger"],
      ["Not Assessed",  String(requirements.filter((r) => r.status === "not_assessed").length),  "info"],
    ];

    const dashRows: XlsRow[] = [
      ...titleBlock(user.company, "Legal & Regulatory Compliance", "ISO 45001:2018 Clause 6.1.3 — Determination of Legal Requirements", dateStr, D),
      ...kpiBlock([
        { label: "TOTAL REQUIREMENTS", value: requirements.length, style: "kpi_val" },
        { label: "COMPLIANT",          value: compliant,            style: "kpi_grn" },
        { label: "COMPLIANCE GAPS",    value: minorGap + majorGap,  style: (minorGap + majorGap) > 0 ? "kpi_amber" : "kpi_val" },
        { label: "NON-COMPLIANT",      value: nonCompliant,         style: nonCompliant > 0 ? "kpi_red" : "kpi_val" },
        { label: "REVIEW DUE ≤30d",    value: dueNext30,            style: dueNext30 > 0 ? "kpi_amber" : "kpi_val" },
      ], D),
      sectionRow("STATUS BREAKDOWN", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...byStatus.map(([lbl, cnt, st], i): XlsRow => ({
        cells: [
          { v: lbl, s: st },
          { v: cnt, s: st, t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      sectionRow("CATEGORY BREAKDOWN", D),
      theadRow(["Category", "Count", "", "", ""]),
      ...byCat.map((cat, i): XlsRow => ({
        cells: [
          { v: humanize(cat), s: alt(i) },
          { v: requirements.filter((r) => r.category === cat).length, s: alt(i), t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
    ];

    // ── Sheet 2: Compliance Register ────────────────────────────────────────────
    const regCols = [100, 200, 110, 100, 100, 110, 85, 80, 180];
    const regHeaders = ["Regulation", "Title", "Jurisdiction", "Category", "Status", "Owner", "Next Review", "Frequency", "Notes"];

    function buildRegRow(r: LegalRequirement, i: number): XlsRow {
      const a = alt(i);
      const st = statusStyle(r.status);
      const reviewDays = r.next_review_date
        ? Math.ceil((new Date(r.next_review_date).getTime() - now.getTime()) / 86400000)
        : null;
      const reviewStyle: StyleId = reviewDays === null ? a : reviewDays < 0 ? "danger" : reviewDays <= 30 ? "warn" : a;
      return {
        cells: [
          { v: r.regulation_ref, s: a },
          { v: r.title, s: a },
          { v: r.jurisdiction, s: a },
          { v: humanize(r.category), s: a },
          { v: humanize(r.status), s: st },
          { v: r.owner_id ? (profileMap[r.owner_id] ?? "—") : "Unassigned", s: a },
          { v: fmtDate(r.next_review_date), s: reviewStyle },
          { v: r.review_frequency_days ? `Every ${Math.round(r.review_frequency_days / 30)} months` : "—", s: a },
          { v: r.compliance_notes ?? "—", s: a },
        ] as XlsCell[],
      };
    }

    const registerRows: XlsRow[] = [
      theadRow(regHeaders),
      ...requirements.map((r, i) => buildRegRow(r, i)),
    ];

    // ── Sheet 3: Gaps & Non-Conformances ────────────────────────────────────────
    const gaps = requirements.filter(
      (r) => r.status !== "compliant" && r.status !== "not_applicable"
    );

    const gapsRows: XlsRow[] = gaps.length === 0
      ? [{ cells: [{ v: "✓ Full compliance — no gaps or non-conformances found.", s: "good" as StyleId }] }]
      : [
          theadRow(regHeaders),
          ...gaps.map((r, i) => buildRegRow(r, i)),
        ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Legal-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",              cols: Array(D).fill(140), rows: dashRows },
        { name: "Compliance Register",    cols: regCols, rows: registerRows, freeze: 1 },
        { name: "Gaps & Non-Conformances", cols: regCols, rows: gapsRows,    freeze: gaps.length > 0 ? 1 : undefined },
      ],
    });
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" />
      Export Register
    </button>
  );
}

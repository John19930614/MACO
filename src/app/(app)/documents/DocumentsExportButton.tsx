"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { Document, Profile } from "@/lib/types";
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

const CATEGORY_LABEL: Record<string, string> = {
  sop: "SOP", policy: "Policy", procedure: "Procedure",
  form: "Form", permit: "Permit", msds: "SDS",
  plan: "Plan", guideline: "Guideline",
};

export function DocumentsExportButton({
  documents,
  profiles,
}: {
  documents: Document[];
  profiles: Profile[];
}) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

    const active      = documents.filter((d) => d.status === "active").length;
    const draft       = documents.filter((d) => d.status === "draft").length;
    const underReview = documents.filter((d) => d.status === "under_review").length;
    const ackRequired = documents.filter((d) => d.acknowledgment_required).length;
    const reviewSoon  = documents.filter((d) => {
      const diff = new Date(d.review_date).getTime() - now.getTime();
      return diff >= 0 && diff < 30 * 24 * 60 * 60 * 1000;
    }).length;

    const D = 5;

    // ── Breakdowns ───────────────────────────────────────────────────────────────
    const statuses   = [...new Set(documents.map((d) => d.status))].sort();
    const categories = [...new Set(documents.map((d) => d.category))].sort();

    // ── Sheet 1: Dashboard ──────────────────────────────────────────────────────
    const dashRows: XlsRow[] = [
      ...titleBlock(
        user.company,
        "Document Register",
        "ISO 45001:2018 Clause 7.5 — Documented Information Management",
        dateStr,
        D,
      ),
      ...kpiBlock([
        { label: "TOTAL DOCUMENTS", value: documents.length, style: "kpi_val" },
        { label: "ACTIVE",          value: active,            style: "kpi_grn" },
        { label: "IN DRAFT",        value: draft,             style: draft > 0        ? "kpi_blu"   : "kpi_val" },
        { label: "UNDER REVIEW",    value: underReview,       style: underReview > 0  ? "kpi_amber" : "kpi_val" },
        { label: "REVIEW DUE ≤30d", value: reviewSoon,        style: reviewSoon > 0   ? "kpi_amber" : "kpi_val" },
      ], D),
      sectionRow("STATUS BREAKDOWN", D),
      theadRow(["Status", "Count", "", "", ""]),
      ...statuses.map((st, i): XlsRow => ({
        cells: [
          { v: humanize(st), s: alt(i) },
          { v: documents.filter((d) => d.status === st).length, s: alt(i), t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      sectionRow("CATEGORY BREAKDOWN", D),
      theadRow(["Category", "Count", "", "", ""]),
      ...categories.map((cat, i): XlsRow => ({
        cells: [
          { v: CATEGORY_LABEL[cat] ?? humanize(cat), s: alt(i) },
          { v: documents.filter((d) => d.category === cat).length, s: alt(i), t: "Number" },
          { v: null }, { v: null }, { v: null },
        ] as XlsCell[],
      })),
    ];

    // ── Shared register columns ─────────────────────────────────────────────────
    const regCols    = [80, 220, 90, 70, 85, 85, 120, 90, 100];
    const regHeaders = ["Document ID", "Title", "Category", "Version", "Effective Date", "Review Date", "Owner", "Ack Required", "Status"];

    function buildDocRow(d: Document, i: number): XlsRow {
      const a = alt(i);
      const statusSt: StyleId =
        d.status === "active"       ? "good"
        : d.status === "draft"        ? "info"
        : d.status === "under_review" ? "warn"
        : a;
      const reviewDays = d.review_date
        ? Math.ceil((new Date(d.review_date).getTime() - now.getTime()) / 86400000)
        : null;
      const reviewSt: StyleId =
        reviewDays === null ? a
        : reviewDays < 0   ? "danger"
        : reviewDays <= 30 ? "warn"
        : a;
      const ackSt: StyleId = d.acknowledgment_required ? "info" : a;

      return {
        cells: [
          { v: d.id,                                              s: a },
          { v: d.title,                                           s: a },
          { v: CATEGORY_LABEL[d.category] ?? humanize(d.category), s: a },
          { v: d.version,                                         s: a },
          { v: fmtDate(d.effective_date),                         s: a },
          { v: fmtDate(d.review_date),                            s: reviewSt },
          { v: d.owner_id ? (profileMap[d.owner_id] ?? "—") : "Unassigned", s: a },
          { v: d.acknowledgment_required ? "Yes" : "No",          s: ackSt },
          { v: humanize(d.status),                                s: statusSt },
        ] as XlsCell[],
      };
    }

    // ── Sheet 2: Document Register ──────────────────────────────────────────────
    const registerRows: XlsRow[] = [
      theadRow(regHeaders),
      ...documents.map((d, i) => buildDocRow(d, i)),
    ];

    // ── Sheet 3: Review Due Soon ────────────────────────────────────────────────
    const reviewDue = documents.filter((d) => {
      if (!d.review_date) return false;
      const days = Math.ceil((new Date(d.review_date).getTime() - now.getTime()) / 86400000);
      return days <= 30;
    });

    const reviewRows: XlsRow[] = reviewDue.length === 0
      ? [{ cells: [{ v: "✓ No documents due for review in the next 30 days.", s: "good" as StyleId }] }]
      : [
          theadRow(regHeaders),
          ...reviewDue.map((d, i) => buildDocRow(d, i)),
        ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Document-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",        cols: Array(D).fill(140), rows: dashRows },
        { name: "Document Register", cols: regCols, rows: registerRows, freeze: 1 },
        { name: "Review Due Soon",  cols: regCols, rows: reviewRows,    freeze: reviewDue.length > 0 ? 1 : undefined },
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

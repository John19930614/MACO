"use client";

import { Download } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import type { RiskAssessment, Profile } from "@/lib/types";
import {
  buildXls,
  titleBlock,
  kpiBlock,
  sectionRow,
  blankRow,
  theadRow,
  alt,
} from "@/lib/xlsExport";
import type { XlsCell, XlsRow, StyleId } from "@/lib/xlsExport";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function riskLevelStyle(level: string): StyleId {
  if (level === "extreme") return "danger";
  if (level === "high") return "warn";
  if (level === "medium") return "info";
  return "good";
}

const REGISTER_COLS = [70, 180, 100, 55, 55, 65, 90, 65, 90, 110, 85, 90];
const D = 5;

export function RiskExportButton({ assessments, profiles }: { assessments: RiskAssessment[]; profiles: Profile[] }) {
  const { user } = useDemoUser();
  function handleExport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

    const critical = assessments.filter((r) => r.risk_level === "extreme").length;
    const high     = assessments.filter((r) => r.risk_level === "high").length;
    const active   = assessments.filter((r) => r.status === "active").length;
    const overdue  = assessments.filter((r) => r.review_date && new Date(r.review_date) < now).length;

    // ── Sheet 1: Dashboard ──────────────────────────────────────────────────────

    const categories = [...new Set(assessments.map((r) => r.category))].sort();

    const dashRows: XlsRow[] = [
      ...titleBlock(user.company, "Risk Register", "ISO 45001:2018 Clause 6.1 — Actions to Address Risks", dateStr, D),
      ...kpiBlock(
        [
          { label: "TOTAL ASSESSMENTS", value: assessments.length, style: "kpi_val" },
          { label: "EXTREME RISK",       value: critical,            style: critical > 0 ? "kpi_red"   : "kpi_val" },
          { label: "HIGH RISK",           value: high,                style: high > 0    ? "kpi_amber" : "kpi_val" },
          { label: "OVERDUE REVIEW",      value: overdue,             style: overdue > 0 ? "kpi_red"   : "kpi_val" },
          { label: "ACTIVE",              value: active,              style: active > 0  ? "kpi_grn"   : "kpi_val" },
        ],
        D,
      ),
      sectionRow("RISK LEVEL BREAKDOWN", D),
      theadRow(["Risk Level", "Count", "", "", ""]),
      ...(
        [
          ["Extreme", assessments.filter((r) => r.risk_level === "extreme").length, "danger"],
          ["High",    assessments.filter((r) => r.risk_level === "high").length,    "warn"],
          ["Medium",  assessments.filter((r) => r.risk_level === "medium").length,  "info"],
          ["Low",     assessments.filter((r) => r.risk_level === "low").length,     "good"],
        ] as [string, number, StyleId][]
      ).map(([lbl, cnt, sty]): XlsRow => ({
        cells: [
          { v: lbl, s: sty },
          { v: cnt, s: sty, t: "Number" },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      sectionRow("CATEGORY BREAKDOWN", D),
      theadRow(["Category", "Count", "", "", ""]),
      ...categories.map((cat, i): XlsRow => ({
        cells: [
          { v: humanize(cat), s: alt(i) },
          { v: assessments.filter((r) => r.category === cat).length, s: alt(i), t: "Number" },
          { v: null },
          { v: null },
          { v: null },
        ] as XlsCell[],
      })),
      blankRow(D),
      {
        cells: [
          {
            v: "Risk Score = Likelihood × Consequence. Extreme ≥20, High 12–19, Medium 6–11, Low 1–5.",
            s: "meta",
            m: D - 1,
          },
        ] as XlsCell[],
      },
    ];

    // ── Shared register row builder ─────────────────────────────────────────────

    function buildRegisterRow(r: RiskAssessment, i: number): XlsRow {
      const a = alt(i);
      const lvlStyle = riskLevelStyle(r.risk_level);
      const resLvlStyle = r.residual_risk_level ? riskLevelStyle(r.residual_risk_level) : a;
      const reviewOverdue = r.review_date && new Date(r.review_date) < now;
      let statusStyle: StyleId = a;
      if (r.status === "active") statusStyle = "good";
      else if (r.status === "under_review") statusStyle = "info";

      return {
        cells: [
          { v: r.id, s: a },
          { v: r.title, s: a },
          { v: humanize(r.category), s: a },
          { v: r.likelihood_score, s: a, t: "Number" },
          { v: r.consequence_score, s: a, t: "Number" },
          { v: r.risk_score, s: lvlStyle, t: "Number" },
          { v: humanize(r.risk_level), s: lvlStyle },
          { v: r.residual_risk_score ?? null, s: resLvlStyle, t: "Number" },
          { v: r.residual_risk_level ? humanize(r.residual_risk_level) : "—", s: resLvlStyle },
          { v: r.owner_id ? (profileMap[r.owner_id] ?? "—") : "Unassigned", s: a },
          { v: fmtDate(r.review_date), s: reviewOverdue ? "danger" : a },
          { v: humanize(r.status), s: statusStyle },
        ] as XlsCell[],
      };
    }

    // ── Sheet 2: Risk Register ──────────────────────────────────────────────────

    const registerRows: XlsRow[] = [
      ...titleBlock(user.company, "Risk Register", "ISO 45001:2018 Clause 6.1 — Actions to Address Risks", dateStr, 12),
      theadRow(["ID", "Title", "Category", "Likelihood", "Consequence", "Risk Score", "Risk Level", "Residual Score", "Residual Level", "Owner", "Review Date", "Status"]),
      ...assessments.map((r, i) => buildRegisterRow(r, i)),
    ];

    // ── Sheet 3: Extreme & High Risk ────────────────────────────────────────────

    const critical_high = assessments.filter((r) => r.risk_level === "extreme" || r.risk_level === "high");

    const critHighRows: XlsRow[] = [
      ...titleBlock(user.company, "Extreme & High Risk", "ISO 45001:2018 Clause 6.1 — Actions to Address Risks", dateStr, 12),
      ...(critical_high.length === 0
        ? [{ cells: [{ v: "✓ No extreme or high-risk assessments found.", s: "good", m: 11 }] as XlsCell[] }]
        : [
            theadRow(["ID", "Title", "Category", "Likelihood", "Consequence", "Risk Score", "Risk Level", "Residual Score", "Residual Level", "Owner", "Review Date", "Status"]),
            ...critical_high.map((r, i) => buildRegisterRow(r, i)),
          ]),
    ];

    buildXls({
      filename: `${user.company.split(" ")[0]}-Risk-Register-${isoDate}.xls`,
      sheets: [
        { name: "Dashboard",          cols: Array(D).fill(140),  rows: dashRows },
        { name: "Risk Register",       cols: REGISTER_COLS,        rows: registerRows, freeze: 6 },
        { name: "Extreme & High Risk", cols: REGISTER_COLS,        rows: critHighRows, freeze: 6 },
      ],
    });
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" />
      Export Risk Register
    </button>
  );
}

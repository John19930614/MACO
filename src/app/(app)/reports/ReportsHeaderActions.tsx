"use client";

import { useState } from "react";
import { Download, Filter, X } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import { oshaRate } from "@/lib/osha";
import type { CapaAction, Incident, TrainingRecord, LegalRequirement, Chemical } from "@/lib/types";

interface ModuleScore {
  module: string;
  score: number;
  trend: string;
  delta: string;
  openIssues: number;
  issueLabel: string;
}

interface Props {
  capas: CapaAction[];
  incidents: Incident[];
  trainingRecs: TrainingRecord[];
  legal: LegalRequirement[];
  chemicals: Chemical[];
  moduleScores: ModuleScore[];
  overallScore: number;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date((d.includes("T") ? d : d + "T00:00:00")).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function esc(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function sectionHeader(title: string, recordCount: number): string[] {
  return [
    "",
    `${esc("═══════════════════════════════════")},`,
    `${esc(title.toUpperCase())},${esc(`${recordCount} records`)}`,
    `${esc("═══════════════════════════════════")},`,
  ];
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const FILTER_OPTIONS = [
  { key: "all",      label: "All Modules" },
  { key: "capa",     label: "CAPA Only" },
  { key: "legal",    label: "Legal Only" },
  { key: "training", label: "Training Only" },
  { key: "chemical", label: "Chemical Only" },
];

export function ReportsHeaderActions({ capas, incidents, trainingRecs, legal, chemicals, moduleScores, overallScore }: Props) {
  const { user } = useDemoUser();
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  function exportFullReport() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);
    const year = now.getFullYear();

    const openCapas   = capas.filter((c) => !["closed", "pending_verification"].includes(c.status));
    const overdueCapas = capas.filter((c) => c.due_date && new Date(c.due_date) < now && !["closed", "pending_verification"].includes(c.status));
    const ytdIncidents = incidents.filter((i) => new Date(i.occurred_at).getFullYear() === year);
    const lostTime     = ytdIncidents.filter((i) => (i.lost_time_days ?? 0) > 0);
    const regulatory   = ytdIncidents.filter((i) => i.regulatory_reportable);
    const trir         = oshaRate(ytdIncidents.length);
    const gaps         = legal.filter((l) => l.status !== "compliant" && l.status !== "not_applicable");

    const lines: string[] = [];

    // ── Cover block ──────────────────────────────────────────────────────────
    lines.push(`${esc(user.company)},`);
    lines.push(`${esc("EHS COMPLIANCE REPORT — FULL SYSTEM EXPORT")},`);
    lines.push(`${esc("SafetyIQ · Reliance Predictive Safety Technologies")},`);
    lines.push(`${esc("Generated:")},${esc(dateStr)}`);
    lines.push(`${esc("Reporting Period:")},${esc(`Calendar Year ${year}`)}`);
    lines.push(`${esc("Document Classification:")},${esc("Confidential — Internal Use Only")}`);
    lines.push("", "");

    // ── Executive Summary ────────────────────────────────────────────────────
    lines.push(`${esc("EXECUTIVE SUMMARY")},`);
    lines.push(`${esc("Overall Compliance Score:")},${esc(`${overallScore}%`)}`);
    lines.push(`${esc("Open CAPAs:")},${esc(String(openCapas.length))}`);
    lines.push(`${esc("Overdue CAPAs:")},${esc(String(overdueCapas.length))}`);
    lines.push(`${esc("Incidents YTD:")},${esc(String(ytdIncidents.length))}`);
    lines.push(`${esc("Regulatory Reportable Events:")},${esc(String(regulatory.length))}`);
    lines.push(`${esc("Lost-Time Incidents:")},${esc(String(lostTime.length))}`);
    lines.push(`${esc("TRIR (per 100 FTE):")},${esc(trir)}`);
    lines.push(`${esc("Regulatory Gaps:")},${esc(String(gaps.length))}`);
    lines.push(`${esc("High-Risk Chemicals:")},${esc(String(chemicals.filter((c) => c.is_scheduled || c.hazard_statements.some((h) => ["H350","H351","H300","H330"].some((hh) => h.startsWith(hh)))).length))}`);

    // ── Section 1: Module Scorecards ─────────────────────────────────────────
    lines.push(...sectionHeader("Section 1 — EHS Module Compliance Scorecards", moduleScores.length));
    lines.push([esc("EHS Module"), esc("Score"), esc("Trend"), esc("MoM Change"), esc("Open Issues"), esc("Issue Category"), esc("Status")].join(","));
    for (const m of [...moduleScores].sort((a, b) => b.score - a.score)) {
      lines.push([
        esc(m.module), esc(`${m.score}%`), esc(humanize(m.trend)), esc(m.delta),
        esc(m.openIssues), esc(humanize(m.issueLabel)),
        esc(m.score >= 85 ? "Compliant" : m.score >= 70 ? "Needs Improvement" : "At Risk"),
      ].join(","));
    }

    // ── Section 2: Open CAPAs ────────────────────────────────────────────────
    lines.push(...sectionHeader("Section 2 — Open CAPA Actions", openCapas.length));
    lines.push([esc("Title"), esc("Status"), esc("Type"), esc("Severity"), esc("Source Module"), esc("Due Date"), esc("Days Open")].join(","));
    for (const c of openCapas) {
      const daysOpen = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / 86400000);
      lines.push([
        esc(c.title), esc(humanize(c.status)),
        esc(c.kind === "corrective" ? "Corrective" : "Preventive"),
        esc(humanize(c.severity)),
        esc(humanize(c.source_type ?? "manual")),
        esc(c.due_date ? fmtDate(c.due_date) : "No deadline"),
        esc(`${daysOpen} days`),
      ].join(","));
    }

    // ── Section 3: Incidents YTD ─────────────────────────────────────────────
    lines.push(...sectionHeader("Section 3 — Incidents Year-to-Date", ytdIncidents.length));
    lines.push([esc("Title"), esc("Date"), esc("Severity"), esc("Type"), esc("Status"), esc("Location"), esc("Regulatory?"), esc("Medical?"), esc("Lost Days")].join(","));
    for (const i of ytdIncidents) {
      lines.push([
        esc(i.title), esc(fmtDate(i.occurred_at)), esc(humanize(i.severity ?? "")),
        esc(humanize(i.incident_type ?? "")), esc(humanize(i.status)),
        esc(i.location ?? "—"),
        esc(i.regulatory_reportable ? "Yes" : "No"),
        esc(i.medical_treatment_required ? "Yes" : "No"),
        esc(i.lost_time_days ?? 0),
      ].join(","));
    }

    // ── Section 4: Regulatory Gaps ───────────────────────────────────────────
    lines.push(...sectionHeader("Section 4 — Regulatory Compliance Gaps", gaps.length));
    lines.push([esc("Regulation Ref"), esc("Title"), esc("Category"), esc("Jurisdiction"), esc("Status"), esc("Next Review")].join(","));
    for (const l of gaps) {
      lines.push([
        esc(l.regulation_ref), esc(l.title), esc(humanize(l.category)),
        esc(l.jurisdiction), esc(humanize(l.status)), esc(fmtDate(l.next_review_date)),
      ].join(","));
    }

    // ── Section 5: Chemical Inventory Summary ────────────────────────────────
    lines.push(...sectionHeader("Section 5 — Chemical Inventory", chemicals.length));
    lines.push([esc("Chemical Name"), esc("CAS Number"), esc("Quantity"), esc("Unit"), esc("Storage Location"), esc("SDS Status"), esc("Scheduled Substance?"), esc("GHS Hazard Classes")].join(","));
    for (const c of chemicals) {
      lines.push([
        esc(c.name), esc(c.cas_number ?? "—"), esc(c.quantity ?? ""), esc(c.unit ?? ""),
        esc(c.storage_location ?? "—"),
        esc(c.sds_url ? "On file" : "Missing — Action Required"),
        esc(c.is_scheduled ? "Yes — Controlled Substance" : "No"),
        esc(c.hazard_statements.slice(0, 4).join("; ")),
      ].join(","));
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    lines.push("", "");
    lines.push(`${esc("Report generated by SafetyIQ / Reliance Predictive Safety Technologies")},`);
    lines.push(`${esc(`© ${user.company} — Confidential`)},${esc(dateStr)}`);

    downloadCSV(`${user.company.split(" ")[0]}-EHS-Full-Report-${isoDate}.csv`, "﻿" + lines.join("\n"));
  }

  return (
    <div className="flex items-center gap-2 relative">
      <button
        onClick={() => setFilterOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition ${
          filterOpen || activeFilter !== "all"
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Filter className="h-4 w-4" />
        {activeFilter === "all" ? "Filters" : FILTER_OPTIONS.find((f) => f.key === activeFilter)?.label}
      </button>

      {filterOpen && (
        <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Filter View</span>
            <button onClick={() => setFilterOpen(false)}><X className="h-3.5 w-3.5 text-slate-400" /></button>
          </div>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setActiveFilter(opt.key); setFilterOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${activeFilter === opt.key ? "text-blue-600 font-medium" : "text-slate-700"}`}
            >
              {activeFilter === opt.key && <span className="text-blue-500">✓</span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={exportFullReport}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <Download className="h-4 w-4" />
        Export Full Report
      </button>
    </div>
  );
}

"use client";

import { Download, ShieldCheck, FileArchive } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { useDemoUser } from "@/lib/context/demo-user";
import type { WasteStream, WastePickup, WasteVendor, WasteInspection, WasteProfile } from "@/lib/types";

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

// Builds a polished CSV with a document header block, data table, and optional summary section.
function buildReport(opts: {
  title: string;
  description: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  summary?: [string, string | number][];
  companyName: string;
}): string {
  const now = new Date();
  const generated = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const year = now.getFullYear();

  const headerBlock = [
    [esc(opts.companyName), esc("EHS Compliance Documentation")],
    [esc(opts.title), esc(opts.description)],
    [esc("SafetyIQ · Reliance Predictive Safety Technologies"), ""],
    [esc("Generated:"), esc(generated)],
    [esc("Reporting Period:"), esc(`Calendar Year ${year}`)],
    [esc("Total Records:"), esc(String(opts.rows.length))],
    ["", ""],
  ].map((r) => r.join(","));

  const dataRows = [
    opts.headers.map(esc).join(","),
    ...opts.rows.map((r) => r.map(esc).join(",")),
  ];

  const summaryRows: string[] = [];
  if (opts.summary?.length) {
    summaryRows.push("", [esc("── SUMMARY ──"), ""].join(","));
    for (const [label, val] of opts.summary) {
      summaryRows.push([esc(label), esc(String(val))].join(","));
    }
  }

  // ﻿ BOM ensures Excel opens UTF-8 CSV correctly
  return "﻿" + [...headerBlock, ...dataRows, ...summaryRows].join("\n");
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

// ── Report section definitions ────────────────────────────────────────────────

interface ReportSection {
  title: string;
  description: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  summary: [string, string | number][];
}

const DAYS_90 = 90 * 86400000;

function buildSections(
  streams: WasteStream[],
  pickups: WastePickup[],
  vendors: WasteVendor[],
  inspections: WasteInspection[],
  profiles: WasteProfile[],
): Record<string, ReportSection> {
  const now = new Date();
  const vendorName = (id: string | null | undefined): string =>
    id ? (vendors.find((v) => v.id === id)?.name ?? id) : "—";

  // 1. Waste Stream Register
  const streamRegister: ReportSection = {
    title: "Waste Stream Register",
    description: "RCRA waste stream inventory — classification, quantities, and disposal tracking",
    headers: ["Waste Name", "EPA/Waste Code", "Classification", "Quantity", "Unit", "Disposal Method", "Contractor", "Manifest #", "Disposal Date", "Status"],
    rows: streams.map((s) => [
      s.waste_name,
      s.waste_code ?? "—",
      humanize(s.classification),
      s.quantity,
      s.unit,
      humanize(s.disposal_method),
      s.disposal_contractor ?? "—",
      s.manifest_number ?? "—",
      fmtDate(s.disposal_date),
      humanize(s.status),
    ]),
    summary: [
      ["Total Waste Streams", streams.length],
      ["Hazardous", streams.filter((s) => s.classification === "hazardous").length],
      ["Manifested", streams.filter((s) => !!s.manifest_number).length],
      ["Disposed", streams.filter((s) => s.status === "disposed").length],
    ],
  };

  // 2. Pickup & Manifest Log
  const pickupLog: ReportSection = {
    title: "Pickup & Manifest Log",
    description: "Scheduled and completed waste pickups with manifest references",
    headers: ["Vendor", "Manifest #", "Scheduled Date", "Completed Date", "Quantity", "Unit", "Status", "Notes"],
    rows: pickups.map((p) => [
      vendorName(p.vendor_id),
      p.manifest_number ?? "—",
      fmtDate(p.scheduled_date),
      fmtDate(p.completed_date),
      p.quantity ?? "—",
      p.unit ?? "—",
      humanize(p.status),
      p.notes ?? "—",
    ]),
    summary: [
      ["Total Pickups", pickups.length],
      ["Completed", pickups.filter((p) => p.status === "completed" || !!p.completed_date).length],
      ["Pending", pickups.filter((p) => p.status !== "completed" && !p.completed_date).length],
    ],
  };

  // 3. Vendor / TSDF Register
  const vendorRegister: ReportSection = {
    title: "Vendor / TSDF Register",
    description: "Treatment, storage, and disposal facilities — permits and contact details",
    headers: ["Name", "EPA ID", "Contact", "Phone", "Email", "Services", "Permit Expiry", "Status"],
    rows: vendors.map((v) => [
      v.name,
      v.epa_id ?? "—",
      v.contact_name ?? "—",
      v.phone ?? "—",
      v.email ?? "—",
      v.services.join("; "),
      fmtDate(v.permit_expiry),
      humanize(v.status),
    ]),
    summary: [
      ["Total Vendors", vendors.length],
      ["Active", vendors.filter((v) => v.status === "active").length],
      ["Permits Expiring Within 90 Days", vendors.filter((v) => {
        if (!v.permit_expiry) return false;
        const diff = new Date(v.permit_expiry).getTime() - now.getTime();
        return diff >= 0 && diff <= DAYS_90;
      }).length],
    ],
  };

  // 4. Inspection Log
  const inspectionLog: ReportSection = {
    title: "Inspection Log",
    description: "Waste accumulation area inspections — results and corrective findings",
    headers: ["Area", "Inspection Date", "Inspector", "Result", "Findings", "Next Due"],
    rows: inspections.map((i) => [
      i.area ?? "—",
      fmtDate(i.inspection_date),
      i.inspector ?? "—",
      i.passed ? "Pass" : "Fail",
      i.findings ?? "—",
      fmtDate(i.next_due),
    ]),
    summary: [
      ["Total Inspections", inspections.length],
      ["Passed", inspections.filter((i) => i.passed).length],
      ["Failed", inspections.filter((i) => !i.passed).length],
    ],
  };

  // 5. Waste Profile Register
  const profileRegister: ReportSection = {
    title: "Waste Profile Register",
    description: "Approved waste characterization profiles and lifecycle state",
    headers: ["Name", "Waste Code", "Classification", "Physical State", "State", "Version", "Submitted", "Approved"],
    rows: profiles.map((p) => [
      p.name,
      p.waste_code ?? "—",
      humanize(p.classification),
      humanize(p.physical_state),
      humanize(p.state),
      p.version,
      fmtDate(p.submitted_at),
      fmtDate(p.approved_at),
    ]),
    summary: [
      ["Total Profiles", profiles.length],
      ["Approved", profiles.filter((p) => p.state === "approved" || p.state === "active").length],
      ["In Review", profiles.filter((p) => p.state === "ehs_review").length],
    ],
  };

  return {
    streams: streamRegister,
    pickups: pickupLog,
    vendors: vendorRegister,
    inspections: inspectionLog,
    profiles: profileRegister,
  };
}

// ── Component ───────────────────────────────────────────────────────────────

export function WasteReportsTab({
  streams,
  pickups,
  vendors,
  inspections,
  profiles,
}: {
  streams: WasteStream[];
  pickups: WastePickup[];
  vendors: WasteVendor[];
  inspections: WasteInspection[];
  profiles: WasteProfile[];
}) {
  const { user } = useDemoUser();
  const company = user.company;
  const firstWord = company.split(" ")[0];

  const sections = buildSections(streams, pickups, vendors, inspections, profiles);

  function exportSection(key: keyof typeof sections, filenameLabel: string) {
    const s = sections[key];
    const csv = buildReport({
      title: s.title,
      description: s.description,
      headers: s.headers,
      rows: s.rows,
      summary: s.summary,
      companyName: company,
    });
    downloadCSV(`${firstWord}-${filenameLabel}.csv`, csv);
  }

  function exportAuditBinder() {
    const now = new Date();
    const generated = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const isoDate = now.toISOString().slice(0, 10);
    const year = now.getFullYear();

    const lines: string[] = [
      [esc(company), esc("Hazardous Waste Audit Binder")].join(","),
      [esc("SafetyIQ · Reliance Predictive Safety Technologies"), ""].join(","),
      [esc("RCRA-Compliant Export Package"), ""].join(","),
      [esc("Generated:"), esc(generated)].join(","),
      [esc("Reporting Period:"), esc(`Calendar Year ${year}`)].join(","),
      "",
    ];

    for (const key of Object.keys(sections) as (keyof typeof sections)[]) {
      const s = sections[key];
      lines.push("");
      lines.push([esc(`── ${s.title.toUpperCase()} ──`), ""].join(","));
      lines.push([esc(s.description), ""].join(","));
      lines.push([esc("Records:"), esc(String(s.rows.length))].join(","));
      lines.push("");
      lines.push(s.headers.map(esc).join(","));
      for (const row of s.rows) {
        lines.push(row.map(esc).join(","));
      }
      lines.push("");
      lines.push([esc("── SUMMARY ──"), ""].join(","));
      for (const [label, val] of s.summary) {
        lines.push([esc(label), esc(String(val))].join(","));
      }
    }

    // ﻿ BOM ensures Excel opens UTF-8 CSV correctly
    const csv = "﻿" + lines.join("\n");
    downloadCSV(`${firstWord}-Waste-Audit-Binder-${isoDate}.csv`, csv);
  }

  const PACKAGES: { key: keyof typeof sections; label: string; description: string; count: string; filename: string }[] = [
    {
      key: "streams",
      label: "Waste Stream Register",
      description: "Full RCRA waste stream inventory with disposal and manifest tracking.",
      count: `${streams.length} stream${streams.length === 1 ? "" : "s"}`,
      filename: "Waste-Stream-Register",
    },
    {
      key: "pickups",
      label: "Pickup & Manifest Log",
      description: "Scheduled and completed pickups linked to vendors and manifests.",
      count: `${pickups.length} pickup${pickups.length === 1 ? "" : "s"}`,
      filename: "Pickup-Manifest-Log",
    },
    {
      key: "vendors",
      label: "Vendor / TSDF Register",
      description: "Disposal facilities with EPA IDs, permits, and contact details.",
      count: `${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`,
      filename: "Vendor-TSDF-Register",
    },
    {
      key: "inspections",
      label: "Inspection Log",
      description: "Accumulation area inspections with results and findings.",
      count: `${inspections.length} inspection${inspections.length === 1 ? "" : "s"}`,
      filename: "Inspection-Log",
    },
    {
      key: "profiles",
      label: "Waste Profile Register",
      description: "Waste characterization profiles and approval lifecycle.",
      count: `${profiles.length} profile${profiles.length === 1 ? "" : "s"}`,
      filename: "Waste-Profile-Register",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Intro banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
          RCRA-compliant export packages compiled live from {company}&rsquo;s waste records. Every
          report below is generated on demand from current data — download any package or compile a
          full audit binder for inspection readiness.
        </p>
      </div>

      {/* Report package cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PACKAGES.map((p) => (
          <Card key={p.key} className="flex flex-col p-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.label}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{p.description}</p>
              <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {p.count}
              </span>
            </div>
            <button
              onClick={() => exportSection(p.key, p.filename)}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </Card>
        ))}
      </div>

      {/* Full audit binder */}
      <Card>
        <CardHeader
          title="Compile Full Audit Binder"
          subtitle="Combine all five registers into a single inspection-ready CSV."
        />
        <div className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            One file containing the waste stream register, pickup &amp; manifest log, vendor/TSDF
            register, inspection log, and waste profile register — each as its own labeled section.
          </p>
          <button
            onClick={exportAuditBinder}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <FileArchive className="h-4 w-4" />
            Compile Full Audit Binder
          </button>
        </div>
      </Card>
    </div>
  );
}

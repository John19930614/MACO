"use client";

import { Presentation, Sheet, ShieldCheck, FileArchive } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { useDemoUser } from "@/lib/context/demo-user";
import { downloadReportPptx, downloadMultiSectionPptx } from "@/lib/reports/pptx";
import { downloadReportXlsx, downloadMultiSheetXlsx } from "@/lib/reports/xlsx";
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

  const streamRegister: ReportSection = {
    title: "Waste Stream Register",
    description: "RCRA waste stream inventory — classification, quantities, and disposal tracking",
    headers: ["Waste Name", "EPA/Waste Code", "Classification", "Quantity", "Unit", "Disposal Method", "Contractor", "Manifest #", "Disposal Date", "Status"],
    rows: streams.map((s) => [
      s.waste_name, s.waste_code ?? "—", humanize(s.classification), s.quantity, s.unit,
      humanize(s.disposal_method), s.disposal_contractor ?? "—", s.manifest_number ?? "—",
      fmtDate(s.disposal_date), humanize(s.status),
    ]),
    summary: [
      ["Total Waste Streams", streams.length],
      ["Hazardous", streams.filter((s) => s.classification === "hazardous").length],
      ["Manifested", streams.filter((s) => !!s.manifest_number).length],
      ["Disposed", streams.filter((s) => s.status === "disposed").length],
    ],
  };

  const pickupLog: ReportSection = {
    title: "Pickup & Manifest Log",
    description: "Scheduled and completed waste pickups with manifest references",
    headers: ["Vendor", "Manifest #", "Scheduled Date", "Completed Date", "Quantity", "Unit", "Status", "Notes"],
    rows: pickups.map((p) => [
      vendorName(p.vendor_id), p.manifest_number ?? "—", fmtDate(p.scheduled_date), fmtDate(p.completed_date),
      p.quantity ?? "—", p.unit ?? "—", humanize(p.status), p.notes ?? "—",
    ]),
    summary: [
      ["Total Pickups", pickups.length],
      ["Completed", pickups.filter((p) => p.status === "completed" || !!p.completed_date).length],
      ["Pending", pickups.filter((p) => p.status !== "completed" && !p.completed_date).length],
    ],
  };

  const vendorRegister: ReportSection = {
    title: "Vendor / TSDF Register",
    description: "Treatment, storage, and disposal facilities — permits and contact details",
    headers: ["Name", "EPA ID", "Contact", "Phone", "Email", "Services", "Permit Expiry", "Status"],
    rows: vendors.map((v) => [
      v.name, v.epa_id ?? "—", v.contact_name ?? "—", v.phone ?? "—", v.email ?? "—",
      v.services.join("; "), fmtDate(v.permit_expiry), humanize(v.status),
    ]),
    summary: [
      ["Total Vendors", vendors.length],
      ["Active", vendors.filter((v) => v.status === "active").length],
      ["Permits Expiring ≤ 90 Days", vendors.filter((v) => {
        if (!v.permit_expiry) return false;
        const diff = new Date(v.permit_expiry).getTime() - now.getTime();
        return diff >= 0 && diff <= DAYS_90;
      }).length],
    ],
  };

  const inspectionLog: ReportSection = {
    title: "Inspection Log",
    description: "Waste accumulation area inspections — results and corrective findings",
    headers: ["Area", "Inspection Date", "Inspector", "Result", "Findings", "Next Due"],
    rows: inspections.map((i) => [
      i.area ?? "—", fmtDate(i.inspection_date), i.inspector ?? "—",
      i.passed ? "Pass" : "Fail", i.findings ?? "—", fmtDate(i.next_due),
    ]),
    summary: [
      ["Total Inspections", inspections.length],
      ["Passed", inspections.filter((i) => i.passed).length],
      ["Failed", inspections.filter((i) => !i.passed).length],
    ],
  };

  const profileRegister: ReportSection = {
    title: "Waste Profile Register",
    description: "Approved waste characterization profiles and lifecycle state",
    headers: ["Name", "Waste Code", "Classification", "Physical State", "State", "Version", "Submitted", "Approved"],
    rows: profiles.map((p) => [
      p.name, p.waste_code ?? "—", humanize(p.classification), humanize(p.physical_state),
      humanize(p.state), p.version, fmtDate(p.submitted_at), fmtDate(p.approved_at),
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
  const firstWord = company.split(" ")[0] || "SafetyIQ";

  const sections = buildSections(streams, pickups, vendors, inspections, profiles);

  function exportPptx(key: keyof typeof sections, fileBase: string, accent: string) {
    const s = sections[key];
    void downloadReportPptx({
      title: s.title, description: s.description, headers: s.headers, rows: s.rows,
      summary: s.summary, companyName: company, accent, fileName: `${firstWord}-${fileBase}.pptx`,
    });
  }

  function exportXlsx(key: keyof typeof sections, fileBase: string) {
    const s = sections[key];
    downloadReportXlsx({
      title: s.title, description: s.description, headers: s.headers, rows: s.rows,
      summary: s.summary, companyName: company, fileName: `${firstWord}-${fileBase}.xlsx`,
    });
  }

  function binderSections() {
    return (Object.keys(sections) as (keyof typeof sections)[]).map((k) => ({
      name: sections[k].title,
      headers: sections[k].headers,
      rows: sections[k].rows,
    }));
  }

  function exportBinderPptx() {
    void downloadMultiSectionPptx({
      title: "Hazardous Waste Audit Binder",
      description: "RCRA-compliant export package — all waste registers",
      companyName: company,
      accent: "0F766E",
      fileName: `${firstWord}-Waste-Audit-Binder.pptx`,
      sections: binderSections(),
    });
  }

  function exportBinderXlsx() {
    downloadMultiSheetXlsx({
      fileName: `${firstWord}-Waste-Audit-Binder.xlsx`,
      companyName: company,
      sections: binderSections(),
    });
  }

  const PACKAGES: { key: keyof typeof sections; label: string; description: string; count: string; filename: string; accent: string }[] = [
    { key: "streams",     label: "Waste Stream Register", description: "Full RCRA waste stream inventory with disposal and manifest tracking.", count: `${streams.length} stream${streams.length === 1 ? "" : "s"}`,        filename: "Waste-Stream-Register", accent: "2563EB" },
    { key: "pickups",     label: "Pickup & Manifest Log", description: "Scheduled and completed pickups linked to vendors and manifests.",     count: `${pickups.length} pickup${pickups.length === 1 ? "" : "s"}`,        filename: "Pickup-Manifest-Log",   accent: "EA580C" },
    { key: "vendors",     label: "Vendor / TSDF Register",description: "Disposal facilities with EPA IDs, permits, and contact details.",      count: `${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`,        filename: "Vendor-TSDF-Register",  accent: "0891B2" },
    { key: "inspections", label: "Inspection Log",        description: "Accumulation area inspections with results and findings.",            count: `${inspections.length} inspection${inspections.length === 1 ? "" : "s"}`, filename: "Inspection-Log",        accent: "10B981" },
    { key: "profiles",    label: "Waste Profile Register", description: "Waste characterization profiles and approval lifecycle.",            count: `${profiles.length} profile${profiles.length === 1 ? "" : "s"}`,      filename: "Waste-Profile-Register",accent: "7C3AED" },
  ];

  return (
    <div className="space-y-4">
      {/* Intro banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
          RCRA-compliant export packages compiled live from {company}&rsquo;s waste records. Download any
          register as a branded <span className="font-semibold">PowerPoint</span> deck or a formatted{" "}
          <span className="font-semibold">Excel</span> workbook, or compile a full audit binder for inspection readiness.
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
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => exportPptx(p.key, p.filename, p.accent)}
                title="Download a branded PowerPoint deck"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                <Presentation className="h-3.5 w-3.5" /> PowerPoint
              </button>
              <button
                onClick={() => exportXlsx(p.key, p.filename)}
                title="Download a formatted Excel workbook"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
              >
                <Sheet className="h-3.5 w-3.5" /> Excel
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Full audit binder */}
      <Card>
        <CardHeader
          title="Compile Full Audit Binder"
          subtitle="All five registers in one inspection-ready file."
        />
        <div className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            The waste stream register, pickup &amp; manifest log, vendor/TSDF register, inspection log, and
            waste profile register — as a multi-section PowerPoint deck or a multi-tab Excel workbook.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={exportBinderPptx}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <FileArchive className="h-4 w-4" /> PowerPoint
            </button>
            <button
              onClick={exportBinderXlsx}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Sheet className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

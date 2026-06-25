"use client";

import { useMemo } from "react";
import { AlertTriangle, FileText, ShieldAlert } from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import { useDemoUser } from "@/lib/context/demo-user";
import { WasteCalendarExportButton } from "./WasteCalendarExportButton";
import type { WasteStream, WastePickup, WasteVendor, WasteInspection } from "@/lib/types";

// "Compliance & Emergency" tab for the Waste module.
//
// IMPORTANT — data integrity: this component renders ONLY (a) real obligations
// derived from the props (pickups, permits, inspections, disposal targets) and
// (b) accurate STATIC regulatory reference text (citations / standard RCRA
// contingency procedure). It fabricates NO operational status — no spill-kit
// counts, no drill logs, no inspection pass/fail tallies. Anything not known
// from real data is shown as a clearly-blank fill-in line.

interface Props {
  streams: WasteStream[];
  pickups: WastePickup[];
  vendors: WasteVendor[];
  inspections: WasteInspection[];
  emergencyCoordinator?: string;
  facilityPhone?: string;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDay(d: string): Date {
  // Treat bare "YYYY-MM-DD" as a local calendar day, not UTC midnight.
  return new Date(d.includes("T") ? d : d + "T00:00:00");
}

function fmtDate(d: string): string {
  return parseDay(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(d: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDay(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Static regulatory reference (legitimate citations, not live status) ───────

interface LegalRow {
  authority: string;
  obligation: string;
  category: string;
}

const LEGAL_REGISTER: LegalRow[] = [
  { authority: "EPA 40 CFR 262", obligation: "Generator standards (accumulation, manifests, training)", category: "Federal" },
  { authority: "EPA 40 CFR 265", obligation: "Container & tank storage standards (Subpart C contingency)", category: "Federal" },
  { authority: "EPA 40 CFR 268", obligation: "Land Disposal Restrictions (LDR)", category: "Federal" },
  { authority: "DOT 49 CFR 171–180", obligation: "Hazardous materials transportation", category: "Federal" },
  { authority: "EPCRA §312", obligation: "Tier II hazardous chemical inventory reporting", category: "Federal" },
];

interface RetentionRow {
  document: string;
  period: string;
  authority: string;
}

const RETENTION_SCHEDULE: RetentionRow[] = [
  { document: "Hazardous waste manifests", period: "3 years", authority: "40 CFR 264.74" },
  { document: "Land Disposal Restriction (LDR) certifications", period: "3 years", authority: "40 CFR 268.7" },
  { document: "Inspection records", period: "3 years", authority: "40 CFR 265.15" },
  { document: "Personnel training records", period: "3 years", authority: "40 CFR 265.16" },
  { document: "Biennial reports", period: "3 years", authority: "40 CFR 262.41" },
];

// Human-readable label for a classification enum value.
function classLabel(c: string): string {
  return c
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Compliance obligation rows (REAL, prop-derived) ───────────────────────────

type ObligationType = "Pickup" | "Permit" | "Inspection" | "Disposal";

interface Obligation {
  key: string;
  date: string;
  type: ObligationType;
  label: string;
}

const TYPE_STYLE: Record<ObligationType, string> = {
  Pickup: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Permit: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Inspection: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Disposal: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function WasteComplianceTab({ streams, pickups, vendors, inspections, emergencyCoordinator, facilityPhone }: Props) {
  const { user } = useDemoUser();
  const company = user.company || "Your Company";
  const coordLine = emergencyCoordinator && emergencyCoordinator.trim() ? emergencyCoordinator.trim() : "";
  const phoneLine = facilityPhone && facilityPhone.trim() ? facilityPhone.trim() : "";

  const vendorName = (id: string | null): string =>
    (id ? vendors.find((v) => v.id === id)?.name : null) ?? "Vendor TBD";

  // Build the combined, date-sorted obligation list strictly from real records.
  const obligations = useMemo<Obligation[]>(() => {
    const rows: Obligation[] = [];

    for (const p of pickups) {
      if (!p.scheduled_date || p.status === "completed") continue;
      rows.push({
        key: `pickup-${p.id}`,
        date: p.scheduled_date,
        type: "Pickup",
        label: `Pickup — ${vendorName(p.vendor_id)}`,
      });
    }

    for (const v of vendors) {
      if (!v.permit_expiry) continue;
      rows.push({
        key: `permit-${v.id}`,
        date: v.permit_expiry,
        type: "Permit",
        label: `${v.name} TSDF permit renewal`,
      });
    }

    for (const i of inspections) {
      if (!i.next_due) continue;
      rows.push({
        key: `inspection-${i.id}`,
        date: i.next_due,
        type: "Inspection",
        label: `${i.area ?? "Site"} inspection due`,
      });
    }

    for (const s of streams) {
      if (!s.disposal_date || s.status === "disposed") continue;
      rows.push({
        key: `disposal-${s.id}`,
        date: s.disposal_date,
        type: "Disposal",
        label: `${s.waste_name} disposal target`,
      });
    }

    return rows.sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime());
  }, [streams, pickups, vendors, inspections]);

  // Distinct, real classifications present across the streams — drives the
  // "Hazards Present" list on the emergency poster.
  const hazardClasses = useMemo<string[]>(() => {
    const seen = new Set<string>();
    for (const s of streams) if (s.classification) seen.add(s.classification);
    return Array.from(seen).map(classLabel).sort();
  }, [streams]);

  // ── Emergency poster (real hazards + standard RCRA contingency text) ─────────

  function buildPosterHtml(): string {
    const hazardItems =
      hazardClasses.length > 0
        ? hazardClasses.map((h) => `<li>${esc(h)}</li>`).join("")
        : `<li><em>No waste streams on record — verify hazards on site before storing waste.</em></li>`;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Hazardous Waste — Emergency Response — ${esc(company)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; color: #111; }
  .poster { max-width: 7.5in; margin: 0 auto; border: 4px solid #000; }
  .hdr { background: #b91c1c; color: #fff; text-align: center; padding: 18px 14px; }
  .hdr .t1 { font-size: 26px; font-weight: 800; letter-spacing: 1px; }
  .hdr .t2 { font-size: 15px; font-weight: 700; margin-top: 6px; }
  .band { background: #facc15; color: #000; text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 5px; border-top: 3px solid #000; border-bottom: 3px solid #000; }
  .sec { padding: 14px 20px; border-bottom: 2px solid #000; }
  .sec h2 { font-size: 15px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: .5px; }
  .sec ul, .sec ol { margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; }
  .contacts { display: flex; gap: 24px; flex-wrap: wrap; }
  .contacts .field { flex: 1 1 240px; font-size: 13px; }
  .contacts .k { font-weight: 800; text-transform: uppercase; font-size: 10px; color: #444; display: block; margin-bottom: 4px; }
  .blank { display: inline-block; min-width: 220px; border-bottom: 2px solid #000; height: 18px; }
  .rnc { background: #fef2f2; border: 2px solid #b91c1c; padding: 8px 12px; font-size: 14px; font-weight: 700; text-align: center; margin-top: 10px; }
  .footer { font-size: 10px; text-align: center; padding: 8px; color: #333; }
  @media print { body { padding: 0; } .noprint { display: none; } }
  .noprint { text-align: center; margin-top: 18px; }
  .noprint button { font-size: 13px; padding: 8px 18px; cursor: pointer; }
</style></head>
<body>
  <div class="poster">
    <div class="hdr">
      <div class="t1">HAZARDOUS WASTE — EMERGENCY RESPONSE</div>
      <div class="t2">${esc(company)}</div>
    </div>
    <div class="band">Post in waste accumulation / storage area · Keep visible at all times</div>

    <div class="sec">
      <h2>Hazards Present at This Site</h2>
      <ul>${hazardItems}</ul>
    </div>

    <div class="sec">
      <h2>In Case of Spill / Release</h2>
      <ol>
        <li>Evacuate the immediate area and alert nearby personnel.</li>
        <li>Stop the source and contain the release — ONLY if it is safe to do so.</li>
        <li>Use the spill kit and appropriate PPE to absorb / dike the material.</li>
        <li>Notify the Emergency Coordinator immediately.</li>
        <li>For any fire, explosion, or personal injury, call <strong>911</strong>.</li>
        <li>For a reportable release, notify the National Response Center.</li>
      </ol>
      <div class="rnc">National Response Center: 1-800-424-8802</div>
    </div>

    <div class="sec">
      <h2>Emergency Contacts</h2>
      <div class="contacts">
        <div class="field"><span class="k">Emergency Coordinator</span>${coordLine ? `<span style="border-bottom:1px solid #000;min-width:180px;display:inline-block;padding:0 6px;font-weight:700;">${coordLine}</span>` : `<span class="blank"></span>`}</div>
        <div class="field"><span class="k">Facility Phone</span>${phoneLine ? `<span style="border-bottom:1px solid #000;min-width:180px;display:inline-block;padding:0 6px;font-weight:700;">${phoneLine}</span>` : `<span class="blank"></span>`}</div>
      </div>
    </div>

    <div class="footer">SafetyIQ · Posted per 40 CFR 262 Subpart M / 265 Subpart C</div>
  </div>
  <div class="noprint"><button onclick="window.print()">Print this poster</button></div>
</body></html>`;
  }

  function handleGeneratePoster() {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) {
      // Popup blocked — fall back to downloading the poster as an HTML file.
      const blob = new Blob([buildPosterHtml()], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "emergency-response-poster.html";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    w.document.write(buildPosterHtml());
    w.document.close();
  }

  return (
    <div className="space-y-5">
      {/* 1) Compliance Calendar — real obligations derived from props */}
      <Card>
        <CardHeader
          title="Compliance Calendar"
          subtitle="Upcoming & overdue obligations derived from live data"
          right={
            <WasteCalendarExportButton
              streams={streams}
              pickups={pickups}
              vendors={vendors}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/50"
              label="Export (iCal)"
            />
          }
        />
        <div className="px-4 py-3">
          {obligations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
              No dated obligations on record. Scheduled pickups, vendor permit expiries, inspection due
              dates, and disposal targets will appear here as they are entered.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {obligations.map((o) => {
                const d = daysUntil(o.date);
                const overdue = d <= 0;
                const soon = d > 0 && d <= 30;
                const dotColor = overdue ? "#dc2626" : soon ? "#f59e0b" : "#3b82f6";
                const hint = overdue
                  ? d === 0
                    ? "Due today"
                    : `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`
                  : `in ${d} day${d === 1 ? "" : "s"}`;
                return (
                  <li key={o.key} className="flex items-center gap-3 py-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: dotColor }}
                      aria-hidden
                    />
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_STYLE[o.type]}`}
                    >
                      {o.type}
                    </span>
                    <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                      {o.label}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {fmtDate(o.date)}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        overdue ? "text-red-600" : soon ? "text-amber-600" : "text-slate-400"
                      }`}
                    >
                      {hint}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Derived from live pickups, vendor permits, inspections, and disposal targets. Dates reflect
            the records currently in this tenant.
          </p>
        </div>
      </Card>

      {/* 2) Emergency Response Poster */}
      <Card>
        <CardHeader
          title="Emergency Response Poster"
          subtitle="Printable RCRA contingency poster for the waste storage area"
        />
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Generates a printable emergency-response poster listing the hazard classifications actually
              present in your waste streams, the standard spill / release response steps, and the National
              Response Center number. Emergency Coordinator and facility phone are pre-filled from Company
              Settings when available, otherwise left blank to complete on site.
            </div>
          </div>
          <button
            type="button"
            onClick={handleGeneratePoster}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            title="Open a printable emergency-response poster"
          >
            <AlertTriangle className="h-4 w-4" />
            Generate Emergency Poster
          </button>
        </div>
      </Card>

      {/* 3) Regulatory Reference — static citations */}
      <Card>
        <CardHeader
          title="Regulatory Reference — Static"
          subtitle="Standard citations and minimum retention periods (reference, not tenant status)"
          right={
            <Pill className="bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              <FileText className="h-3 w-3" /> Reference
            </Pill>
          }
        />
        <div className="grid gap-6 px-4 py-4 lg:grid-cols-2">
          {/* Legal Register */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Legal Register
            </h4>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400 dark:border-slate-700">
                  <th className="py-1.5 pr-3 font-semibold">Authority</th>
                  <th className="py-1.5 pr-3 font-semibold">Obligation</th>
                  <th className="py-1.5 font-semibold">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {LEGAL_REGISTER.map((r) => (
                  <tr key={r.authority} className="align-top">
                    <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">
                      {r.authority}
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{r.obligation}</td>
                    <td className="py-2">
                      <Pill className="bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        {r.category}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Document Retention */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Document Retention
            </h4>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400 dark:border-slate-700">
                  <th className="py-1.5 pr-3 font-semibold">Document</th>
                  <th className="py-1.5 pr-3 font-semibold">Min. Period</th>
                  <th className="py-1.5 font-semibold">Authority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {RETENTION_SCHEDULE.map((r) => (
                  <tr key={r.document} className="align-top">
                    <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">
                      {r.document}
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{r.period}</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{r.authority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Minimum retention — do not delete records before the listed period elapses.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

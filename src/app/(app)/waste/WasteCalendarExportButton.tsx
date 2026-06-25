"use client";

import { Calendar } from "lucide-react";
import type { WasteStream, WastePickup, WasteVendor } from "@/lib/types";

// Builds a standard iCalendar (.ics) file from real waste disposal dates and
// scheduled pickups, so users can import deadlines into Outlook / Google / Apple
// Calendar. Pure client-side — no server or DB involvement.

interface Props {
  streams: WasteStream[];
  pickups: WastePickup[];
  vendors: WasteVendor[];
  label?: string;
  className?: string;
}

// Fold/escape text per RFC 5545.
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// "2026-07-15" or ISO timestamp → "20260715" (all-day DATE value).
function toICSDate(d: string): string | null {
  const day = d.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return day.replace(/-/g, "");
}

function nextDay(yyyymmdd: string): string {
  const y = +yyyymmdd.slice(0, 4);
  const m = +yyyymmdd.slice(4, 6);
  const d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return (
    dt.getUTCFullYear().toString().padStart(4, "0") +
    (dt.getUTCMonth() + 1).toString().padStart(2, "0") +
    dt.getUTCDate().toString().padStart(2, "0")
  );
}

function buildEvent(opts: { uid: string; date: string; summary: string; description: string }): string[] {
  const end = nextDay(opts.date);
  return [
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTART;VALUE=DATE:${opts.date}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeICS(opts.summary)}`,
    `DESCRIPTION:${escapeICS(opts.description)}`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

export function WasteCalendarExportButton({ streams, pickups, vendors, label = "Export Calendar (iCal)", className }: Props) {
  function handleExport() {
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SafetyIQ//Waste Management//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:SafetyIQ Waste Schedule",
    ];

    let count = 0;

    // Scheduled / pending pickups
    for (const p of pickups) {
      if (!p.scheduled_date) continue;
      const date = toICSDate(p.scheduled_date);
      if (!date) continue;
      const vendor = vendors.find((v) => v.id === p.vendor_id)?.name ?? "Vendor TBD";
      const manifest = p.manifest_number ? ` · Manifest ${p.manifest_number}` : "";
      lines.push(
        ...buildEvent({
          uid: `pickup-${p.id}@safetyiq`,
          date,
          summary: `Waste Pickup — ${vendor}`,
          description: `Scheduled hazardous-waste pickup with ${vendor}.${manifest}` +
            (p.quantity != null ? ` Quantity: ${p.quantity} ${p.unit ?? ""}.` : "") +
            ` Status: ${p.status.replace(/_/g, " ")}.`,
        })
      );
      count++;
    }

    // Waste stream disposal target dates
    for (const s of streams) {
      if (!s.disposal_date) continue;
      const date = toICSDate(s.disposal_date);
      if (!date) continue;
      lines.push(
        ...buildEvent({
          uid: `stream-${s.id}@safetyiq`,
          date,
          summary: `Waste Disposal — ${s.waste_name}`,
          description: `${s.classification.replace(/_/g, " ")} waste` +
            (s.waste_code ? ` (${s.waste_code})` : "") +
            ` scheduled for ${s.disposal_method.replace(/_/g, " ")}.` +
            (s.disposal_contractor ? ` Contractor: ${s.disposal_contractor}.` : "") +
            (s.manifest_number ? ` Manifest: ${s.manifest_number}.` : ""),
        })
      );
      count++;
    }

    lines.push("END:VCALENDAR");

    // Even with zero dated records this produces a valid (empty) calendar,
    // so the action always gives the user a file rather than a silent no-op.
    void count;

    const ics = lines.join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "safetyiq-waste-schedule.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={handleExport} className={className} title="Download disposal dates and pickups as a calendar file">
      <Calendar className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

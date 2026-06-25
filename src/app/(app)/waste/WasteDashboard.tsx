"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FlaskConical,
  Calendar,
  FileText,
  Clock,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  Zap,
  Truck,
  CheckCircle2,
  PhoneCall,
  ClipboardCheck,
  Tag,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import type {
  WasteStream,
  Chemical,
  WasteVendor,
  WastePickup,
  WasteInspection as LiveWasteInspection,
  WasteProfile,
} from "@/lib/types";
import { WasteProfilePipeline } from "./WasteProfilePipeline";
import { WasteLabelButton } from "./WasteLabelButton";
import { WasteCalendarExportButton } from "./WasteCalendarExportButton";
import { WasteLabelsTab } from "./WasteLabelsTab";
import { WasteComplianceTab } from "./WasteComplianceTab";
import { WasteReportsTab } from "./WasteReportsTab";
import { Card, CardHeader, Pill, Stat } from "@/components/ui/primitives";
import {
  addWasteVendor,
  updateWasteVendor,
  scheduleWastePickup,
  updateWastePickup,
  logWasteInspection,
} from "@/lib/actions/ehs";
import { Modal, Field, Input, Select, Textarea, SubmitRow } from "@/components/modals/Modal";
import { playCreateSound } from "@/lib/sounds";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "register" | "accumulation" | "schedule" | "manifests" | "vendors" | "inspections" | "compliance" | "labels" | "reports";

interface WasteSuggestion {
  chemicalId: string;
  chemicalName: string;
  classification: string;
  reason: string;
  disposalMethod: string;
  epaCode: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WASTE_STATUS_STYLE: Record<string, string> = {
  pending:        "bg-amber-100 text-amber-700",
  pending_pickup: "bg-amber-100 text-amber-700",
  accumulating:   "bg-blue-100 text-blue-700",
  manifested:     "bg-blue-100 text-blue-700",
  disposed:       "bg-emerald-100 text-emerald-700",
  reported:       "bg-slate-100 text-slate-600",
};

const CLASS_STYLE: Record<string, string> = {
  hazardous:    "bg-red-100 text-red-700",
  non_hazardous:"bg-emerald-100 text-emerald-700",
  clinical:     "bg-orange-100 text-orange-700",
  radioactive:  "bg-purple-100 text-purple-700",
  scheduled:    "bg-red-100 text-red-700",
  recyclable:   "bg-blue-100 text-blue-700",
  general:      "bg-slate-100 text-slate-600",
};

// Every tab is backed by the tenant's real data (waste_streams, waste_vendors,
// waste_pickups, waste_inspections, waste_profiles). No mock/sample data.
const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "register",     label: "Waste Register",        Icon: FlaskConical },
  { id: "accumulation", label: "Accumulation Tracker",  Icon: Clock },
  { id: "schedule",     label: "Pickup Schedule",       Icon: Calendar },
  { id: "vendors",      label: "Vendors / TSDF",        Icon: Truck },
  { id: "manifests",    label: "Pickups / Manifests",   Icon: FileText },
  { id: "labels",       label: "Labels / Containers",   Icon: Tag },
  { id: "inspections",  label: "Inspections",           Icon: ClipboardCheck },
  { id: "compliance",   label: "Compliance & Emergency",Icon: ShieldAlert },
  { id: "reports",      label: "Reports / Exports",     Icon: BarChart3 },
];


const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function suggestWaste(c: Chemical): WasteSuggestion | null {
  const h = c.hazard_statements;
  if (h.some((x) => /^H2[0-6]|^H27/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Flammable / Explosive", disposalMethod: "incineration", epaCode: "D001" };
  if (h.some((x) => /^H(30[0-2]|31[0-2]|33[0-2])/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Acute Toxic", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(350|351)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Carcinogenic", disposalMethod: "incineration", epaCode: "D012" };
  if (h.some((x) => /^H(360|361)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Reproductive Hazard", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(370|371|372|373)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Target Organ Toxin", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(290|314|315)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Corrosive", disposalMethod: "neutralization", epaCode: "D002" };
  if (h.some((x) => /^H4/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Aquatic Toxic", disposalMethod: "treatment", epaCode: "D012" };
  if (c.is_scheduled)
    return { chemicalId: c.id, chemicalName: c.name, classification: "scheduled", reason: "Scheduled substance", disposalMethod: "treatment", epaCode: "—" };
  return null;
}

// ── Accumulation Tracker ──────────────────────────────────────────────────────

function AccumulationTracker({ streams }: { streams: WasteStream[] }) {
  const LIMIT_DAYS = 90;
  const now = useMemo(() => new Date(), []);

  const active = streams.filter((s) => s.status !== "disposed" && s.status !== "reported");

  const items = useMemo(
    () =>
      active.map((s) => {
        const start = new Date(s.created_at);
        const daysAccum = Math.max(0, daysBetween(start, now));
        const daysLeft  = Math.max(0, LIMIT_DAYS - daysAccum);
        const pct       = Math.min(100, (daysAccum / LIMIT_DAYS) * 100);
        const urgent    = daysLeft <= 14;
        const warning   = daysLeft > 14 && daysLeft <= 30;
        const dotColor  = urgent ? "#dc2626" : warning ? "#f59e0b" : "#10b981";
        const barClass  = urgent ? "bg-red-500" : warning ? "bg-amber-500" : "bg-emerald-500";
        const limitDate = new Date(start);
        limitDate.setDate(limitDate.getDate() + LIMIT_DAYS);
        return { ...s, daysAccum, daysLeft, pct, urgent, warning, dotColor, barClass, limitDate };
      }),
    [active, now],
  );

  const urgentCount = items.filter((i) => i.urgent).length;

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
        No active waste streams to track — all streams are disposed or reported.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {urgentCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <div className="text-sm font-semibold text-red-900">
              {urgentCount} stream{urgentCount > 1 ? "s" : ""} approaching the 90-day EPA accumulation limit
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              SQG facilities must arrange disposal before the accumulation limit expires. Contact your waste contractor immediately.
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          title="Satellite Accumulation Areas"
          subtitle={`${active.length} active stream${active.length !== 1 ? "s" : ""} · EPA 90-day SQG accumulation limit`}
        />
        <div className="flex flex-col divide-y divide-slate-50">
          {items.map((item) => (
            <div key={item.id} className="px-5 py-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/waste/${item.id}`}
                    className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:underline"
                  >
                    {item.waste_name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Pill className={CLASS_STYLE[item.classification] ?? "bg-slate-100 text-slate-600"}>
                      {item.classification.replace(/_/g, " ")}
                    </Pill>
                    <Pill className={WASTE_STATUS_STYLE[item.status] ?? "bg-slate-100 text-slate-600"}>
                      {item.status.replace(/_/g, " ")}
                    </Pill>
                    {item.waste_code && (
                      <span className="text-[11px] font-mono text-slate-400">{item.waste_code}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold tabular-nums" style={{ color: item.dotColor }}>
                    {item.daysLeft}
                  </div>
                  <div className="text-[11px] text-slate-400">days left</div>
                </div>
              </div>

              <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${item.barClass}`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Started: {fmt(item.created_at)}</span>
                <span>
                  {item.daysAccum} / {LIMIT_DAYS} days · Limit:{" "}
                  {item.limitDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>

              <div className="mt-1 text-[11px] text-slate-400">
                {item.quantity} {item.unit} · {item.disposal_contractor ?? "No contractor assigned"}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[11px] text-slate-400">
          EPA 40 CFR Part 262 — SQG: 90-day limit · LQG: 90-day limit · VSQG: No time limit · Ref: 40 CFR §262.16(b)(1)
        </div>
      </Card>
    </div>
  );
}

// ── Pickup Schedule ───────────────────────────────────────────────────────────

function PickupSchedule({ streams }: { streams: WasteStream[] }) {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  type CalEvent = { name: string; type: "disposal" | "limit"; color: string };

  const eventsByDay = useMemo<Record<number, CalEvent[]>>(() => {
    const map: Record<number, CalEvent[]> = {};
    for (const s of streams) {
      if (s.disposal_date) {
        const d = new Date(s.disposal_date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push({
            name: s.waste_name,
            type: "disposal",
            color: s.status === "disposed" ? "#10b981" : "#3b82f6",
          });
        }
      }
      if (s.status !== "disposed" && s.status !== "reported") {
        const start = new Date(s.created_at);
        const limitDate = new Date(start);
        limitDate.setDate(limitDate.getDate() + 90);
        if (limitDate.getFullYear() === year && limitDate.getMonth() === month) {
          const day = limitDate.getDate();
          if (!map[day]) map[day] = [];
          map[day].push({ name: s.waste_name + " — 90d limit", type: "limit", color: "#dc2626" });
        }
      }
    }
    return map;
  }, [streams, year, month]);

  const upcomingPickups = useMemo(
    () =>
      streams
        .filter((s) => s.disposal_date && new Date(s.disposal_date) >= today)
        .sort((a, b) => new Date(a.disposal_date!).getTime() - new Date(b.disposal_date!).getTime())
        .slice(0, 5),
    [streams, today],
  );

  const unscheduled = streams.filter((s) => !s.disposal_date && s.status !== "disposed" && s.status !== "reported");

  const blanks = Array(firstDay).fill(null);
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Calendar */}
      <div className="lg:col-span-2">
        <Card>
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="font-semibold text-slate-800">
              {MONTH_NAMES[month]} {year}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 px-3 pb-3">
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {blanks.map((_, i) => (
                <div key={`b-${i}`} />
              ))}
              {days.map((day) => {
                const events = eventsByDay[day] || [];
                const isToday =
                  today.getDate() === day &&
                  today.getMonth() === month &&
                  today.getFullYear() === year;
                return (
                  <div
                    key={day}
                    className={`min-h-[56px] rounded-lg p-1.5 ${
                      isToday
                        ? "bg-blue-50 ring-1 ring-blue-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        isToday ? "text-blue-700" : "text-slate-600"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {events.slice(0, 2).map((ev, i) => (
                        <div
                          key={i}
                          className="truncate rounded px-1 py-0.5 text-[9px] leading-tight text-white"
                          style={{ backgroundColor: ev.color }}
                          title={ev.name}
                        >
                          {ev.name.length > 14 ? ev.name.slice(0, 14) + "…" : ev.name}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-[9px] text-slate-400">+{events.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-slate-50 bg-slate-50/50 px-5 py-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "#3b82f6" }} />
              <span className="text-slate-500">Scheduled pickup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "#10b981" }} />
              <span className="text-slate-500">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "#dc2626" }} />
              <span className="text-slate-500">90-day limit</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Upcoming Pickups" subtitle="Scheduled disposal dates" />
          <div className="flex flex-col divide-y divide-slate-50">
            {upcomingPickups.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-slate-400">
                No upcoming pickups scheduled
              </div>
            ) : (
              upcomingPickups.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">{s.waste_name}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">{s.disposal_contractor ?? "—"}</span>
                    <span className="text-xs font-medium text-blue-700">{fmt(s.disposal_date)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Unscheduled Streams" subtitle="No disposal date set" />
          <div className="flex flex-col divide-y divide-slate-50">
            {unscheduled.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-slate-400">
                All active streams have scheduled dates
              </div>
            ) : (
              unscheduled.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{s.waste_name}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {s.quantity} {s.unit} · {s.disposal_contractor ?? "No contractor"}
                    </div>
                  </div>
                  <Pill className={WASTE_STATUS_STYLE[s.status] ?? "bg-slate-100 text-slate-600"}>
                    {s.status.replace(/_/g, " ")}
                  </Pill>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Manifest Archive ──────────────────────────────────────────────────────────

type ManifestFilter = "all" | "manifested" | "disposed" | "pending";

function ManifestArchive({ streams }: { streams: WasteStream[] }) {
  const [filter, setFilter] = useState<ManifestFilter>("all");

  const filtered = filter === "all" ? streams : streams.filter((s) => s.status === filter);
  const manifestedCount = streams.filter((s) => s.manifest_number).length;
  const disposedCount   = streams.filter((s) => s.status === "disposed").length;

  const FILTER_OPTIONS: { id: ManifestFilter; label: string }[] = [
    { id: "all",        label: "All" },
    { id: "manifested", label: "Manifested" },
    { id: "disposed",   label: "Disposed" },
    { id: "pending",    label: "Pending" },
  ];

  function handleDownload(stream: WasteStream) {
    const content = [
      "HAZARDOUS WASTE MANIFEST",
      "",
      `Manifest #:       ${stream.manifest_number ?? "NOT YET ASSIGNED"}`,
      `Waste Name:       ${stream.waste_name}`,
      `Waste Code:       ${stream.waste_code ?? "—"}`,
      `Classification:   ${stream.classification}`,
      `Quantity:         ${stream.quantity} ${stream.unit}`,
      `Disposal Method:  ${stream.disposal_method}`,
      `Contractor:       ${stream.disposal_contractor ?? "—"}`,
      `Disposal Date:    ${stream.disposal_date ?? "Not scheduled"}`,
      `Status:           ${stream.status}`,
      "",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `manifest-${(stream.manifest_number ?? stream.id).replace(/[^a-zA-Z0-9-]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Filter:</span>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === opt.id
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Manifest Archive"
          subtitle={`${manifestedCount} manifested · ${disposedCount} disposed · Full regulatory audit trail`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 text-left">Waste Stream</th>
                <th className="px-4 py-2.5 text-left">Manifest #</th>
                <th className="px-4 py-2.5 text-left">Classification</th>
                <th className="px-4 py-2.5 text-left">Qty</th>
                <th className="px-4 py-2.5 text-left">Contractor</th>
                <th className="px-4 py-2.5 text-left">Disposal Date</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Manifest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/waste/${s.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {s.waste_name}
                    </Link>
                    {s.waste_code && (
                      <div className="mt-0.5 text-xs font-mono text-slate-400">{s.waste_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">
                    {s.manifest_number ?? (
                      <span className="text-slate-300 italic">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill className={CLASS_STYLE[s.classification] ?? "bg-slate-100 text-slate-600"}>
                      {s.classification.replace(/_/g, " ")}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                    {s.quantity} {s.unit}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.disposal_contractor ?? "—"}</td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                    {fmt(s.disposal_date)}
                  </td>
                  <td className="px-4 py-3">
                    <Pill className={WASTE_STATUS_STYLE[s.status] ?? "bg-slate-100 text-slate-600"}>
                      {s.status.replace(/_/g, " ")}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDownload(s)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      {s.manifest_number ? "Download" : "Draft"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    No streams match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


// ── Live vendor / pickup / inspection workflow primitives ─────────────────────
// Backed by waste_vendors / waste_pickups / waste_inspections via real actions.

const VENDOR_STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  pending:  "bg-amber-100 text-amber-700",
  review:   "bg-amber-100 text-amber-700",
  inactive: "bg-slate-100 text-slate-500",
  expired:  "bg-red-100 text-red-700",
};

const PICKUP_STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Add / Edit Vendor modal → addWasteVendor / updateWasteVendor
function VendorFormButton({
  mode,
  vendor,
  label,
  className,
}: {
  mode: "add" | "edit";
  vendor?: WasteVendor;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res =
      mode === "edit" && vendor
        ? await updateWasteVendor(vendor.id, fd)
        : await addWasteVendor(null, fd);
    if (res.ok) {
      playCreateSound();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Could not save vendor.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={mode === "edit" ? `Edit Vendor — ${vendor?.name ?? ""}` : "Add Waste Vendor / TSDF"}>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <Field label="Vendor Name" required>
              <Input name="name" defaultValue={vendor?.name ?? ""} required placeholder="Clean Harbors" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="EPA ID">
                <Input name="epa_id" defaultValue={vendor?.epa_id ?? ""} placeholder="NJD000000000" />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={vendor?.status ?? "active"}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="review">Under Review</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Name">
                <Input name="contact_name" defaultValue={vendor?.contact_name ?? ""} placeholder="Account manager" />
              </Field>
              <Field label="Phone">
                <Input name="phone" defaultValue={vendor?.phone ?? ""} placeholder="(800) 000-0000" />
              </Field>
            </div>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={vendor?.email ?? ""} placeholder="scheduling@vendor.com" />
            </Field>
            <Field label="Services (comma-separated)">
              <Input name="services" defaultValue={(vendor?.services ?? []).join(", ")} placeholder="Hazardous disposal, Transport, TSDF" />
            </Field>
            <Field label="Permit Expiry">
              <Input name="permit_expiry" type="date" defaultValue={vendor?.permit_expiry ? vendor.permit_expiry.slice(0, 10) : ""} />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" defaultValue={vendor?.notes ?? ""} placeholder="Restrictions, scope, certifications…" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

// Schedule Pickup modal → scheduleWastePickup
function SchedulePickupButton({
  vendors,
  streams,
  label,
  className,
  prefillVendorId,
}: {
  vendors: WasteVendor[];
  streams: WasteStream[];
  label: string;
  className?: string;
  prefillVendorId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await scheduleWastePickup(null, new FormData(e.currentTarget));
    if (res.ok) {
      playCreateSound();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Could not schedule pickup.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule Waste Pickup">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <Field label="Vendor" required>
              <Select name="vendor_id" defaultValue={prefillVendorId ?? ""} required>
                <option value="" disabled>Select a vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Waste Stream">
              <Select name="waste_stream_id" defaultValue="">
                <option value="">— Not specified —</option>
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.waste_name}{s.waste_code ? ` (${s.waste_code})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Manifest #">
                <Input name="manifest_number" placeholder="NJ-2026-000000" />
              </Field>
              <Field label="Scheduled Date" required>
                <Input name="scheduled_date" type="date" defaultValue={todayISO()} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantity">
                <Input name="quantity" type="number" step="any" min="0" placeholder="0" />
              </Field>
              <Field label="Unit">
                <Select name="unit" defaultValue="kg">
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                  <option value="L">L</option>
                  <option value="gal">gal</option>
                  <option value="drums">drums</option>
                </Select>
              </Field>
            </div>
            <Field label="Status">
              <Select name="status" defaultValue="requested">
                <option value="requested">Requested</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea name="notes" placeholder="Pickup window, access instructions…" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

// Per-pickup "Mark Complete" → updateWastePickup(id, {status:"completed", completed_date: today})
function MarkPickupCompleteButton({ pickup }: { pickup: WastePickup }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("status", "completed");
    fd.set("completed_date", todayISO());
    fd.set("manifest_number", pickup.manifest_number ?? "");
    fd.set("scheduled_date", pickup.scheduled_date ?? "");
    if (pickup.quantity != null) fd.set("quantity", String(pickup.quantity));
    fd.set("unit", pickup.unit ?? "kg");
    fd.set("notes", pickup.notes ?? "");
    const res = await updateWastePickup(pickup.id, fd);
    if (res.ok) {
      playCreateSound();
      router.refresh();
    } else {
      setError(res.error ?? "Could not update pickup.");
    }
    setPending(false);
  }

  if (pickup.status === "completed") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark Complete"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}

// Log Inspection modal → logWasteInspection
function LogInspectionButton({
  label,
  className,
  prefillArea,
}: {
  label: string;
  className?: string;
  prefillArea?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await logWasteInspection(null, new FormData(e.currentTarget));
    if (res.ok) {
      playCreateSound();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Could not log inspection.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Log SAA / CAA Inspection">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <Field label="Area" required>
              <Input name="area" defaultValue={prefillArea ?? ""} required placeholder="Chemical SAA — Lab A" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Inspection Date" required>
                <Input name="inspection_date" type="date" defaultValue={todayISO()} required />
              </Field>
              <Field label="Inspector">
                <Input name="inspector" placeholder="Inspector name" />
              </Field>
            </div>
            <Field label="Result">
              <Select name="passed" defaultValue="true">
                <option value="true">Pass</option>
                <option value="false">Fail — findings noted</option>
              </Select>
            </Field>
            <Field label="Findings">
              <Textarea name="findings" placeholder="Deficiencies, CAPA notes, observations…" />
            </Field>
            <Field label="Next Due">
              <Input name="next_due" type="date" />
            </Field>
          </div>
          <SubmitRow onClose={() => setOpen(false)} submitting={pending} />
        </form>
      </Modal>
    </>
  );
}

// ── WasteDashboard (main export) ──────────────────────────────────────────────

export function WasteDashboard({
  streams,
  chemicals,
  vendors,
  pickups,
  inspections,
  profiles,
}: {
  streams: WasteStream[];
  chemicals: Chemical[];
  vendors: WasteVendor[];
  pickups: WastePickup[];
  inspections: LiveWasteInspection[];
  profiles: WasteProfile[];
}) {
  const [tab, setTab] = useState<Tab>("register");

  const pending    = streams.filter((w) => w.status === "pending" || w.status === "pending_pickup").length;
  const manifested = streams.filter((w) => w.status === "manifested").length;
  const hazardous  = streams.filter((w) => w.classification === "hazardous" || w.classification === "clinical").length;

  // Readiness score derived entirely from live signals (no mock data).
  const nowMs = Date.now();
  const DAY = 86400000;
  const failedInsp     = inspections.filter((i) => i.passed === false).length;
  const overdueInsp    = inspections.filter((i) => i.next_due && new Date(i.next_due).getTime() < nowMs).length;
  const expiringPerms  = vendors.filter((v) => v.permit_expiry && Math.ceil((new Date(v.permit_expiry).getTime() - nowMs) / DAY) <= 30).length;
  const streamsNoCode  = streams.filter((s) => !s.waste_code && s.status !== "disposed").length;
  const inspectionIssues = failedInsp + overdueInsp;
  const readinessScore = Math.max(0, 100 - failedInsp * 10 - overdueInsp * 8 - expiringPerms * 6 - streamsNoCode * 4 - (pending > 0 ? 5 : 0));
  const readinessColor = readinessScore >= 80 ? "#10b981" : readinessScore >= 60 ? "#f59e0b" : "#dc2626";

  const trackedNames = new Set(streams.map((w) => w.waste_name.toLowerCase()));
  const suggestions: WasteSuggestion[] = [];
  for (const chem of chemicals) {
    if (chem.status !== "active") continue;
    const s = suggestWaste(chem);
    if (s && !trackedNames.has(chem.name.toLowerCase())) suggestions.push(s);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Readiness Score"   value={`${readinessScore}%`} hint="Live waste compliance score" accent={readinessColor} />
        <Stat label="Waste Streams"     value={streams.length}       hint="Tracked streams" />
        <Stat label="Hazardous"         value={hazardous}            hint="Haz + clinical"    accent={hazardous > 0 ? "#dc2626" : "#10b981"} />
        <Stat label="Pending Pickup"    value={pending}              hint="Awaiting disposal" accent={pending > 0 ? "#f59e0b" : "#10b981"} />
        <Stat label="Inspection Issues" value={inspectionIssues}     hint="Failed + overdue"  accent={inspectionIssues > 0 ? "#f59e0b" : "#10b981"} />
      </div>

      {/* Pending alert */}
      {pending > 0 && (
        <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">
            {pending} Waste Stream{pending > 1 ? "s" : ""} Pending Pickup — Review Accumulation Limits
          </div>
          <div className="mt-0.5 text-xs text-amber-700">
            Ensure accumulation start dates and EPA 90/270-day limits are tracked. Contact disposal contractor.
          </div>
        </div>
      )}

      {/* Daily Action List — derived entirely from live waste data */}
      {(() => {
        const actions: { priority: string; type: string; label: string; targetTab: Tab }[] = [];
        const dayMs = 86400000;
        // Streams missing a waste code can't have a compliant label/profile.
        streams.filter((s) => !s.waste_code && s.status !== "disposed").forEach((s) => {
          actions.push({ priority: "medium", type: "Label", label: `${s.waste_name} has no EPA/waste code — label & profile incomplete`, targetTab: "labels" });
        });
        // Profiles waiting on EHS review.
        profiles.filter((p) => p.state === "ehs_review").forEach((p) => {
          actions.push({ priority: "high", type: "Profile", label: `${p.name} awaiting EHS review approval`, targetTab: "register" });
        });
        // Vendor / TSDF permits expiring within 90 days (or expired).
        vendors.forEach((v) => {
          if (!v.permit_expiry) return;
          const diff = Math.ceil((new Date(v.permit_expiry).getTime() - Date.now()) / dayMs);
          if (diff <= 90) actions.push({ priority: diff <= 30 ? "high" : "medium", type: "Vendor", label: `${v.name} TSDF permit ${diff <= 0 ? "expired" : `expires ${fmt(v.permit_expiry)}`} — re-qualification required`, targetTab: "vendors" });
        });
        // Inspections past their next-due date.
        inspections.forEach((ins) => {
          if (!ins.next_due) return;
          const diff = Math.ceil((new Date(ins.next_due).getTime() - Date.now()) / dayMs);
          if (diff <= 0) actions.push({ priority: "high", type: "Inspection", label: `${ins.area ?? "Site"} inspection overdue (due ${fmt(ins.next_due)})`, targetTab: "inspections" });
        });
        // Pending pickups that need scheduling.
        if (pending > 0) actions.push({ priority: "medium", type: "Pickup", label: `${pending} stream${pending > 1 ? "s" : ""} pending pickup — schedule with a vendor`, targetTab: "manifests" });
        if (actions.length === 0) return null;
        return (
          <Card>
            <CardHeader
              title="Daily Action List"
              subtitle={`${actions.length} item${actions.length !== 1 ? "s" : ""} requiring attention — BL-WMP-01 Command Center`}
            />
            <div className="divide-y divide-slate-50">
              {actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTab(a.targetTab)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    a.priority === "critical" ? "bg-red-500" :
                    a.priority === "high"     ? "bg-amber-500" : "bg-blue-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className={`mr-2 text-[10px] font-bold uppercase tracking-wide ${
                      a.priority === "critical" ? "text-red-600" :
                      a.priority === "high"     ? "text-amber-600" : "text-blue-600"
                    }`}>{a.type}</span>
                    <span className="text-xs text-slate-700">{a.label}</span>
                  </div>
                  <span className="shrink-0 mt-0.5 text-[10px] font-medium text-blue-500">→ {a.targetTab}</span>
                </button>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Tab navigation */}
      <div className="overflow-x-auto rounded-xl bg-slate-100 p-1">
        <div className="flex min-w-max gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "register" && (
        <div className="flex flex-col gap-4">
          {suggestions.length > 0 && (
            <Card>
              <CardHeader
                title="Inventory-Derived Waste Profiles"
                subtitle={`${suggestions.length} chemical${suggestions.length !== 1 ? "s" : ""} suggest waste streams not yet recorded — create entries to close the gap`}
                right={
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    <Zap className="h-3 w-3" />
                    Inventory-driven
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 text-left">Chemical</th>
                      <th className="px-4 py-2.5 text-left">Hazard Basis</th>
                      <th className="px-4 py-2.5 text-left">Suggested Classification</th>
                      <th className="px-4 py-2.5 text-left">Disposal Method</th>
                      <th className="px-4 py-2.5 text-left">EPA Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {suggestions.map((s) => (
                      <tr key={s.chemicalId} className="hover:bg-amber-50/30">
                        <td className="px-4 py-3 font-medium text-slate-800">{s.chemicalName}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{s.reason}</td>
                        <td className="px-4 py-3">
                          <Pill className={CLASS_STYLE[s.classification] ?? "bg-slate-100 text-slate-600"}>
                            {s.classification.replace(/_/g, " ")}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-xs capitalize text-slate-600">
                          {s.disposalMethod.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500">{s.epaCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Waste Profile Review Pipeline — backed by the real waste_profiles table */}
          <WasteProfilePipeline profiles={profiles} streams={streams} />

          <Card>
            <CardHeader
              title="Waste Stream Register"
              subtitle={`${streams.length} streams · ${hazardous} hazardous · ${manifested} manifested`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Waste Name</th>
                    <th className="px-4 py-2.5 text-left">Code</th>
                    <th className="px-4 py-2.5 text-left">Classification</th>
                    <th className="px-4 py-2.5 text-left">Profile State</th>
                    <th className="px-4 py-2.5 text-left">Quantity</th>
                    <th className="px-4 py-2.5 text-left">Disposal Method</th>
                    <th className="px-4 py-2.5 text-left">Contractor</th>
                    <th className="px-4 py-2.5 text-left">Disposal Date</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {streams.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Link href={`/waste/${w.id}`} className="font-medium text-blue-700 hover:underline">
                                {w.waste_name}
                              </Link>
                              <WasteLabelButton
                                stream={w}
                                label="Label"
                                className="ml-1 inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
                              />
                            </div>
                            {w.manifest_number && (
                              <div className="ml-4 mt-0.5 text-xs font-mono text-slate-400">
                                {w.manifest_number}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">
                            {w.waste_code ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Pill className={CLASS_STYLE[w.classification] ?? "bg-slate-100 text-slate-600"}>
                              {w.classification.replace(/_/g, " ")}
                            </Pill>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const ps = w.status === "disposed" || w.status === "reported" ? "approved" :
                                         w.status === "manifested" ? "active" : "active";
                              return (
                                <Pill className={
                                  ps === "approved" ? "bg-emerald-100 text-emerald-700" :
                                  ps === "active"   ? "bg-blue-100 text-blue-700"       :
                                                      "bg-amber-100 text-amber-700"
                                }>
                                  {ps === "approved" ? "Approved" : ps === "active" ? "Active" : "Draft"}
                                </Pill>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                            {w.quantity} {w.unit}
                          </td>
                          <td className="px-4 py-3 text-xs capitalize text-slate-600">
                            {w.disposal_method.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {w.disposal_contractor ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                            {fmt(w.disposal_date)}
                          </td>
                          <td className="px-4 py-3">
                            <Pill className={WASTE_STATUS_STYLE[w.status] ?? "bg-slate-100 text-slate-600"}>
                              {w.status}
                            </Pill>
                          </td>
                        </tr>
                  ))}
                  {streams.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                        No waste streams recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}

      {/* ── Inspections tab ── */}
      {tab === "inspections" && (
        <div className="space-y-5">
          {/* Summary KPIs — live SAA/CAA inspection records */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total Inspections" value={inspections.length} hint="All areas" />
            <Stat label="Passed"  value={inspections.filter(i => i.passed === true).length}  hint="Fully compliant" accent="#10b981" />
            <Stat label="Failed"  value={inspections.filter(i => i.passed === false).length} hint="Findings noted"  accent="#dc2626" />
            <Stat label="Logged 30d" value={inspections.filter(i => i.inspection_date && (Date.now() - new Date(i.inspection_date).getTime()) <= 30 * 86400000).length} hint="Recent activity" />
          </div>

          {/* Blueprint info + Log Inspection */}
          <div className="flex items-start justify-between gap-4 rounded-xl border-l-4 border-violet-500 bg-violet-50 p-4">
            <div className="text-xs text-violet-800">
              <div className="font-semibold text-sm text-violet-900 mb-1">BL-WMP-09 Inspection &amp; Audit App</div>
              SAA/CAA inspections record area, date, inspector, pass/fail result, findings, and the next due date.
              Failed inspections should be followed by a CAPA in the CAPA module.
            </div>
            <LogInspectionButton
              label="Log Inspection"
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
            />
          </div>

          {/* Live inspection records */}
          {inspections.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              No inspections logged yet. Use “Log Inspection” to record an SAA/CAA inspection.
            </div>
          ) : (
            inspections.map((insp) => {
              const passed = insp.passed === true;
              const failed = insp.passed === false;
              return (
                <Card key={insp.id}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <ClipboardCheck className={`mt-0.5 h-5 w-5 shrink-0 ${passed ? "text-emerald-500" : failed ? "text-red-500" : "text-slate-400"}`} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800">{insp.area ?? "Unspecified area"}</h3>
                            <Pill className={passed ? "bg-emerald-100 text-emerald-700" : failed ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}>
                              {passed ? "Pass" : failed ? "Fail" : "—"}
                            </Pill>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Inspector: {insp.inspector ?? "—"} · {fmt(insp.inspection_date)}
                          </p>
                        </div>
                      </div>
                      {insp.next_due && (
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] text-slate-400">Next due</div>
                          <div className="text-sm font-semibold text-blue-600">{fmt(insp.next_due)}</div>
                        </div>
                      )}
                    </div>
                    {insp.findings ? (
                      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-red-600">Findings</div>
                        <p className="text-xs text-red-800">{insp.findings}</p>
                      </div>
                    ) : passed ? (
                      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> No findings recorded
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}

        </div>
      )}

      {/* ── Training & Compliance tab ── */}
        {tab === "compliance" && (
          <WasteComplianceTab streams={streams} pickups={pickups} vendors={vendors} inspections={inspections} />
        )}

      {tab === "accumulation" && <AccumulationTracker streams={streams} />}
      {tab === "schedule"     && <PickupSchedule streams={streams} />}


      {/* ── Labels & Compatibility tab (BL-WMP-07 + BL-WMP-08) ── */}
        {tab === "labels" && <WasteLabelsTab streams={streams} />}
      {tab === "manifests"    && (
        <div className="flex flex-col gap-4">
          {/* LDR info banner */}
          <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4 text-xs text-blue-800">
            <div className="font-semibold text-sm text-blue-900 mb-1">Transportation, Manifest &amp; LDR Workflow</div>
            Each shipment requires: pickup request → shipment readiness checklist → manifest number →
            Land Disposal Restriction (LDR) certification → return copy → disposal certificate.
            Shipment is blocked until all required evidence is confirmed.
          </div>

          {/* Live scheduled pickups / manifests — waste_pickups */}
          <Card>
            <CardHeader
              title="Scheduled Pickups &amp; Manifests"
              subtitle={`${pickups.length} pickup${pickups.length !== 1 ? "s" : ""} · ${pickups.filter(p => p.status === "completed").length} completed`}
              right={
                <div className="flex items-center gap-2">
                  <WasteCalendarExportButton
                    streams={streams}
                    pickups={pickups}
                    vendors={vendors}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  />
                  <SchedulePickupButton
                    vendors={vendors}
                    streams={streams}
                    label="Schedule Pickup"
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                  />
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Vendor</th>
                    <th className="px-4 py-2.5 text-left">Manifest #</th>
                    <th className="px-4 py-2.5 text-left">Scheduled</th>
                    <th className="px-4 py-2.5 text-left">Completed</th>
                    <th className="px-4 py-2.5 text-left">Qty</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pickups.map((p) => {
                    const vendor = vendors.find((v) => v.id === p.vendor_id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{vendor?.name ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {p.manifest_number ?? <span className="italic text-slate-300">Not assigned</span>}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(p.scheduled_date)}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(p.completed_date)}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                          {p.quantity != null ? `${p.quantity} ${p.unit ?? ""}`.trim() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Pill className={PICKUP_STATUS_STYLE[p.status] ?? "bg-slate-100 text-slate-600"}>
                            {p.status.replace(/_/g, " ")}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end">
                            <MarkPickupCompleteButton pickup={p} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pickups.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                        No pickups scheduled yet. Use “Schedule Pickup” to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>


          <ManifestArchive streams={streams} />
        </div>
      )}


      {/* ── Vendors / TSDF tab ── */}
      {tab === "vendors" && (
        <div className="space-y-5">
          <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4 text-xs text-blue-800">
            <div className="font-semibold text-sm text-blue-900 mb-1">BL-WMP-11 Vendor / Transporter / TSDF Approval</div>
            Approved/current status required before pickup release.
            Vendor profile includes service scope, licenses, permits, insurance, restrictions, and expiration dates.
            Shipments are blocked when TSDF permit evidence is missing or expired.
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Vendors"          value={vendors.length}                                          hint="On file" />
            <Stat label="Active"           value={vendors.filter(v => v.status === "active").length}        hint="Approved status"  accent="#10b981" />
            <Stat label="Permit Expiring"  value={vendors.filter(v => v.permit_expiry && (new Date(v.permit_expiry).getTime() - Date.now()) <= 90 * 86400000).length} hint="≤ 90 days"  accent="#f59e0b" />
            <Stat label="Needs Review"     value={vendors.filter(v => v.status !== "active").length}        hint="Pending / inactive" />
          </div>

          {/* Live approved vendors / TSDF — waste_vendors */}
          <Card>
            <CardHeader
              title="Approved Vendors / TSDF"
              subtitle={`${vendors.length} vendor${vendors.length !== 1 ? "s" : ""} on file`}
              right={
                <VendorFormButton
                  mode="add"
                  label="Add Vendor"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                />
              }
            />
            <div className="divide-y divide-slate-50">
              {vendors.map((v) => {
                const permitDays = v.permit_expiry ? Math.ceil((new Date(v.permit_expiry).getTime() - Date.now()) / 86400000) : null;
                const permitExpired = permitDays != null && permitDays <= 0;
                const permitExpiring = permitDays != null && permitDays > 0 && permitDays <= 90;
                return (
                  <div key={v.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Truck className="h-4 w-4 shrink-0 text-blue-500" />
                        <h3 className="text-sm font-bold text-slate-800">{v.name}</h3>
                        <Pill className={VENDOR_STATUS_STYLE[v.status] ?? "bg-slate-100 text-slate-600"}>
                          {v.status.replace(/_/g, " ")}
                        </Pill>
                      </div>
                      <div className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-2">
                        <span>EPA ID: <span className="font-mono text-slate-600">{v.epa_id ?? "—"}</span></span>
                        <span>Contact: {v.contact_name ?? "—"}</span>
                        {v.phone && (
                          <span className="flex items-center gap-1 text-blue-600"><PhoneCall className="h-3 w-3" />{v.phone}</span>
                        )}
                        <span className={permitExpired ? "font-semibold text-red-600" : permitExpiring ? "font-semibold text-amber-600" : ""}>
                          Permit: {fmt(v.permit_expiry)}{permitExpired ? " — EXPIRED" : permitExpiring ? ` — ${permitDays}d` : ""}
                        </span>
                      </div>
                      {v.services.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {v.services.map((s) => (
                            <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <SchedulePickupButton
                        vendors={vendors}
                        streams={streams}
                        prefillVendorId={v.id}
                        label="Schedule pickup"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      />
                      <VendorFormButton
                        mode="edit"
                        vendor={v}
                        label="Edit"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      />
                      {v.email && (
                        <a
                          href={`mailto:${v.email}`}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Contact
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {vendors.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  No vendors on file. Use “Add Vendor” to register a disposal vendor or TSDF.
                </div>
              )}
            </div>
          </Card>

        </div>
      )}

      {/* ── Reports / Audit Binder tab (BL-WMP-16) ── */}
        {tab === "reports" && (
          <WasteReportsTab streams={streams} pickups={pickups} vendors={vendors} inspections={inspections} profiles={profiles} />
        )}

    </div>
  );
}

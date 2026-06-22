"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LegalRequirement, Audit, CapaAction, Equipment } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalItem {
  id: string;
  date: Date;
  label: string;
  module: "legal" | "audit" | "capa" | "equipment";
  urgency: "overdue" | "this_week" | "this_month" | "upcoming";
}

const MODULE_STYLE = {
  legal:     { dot: "bg-blue-500",   chip: "bg-blue-50 border-blue-200 text-blue-800",   tag: "Legal"     },
  audit:     { dot: "bg-purple-500", chip: "bg-purple-50 border-purple-200 text-purple-800", tag: "Audit" },
  capa:      { dot: "bg-orange-500", chip: "bg-orange-50 border-orange-200 text-orange-800", tag: "CAPA"  },
  equipment: { dot: "bg-amber-500",  chip: "bg-amber-50 border-amber-200 text-amber-800",  tag: "Equip."  },
} as const;

const URGENCY_LEFT: Record<CalItem["urgency"], string> = {
  overdue:    "border-l-4 border-red-500",
  this_week:  "border-l-4 border-amber-500",
  this_month: "border-l-4 border-blue-400",
  upcoming:   "border-l-4 border-slate-200",
};

const URGENCY_LABEL: Record<CalItem["urgency"], string> = {
  overdue:   "Overdue",
  this_week: "This week",
  this_month:"This month",
  upcoming:  "Upcoming",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUrgency(date: Date, now: Date): CalItem["urgency"] {
  const days = (date.getTime() - now.getTime()) / 86400000;
  if (days < 0)   return "overdue";
  if (days <= 7)  return "this_week";
  if (days <= 30) return "this_month";
  return "upcoming";
}

function parseDate(s: string) {
  return new Date(s + "T00:00:00");
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function fmtFull(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function fmtShort(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  requirements: LegalRequirement[];
  audits: Audit[];
  capas: CapaAction[];
  equipment: Equipment[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ComplianceCalendar({ requirements, audits, capas, equipment }: Props) {
  const now = new Date();
  const todayStr = now.toDateString();

  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Build items (no horizon cap — grid shows any month)
  const allItems = useMemo<CalItem[]>(() => {
    const items: CalItem[] = [];

    requirements.forEach((r) => {
      if (!r.next_review_date) return;
      const d = parseDate(r.next_review_date);
      items.push({ id: `legal-${r.id}`, date: d, label: r.title, module: "legal", urgency: getUrgency(d, now) });
    });

    audits
      .filter((a) => a.status !== "completed" && a.status !== "cancelled")
      .forEach((a) => {
        const d = parseDate(a.scheduled_date);
        items.push({ id: `audit-${a.id}`, date: d, label: a.title, module: "audit", urgency: getUrgency(d, now) });
      });

    capas
      .filter((c) => c.status !== "closed" && c.due_date)
      .forEach((c) => {
        const d = parseDate(c.due_date!);
        items.push({ id: `capa-${c.id}`, date: d, label: c.title, module: "capa", urgency: getUrgency(d, now) });
      });

    equipment.forEach((e) => {
      if (e.next_calibration_date) {
        const d = parseDate(e.next_calibration_date);
        items.push({ id: `cal-${e.id}`, date: d, label: `Calibrate: ${e.name}`, module: "equipment", urgency: getUrgency(d, now) });
      }
      if (e.next_inspection_date) {
        const d = parseDate(e.next_inspection_date);
        items.push({ id: `insp-${e.id}`, date: d, label: `Inspect: ${e.name}`, module: "equipment", urgency: getUrgency(d, now) });
      }
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements, audits, capas, equipment]);

  // Index by day
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    allItems.forEach((item) => {
      const key = item.date.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [allItems]);

  // Calendar grid cells
  const { days, monthLabel } = useMemo(() => {
    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);

    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay()); // back to Sunday

    const end = new Date(last);
    end.setDate(end.getDate() + (6 - end.getDay())); // forward to Saturday

    const days: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { days, monthLabel };
  }, [currentMonth]);

  // Navigation
  const prevMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(null);
  };

  // Side-panel data
  const selectedItems = selectedDate
    ? (itemsByDay.get(selectedDate.toDateString()) ?? [])
    : null;

  const horizon90 = new Date(now.getTime() + 90 * 86400000);
  const upcomingItems = allItems.filter(
    (i) => i.date >= new Date(todayStr) && i.date <= horizon90,
  );

  const overdueItems = allItems.filter((i) => i.urgency === "overdue");

  return (
    <div className="p-4 space-y-4">

      {/* Overdue banner */}
      {overdueItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-l-4 border-red-500 bg-red-50 p-3 text-xs">
          <div className="font-bold text-red-900 shrink-0">
            {overdueItems.length} Overdue
          </div>
          <div className="text-red-700 truncate">
            {overdueItems.map((i) => i.label).join(" · ")}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">

        {/* ── Calendar grid ──────────────────────────────────────────────── */}
        <div>
          {/* Month header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 active:bg-slate-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={nextMonth}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 active:bg-slate-100"
                aria-label="Next month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <h3 className="ml-1 text-sm font-semibold text-slate-800">
                {monthLabel}
              </h3>
            </div>
            <button
              onClick={goToday}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Today
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="mb-0.5 grid grid-cols-7">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
            {days.map((day, i) => {
              const inMonth  = day.getMonth() === currentMonth.getMonth();
              const isToday  = sameDay(day, now);
              const isSel    = selectedDate ? sameDay(day, selectedDate) : false;
              const dayItems = itemsByDay.get(day.toDateString()) ?? [];
              const hasOver  = dayItems.some((x) => x.urgency === "overdue");
              const visible  = dayItems.slice(0, 2);
              const overflow = dayItems.length - 2;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(isSel ? null : new Date(day))}
                  className={[
                    "relative min-h-[76px] overflow-hidden bg-white p-1.5 text-left transition-colors",
                    inMonth ? "" : "opacity-35",
                    isSel ? "ring-2 ring-inset ring-blue-500" : "hover:bg-slate-50/80",
                  ].join(" ")}
                >
                  {/* Date number */}
                  <div
                    className={[
                      "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                      isToday
                        ? "bg-blue-600 text-white"
                        : hasOver && !isToday
                        ? "text-red-600"
                        : "text-slate-600",
                    ].join(" ")}
                  >
                    {day.getDate()}
                  </div>

                  {/* Event chips */}
                  <div className="flex flex-col gap-0.5">
                    {visible.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1 overflow-hidden rounded border px-1 py-0.5 ${MODULE_STYLE[item.module].chip}`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${MODULE_STYLE[item.module].dot}`} />
                        <span className="truncate text-[9px] font-semibold leading-none">
                          {MODULE_STYLE[item.module].tag}
                        </span>
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-500">
                        +{overflow}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(["legal", "audit", "capa", "equipment"] as const).map((m) => (
              <div
                key={m}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${MODULE_STYLE[m].chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${MODULE_STYLE[m].dot}`} />
                {MODULE_STYLE[m].tag}
              </div>
            ))}
            <span className="ml-auto text-[10px] text-slate-400">
              Click a date to inspect
            </span>
          </div>
        </div>

        {/* ── Side panel ─────────────────────────────────────────────────── */}
        <div className="flex flex-col">
          {selectedItems !== null ? (
            /* Selected day */
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700">
                  {fmtFull(selectedDate!)}
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {selectedItems.length === 0 ? (
                <div className="flex-1 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
                  No obligations scheduled for this date.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-r-xl bg-white px-3 py-2.5 shadow-sm ${URGENCY_LEFT[item.urgency]}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${MODULE_STYLE[item.module].dot}`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 leading-snug">
                            {item.label}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${MODULE_STYLE[item.module].chip}`}
                            >
                              {MODULE_STYLE[item.module].tag}
                            </span>
                            <span
                              className={`text-[9px] font-semibold ${
                                item.urgency === "overdue"    ? "text-red-600"   :
                                item.urgency === "this_week"  ? "text-amber-600" :
                                "text-slate-400"
                              }`}
                            >
                              {URGENCY_LABEL[item.urgency]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Upcoming list */
            <>
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Next 90 Days
                </span>
                {upcomingItems.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    {upcomingItems.length}
                  </span>
                )}
              </div>

              {upcomingItems.length === 0 ? (
                <div className="flex-1 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
                  No upcoming obligations in the next 90 days.
                </div>
              ) : (
                <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-0.5">
                  {upcomingItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedDate(item.date);
                        setCurrentMonth(
                          new Date(item.date.getFullYear(), item.date.getMonth(), 1),
                        );
                      }}
                      className={`w-full text-left rounded-r-xl bg-white px-3 py-2 shadow-sm transition-colors hover:bg-slate-50 ${URGENCY_LEFT[item.urgency]}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${MODULE_STYLE[item.module].dot}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium text-slate-700 leading-snug">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {fmtShort(item.date)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-bold ${MODULE_STYLE[item.module].chip}`}
                        >
                          {MODULE_STYLE[item.module].tag}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

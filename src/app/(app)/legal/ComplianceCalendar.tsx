import type { LegalRequirement, Audit, CapaAction, Equipment } from "@/lib/types";

interface CalItem {
  id: string;
  date: Date;
  label: string;
  module: "legal" | "audit" | "capa" | "equipment";
  urgency: "overdue" | "this_week" | "this_month" | "upcoming";
}

const MODULE_STYLE = {
  legal:     { dot: "bg-blue-500",   badge: "bg-blue-50 border-blue-200 text-blue-800" },
  audit:     { dot: "bg-purple-500", badge: "bg-purple-50 border-purple-200 text-purple-800" },
  capa:      { dot: "bg-orange-500", badge: "bg-orange-50 border-orange-200 text-orange-800" },
  equipment: { dot: "bg-amber-500",  badge: "bg-amber-50 border-amber-200 text-amber-800" },
};

const MODULE_LABEL = { legal: "Legal", audit: "Audit", capa: "CAPA", equipment: "Equipment" };

function urgency(date: Date, now: Date): CalItem["urgency"] {
  const diff = date.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0)   return "overdue";
  if (days <= 7)  return "this_week";
  if (days <= 30) return "this_month";
  return "upcoming";
}

const URGENCY_LABEL: Record<CalItem["urgency"], string> = {
  overdue:    "Overdue",
  this_week:  "This Week",
  this_month: "This Month",
  upcoming:   "Upcoming",
};

const URGENCY_BAR: Record<CalItem["urgency"], string> = {
  overdue:    "border-l-4 border-red-500",
  this_week:  "border-l-4 border-amber-500",
  this_month: "border-l-4 border-blue-400",
  upcoming:   "border-l-4 border-slate-200",
};

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  requirements: LegalRequirement[];
  audits: Audit[];
  capas: CapaAction[];
  equipment: Equipment[];
}

export function ComplianceCalendar({ requirements, audits, capas, equipment }: Props) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days out

  const items: CalItem[] = [];

  // Legal review dates
  requirements.forEach((r) => {
    if (!r.next_review_date) return;
    const d = new Date(r.next_review_date);
    if (d > horizon) return;
    items.push({ id: `legal-${r.id}`, date: d, label: `Review: ${r.title}`, module: "legal", urgency: urgency(d, now) });
  });

  // Audit scheduled dates
  audits.filter((a) => a.status !== "completed" && a.status !== "cancelled").forEach((a) => {
    const d = new Date(a.scheduled_date);
    if (d > horizon) return;
    items.push({ id: `audit-${a.id}`, date: d, label: `Audit: ${a.title}`, module: "audit", urgency: urgency(d, now) });
  });

  // CAPA due dates
  capas.filter((c) => c.status !== "closed" && c.due_date).forEach((c) => {
    const d = new Date(c.due_date!);
    if (d > horizon) return;
    items.push({ id: `capa-${c.id}`, date: d, label: `CAPA: ${c.title}`, module: "capa", urgency: urgency(d, now) });
  });

  // Equipment calibration / inspection
  equipment.forEach((e) => {
    if (e.next_calibration_date) {
      const d = new Date(e.next_calibration_date);
      if (d <= horizon)
        items.push({ id: `cal-${e.id}`, date: d, label: `Calibrate: ${e.name}`, module: "equipment", urgency: urgency(d, now) });
    }
    if (e.next_inspection_date) {
      const d = new Date(e.next_inspection_date);
      if (d <= horizon)
        items.push({ id: `insp-${e.id}`, date: d, label: `Inspect: ${e.name}`, module: "equipment", urgency: urgency(d, now) });
    }
  });

  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  const overdue   = items.filter((i) => i.urgency === "overdue");
  const thisWeek  = items.filter((i) => i.urgency === "this_week");
  const thisMonth = items.filter((i) => i.urgency === "this_month");
  const upcoming  = items.filter((i) => i.urgency === "upcoming");

  const groups = [
    { label: "Overdue", items: overdue,   emptyMsg: null },
    { label: "This Week", items: thisWeek, emptyMsg: null },
    { label: "This Month", items: thisMonth, emptyMsg: null },
    { label: "Next 90 Days", items: upcoming, emptyMsg: "No further obligations in the next 90 days." },
  ];

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-400">
        No upcoming compliance obligations in the next 90 days.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-50">
      {groups.map(({ label, items: groupItems, emptyMsg }) => {
        if (groupItems.length === 0 && !emptyMsg) return null;
        return (
          <div key={label} className="px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
              {groupItems.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  {groupItems.length}
                </span>
              )}
            </div>
            {groupItems.length === 0 && emptyMsg ? (
              <p className="text-xs text-slate-400">{emptyMsg}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {groupItems.map((item) => {
                  const style = MODULE_STYLE[item.module];
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 rounded-r-lg bg-white px-3 py-2.5 shadow-sm ${URGENCY_BAR[item.urgency]}`}
                    >
                      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-400">{fmt(item.date)}</p>
                      </div>
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                        {MODULE_LABEL[item.module]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

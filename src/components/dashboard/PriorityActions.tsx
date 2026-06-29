import Link from "next/link";

interface ActionItem {
  id: string;
  urgency: "overdue" | "soon" | "pending";
  title: string;
  meta: string;
  href: string;
  badge: string;
}

interface Props {
  items: ActionItem[];
}

export function PriorityActions({ items }: Props) {
  if (items.length === 0) return null;

  const overdue  = items.filter((i) => i.urgency === "overdue");
  const soon     = items.filter((i) => i.urgency === "soon");
  const pending  = items.filter((i) => i.urgency === "pending");

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Priority actions</h2>
          <p className="text-xs text-slate-400">What needs your attention right now</p>
        </div>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Overdue section */}
      {overdue.length > 0 && (
        <>
          <div className="bg-red-50/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500 dark:bg-red-950/30 dark:text-red-400">
            Overdue · act today
          </div>
          {overdue.map((item) => (
            <ActionRow key={item.id} item={item} />
          ))}
        </>
      )}

      {/* Due soon section */}
      {soon.length > 0 && (
        <>
          <div className="border-t border-slate-100 bg-amber-50/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:border-slate-700 dark:bg-amber-950/20 dark:text-amber-400">
            Due soon · act this week
          </div>
          {soon.map((item) => (
            <ActionRow key={item.id} item={item} />
          ))}
        </>
      )}

      {/* Pending section */}
      {pending.length > 0 && (
        <>
          <div className="border-t border-slate-100 bg-blue-50/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:border-slate-700 dark:bg-blue-950/20 dark:text-blue-400">
            Pending · needs a decision
          </div>
          {pending.map((item) => (
            <ActionRow key={item.id} item={item} />
          ))}
        </>
      )}
    </div>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const dot =
    item.urgency === "overdue"
      ? "bg-red-500"
      : item.urgency === "soon"
      ? "bg-amber-400"
      : "bg-blue-500";

  const chip =
    item.urgency === "overdue"
      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      : item.urgency === "soon"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 border-t border-slate-50 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{item.title}</p>
        <p className="text-[11px] text-slate-400">{item.meta}</p>
      </div>
      <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${chip}`}>{item.badge}</span>
    </Link>
  );
}

// ── Builder helpers ──────────────────────────────────────────────────────────

export function buildPriorityItems({
  overdueCapas,
  overdueEquipment,
  expiringTrainingSoon,
  pendingFindings,
}: {
  overdueCapas: Array<{ id: string; title: string; due_date: string | null; status: string }>;
  overdueEquipment: Array<{ id: string; name: string; status: string }>;
  expiringTrainingSoon: Array<{ id: string; course_id: string; expiry_date: string | null }>;
  pendingFindings: Array<{ id: string; job: string; source_type?: string; output: unknown }>;
}): ActionItem[] {
  const now = new Date();
  const items: ActionItem[] = [];

  // Overdue CAPAs — sorted worst first
  for (const c of overdueCapas) {
    if (!c.due_date) continue;
    const daysOver = Math.floor((now.getTime() - new Date(c.due_date).getTime()) / 86400000);
    items.push({
      id: `capa-${c.id}`,
      urgency: "overdue",
      title: c.title,
      meta: `CAPA · due ${new Date(c.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      href: `/capa/${c.id}`,
      badge: `${daysOver}d overdue`,
    });
  }
  // Sort overdue CAPAs by worst first
  items.sort((a, b) => {
    const dA = parseInt(a.badge) || 0;
    const dB = parseInt(b.badge) || 0;
    return dB - dA;
  });

  // Overdue equipment
  for (const e of overdueEquipment) {
    items.push({
      id: `equip-${e.id}`,
      urgency: "overdue",
      title: `${e.name} — ${e.status.replace(/_/g, " ")}`,
      meta: "Monitoring & Equipment · action required",
      href: `/monitoring/${e.id}`,
      badge: "Expired",
    });
  }

  // Training expiring in 7 days
  for (const t of expiringTrainingSoon) {
    if (!t.expiry_date) continue;
    const daysLeft = Math.floor((new Date(t.expiry_date).getTime() - now.getTime()) / 86400000);
    items.push({
      id: `training-${t.id}`,
      urgency: "soon",
      title: `Training certification expiring`,
      meta: `Training · expires ${new Date(t.expiry_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · course ${t.course_id.slice(0, 8)}`,
      href: "/training",
      badge: `${daysLeft}d left`,
    });
  }

  // AI findings pending review
  for (const f of pendingFindings.slice(0, 5)) {
    items.push({
      id: `ai-${f.id}`,
      urgency: "pending",
      title: `${String(f.job).replace(/_/g, " ")}${f.source_type ? ` — ${f.source_type}` : ""}`,
      meta: "AI Finding · awaiting your review",
      href: "/ai",
      badge: "Review",
    });
  }

  return items;
}

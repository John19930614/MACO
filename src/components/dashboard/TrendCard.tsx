import { Card, CardHeader } from "@/components/ui/primitives";
import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MonthlyPoint } from "@/lib/actions/getDashboardTrends";

// Shared primitive for every trend card on the Client Command Center. Pure
// server component (no client JS) — same convention as Card/CardHeader and the
// dashboard's other panels. Rendering, empty-state, and demo-banner logic live
// here once so the 7 cards can't drift out of sync with each other.

interface TrendCardProps {
  title: string;
  icon: LucideIcon;
  value: number | string;
  monthlySeries: MonthlyPoint[];
  summary: string;
  emptyMessage: string;
  isEmpty: boolean;
  isDemoData: boolean;
}

/** Visible banner (icon + text, not a color-only cue) shown at the top of a card fed by demo data. */
export function TrendDemoBanner() {
  return (
    <div className="flex items-center gap-1.5 rounded-t-xl border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Sample data — your live data will appear here.</span>
    </div>
  );
}

export function TrendCard({
  title,
  icon: Icon,
  value,
  monthlySeries,
  summary,
  emptyMessage,
  isEmpty,
  isDemoData,
}: TrendCardProps) {
  return (
    <Card className="flex h-full flex-col">
      {isDemoData && <TrendDemoBanner />}
      <CardHeader title={title} right={<Icon className="h-4 w-4 text-slate-400" aria-hidden />} />
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {isEmpty ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <span aria-hidden>✓</span>
            {emptyMessage}
          </p>
        ) : (
          <>
            <div className="text-2xl font-extrabold tabular-nums text-slate-800 dark:text-white">{value}</div>
            {monthlySeries.length > 0 && <Sparkline points={monthlySeries} />}
            <p className="text-xs text-slate-500 dark:text-slate-400">{summary}</p>
          </>
        )}
      </div>
    </Card>
  );
}

/** Minimal dependency-free sparkline — deliberately smaller/simpler than TrendArea, which is sized for a full chart panel, not a card footer. */
function Sparkline({ points }: { points: MonthlyPoint[] }) {
  const width = 160;
  const height = 32;
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.count));
  const x = (i: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) => height - 2 - (v / max) * (height - 4);
  const linePts = points.map((p, i) => `${x(i)},${y(p.count)}`).join(" ");

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="6-month trend"
      className="h-8"
    >
      {n > 1 && (
        <polyline
          points={linePts}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {n === 1 && <circle cx={x(0)} cy={y(points[0].count)} r={2.5} fill="#2563eb" />}
    </svg>
  );
}

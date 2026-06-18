import { SEVERITY_META, SEVERITIES } from "@/lib/constants";
import type { WeekBucket, Slice } from "@/lib/analytics/trends";

/** Horizontal bar list — for distributions and recurrence. */
export function BarList({ data, color = "var(--color-pclss)", colorFor, format }: { data: Slice[]; color?: string; colorFor?: (label: string) => string | undefined; format?: (s: string) => string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-36 shrink-0 truncate text-xs text-slate-600" title={d.label}>
            {format ? format(d.label) : d.label.replace(/_/g, " ")}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
            <div className="h-full rounded" style={{ width: `${(d.count / max) * 100}%`, background: colorFor?.(d.label) ?? color }} />
          </div>
          <span className="w-7 shrink-0 text-right text-xs font-semibold text-slate-600">{d.count}</span>
        </div>
      ))}
      {data.length === 0 && <p className="text-xs text-slate-400">No data.</p>}
    </div>
  );
}

/** Stacked-column timeline of cells per week, split by severity. */
export function StackedTimeline({ buckets }: { buckets: WeekBucket[] }) {
  const W = Math.max(360, buckets.length * 46);
  const H = 200;
  const padB = 28;
  const padL = 24;
  const chartH = H - padB - 8;
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const colW = buckets.length ? (W - padL) / buckets.length : 0;
  const barW = Math.min(28, colW * 0.6);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[200px] w-full min-w-[360px]" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Cells created per week by severity">
        {/* y gridlines */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W} y1={8 + chartH * (1 - f)} y2={8 + chartH * (1 - f)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={0} y={8 + chartH * (1 - f) + 3} fontSize={9} fill="#94a3b8">{Math.round(max * f)}</text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = padL + i * colW + (colW - barW) / 2;
          let yTop = 8 + chartH;
          return (
            <g key={b.weekStart}>
              {SEVERITIES.map((sev) => {
                const n = b.counts[sev];
                if (!n) return null;
                const h = (n / max) * chartH;
                yTop -= h;
                return <rect key={sev} x={x} y={yTop} width={barW} height={h} fill={SEVERITY_META[sev].color} rx={1} />;
              })}
              {i % Math.ceil(buckets.length / 8 || 1) === 0 && (
                <text x={x + barW / 2} y={H - 10} fontSize={9} fill="#94a3b8" textAnchor="middle">{b.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3">
        {SEVERITIES.map((s) => (
          <span key={s} className="flex items-center gap-1 text-[11px] text-slate-500">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEVERITY_META[s].color }} />
            {SEVERITY_META[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}

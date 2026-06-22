import { cn } from "@/lib/utils";

// ── Light (default) variants — used by customer EHS pages ─────────────────────

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800", className)}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Pill({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}
      style={style}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
  icon,
  strip,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: string;
  icon?: React.ReactNode;
  strip?: string;
  trend?: { label: string; direction?: "up" | "down" | "flat" };
}) {
  const trendColor =
    trend?.direction === "up"
      ? "text-emerald-600"
      : trend?.direction === "down"
        ? "text-red-500"
        : "text-slate-400";
  const trendArrow =
    trend?.direction === "up" ? "↑" : trend?.direction === "down" ? "↓" : "→";

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      {strip && (
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: strip }} />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
          <div className="mt-1 text-3xl font-extrabold leading-none tracking-tight dark:text-white" style={{ color: accent ?? undefined }}>
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</div>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: accent ? `${accent}18` : "#f0f3f8", color: accent ?? "#64748b" }}>
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className={`mt-3 flex items-center gap-1 border-t border-slate-100 pt-2.5 text-[11.5px] font-semibold dark:border-slate-700 ${trendColor}`}>
          <span>{trendArrow}</span>
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

// ── Dark variants — used by SA / Platform Admin pages ─────────────────────────

export function DarkCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-white/8 bg-slate-900/60", className)}>{children}</div>
  );
}

export function DarkCardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function DarkStat({
  label,
  value,
  hint,
  accent,
  icon,
  strip,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: string;
  icon?: React.ReactNode;
  strip?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-slate-900/60 p-4">
      {strip && (
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: strip }} />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-3xl font-extrabold leading-none tracking-tight text-white" style={accent ? { color: accent } : {}}>
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: accent ? `${accent}20` : "rgba(255,255,255,0.06)", color: accent ?? "#94a3b8" }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function DarkPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/8 bg-slate-950/80 px-6 py-4">
      <div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

// Dependency-free SVG charts. Pure presentational components (no client JS),
// safe to render from server components. Themed via hex color props.

import React from "react";

export interface Segment {
  label: string;
  value: number;
  color: string;
}

// ── Score gauge (donut ring with center value) ───────────────────────────────

export function ScoreGauge({
  value,
  size = 132,
  stroke = 13,
  label,
  color,
  track = "#e2e8f0",
}: {
  value: number;            // 0–100
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
  track?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const arc = (v / 100) * C;
  const ringColor = color ?? (v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#dc2626");

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${v}%`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={ringColor} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${arc} ${C - arc}`}
          />
        </g>
        <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: size * 0.26, fontWeight: 800, fill: "#1e293b" }}>
          {Math.round(v)}%
        </text>
        {label && (
          <text x={cx} y={cy + size * 0.17} textAnchor="middle"
            style={{ fontSize: size * 0.085, fontWeight: 600, fill: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Donut (multi-segment) with optional center label ──────────────────────────

export function DonutChart({
  segments,
  size = 132,
  stroke = 20,
  centerValue,
  centerLabel,
}: {
  segments: Segment[];
  size?: number;
  stroke?: number;
  centerValue?: string | number;
  centerLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="donut chart">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {total > 0 && segments.map((seg, i) => {
          if (seg.value <= 0) return null;
          const len = (seg.value / total) * C;
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acc}
            />
          );
          acc += len;
          return el;
        })}
      </g>
      {(centerValue != null || centerLabel) && (
        <>
          {centerValue != null && (
            <text x={cx} y={centerLabel ? cy - 4 : cy} textAnchor="middle" dominantBaseline="central"
              style={{ fontSize: size * 0.24, fontWeight: 800, fill: "#1e293b" }}>
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text x={cx} y={cy + size * 0.13} textAnchor="middle"
              style={{ fontSize: size * 0.082, fontWeight: 600, fill: "#94a3b8" }}>
              {centerLabel}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

export function Legend({ segments, showValues = true }: { segments: Segment[]; showValues?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {segments.map((s) => (
        <div key={s.label} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
          <span className="flex-1 text-slate-600">{s.label}</span>
          {showValues && <span className="font-semibold tabular-nums text-slate-800">{s.value}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Trend area / line chart ───────────────────────────────────────────────────

export interface TrendPoint {
  label: string;
  value: number;
}

export function TrendArea({
  points,
  width = 520,
  height = 150,
  color = "#2563eb",
  fill = "#dbeafe",
  valueSuffix = "",
}: {
  points: TrendPoint[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
  valueSuffix?: string;
}) {
  const padL = 28;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = points.length;
  const maxV = Math.max(1, ...points.map((p) => p.value));
  const niceMax = Math.ceil(maxV / 4) * 4 || 4;

  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / niceMax) * innerH;

  const linePts = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const areaPath = n > 0
    ? `M ${x(0)},${padT + innerH} ${points.map((p, i) => `L ${x(i)},${y(p.value)}`).join(" ")} L ${x(n - 1)},${padT + innerH} Z`
    : "";

  const gridVals = [0, niceMax / 2, niceMax];

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="trend chart" preserveAspectRatio="xMidYMid meet">
      {gridVals.map((gv, i) => (
        <g key={i}>
          <line x1={padL} y1={y(gv)} x2={width - padR} y2={y(gv)} stroke="#f1f5f9" strokeWidth={1} />
          <text x={padL - 6} y={y(gv)} textAnchor="end" dominantBaseline="central" style={{ fontSize: 9, fill: "#94a3b8" }}>
            {Math.round(gv)}{valueSuffix}
          </text>
        </g>
      ))}
      {n > 0 && <path d={areaPath} fill={fill} opacity={0.6} />}
      {n > 1 && <polyline points={linePts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={n > 24 ? 0 : 3} fill="#fff" stroke={color} strokeWidth={2} />
          {(n <= 12 || i % Math.ceil(n / 12) === 0) && (
            <text x={x(i)} y={height - 6} textAnchor="middle" style={{ fontSize: 9, fill: "#94a3b8" }}>{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Horizontal bars (e.g. score by category) ─────────────────────────────────

export function BarsH({
  items,
  max = 100,
  suffix = "%",
}: {
  items: { label: string; value: number; color?: string }[];
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => {
        const pct = Math.max(0, Math.min(100, (it.value / max) * 100));
        const c = it.color ?? (it.value >= 80 ? "#10b981" : it.value >= 60 ? "#f59e0b" : "#dc2626");
        return (
          <div key={it.label} className="flex items-center gap-3">
            <div className="w-36 shrink-0 truncate text-xs font-medium text-slate-600">{it.label}</div>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c }} />
            </div>
            <div className="w-10 text-right text-xs font-bold tabular-nums" style={{ color: c }}>
              {it.value}{suffix}
            </div>
          </div>
        );
      })}
    </div>
  );
}

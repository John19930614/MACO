"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { SafetyCell, SafetyLocation, Site } from "@/lib/types";
import { SEVERITIES, CELL_STATUSES, SEVERITY_META, RISK_OBJECT_META, type Severity, type EventKind, type Role } from "@/lib/constants";
import { CellDrawer } from "./CellDrawer";
import { Flame, Filter, AlertTriangle, ShieldX, Radar } from "lucide-react";

// An Event Cell resolved to a map coordinate (via its precursor cell's location).
export interface EventPoint {
  id: string;
  title: string;
  kind: EventKind;
  severity: Severity;
  cellId: string; // precursor cell — clicking the pin opens it
  lng: number;
  lat: number;
}

// A cell with broken/unverified control proofs (a Failure Cell), one per cell.
export interface FailurePoint {
  cellId: string;
  title: string;
  count: number; // number of failing control proofs
  lng: number;
  lat: number;
}

// A location's forecast band, placed at the location coordinates.
export interface ForecastPoint {
  locationId: string;
  label: string;
  score: number;
  band: "green" | "amber" | "orange" | "red";
  lng: number;
  lat: number;
}

// maplibre touches `window`, so the canvas must be client-only.
const MapCanvas = dynamic(() => import("./MapCanvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-[#0b1020] text-slate-500">Loading map…</div>,
});

interface Props {
  cells: SafetyCell[];
  locations: SafetyLocation[];
  sites: Site[];
  siteId: string;
  role: Role;
  heatByCell: Record<string, number>;
  events: EventPoint[];
  failures: FailurePoint[];
  forecast: ForecastPoint[];
}

const FORECAST_BAND_COLOR: Record<ForecastPoint["band"], string> = {
  green: "#1f9d55",
  amber: "#d9a400",
  orange: "#b45309",
  red: "#b80a0a",
};

export function MapWorkspace({ cells, locations, sites, siteId, role, heatByCell, events, failures, forecast }: Props) {
  const router = useRouter();
  const [severity, setSeverity] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [heat, setHeat] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [showFailures, setShowFailures] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const site = sites.find((s) => s.id === siteId);

  const filtered = useMemo(
    () =>
      cells.filter(
        (c) => (!severity || c.severity === severity) && (!status || c.status === status),
      ),
    [cells, severity, status],
  );

  const counts = useMemo(() => {
    return {
      total: filtered.length,
      critical: filtered.filter((c) => c.severity === "critical").length,
      open: filtered.filter((c) => c.status !== "closed").length,
    };
  }, [filtered]);

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={siteId}
          onChange={(e) => router.push(`/map?site=${e.target.value}`)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm">
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_META[s].label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm">
          <option value="">All statuses</option>
          {CELL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button
          onClick={() => setHeat((h) => !h)}
          aria-pressed={heat}
          aria-label="Toggle heat layer"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium ${heat ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}
        >
          <Flame className="h-3.5 w-3.5" /> Heat
        </button>
        <button
          onClick={() => setShowEvents((v) => !v)}
          aria-pressed={showEvents}
          aria-label="Toggle event layer"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium"
          style={showEvents ? { background: `${RISK_OBJECT_META.event.color}1a`, color: RISK_OBJECT_META.event.color } : { background: "#f1f5f9", color: "#475569" }}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Events
        </button>
        <button
          onClick={() => setShowFailures((v) => !v)}
          aria-pressed={showFailures}
          aria-label="Toggle failing-control layer"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium"
          style={showFailures ? { background: `${RISK_OBJECT_META.failure.color}1a`, color: RISK_OBJECT_META.failure.color } : { background: "#f1f5f9", color: "#475569" }}
        >
          <ShieldX className="h-3.5 w-3.5" /> Failures
        </button>
        <button
          onClick={() => setShowForecast((v) => !v)}
          aria-pressed={showForecast}
          aria-label="Toggle forecast layer"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium ${showForecast ? "bg-[var(--color-pclss-soft)] text-[var(--color-pclss-deep)]" : "bg-slate-100 text-slate-600"}`}
        >
          <Radar className="h-3.5 w-3.5" /> Forecast
        </button>
      </div>

      {/* Insight rail (bottom KPI cards) */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex gap-2">
        <RailCard label="Cells shown" value={counts.total} />
        <RailCard label="Open" value={counts.open} accent="var(--color-pclss)" />
        <RailCard label="Critical" value={counts.critical} accent="var(--color-sev-critical)" />
        {showEvents && events.length > 0 && <RailCard label="Events" value={events.length} accent={RISK_OBJECT_META.event.color} />}
        {showFailures && failures.length > 0 && <RailCard label="Failures" value={failures.length} accent={RISK_OBJECT_META.failure.color} />}
        {showForecast && <RailCard label="Forecast: at risk" value={forecast.filter((f) => f.band === "red" || f.band === "orange").length} accent={FORECAST_BAND_COLOR.orange} />}
      </div>

      {/* Legend */}
      <div className="absolute right-4 top-4 z-10 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <div className="mb-1 font-semibold text-slate-600">Severity</div>
        {SEVERITIES.map((s) => (
          <div key={s} className="flex items-center gap-1.5 py-0.5 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_META[s].color }} />
            {SEVERITY_META[s].label}
          </div>
        ))}
        <div className="mt-1.5 border-t border-slate-100 pt-1.5">
          <div className="flex items-center gap-1.5 py-0.5 text-slate-600">
            <span className="h-2.5 w-2.5 rotate-45 border-2 border-white" style={{ background: RISK_OBJECT_META.event.color }} />
            Event (outcome)
          </div>
          <div className="flex items-center gap-1.5 py-0.5 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full border-2 bg-transparent" style={{ borderColor: RISK_OBJECT_META.failure.color }} />
            Failing control
          </div>
          {showForecast && (
            <div className="mt-1.5 border-t border-slate-100 pt-1.5">
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Forecast band</div>
              {(["red", "orange", "amber", "green"] as const).map((b) => (
                <div key={b} className="flex items-center gap-1.5 py-0.5 capitalize text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full border-2 bg-transparent" style={{ borderColor: FORECAST_BAND_COLOR[b] }} />
                  {b}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MapCanvas cells={filtered} locations={locations} site={site} selectedId={selectedId} onSelect={setSelectedId} heat={heat} heatByCell={heatByCell} events={events} showEvents={showEvents} failures={failures} showFailures={showFailures} forecast={forecast} showForecast={showForecast} />
      <CellDrawer cellId={selectedId} role={role} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function RailCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

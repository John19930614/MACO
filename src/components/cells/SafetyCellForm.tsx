"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Crosshair, Camera, X } from "lucide-react";
import type { Site, SafetyLocation } from "@/lib/types";
import {
  SEVERITIES,
  SEVERITY_META,
  ENERGY_SOURCES,
  EXPOSURE_TYPES,
  CONTROL_GAPS,
} from "@/lib/constants";

export function SafetyCellForm({ sites, locations }: { sites: Site[]; locations: SafetyLocation[] }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const siteLocations = locations.filter((l) => l.site_id === siteId);
  const [locationId, setLocationId] = useState(siteLocations[0]?.id ?? "");
  const [geo, setGeo] = useState<{ status: "idle" | "locating" | "done" | "error"; note?: string }>({ status: "idle" });
  const [photos, setPhotos] = useState<File[]>([]);

  // Reset the selected location when the site changes.
  useEffect(() => {
    setLocationId(siteLocations[0]?.id ?? "");
    setGeo({ status: "idle" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeo({ status: "error", note: "Geolocation not available on this device." });
      return;
    }
    setGeo({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Snap to the nearest mapped location for this site.
        const { latitude, longitude } = pos.coords;
        let best: SafetyLocation | null = null;
        let bestM = Infinity;
        for (const l of siteLocations) {
          const m = haversine(latitude, longitude, l.lat, l.lng);
          if (m < bestM) { bestM = m; best = l; }
        }
        if (best) {
          setLocationId(best.id);
          setGeo({ status: "done", note: `Nearest mapped point: ${best.label} (${Math.round(bestM)} m away)` });
        } else {
          setGeo({ status: "error", note: "No mapped locations for this site yet." });
        }
      },
      () => setGeo({ status: "error", note: "Couldn't get your location (permission denied?)." }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      site_id: siteId,
      location_id: locationId,
      title: String(fd.get("title")),
      description: String(fd.get("description")),
      task: String(fd.get("task")),
      crew: String(fd.get("crew") || ""),
      company: String(fd.get("company") || ""),
      permit_ref: String(fd.get("permit_ref") || ""),
      severity: String(fd.get("severity")),
      likelihood: Number(fd.get("likelihood")),
      status: "open",
      hazard_genome: {
        energySource: String(fd.get("energySource")),
        exposureType: String(fd.get("exposureType")),
        trigger: String(fd.get("trigger")),
        controlGap: String(fd.get("controlGap")),
        environment: String(fd.get("environment") || ""),
      },
      // Photos ride along so they attach when a reviewer approves the staged cell.
      evidence: photos.map((p) => ({ kind: "photo", name: p.name, summary: "Field capture" })),
    };
    const res = await fetch("/api/cells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.pending) {
        // Gateway-validated, now awaiting human review — it is NOT live yet.
        setSubmitted(true);
        setSubmitting(false);
        return;
      }
      // Live mode (direct insert): attach evidence and open the record.
      for (const p of photos) {
        await fetch("/api/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cell_id: j.cell.id, kind: "photo", name: p.name, summary: "Field capture" }),
        });
      }
      router.push(`/cells/${j.cell.id}`);
      router.refresh();
    } else if (res.status === 403) {
      setError("You don't have permission to create cells.");
      setSubmitting(false);
    } else if (res.status === 422) {
      const j = await res.json().catch(() => null);
      setError(j?.rejections?.[0]?.reason ? `Blocked by the gateway: ${j.rejections[0].reason}` : "Blocked by the gateway.");
      setSubmitting(false);
    } else {
      setError("Please complete the required fields.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
          <h2 className="text-base font-bold text-emerald-900">Submitted — pending human review</h2>
          <p className="mt-1 text-sm text-emerald-800">
            The cell passed the AI Gateway and is now in the review queue. It will appear in the Cell Database, map and 3D web once a reviewer approves it.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => router.push("/review")} className="rounded-lg bg-[var(--color-pclss)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Open review queue</button>
            <button onClick={() => { setSubmitted(false); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Submit another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5 p-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Fieldset legend="Location" hint="Where the risk is — AMAYA is location-first.">
        <Field label="Site">
          <select name="site_id" value={siteId} onChange={(e) => setSiteId(e.target.value)} className={input}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Location / point">
          <div className="flex gap-2">
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={input} required>
              {siteLocations.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={useMyLocation}
              title="Use my current location"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {geo.status === "locating" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
              GPS
            </button>
          </div>
          {geo.note && (
            <p className={`mt-1 text-[11px] ${geo.status === "error" ? "text-red-600" : "text-emerald-600"}`}>{geo.note}</p>
          )}
        </Field>
      </Fieldset>

      <Fieldset legend="Evidence" hint="Snap photos in the field — capture opens your camera on mobile.">
        <Field label="Photos" full>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:bg-slate-50">
            <Camera className="h-4 w-4" />
            <span>Add photos</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
            />
          </label>
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name}
                  <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>
      </Fieldset>

      <Fieldset legend="What & task">
        <Field label="Title" full>
          <input name="title" className={input} placeholder="e.g. Forklift unloading at blind corner without verified spotter" required />
        </Field>
        <Field label="Description" full>
          <textarea name="description" className={input} rows={3} placeholder="What did you observe?" required />
        </Field>
        <Field label="Task / activity">
          <input name="task" className={input} placeholder="e.g. Container unloading" required />
        </Field>
        <Field label="Crew">
          <input name="crew" className={input} placeholder="e.g. Day shift / Dock crew 2" />
        </Field>
        <Field label="Company / contractor">
          <input name="company" className={input} placeholder="e.g. Harbor Stevedoring" />
        </Field>
        <Field label="Permit reference">
          <input name="permit_ref" className={input} placeholder="e.g. PRM-2231" />
        </Field>
      </Fieldset>

      <Fieldset legend="Hazard genome" hint="The structured fingerprint AMAYA reasons over.">
        <Field label="Energy source">
          <select name="energySource" className={input} required>
            {ENERGY_SOURCES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Exposure type">
          <select name="exposureType" className={input} required>
            {EXPOSURE_TYPES.map((v) => <option key={v} value={v}>{v.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
        <Field label="Trigger">
          <input name="trigger" className={input} placeholder="e.g. congestion, weather, schedule pressure" required />
        </Field>
        <Field label="Control gap">
          <select name="controlGap" className={input} required>
            {CONTROL_GAPS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Environment" full>
          <input name="environment" className={input} placeholder="e.g. high pedestrian traffic, limited sightlines" />
        </Field>
      </Fieldset>

      <Fieldset legend="Risk">
        <Field label="Severity">
          <select name="severity" className={input} defaultValue="medium" required>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
          </select>
        </Field>
        <Field label="Likelihood (1–5)">
          <input name="likelihood" type="number" min={1} max={5} defaultValue={3} className={input} required />
        </Field>
      </Fieldset>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-pclss)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Create Safety Cell
        </button>
      </div>
    </form>
  );
}

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--color-pclss)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pclss)]";

/** Great-circle distance in metres, for snapping GPS to the nearest location. */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function Fieldset({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <legend className="px-1 text-sm font-semibold text-slate-800">{legend}</legend>
      {hint && <p className="mb-2 text-xs text-slate-400">{hint}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

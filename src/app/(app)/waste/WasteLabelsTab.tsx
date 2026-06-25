"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardHeader, Pill, Stat } from "@/components/ui/primitives";
import { WasteLabelButton } from "./WasteLabelButton";
import type { WasteStream } from "@/lib/types";

// Container & Label Control tab for the Waste module. Drives every figure,
// row, and compatibility flag from the real `streams` passed in via props —
// no mock or hardcoded sample data. Per-row label printing is delegated to the
// existing WasteLabelButton (RCRA container label + QR code).

function fmt(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date.includes("T") ? date : date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ── Hazard grouping (derived from the streams actually present) ───────────────

type HazardGroup = "ignitable" | "corrosive" | "reactive" | "oxidizer" | "general";

const GROUP_LABEL: Record<HazardGroup, string> = {
  ignitable: "Ignitable",
  corrosive: "Corrosive",
  reactive: "Reactive",
  oxidizer: "Oxidizer",
  general: "General / Non-hazardous",
};

function hazardGroup(s: WasteStream): HazardGroup {
  const code = (s.waste_code ?? "").trim().toUpperCase();
  const name = s.waste_name.toLowerCase();
  if (code.startsWith("D002")) return "corrosive";
  if (code.startsWith("D003")) return "reactive";
  if (code.startsWith("D001")) return "ignitable";
  // Name/code hints for oxidizers (kept deliberately simple).
  if (/oxidi[sz]|peroxide|perchlorate|nitrate|permanganate/.test(name)) return "oxidizer";
  if (s.classification === "scheduled" || s.classification === "hazardous") return "ignitable";
  return "general";
}

// Incompatibility rules among hazard groups. Only pairs where BOTH groups are
// actually present in the current streams are surfaced.
const INCOMPAT_RULES: {
  a: HazardGroup;
  b: HazardGroup;
  risk: "critical" | "warning";
  reason: string;
  action: string;
}[] = [
  {
    a: "ignitable",
    b: "oxidizer",
    risk: "critical",
    reason: "Oxidizers dramatically accelerate combustion of ignitable wastes; co-storage creates fire/explosion risk.",
    action: "Store in separate, distance-segregated cabinets. Do not ship together; resolve before manifesting.",
  },
  {
    a: "corrosive",
    b: "reactive",
    risk: "critical",
    reason: "Acidic corrosives contacting reactive wastes can generate heat, toxic/flammable gas, or violent reaction.",
    action: "Physically isolate with secondary containment; verify SDS reactivity before co-location.",
  },
  {
    a: "ignitable",
    b: "corrosive",
    risk: "warning",
    reason: "Corrosive leakage can compromise ignitable containers and ignition-source controls over time.",
    action: "Segregate within the accumulation area and inspect container integrity at each weekly walk-down.",
  },
];

export function WasteLabelsTab({ streams }: { streams: WasteStream[] }) {
  const totalContainers = streams.length;
  const labelReady = streams.filter((s) => s.waste_code && s.classification).length;
  const needsCode = streams.filter((s) => !s.waste_code).length;
  const hazardous = streams.filter(
    (s) => s.classification === "hazardous" || s.classification === "scheduled",
  ).length;

  // Which hazard groups are actually present, and the flagged incompatible pairs.
  const presentGroups = new Set<HazardGroup>(streams.map(hazardGroup));
  const flaggedPairs = INCOMPAT_RULES.filter(
    (r) => presentGroups.has(r.a) && presentGroups.has(r.b),
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-l-4 border-indigo-500 bg-indigo-50 p-4 text-xs text-indigo-800">
        <div className="mb-1 text-sm font-semibold text-indigo-900">Container &amp; Label Control</div>
        Every hazardous waste container must carry a complete label — contents, hazards, accumulation start date,
        and generator information. Labels print directly from the entries in your waste register below.
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Containers" value={totalContainers} hint="In the waste register" />
        <Stat label="Label-Ready" value={labelReady} hint="Code + classification set" accent="#10b981" />
        <Stat label="Needs Waste Code" value={needsCode} hint="Missing EPA / waste code" accent="#f59e0b" />
        <Stat label="Hazardous" value={hazardous} hint="Hazardous or scheduled" accent="#dc2626" />
      </div>

      <Card>
        <CardHeader
          title="Container Label Status"
          subtitle="Label readiness per waste stream · Print RCRA container labels with QR codes"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 text-left">Waste Name</th>
                <th className="px-4 py-2.5 text-left">Code</th>
                <th className="px-4 py-2.5 text-left">Classification</th>
                <th className="px-4 py-2.5 text-left">Quantity</th>
                <th className="px-4 py-2.5 text-left">Accumulation Start</th>
                <th className="px-4 py-2.5 text-left">Label Readiness</th>
                <th className="px-4 py-2.5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {streams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-400">
                    No waste streams — add streams in the Waste Register to manage labels.
                  </td>
                </tr>
              ) : (
                streams.map((s) => (
                  <tr key={s.id} className={!s.waste_code ? "bg-amber-50/30" : "hover:bg-slate-50"}>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{s.waste_name}</td>
                    <td className="px-4 py-3">
                      {s.waste_code ? (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-700">
                          {s.waste_code}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-slate-100 text-slate-700">{s.classification.replace(/_/g, " ")}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{`${s.quantity} ${s.unit}`}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmt(s.created_at)}</td>
                    <td className="px-4 py-3">
                      {s.waste_code ? (
                        <Pill className="bg-emerald-100 text-emerald-700">Ready to print</Pill>
                      ) : (
                        <Pill className="bg-amber-100 text-amber-700">Add waste code</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <WasteLabelButton
                        stream={s}
                        label="Print Label"
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Storage Compatibility Matrix"
          subtitle="Incompatible co-storage pairs derived from the hazard classes & waste codes present in your register"
        />
        <div className="space-y-3 p-4">
          {flaggedPairs.length === 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>No incompatible co-storage pairs detected among current waste streams.</span>
            </div>
          ) : (
            flaggedPairs.map((pair, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  pair.risk === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ShieldAlert
                    className={`h-4 w-4 shrink-0 ${pair.risk === "critical" ? "text-red-500" : "text-amber-500"}`}
                  />
                  <span className="text-sm font-semibold text-slate-800">
                    {GROUP_LABEL[pair.a]} + {GROUP_LABEL[pair.b]}
                  </span>
                  <Pill
                    className={
                      pair.risk === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }
                  >
                    {pair.risk === "critical" ? "Critical" : "Warning — segregate"}
                  </Pill>
                </div>
                <p className="text-xs text-slate-700">{pair.reason}</p>
                <p className="mt-1.5 text-xs font-medium text-slate-600">
                  <span className="font-semibold uppercase tracking-wide text-slate-400">Required action: </span>
                  {pair.action}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { getWasteStreams, getChemicals } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { AddWasteButton } from "./AddWasteButton";
import type { Chemical } from "@/lib/types";
import { Zap } from "lucide-react";

const WASTE_STATUS_STYLE: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-700",
  manifested: "bg-blue-100 text-blue-700",
  disposed:   "bg-emerald-100 text-emerald-700",
  reported:   "bg-slate-100 text-slate-600",
};

const CLASS_STYLE: Record<string, string> = {
  hazardous:    "bg-red-100 text-red-700",
  non_hazardous:"bg-emerald-100 text-emerald-700",
  clinical:     "bg-orange-100 text-orange-700",
  radioactive:  "bg-purple-100 text-purple-700",
  scheduled:    "bg-red-100 text-red-700",
  recyclable:   "bg-blue-100 text-blue-700",
  general:      "bg-slate-100 text-slate-600",
};

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── GHS H-code → waste classification mapping ─────────────────────────────────
interface WasteSuggestion {
  chemicalId: string;
  chemicalName: string;
  classification: string;
  reason: string;
  disposalMethod: string;
  epaCode: string;
}

function suggestWaste(c: Chemical): WasteSuggestion | null {
  const h = c.hazard_statements;
  if (h.some((x) => /^H2[0-6]|^H27/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Flammable / Explosive", disposalMethod: "incineration", epaCode: "D001" };
  if (h.some((x) => /^H(30[0-2]|31[0-2]|33[0-2])/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Acute Toxic", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(350|351)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Carcinogenic", disposalMethod: "incineration", epaCode: "D012" };
  if (h.some((x) => /^H(360|361)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Reproductive Hazard", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(370|371|372|373)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Target Organ Toxin", disposalMethod: "treatment", epaCode: "D012" };
  if (h.some((x) => /^H(290|314|315)/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Corrosive", disposalMethod: "neutralization", epaCode: "D002" };
  if (h.some((x) => /^H4/.test(x)))
    return { chemicalId: c.id, chemicalName: c.name, classification: "hazardous", reason: "Aquatic Toxic", disposalMethod: "treatment", epaCode: "D012" };
  if (c.is_scheduled)
    return { chemicalId: c.id, chemicalName: c.name, classification: "scheduled", reason: "Scheduled substance", disposalMethod: "treatment", epaCode: "—" };
  return null;
}

export default async function WastePage() {
  const [streams, chemicals] = await Promise.all([getWasteStreams(), getChemicals()]);

  const pending    = streams.filter((w) => w.status === "pending").length;
  const manifested = streams.filter((w) => w.status === "manifested").length;
  const disposed   = streams.filter((w) => w.status === "disposed").length;
  const hazardous  = streams.filter((w) => w.classification === "hazardous" || w.classification === "clinical").length;

  // Build inventory-derived suggestions for active chemicals that aren't already tracked
  const trackedNames = new Set(streams.map((w) => w.waste_name.toLowerCase()));
  const suggestions: WasteSuggestion[] = [];
  for (const chem of chemicals) {
    if (chem.status !== "active") continue;
    const s = suggestWaste(chem);
    if (s && !trackedNames.has(chem.name.toLowerCase())) {
      suggestions.push(s);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Waste Management"
        subtitle="Inventory-driven waste profiles · Accumulation tracking · Manifests"
        actions={<AddWasteButton />}
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Waste Streams"  value={streams.length} hint="Tracked streams" />
          <Stat label="Hazardous"      value={hazardous}      hint="Haz + biohaz"      accent={hazardous > 0 ? "#dc2626" : "#10b981"} />
          <Stat label="Pending Pickup" value={pending}        hint="Awaiting disposal" accent={pending > 0 ? "#f59e0b" : "#10b981"} />
          <Stat label="Disposed YTD"   value={disposed}       hint="Completed"         accent="#10b981" />
        </div>

        {/* Pending alert */}
        {pending > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-900">
              {pending} Waste Stream{pending > 1 ? "s" : ""} Pending Pickup — Review Accumulation Limits
            </div>
            <div className="mt-0.5 text-xs text-amber-700">
              Ensure accumulation start dates and EPA 90/270-day limits are tracked. Contact disposal contractor.
            </div>
          </div>
        )}

        {/* ── Inventory-derived waste profile suggestions ───────────────────── */}
        {suggestions.length > 0 && (
          <Card className="mb-5">
            <CardHeader
              title="Inventory-Derived Waste Profiles"
              subtitle={`${suggestions.length} chemical${suggestions.length !== 1 ? "s" : ""} in your inventory suggest waste streams not yet recorded — create waste entries to close the gap`}
              right={
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  <Zap className="h-3 w-3" />
                  Inventory-driven
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Chemical</th>
                    <th className="px-4 py-2.5 text-left">Hazard Basis</th>
                    <th className="px-4 py-2.5 text-left">Suggested Classification</th>
                    <th className="px-4 py-2.5 text-left">Disposal Method</th>
                    <th className="px-4 py-2.5 text-left">EPA Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {suggestions.map((s) => (
                    <tr key={s.chemicalId} className="hover:bg-amber-50/30">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.chemicalName}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{s.reason}</td>
                      <td className="px-4 py-3">
                        <Pill className={CLASS_STYLE[s.classification] ?? "bg-slate-100 text-slate-600"}>
                          {s.classification.replace(/_/g, " ")}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-slate-600">
                        {s.disposalMethod.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{s.epaCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Waste streams table */}
        <Card>
          <CardHeader title="Waste Stream Register" subtitle={`${streams.length} streams · ${hazardous} hazardous · ${manifested} manifested`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Waste Name</th>
                  <th className="px-4 py-2.5 text-left">Code</th>
                  <th className="px-4 py-2.5 text-left">Classification</th>
                  <th className="px-4 py-2.5 text-left">Quantity</th>
                  <th className="px-4 py-2.5 text-left">Disposal Method</th>
                  <th className="px-4 py-2.5 text-left">Contractor</th>
                  <th className="px-4 py-2.5 text-left">Disposal Date</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {streams.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/waste/${w.id}`} className="font-medium text-blue-700 hover:underline">
                        {w.waste_name}
                      </Link>
                      {w.manifest_number && (
                        <div className="mt-0.5 text-xs font-mono text-slate-400">{w.manifest_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{w.waste_code ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Pill className={CLASS_STYLE[w.classification] ?? "bg-slate-100 text-slate-600"}>
                        {w.classification.replace(/_/g, " ")}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                      {w.quantity} {w.unit}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 capitalize">
                      {w.disposal_method.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{w.disposal_contractor ?? "—"}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(w.disposal_date)}</td>
                    <td className="px-4 py-3">
                      <Pill className={WASTE_STATUS_STYLE[w.status] ?? "bg-slate-100 text-slate-600"}>
                        {w.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
                {streams.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                      No waste streams recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

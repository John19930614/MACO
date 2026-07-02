import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";
import { getChemicalById } from "@/lib/data/ehsRepo";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { EditChemicalForm } from "./EditChemicalForm";
import { HazardAnalysisPanel } from "./HazardAnalysisPanel";
import { getHazardHistory } from "@/lib/actions/chemicalHazard";

export default async function ChemicalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [chemical, historyResult] = await Promise.all([
    getChemicalById(id),
    getHazardHistory(id),
  ]);
  if (!chemical) notFound();

  const history = historyResult.ok ? (historyResult.records ?? []) : [];

  const BAND_BADGE: Record<string, string> = {
    none:     "bg-slate-100 text-slate-600",
    low:      "bg-emerald-100 text-emerald-700",
    medium:   "bg-amber-100 text-amber-700",
    high:     "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={chemical.name}
        subtitle={`Chemical · ${chemical.storage_location}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/chemicals/${chemical.id}/passport`}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <ScanLine className="h-4 w-4" />
              Generate Smart Chemical Passport Label
            </Link>
            <Link
              href="/chemicals"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Chemicals
            </Link>
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Chemical record edit */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Edit Chemical</h2>
              <div className="flex gap-2">
                {chemical.is_scheduled && (
                  <Pill className="bg-orange-100 text-orange-700">Scheduled</Pill>
                )}
                <Pill className="bg-slate-100 text-slate-600 capitalize">{chemical.status}</Pill>
              </div>
            </div>
            <EditChemicalForm chemical={chemical} />
          </div>

          {/* Concentration hazard analysis */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Concentration hazard analysis</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                The same chemical can be dangerous at one concentration and safe at another.
                Enter the concentration you are working with to get an accurate hazard classification for that dilution.
              </p>
            </div>
            <HazardAnalysisPanel chemical={chemical} />
          </div>

          {/* Past classifications */}
          {history.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Past classifications</h3>
              <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                <ul className="divide-y divide-slate-50">
                  {history.map((rec) => (
                    <li key={rec.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${BAND_BADGE[rec.hazardBand] ?? "bg-slate-100 text-slate-600"}`}>
                        {rec.hazardBand} hazard
                      </span>
                      <span className="text-xs text-slate-600 font-medium">{rec.concentrationPct}%</span>
                      {rec.hazardTypes.length > 0 && (
                        <span className="text-xs text-slate-400">{rec.hazardTypes.join(", ")}</span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400 capitalize">{rec.reviewDecision}</span>
                      <span className="text-[10px] text-slate-400">{new Date(rec.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

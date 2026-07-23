import { getBuildingNfpaPosting } from "@/lib/actions/nfpa-704-diamond-calculation";
import { NFPA704Diamond } from "../../NFPA704Diamond";

// Large-print, print-friendly building entrance posting. Print / save-as-PDF
// with Ctrl/Cmd+P. On-screen helper text (mounting height, warnings) is hidden
// in the printed output via `print:hidden` so the placard prints clean.
export default async function NfpaPrintPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const { buildingId } = await params;

  let building;
  try {
    ({ building } = await getBuildingNfpaPosting({ buildingId }));
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-10 text-center">
        <p className="text-red-700">
          We couldn&apos;t load this building&apos;s posting. Please go back and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-10 print:p-0">
      <div className="flex flex-col items-center space-y-8 text-center">
        <h1 className="text-4xl font-bold print:text-5xl">{building.buildingName}</h1>

        <p className="max-w-md text-sm text-slate-500 print:hidden">
          Print this page (Ctrl/Cmd+P) and post at the building entrance, mounted 18–24
          inches off the ground, per NFPA 704 posting guidance.
        </p>

        <NFPA704Diamond rating={building.rating} size={380} />

        {!building.rating.isComplete && (
          <p className="max-w-md font-semibold text-amber-700 print:text-black">
            Warning: one or more hazard categories have no rating entered for this building
            yet. Do not post this placard until all containers have ratings — an unrated
            category is not the same as a zero / no-hazard rating.
          </p>
        )}

        <p className="text-xs text-slate-400">
          Generated {new Date(building.generatedAt).toLocaleString()} · BETA — pending
          EHS / fire-safety sign-off
        </p>
      </div>
    </div>
  );
}

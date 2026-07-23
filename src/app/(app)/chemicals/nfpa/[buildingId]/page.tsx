import Link from "next/link";
import { getBuildingNfpaPosting } from "@/lib/actions/nfpa-704-diamond-calculation";
import { NFPA704Diamond } from "../NFPA704Diamond";

export default async function NfpaBuildingPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const { buildingId } = await params;

  let data;
  try {
    data = await getBuildingNfpaPosting({ buildingId });
  } catch {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">NFPA 704 Ratings</h1>
        <p className="text-red-700">
          We couldn&apos;t load this building&apos;s ratings. Please refresh, or contact an
          admin if this keeps happening.
        </p>
        <Link href="/chemicals/nfpa" className="mt-4 inline-block text-sm text-blue-600">
          ← Back to buildings
        </Link>
      </div>
    );
  }

  const { building, storageAreas } = data;

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/chemicals/nfpa" className="text-sm text-blue-600">
          ← Back to buildings
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {building.buildingName} — NFPA 704 Ratings
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          Ratings roll up from each container, to each storage area (room), to a single
          rating for this building&apos;s entrance posting. Each color is taken as the{" "}
          <strong>worst</strong> value found — never averaged or diluted by quantity.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <NFPA704Diamond rating={building.rating} label="Building entrance posting" size={220} />
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            {building.storageAreaCount} storage area(s)
            {building.unratedContainerCount > 0 && (
              <span className="text-amber-700">
                {" "}· {building.unratedContainerCount} container(s) missing ratings
              </span>
            )}
          </div>
          <Link
            href={`/chemicals/nfpa/${building.buildingId}/print`}
            className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open printable posting
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Storage Areas</h2>
        {storageAreas.length === 0 ? (
          <div className="text-slate-500">
            No chemicals with a storage location yet for this building. Add chemicals to start
            tracking ratings.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storageAreas.map((area) => (
              <div
                key={area.storageAreaId}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center"
              >
                <div className="font-medium">{area.storageAreaName}</div>
                <NFPA704Diamond rating={area.rating} size={140} />
                <div className="text-xs text-slate-600">
                  {area.containerCount} container(s)
                  {area.unratedContainerCount > 0 && (
                    <span className="text-amber-700">
                      {" "}· {area.unratedContainerCount} missing ratings
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

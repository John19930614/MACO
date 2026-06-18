import { getSites, getCells, getLocations, getProofs, getEvents, getForecast, currentUser } from "@/lib/data/repo";
import { heatWeight } from "@/lib/arc/intelligence";
import { proofToRiskType } from "@/lib/risk/objects";
import { MapWorkspace, type EventPoint, type FailurePoint, type ForecastPoint } from "@/components/map/MapWorkspace";

const GAP = new Set(["missing", "weak_proof", "expired", "conflicting"]);

// Map-first dashboard — the default AMAYA screen (manual §5.8).
export default async function MapPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site } = await searchParams;
  const sites = await getSites();
  const siteId = site ?? sites[0]?.id;
  const [cells, locations, proofs, events, forecast] = await Promise.all([
    getCells({ site_id: siteId }),
    getLocations(siteId),
    getProofs(),
    getEvents(siteId),
    getForecast(siteId),
  ]);
  const siteName = sites.find((s) => s.id === siteId)?.name;

  // Composite heat weight per cell (blends severity, recency, status, proof gaps,
  // and whether the cell already produced an outcome).
  const gapByCell = new Map<string, number>();
  for (const p of proofs) if (GAP.has(p.status)) gapByCell.set(p.cell_id, (gapByCell.get(p.cell_id) ?? 0) + 1);
  const eventByCell = new Map<string, number>();
  for (const e of events) if (e.cell_id) eventByCell.set(e.cell_id, (eventByCell.get(e.cell_id) ?? 0) + 1);
  const now = Date.now();
  const heatByCell: Record<string, number> = {};
  for (const c of cells) heatByCell[c.id] = heatWeight(c, gapByCell.get(c.id) ?? 0, now, eventByCell.get(c.id) ?? 0);

  // Event Cells are placed at their precursor cell's location, so an outcome
  // appears exactly where the warning sign was. Clicking one opens that cell.
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const locById = new Map(locations.map((l) => [l.id, l]));
  const eventPoints: EventPoint[] = events.flatMap((e) => {
    const cell = e.cell_id ? cellById.get(e.cell_id) : undefined;
    const loc = cell ? locById.get(cell.location_id) : undefined;
    if (!cell || !loc) return [];
    return [{ id: e.id, title: e.title, kind: e.kind, severity: e.severity, cellId: cell.id, lng: loc.lng, lat: loc.lat }];
  });

  // Failure Cells: cells with one or more broken/unverified control proofs,
  // pinned (as hollow red rings) at the cell's location. One pin per cell.
  const failByCell = new Map<string, number>();
  for (const p of proofs) {
    if (!cellById.has(p.cell_id)) continue;
    if (proofToRiskType(p.status) === "failure") failByCell.set(p.cell_id, (failByCell.get(p.cell_id) ?? 0) + 1);
  }
  const failurePoints: FailurePoint[] = [...failByCell.entries()].flatMap(([cellId, count]) => {
    const cell = cellById.get(cellId)!;
    const loc = locById.get(cell.location_id);
    if (!loc) return [];
    return [{ cellId, title: cell.title, count, lng: loc.lng, lat: loc.lat }];
  });

  // Forecast band per location, placed at the location's coordinates.
  const forecastPoints: ForecastPoint[] = forecast.flatMap((fc) => {
    const loc = locById.get(fc.locationId);
    if (!loc) return [];
    return [{ locationId: fc.locationId, label: fc.label, score: fc.score, band: fc.band, lng: loc.lng, lat: loc.lat }];
  });

  return (
    <>
      <MapWorkspace cells={cells} locations={locations} sites={sites} siteId={siteId} role={currentUser().role} heatByCell={heatByCell} events={eventPoints} failures={failurePoints} forecast={forecastPoints} />
    </>
  );
}

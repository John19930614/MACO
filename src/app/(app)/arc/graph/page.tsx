import { getCells, getEdges, getBehaviors, getEvents, getProofs } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/primitives";
import { CellGraph3D } from "@/components/arc/CellGraph3D";
import {
  CELLS   as DEMO_CELLS,
  EDGES   as DEMO_EDGES,
  PROOFS  as DEMO_PROOFS,
  EVENT_CELLS    as DEMO_EVENTS,
  BEHAVIOR_CELLS as DEMO_BEHAVIORS,
} from "@/lib/data/mock";

export const metadata = { title: "Cell Relationship Graph — SafetyIQ" };

export default async function CellGraphPage() {
  const [cells, edges, behaviors, events, proofs] = await Promise.all([
    getCells(),
    getEdges(),
    getBehaviors(),
    getEvents(),
    getProofs(),
  ]);

  // When the live database has no Arc cells yet, fall back to the mock
  // fixtures so the visualization is always populated in dev/demo.
  const isDemo       = cells.length === 0;
  const displayCells     = isDemo ? DEMO_CELLS     : cells;
  const displayEdges     = isDemo ? DEMO_EDGES     : edges;
  const displayBehaviors = isDemo ? DEMO_BEHAVIORS : behaviors;
  const displayEvents    = isDemo ? DEMO_EVENTS    : events;
  const displayProofs    = isDemo ? DEMO_PROOFS    : proofs;

  const subtitle = `3D causal network — ${displayCells.length} cells · ${displayEdges.length} edge${displayEdges.length !== 1 ? "s" : ""} · ${displayBehaviors.length} behavior cluster${displayBehaviors.length !== 1 ? "s" : ""}`;

  return (
    <>
      <PageHeader title="Cell Relationship Graph" subtitle={subtitle} />

      {isDemo && (
        <div className="mx-4 mt-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          No Safety Cells in the live database yet — showing ARC demo data. Data will appear here once cells are ingested.
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden p-4">
        <CellGraph3D
          cells={displayCells}
          edges={displayEdges}
          behaviors={displayBehaviors}
          events={displayEvents}
          proofs={displayProofs}
        />
      </div>
    </>
  );
}

import { getCells, getEdges, getSites, getActions, getFindings } from "@/lib/data/repo";
import { buildPreventionWeb } from "@/lib/arc/prevention";
import { CellWeb } from "@/components/web/CellWeb";

// Cell Web — one unified linkage space across ALL cells and ALL platforms.
// No site/location grouping: every cell relates to every other it shares a
// cause, location, or hazard pattern with, and the layout lets structure emerge.
export default async function CellWebPage() {
  const [cells, edges, sites, actions, findings] = await Promise.all([
    getCells(), getEdges(), getSites(), getActions(), getFindings(),
  ]);
  const cellIds = new Set(cells.map((c) => c.id));
  const prevention = buildPreventionWeb(
    cells,
    actions.filter((a) => cellIds.has(a.cell_id)),
    findings.filter((f) => cellIds.has(f.cell_id)),
  );

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-900">Cell Web</h1>
        <p className="text-sm text-slate-500">
          Every Safety Cell, every platform — one mass linkage space. Cells that share causes, locations, or hazard patterns pull together; clusters emerge on their own.
        </p>
      </div>
      <CellWeb cells={cells} edges={edges} sites={sites} prevention={prevention} />
    </>
  );
}

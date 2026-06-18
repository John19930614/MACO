import { getSites, getCells, getEdges, getActions, getFindings } from "@/lib/data/repo";
import { buildPreventionWeb } from "@/lib/arc/prevention";
import { PreventionWeb } from "@/components/prevention/PreventionWeb";
import { PreventionSitePicker } from "@/components/prevention/PreventionSitePicker";

// Prevention Web — the whole anatomy: how cells affect each other (shared
// control-gap clusters + causal links) and connect to the prevention that
// closes the loop (manual: counterfactual prevention).
export default async function PreventionPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site } = await searchParams;
  const sites = await getSites();
  const siteId = site ?? sites[0]?.id;
  const siteName = sites.find((s) => s.id === siteId)?.name;

  const [cells, edges, actions, findings] = await Promise.all([
    getCells({ site_id: siteId }),
    getEdges(siteId),
    getActions(),
    getFindings(),
  ]);
  const cellIds = new Set(cells.map((c) => c.id));
  const model = buildPreventionWeb(
    cells,
    actions.filter((a) => cellIds.has(a.cell_id)),
    findings.filter((f) => cellIds.has(f.cell_id)),
  );

  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Prevention Web</h1>
          <p className="text-sm text-slate-500">
            Shared causes → cells affecting each other → the prevention that closes the gap. The connective tissue of counterfactual prevention.
          </p>
        </div>
        <div className="ml-auto">
          <PreventionSitePicker sites={sites} siteId={siteId} />
        </div>
      </div>
      <PreventionWeb cells={cells} edges={edges} model={model} />
    </>
  );
}

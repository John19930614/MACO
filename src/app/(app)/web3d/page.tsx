import { getCells, getEdges, getSites, getRiskGraph } from "@/lib/data/repo";
import { Web3D } from "@/components/web/Web3D";

// Cell Web 3D — the unified linkage space as an immersive 3D constellation you
// can orbit and fly through. Two views: the Safety-Cell linkage web, and the
// six-object Risk Intelligence Framework graph (manual §6).
export default async function Web3DPage() {
  const [cells, edges, sites, riskGraph] = await Promise.all([getCells(), getEdges(), getSites(), getRiskGraph()]);
  return (
    <>
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-900">Cell Web — 3D</h1>
        <p className="text-sm text-slate-500">Every Safety Cell as a node in an immersive 3D space; related cells pull together. Switch to Risk objects to see the six-object framework. Orbit, zoom, and click into any cell.</p>
      </div>
      <Web3D cells={cells} edges={edges} sites={sites} riskGraph={riskGraph} />
    </>
  );
}

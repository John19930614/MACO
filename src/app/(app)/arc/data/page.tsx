import { getCells, getProofs, getEdges, getActions, getFindings, getSites } from "@/lib/data/repo";
import { DataSpaceView } from "@/components/arc/DataSpaceView";
import { PageHeader } from "@/components/ui/primitives";

export default async function DataPage() {
  const [cells, proofs, edges, actions, findings, sites] = await Promise.all([
    getCells(),
    getProofs(),
    getEdges(),
    getActions(),
    getFindings(),
    getSites(),
  ]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Data Space"
        subtitle="Inspect the full entity graph for any Safety Cell — every linked record, proof, action, and finding visualised."
      />
      <DataSpaceView cells={cells} proofs={proofs} edges={edges} actions={actions} findings={findings} sites={sites} />
    </div>
  );
}

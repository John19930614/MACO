import { CELLS, PROOFS, EDGES, ACTIONS, AI_FINDINGS, SITES } from "@/lib/data/mock";
import { DataSpaceView } from "@/components/arc/DataSpaceView";
import { PageHeader } from "@/components/ui/primitives";

export default function DataPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Data Space"
        subtitle="Inspect the full entity graph for any Safety Cell — every linked record, proof, action, and finding visualised."
      />
      <DataSpaceView cells={CELLS} proofs={PROOFS} edges={EDGES} actions={ACTIONS} findings={AI_FINDINGS} sites={SITES} />
    </div>
  );
}

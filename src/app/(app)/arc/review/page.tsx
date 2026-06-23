import { getCells, getEdges, getFindings } from "@/lib/data/repo";
import { ReviewQueue } from "@/components/arc/ReviewQueue";
import { PageHeader } from "@/components/ui/primitives";

export default async function ReviewPage() {
  const [cells, edges, findings] = await Promise.all([
    getCells(),
    getEdges(),
    getFindings(),
  ]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Review Queue"
        subtitle="AI suggestions are advisory until a human accepts them. Every finding is explainable and reversible."
      />
      <ReviewQueue findings={findings} edges={edges} cells={cells} />
    </div>
  );
}

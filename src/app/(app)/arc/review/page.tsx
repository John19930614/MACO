import { CELLS, EDGES, AI_FINDINGS } from "@/lib/data/mock";
import { ReviewQueue } from "@/components/arc/ReviewQueue";
import { PageHeader } from "@/components/ui/primitives";

export default function ReviewPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Review Queue"
        subtitle="AI suggestions are advisory until a human accepts them. Every finding is explainable and reversible."
      />
      <ReviewQueue findings={AI_FINDINGS} edges={EDGES} cells={CELLS} />
    </div>
  );
}

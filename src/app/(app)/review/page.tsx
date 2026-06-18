import { PageHeader } from "@/components/ui/primitives";
import { ReviewQueue } from "@/components/workflow/ReviewQueue";
import { currentUser } from "@/lib/data/repo";

// Review Queue — the human-in-the-loop governance step: every AI finding and
// proposed causal link waits here for a person to accept or reject.
export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Review Queue" subtitle="AI suggestions are advisory until a human accepts them (manual §8.1)." />
      <ReviewQueue role={currentUser().role} />
    </>
  );
}

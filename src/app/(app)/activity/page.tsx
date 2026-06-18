import { PageHeader } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/workflow/ActivityFeed";

// Activity — the immutable audit trail as a team feed: who did what, when, why.
export default function ActivityPage() {
  return (
    <>
      <PageHeader title="Activity" subtitle="Audit trail of proof decisions, AI reviews, actions, and comments." />
      <ActivityFeed />
    </>
  );
}

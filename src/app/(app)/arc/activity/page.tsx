import { getAudit } from "@/lib/data/repo";
import { ActivityFeed } from "@/components/arc/ActivityFeed";
import { PageHeader } from "@/components/ui/primitives";

export default async function ActivityPage() {
  const entries = await getAudit();
  const sorted  = [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Activity"
        subtitle="Audit trail of proof decisions, AI reviews, actions, and cell changes."
      />
      <ActivityFeed entries={sorted} />
    </div>
  );
}

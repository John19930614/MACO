import { getEscalationQueue, type EscalationQueueResult } from "@/lib/actions/phase-4-action-response";
import { PageHeader, Card, Stat } from "@/components/ui/primitives";
import { Phase4Action } from "./Phase4Action";

// Manager-facing review queue for the Predictive Risk Engine (Phase 4). Sites
// that crossed into high-risk (Red) with a DRAFT corrective task waiting for a
// human. Nothing is sent until a manager explicitly confirms.
export default async function RiskEscalationsPage() {
  let queue: EscalationQueueResult | null = null;
  let denied = false;
  try {
    queue = await getEscalationQueue();
  } catch {
    // getEscalationQueue throws for a non-manager caller who reaches the URL
    // directly (the nav entry is already role-gated).
    denied = true;
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="p-8 text-center">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">You don&apos;t have access to this page</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Reviewing high-risk-site alerts is limited to EHS managers and admins. Contact your admin if you think this is a mistake.
          </p>
        </Card>
      </div>
    );
  }

  const counts = queue?.counts ?? { pending: 0, confirmed: 0, dismissed: 0 };
  const items = queue?.items ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Action Needed: High-Risk Sites"
        subtitle="Sites that crossed into high-risk (Red) with a draft corrective task waiting for your review. Nothing is sent until you confirm."
      />

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Waiting for review" value={counts.pending} icon="⏳" accent="#C62828" />
          <Stat label="Notified" value={counts.confirmed} icon="✅" accent="#2E7D32" />
          <Stat label="Dismissed" value={counts.dismissed} icon="✖️" accent="#64748b" />
        </div>

        {items.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Nothing here yet</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              No sites are currently flagged high-risk. If a site crosses into Red, its draft corrective task will show up here for your review.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((e) => (
              <Phase4Action key={e.id} escalation={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

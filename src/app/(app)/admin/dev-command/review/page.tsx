import { runGatewayHealthCheck } from "@/lib/gateway/agent";
import {
  buildPlatformReview,
  buildLiveFindings,
  type GatewayLiveInput,
} from "@/lib/devcenter/platform-review";
import { getConvertedFindingIds, getDismissedFindingIds } from "@/lib/devcenter/repo";
import {
  getGateSignal,
  getMigrationsSignal,
  getRlsSignal,
  getPipelineFindings,
  getLastPipelineRunAt,
} from "@/lib/devcenter/review-live";
import { PlatformReviewPanel } from "../_components/PlatformReviewPanel";

export const metadata = { title: "Platform Review · AI Dev Command Center" };

// Always run fresh — every check below reads live telemetry/schema state.
export const dynamic = "force-dynamic";

export default async function PlatformReviewPage() {
  // All live signals in parallel; each degrades to null/[] on failure so the
  // review still renders its catalog + pipeline findings. Findings that already
  // became tasks move to the task board and drop off this list.
  const [snapshot, gate, migrations, rls, pipelineFindings, lastPipelineRunAt, convertedIds, dismissedIds] =
    await Promise.all([
      runGatewayHealthCheck({ persist: false }).catch(() => null),
      getGateSignal(),
      getMigrationsSignal(),
      getRlsSignal(),
      getPipelineFindings(),
      getLastPipelineRunAt(),
      getConvertedFindingIds().catch(() => [] as string[]),
      getDismissedFindingIds().catch(() => [] as string[]),
    ]);
  const gateway: GatewayLiveInput | null = snapshot
    ? {
        overall_status: snapshot.overall_status,
        anomaly_count: snapshot.anomaly_count,
        ai_fallback_rate: snapshot.ai_fallback_rate,
        ai_calls: snapshot.ai_calls,
      }
    : null;

  const result = buildPlatformReview(
    { gateway, gate, migrations, rls },
    new Date().toISOString(),
    convertedIds,
    dismissedIds,
    [...pipelineFindings, ...buildLiveFindings(migrations, rls)],
  );
  return (
    <PlatformReviewPanel
      result={result}
      lastPipelineRunAt={lastPipelineRunAt}
      canDispatchScan={!!process.env.GITHUB_REVIEW_DISPATCH_TOKEN}
    />
  );
}

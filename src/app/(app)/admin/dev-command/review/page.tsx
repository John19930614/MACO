import { runGatewayHealthCheck } from "@/lib/gateway/agent";
import { buildPlatformReview, type GatewayLiveInput } from "@/lib/devcenter/platform-review";
import { PlatformReviewPanel } from "../_components/PlatformReviewPanel";

export const metadata = { title: "Platform Review · AI Dev Command Center" };

// Always run fresh — the AI Engine check reads live gateway telemetry.
export const dynamic = "force-dynamic";

export default async function PlatformReviewPage() {
  // The one live signal. Degrade gracefully if the gateway can't be reached so
  // the review still renders its catalog findings.
  const snapshot = await runGatewayHealthCheck({ persist: false }).catch(() => null);
  const gateway: GatewayLiveInput | null = snapshot
    ? {
        overall_status: snapshot.overall_status,
        anomaly_count: snapshot.anomaly_count,
        ai_fallback_rate: snapshot.ai_fallback_rate,
        ai_calls: snapshot.ai_calls,
      }
    : null;

  const result = buildPlatformReview(gateway, new Date().toISOString());
  return <PlatformReviewPanel result={result} />;
}

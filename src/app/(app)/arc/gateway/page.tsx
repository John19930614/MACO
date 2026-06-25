import { GatewayHealth } from "@/components/arc/GatewayHealth";
import { PageHeader } from "@/components/ui/primitives";
import { runGatewayPipeline } from "@/lib/gateway/pipeline";

export default async function GatewayPage() {
  const report = await runGatewayPipeline().catch(() => null);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Gateway Health"
        subtitle={'Every record passes 3 AI gateways then the 10-check "Nothing Missed" review before entering the Cell Database.'}
        actions={
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-semibold">
            {report ? report.mode : "live"}
          </span>
        }
      />
      <GatewayHealth report={report} />
    </div>
  );
}

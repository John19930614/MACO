import { GatewayHealth } from "@/components/health/GatewayHealth";

// AI Gateway — 3 validation stages every EHS record passes before it enters
// the EHS Database: Schema & Format → Business Rules → Anomaly & Quality →
// "Nothing Missed" 10-check final review → EHS Database.
export default function GatewayPage() {
  return (
    <>
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-900">AI Gateway — EHS data validation</h1>
        <p className="text-sm text-slate-500">
          3 AI gateways + a final &ldquo;Nothing Missed&rdquo; review run live over EHS records — proof that nothing is broken and no bad record enters the database.
        </p>
      </div>
      <GatewayHealth />
    </>
  );
}

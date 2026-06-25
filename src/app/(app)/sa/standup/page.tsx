import { Users } from "lucide-react";
import { DarkPageHeader } from "@/components/ui/primitives";
import { getMeetings } from "@/lib/csp/standup";
import StandupClient from "./StandupClient";

// Superadmin panel: the daily meeting between GUS (platform intelligence) and
// the EHS Records Validation Agent — convene on demand, review past standups,
// and action the gaps they surface.
export default async function SAStandupPage() {
  const meetings = await getMeetings(30).catch(() => []);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DarkPageHeader
        title="Agent Standup — GUS × EHS Validation Agent"
        subtitle="A daily meeting where the two agents share what they see and surface gaps to close"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-indigo-800/50 bg-indigo-900/20 p-4 text-sm text-indigo-200">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
          <p>
            Once a day, <strong>GUS</strong> (Global Unified Safety Intelligence — platform-wide health and forecasting)
            and the <strong>EHS Records Validation Agent</strong> compare notes. GUS brings the platform picture; the EHS
            agent brings what it&apos;s validating, escalating, and learning. Together they surface gaps and improvement
            actions. It runs automatically each morning, or convene it now.
          </p>
        </div>
        <StandupClient meetings={meetings} />
      </div>
    </div>
  );
}

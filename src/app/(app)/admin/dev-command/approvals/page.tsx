import { ApprovalCenter } from "../_components/ApprovalCenter";
import { SAMPLE_APPROVALS } from "@/lib/devcenter/sample";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Approvals · AI Dev Command Center" };

export default function ApprovalsPage() {
  const pending = SAMPLE_APPROVALS.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Approval center</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {pending} waiting. The AI team pauses here before anything risky — deploying, deleting, changing the database, or changing logins.
          </p>
        </div>
      </div>

      <ApprovalCenter approvals={SAMPLE_APPROVALS} title="All approval requests" subtitle="Newest and still-waiting requests first" />
    </div>
  );
}

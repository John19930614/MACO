import { ApprovalCenter } from "../_components/ApprovalCenter";
import { getAllApprovals } from "@/lib/devcenter/repo";
import { SAMPLE_APPROVALS } from "@/lib/devcenter/sample";
import { ShieldCheck, Info } from "lucide-react";

export const metadata = { title: "Approvals · AI Dev Command Center" };

export default async function ApprovalsPage() {
  const real = await getAllApprovals();
  const usingSample = real.length === 0;
  const approvals = usingSample ? SAMPLE_APPROVALS : real;
  const pending = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Approval center</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {pending} waiting. The AI team pauses here before anything risky — deploying, deleting, changing the database, logins, or settings. Every decision is logged and can&apos;t be skipped.
          </p>
        </div>
      </div>

      {usingSample && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>These are example approvals. Real requests from your tasks appear here and can be approved directly.</p>
        </div>
      )}

      <ApprovalCenter
        approvals={approvals}
        title="All approval requests"
        subtitle="Newest and still-waiting requests first — approve, reject (with a reason), or request changes"
        actionable={!usingSample}
      />
    </div>
  );
}

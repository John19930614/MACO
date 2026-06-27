import Link from "next/link";
import { DevTaskIntakeForm } from "../../_components/DevTaskIntakeForm";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New task · AI Dev Command Center" };

export default function NewTaskPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/dev-command/tasks" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">New task for the AI team</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Tell the team what you want. They&apos;ll plan it and check with you before doing anything risky.</p>
      </div>
      <DevTaskIntakeForm />
    </div>
  );
}

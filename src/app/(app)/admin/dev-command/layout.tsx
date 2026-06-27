import { requireDevCommandAccess } from "@/lib/devcenter/access";
import { DevCommandNav } from "./_components/DevCommandNav";
import { Bot } from "lucide-react";

/**
 * AI Dev Command Center shell layout. Admin-only: requireDevCommandAccess() is
 * the page-level guard backing up the /admin/* edge gate in middleware.ts.
 * Provides the title bar + tab nav; pages render inside the scroll area.
 */
export default async function DevCommandLayout({ children }: { children: React.ReactNode }) {
  await requireDevCommandAccess();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 px-6 pb-1 pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">AI Dev Command Center</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hand software tasks to your AI team. They plan, draft, test, and review — and always ask before anything risky.
            </p>
          </div>
        </div>
        <DevCommandNav />
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950">
        {children}
      </div>
    </div>
  );
}

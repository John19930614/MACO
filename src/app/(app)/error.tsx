"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Something went wrong</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          This screen hit an unexpected error. Your data is safe — try again, or head back to the dashboard.
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Try again</button>
        <Link href="/dashboard" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Dashboard</Link>
      </div>
    </div>
  );
}

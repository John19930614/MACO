import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center dark:bg-slate-950">
      <div className="text-6xl font-extrabold text-slate-300 dark:text-slate-700">404</div>
      <p className="text-sm text-slate-500 dark:text-slate-400">That page doesn’t exist.</p>
      <Link href="/dashboard" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        Go to dashboard
      </Link>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap, Activity } from "lucide-react";
import {
  type PlatformReviewResult,
  type ReviewFinding,
  STATUS_LABEL,
  STATUS_TONE,
  SOURCE_LABEL,
} from "@/lib/devcenter/platform-review";
import { ReRunReviewButton } from "./ReRunReviewButton";

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  medium: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  low: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function StatusDot({ status }: { status: "green" | "amber" | "red" }) {
  const tone =
    status === "green" ? "bg-emerald-500" : status === "amber" ? "bg-amber-500" : "bg-red-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${tone}`} />;
}

export function PlatformReviewPanel({ result }: { result: PlatformReviewResult }) {
  const openCount = result.findings.filter((f) => f.severity !== "green").length;

  return (
    <div className="space-y-5">
      {/* Header + overall status */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Platform Review
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[result.overall]}`}
                >
                  {STATUS_LABEL[result.overall]}
                </span>
              </div>
              <p className="max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The Dev Manager runs six checks across the platform and turns each finding into a
                ready-to-approve task. {openCount} open item(s). The AI Engine check runs live; the
                other five reflect the last full review ({result.lastFullReview}).
              </p>
            </div>
          </div>
          <ReRunReviewButton />
        </div>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.checks.map((c) => (
          <div
            key={c.key}
            className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusDot status={c.status} />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.label}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                  c.live
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {c.live ? <Activity className="h-2.5 w-2.5" /> : null}
                {c.live ? "Live" : "Catalog"}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {c.summary}
            </p>
          </div>
        ))}
      </div>

      {/* Findings */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Findings &amp; suggested tasks
        </h3>
        {result.findings.map((f) => (
          <FindingCard key={f.id} f={f} />
        ))}
      </div>
    </div>
  );
}

function FindingCard({ f }: { f: ReviewFinding }) {
  const href = `/admin/dev-command/tasks/new?f=${encodeURIComponent(f.id)}`;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusDot status={f.severity} />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{f.title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_TONE[f.priority]}`}
            >
              {f.priority}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {f.module}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              {SOURCE_LABEL[f.source]}
            </span>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {f.detail}
          </p>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-500">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Fix:</span>{" "}
            {f.recommendation}
          </p>
          {f.where && (
            <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              <Zap className="h-3 w-3" />
              {f.where}
            </p>
          )}
        </div>
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
        >
          Turn into a task
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

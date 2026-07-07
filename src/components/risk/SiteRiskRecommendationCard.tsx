"use client";

// Renders on the existing Predictive Risk page (src/app/(app)/predictive-risk),
// next to each site's score. Shows the AI-written prevention recommendation in
// place of the templated explanation when one exists, with a manager-only
// "Generate recommendation" button and an EHS-lead review control that records
// an auditable accuracy verdict. All server actions return { ok, ... } — never
// throw for expected failures — so errors render as plain-English copy.

import { useState, useTransition } from "react";
import {
  generateSitePreventionRecommendation,
  recordRecommendationReview,
} from "@/lib/actions/phase-3-ai-agent";

type Verdict = "accurate" | "needs_edit" | "inaccurate";

interface Props {
  siteRiskScoreId: string;
  explanationText: string;
  aiRecommendationText: string | null;
  /** True for EHS managers/admins/superadmins — shows Generate + Review controls. */
  canManage: boolean;
  /** Display name of the signed-in reviewer, recorded on the review row. */
  reviewerName: string;
}

const VERDICT_META: Record<Verdict, { icon: string; label: string }> = {
  accurate:   { icon: "✅", label: "Accurate" },
  needs_edit: { icon: "✏️", label: "Needs edit" },
  inaccurate: { icon: "❌", label: "Inaccurate" },
};

export function SiteRiskRecommendationCard({
  siteRiskScoreId,
  explanationText,
  aiRecommendationText,
  canManage,
  reviewerName,
}: Props) {
  const [recommendation, setRecommendation] = useState<string | null>(aiRecommendationText);
  const [error, setError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<"idle" | "saved">("idle");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function onGenerate() {
    setError(null);
    setReviewState("idle");
    startTransition(async () => {
      const res = await generateSitePreventionRecommendation({ siteRiskScoreId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRecommendation(res.aiRecommendationText);
    });
  }

  function onReview(verdict: Verdict) {
    if (!recommendation) return;
    setError(null);
    startTransition(async () => {
      const res = await recordRecommendationReview({
        siteRiskScoreId,
        recommendationText: recommendation,
        reviewedBy: reviewerName,
        verdict,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReviewState("saved");
    });
  }

  const showingAi = !!recommendation;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-center gap-1.5">
        <span aria-hidden>💡</span>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {showingAi ? "AI prevention recommendation" : "Prevention guidance"}
        </h4>
      </div>

      <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-200">
        {recommendation ?? explanationText}
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error} Please check your connection and try again.
        </p>
      )}

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Working…" : showingAi ? "Regenerate recommendation" : "Generate recommendation"}
          </button>
        </div>
      )}

      {canManage && showingAi && (
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          {reviewState === "saved" ? (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              ✅ Review recorded — thank you. This sign-off is saved for audit.
            </p>
          ) : (
            <>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                EHS lead review (recorded as {reviewerName})
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes (e.g. what to fix if it needs an edit)"
                rows={2}
                className="mb-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex flex-wrap gap-2">
                {(Object.keys(VERDICT_META) as Verdict[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onReview(v)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <span aria-hidden>{VERDICT_META[v].icon}</span> {VERDICT_META[v].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

// ============================================================
// DRAFT — NOT DEPLOYED. Predictive Risk dashboard (Phase 1: read-only display).
//
// Renamed from "TrainAnML" to "Predictive Risk Engine" / "Risk Model" — this
// page is intentionally never called "training" anywhere in its UI, to avoid
// confusion with the existing Training & Competency module (/training).
//
// No auto-refresh polling, no alerting UI, no model-health/monitoring panel.
// Scores refresh via a nightly scheduled batch job (once DRAFT_predictive_risk_engine.sql
// and the scheduler are approved) or this page's admin-only "Recalculate now"
// button — never on page load, never live.
// ============================================================

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import { canManage, type Role } from "@/lib/constants";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { recalculateSiteRiskScores, getSiteRiskScores } from "@/lib/actions/predictive-risk-engine";

type Band = "green" | "amber" | "orange" | "red";

interface SiteRiskRow {
  siteId: string;
  siteName: string;
  score: number;
  band: Band;
  explanation: string;
  updatedAt: string | null; // null until a score has been computed/persisted
}

const BAND_META: Record<Band, { icon: string; label: string; className: string }> = {
  red:    { icon: "🔴", label: "Act Now",  className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  orange: { icon: "🟠", label: "Elevated", className: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" },
  amber:  { icon: "🟡", label: "Watch",    className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  green:  { icon: "🟢", label: "Low Risk", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
};

export default function PredictiveRiskPage() {
  const { user } = useDemoUser();
  const canRecalculate = !!user && canManage(user.role as Role);

  const [scores, setScores] = useState<SiteRiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await getSiteRiskScores();
      if (!cancelled) {
        setScores(rows as SiteRiskRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleRecalculate() {
    setRecalculating(true);
    setError(null);
    const res = await recalculateSiteRiskScores({});
    if (!res.ok) {
      setError(res.error);
      setRecalculating(false);
      return;
    }
    // NOTE: until DRAFT_predictive_risk_engine.sql is applied, results are
    // computed fresh but not persisted — they won't survive a page reload.
    setScores(
      res.results.map((r) => ({
        siteId: r.siteId,
        siteName: r.siteName,
        score: r.rawScore,
        band: r.band,
        explanation: r.explanationText,
        updatedAt: new Date().toISOString(),
      })),
    );
    setRecalculating(false);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Predictive Risk Engine"
        subtitle="Site risk scores from overdue inspections, expired SDS, missing training, and recent incidents/near-misses. Updated overnight — not a live feed."
        actions={
          canRecalculate ? (
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={recalculating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {recalculating ? "Recalculating…" : "Recalculate now"}
            </button>
          ) : undefined
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
            {error} Please try again, or contact an admin if this keeps happening.
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-400">Loading risk scores…</div>
        ) : scores.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="No risk scores yet"
            description={
              canRecalculate
                ? "Click \"Recalculate now\" above to run the first calculation for your sites."
                : "An EHS manager or admin can run the first calculation to see site risk bands here."
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scores.map((s) => {
              const meta = BAND_META[s.band];
              return (
                <Card key={s.siteId}>
                  <CardHeader
                    title={s.siteName}
                    right={
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
                        <span aria-hidden>{meta.icon}</span> {meta.label}
                      </span>
                    }
                  />
                  <div className="px-4 pb-4">
                    <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{s.score.toFixed(1)}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {s.explanation}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {s.updatedAt ? `Updated overnight · ${new Date(s.updatedAt).toLocaleString()}` : "Updated overnight"}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

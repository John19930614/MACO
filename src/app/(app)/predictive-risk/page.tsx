"use client";

// ============================================================
// Predictive Risk dashboard (Phase 1: read-only display + go-live gate).
//
// Renamed from "TrainAnML" to "Predictive Risk Engine" / "Risk Model" — this
// page is intentionally never called "training" anywhere in its UI, to avoid
// confusion with the existing Training & Competency module (/training).
//
// Go-live gate: the board runs in "Preview mode" until an EHS lead and a
// Reliance superadmin both sign off (see Phase1Go + predictive_risk_go_live),
// at which point it flips to "Live" and a one-time trust banner appears.
//
// No auto-refresh polling, no alerting UI, no model-health/monitoring panel.
// Scores refresh via a nightly scheduled batch job or this page's manager-only
// "Refresh risk scores" button — never on page load, never live.
// ============================================================

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { useDemoUser } from "@/lib/context/demo-user";
import { canManage, type Role } from "@/lib/constants";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  recalculateSiteRiskScores,
  getSiteRiskScores,
  getGoLiveStatus,
  type GoLiveStatus,
} from "@/lib/actions/predictive-risk-engine";
import { SiteRiskRecommendationCard } from "@/components/risk/SiteRiskRecommendationCard";
import { Phase1Go } from "./Phase1Go";

type Band = "green" | "amber" | "orange" | "red";

interface SiteRiskRow {
  id: string | null; // site_risk_scores.id when persisted; null for fresh/mock results
  siteId: string;
  siteName: string;
  score: number;
  band: Band;
  explanation: string;
  aiRecommendation: string | null; // AI prevention guidance, once generated
  updatedAt: string | null; // null until a score has been computed/persisted
}

// Every badge is icon + word (never color alone), so it stays legible under
// color-blindness simulation (Chrome DevTools vision-deficiency emulation).
const BAND_META: Record<Band, { icon: string; label: string; className: string }> = {
  red:    { icon: "🔴", label: "High risk · Act Now",  className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  orange: { icon: "🟠", label: "Elevated",             className: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" },
  amber:  { icon: "🟡", label: "Watch",                className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  green:  { icon: "🟢", label: "Low risk",             className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
};

const DEFAULT_GO_LIVE: GoLiveStatus = {
  status: "preview",
  ehs_lead_approved_at: null,
  superadmin_approved_at: null,
};

// Icon + word, color-blind safe: filled dot for Live, half dot for Preview.
function StatusBadge({ status }: { status: "preview" | "live" }) {
  return status === "live" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
      <span aria-hidden>●</span> Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <span aria-hidden>◐</span> Preview mode
    </span>
  );
}

export default function PredictiveRiskPage() {
  const { user } = useDemoUser();
  const role = (user?.role as Role) ?? null;
  const canRecalculate = !!role && canManage(role);
  const isSuperadmin = !!user && user.tenant_id === null;
  const canSeeSignoff = !!role && (canManage(role) || isSuperadmin);

  const [scores, setScores] = useState<SiteRiskRow[]>([]);
  const [goLive, setGoLive] = useState<GoLiveStatus>(DEFAULT_GO_LIVE);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrustBanner, setShowTrustBanner] = useState(false);

  const trustKey = `preRiskTrustSeen:${user?.tenant_id ?? "demo"}`;

  function maybeShowTrustBanner(status: "preview" | "live") {
    if (status !== "live") return;
    if (typeof window !== "undefined" && !localStorage.getItem(trustKey)) {
      setShowTrustBanner(true);
    }
  }

  function dismissTrustBanner() {
    if (typeof window !== "undefined") localStorage.setItem(trustKey, "1");
    setShowTrustBanner(false);
  }

  async function refreshGoLive() {
    const gl = await getGoLiveStatus();
    if (gl.ok) {
      setGoLive(gl.data);
      maybeShowTrustBanner(gl.data.status);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rows, gl] = await Promise.all([getSiteRiskScores(), getGoLiveStatus()]);
      if (cancelled) return;
      setScores(rows as SiteRiskRow[]);
      if (gl.ok) {
        setGoLive(gl.data);
        maybeShowTrustBanner(gl.data.status);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // NOTE: until the predictive risk engine migration is applied, results are
    // computed fresh but not persisted — they won't survive a page reload.
    setScores(
      res.results.map((r) => ({
        id: null, // fresh compute — not persisted yet, so no AI recommendation/review controls
        siteId: r.siteId,
        siteName: r.siteName,
        score: r.rawScore,
        band: r.band,
        explanation: r.explanationText,
        aiRecommendation: null,
        updatedAt: new Date().toISOString(),
      })),
    );
    setRecalculating(false);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Predictive Risk Engine"
        subtitle="Site risk scores from overdue inspections, expired SDS, missing training, and recent incidents/near-misses."
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={goLive.status} />
            {canRecalculate ? (
              <button
                type="button"
                onClick={handleRecalculate}
                disabled={recalculating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {recalculating ? "Refreshing…" : "Refresh risk scores"}
              </button>
            ) : null}
          </div>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Persistent in both Preview and Live states — never implies real-time. */}
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400">
          Updated overnight — not real-time
        </p>

        {showTrustBanner && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-200">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              This dashboard now uses real data from your audits, chemical inventory, training records, and
              incidents to estimate site risk.
            </div>
            <button
              type="button"
              onClick={dismissTrustBanner}
              className="shrink-0 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
            >
              Got it
            </button>
          </div>
        )}

        {goLive.status === "preview" && canSeeSignoff && (
          <Phase1Go
            ehsLeadApprovedAt={goLive.ehs_lead_approved_at}
            superadminApprovedAt={goLive.superadmin_approved_at}
            currentUserRole={role ?? ""}
            isSuperadmin={isSuperadmin}
            tenantId={user?.tenant_id ?? null}
            onApproved={refreshGoLive}
          />
        )}

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
                ? "Click \"Refresh risk scores\" above to run the first calculation for your sites."
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
                    {s.id ? (
                      // Persisted score → show the AI prevention recommendation (with the
                      // templated explanation as the built-in fallback until one is generated),
                      // plus manager Generate + EHS-lead Review controls.
                      <SiteRiskRecommendationCard
                        siteRiskScoreId={s.id}
                        explanationText={s.explanation}
                        aiRecommendationText={s.aiRecommendation}
                        canManage={canRecalculate}
                        reviewerName={user?.display_name ?? "EHS Lead"}
                      />
                    ) : (
                      // Freshly computed (not yet persisted) → templated explanation only.
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {s.explanation}
                      </p>
                    )}
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

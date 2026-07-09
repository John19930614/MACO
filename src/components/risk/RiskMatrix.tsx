"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RISK_LEVEL_META, riskLevelFromScore } from "@/lib/constants";
import type { RiskAssessment } from "@/lib/types";

interface RiskMatrixProps {
  riskAssessments: RiskAssessment[];
}

// Rows: likelihood 1 (Rare) .. 5 (Almost Certain). Columns: consequence
// 1 (Negligible) .. 5 (Catastrophic). Labels mirror the existing Risk Heat Map
// so a risk reads the same in both views.
const LIKELIHOOD_LEVELS = [1, 2, 3, 4, 5];
const CONSEQUENCE_LEVELS = [1, 2, 3, 4, 5];

const LIKELIHOOD_LABELS: Record<number, string> = {
  1: "Rare",
  2: "Unlikely",
  3: "Possible",
  4: "Likely",
  5: "Almost Certain",
};
const CONSEQUENCE_LABELS: Record<number, string> = {
  1: "Negligible",
  2: "Minor",
  3: "Moderate",
  4: "Major",
  5: "Catastrophic",
};

export function RiskMatrix({ riskAssessments }: RiskMatrixProps) {
  const [activeCellTooltip, setActiveCellTooltip] = useState<string | null>(null);

  // Group each assessment into its likelihood×consequence cell. Uses the same
  // raw scores stored on the record — no re-derivation, no data fetch.
  const grid = useMemo(() => {
    const map = new Map<string, RiskAssessment[]>();
    for (const risk of riskAssessments) {
      const key = `${risk.likelihood_score}-${risk.consequence_score}`;
      const bucket = map.get(key) ?? [];
      bucket.push(risk);
      map.set(key, bucket);
    }
    return map;
  }, [riskAssessments]);

  if (riskAssessments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
        No risk assessments found yet. Add a risk assessment to see it plotted here.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Likelihood × Consequence Matrix</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Rows: How likely is it to happen? &nbsp;·&nbsp; Columns: How serious would it be?
        </p>
      </div>

      <div className="overflow-x-auto">
        <table aria-label="Risk matrix" className="min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className="p-2" />
              {CONSEQUENCE_LEVELS.map((c) => (
                <th key={c} scope="col" className="p-2 text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                  {CONSEQUENCE_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Likelihood 5 (top) → 1 (bottom) so the highest-risk corner sits top-right. */}
            {[...LIKELIHOOD_LEVELS].reverse().map((l) => (
              <tr key={l}>
                <th scope="row" className="whitespace-nowrap p-2 text-right text-xs font-medium text-slate-700 dark:text-slate-300">
                  {LIKELIHOOD_LABELS[l]}
                </th>
                {CONSEQUENCE_LEVELS.map((c) => {
                  const score = l * c; // 1–25 matrix score
                  const level = riskLevelFromScore(score);
                  const meta = RISK_LEVEL_META[level];
                  const cellRisks = grid.get(`${l}-${c}`) ?? [];
                  const cellKey = `${l}-${c}`;
                  const onExtreme = level === "extreme";
                  return (
                    <td
                      key={c}
                      className="relative border border-white dark:border-slate-800 p-1 align-top"
                      style={{ backgroundColor: meta.bgColor, minWidth: 96, height: 72 }}
                    >
                      <span className="sr-only">
                        {LIKELIHOOD_LABELS[l]} likelihood, {CONSEQUENCE_LABELS[c]} consequence — {meta.label} risk
                      </span>
                      <span
                        aria-hidden
                        className={`pointer-events-none absolute right-1 top-0.5 text-[9px] font-semibold ${
                          onExtreme ? "text-white/70" : "text-black/40"
                        }`}
                      >
                        {score}
                      </span>
                      <div className="relative flex flex-wrap gap-1">
                        {cellRisks.map((risk, idx) => (
                          <Link
                            key={risk.id}
                            href={`/risk/${risk.id}`}
                            aria-label={`Open risk: ${risk.title} — ${meta.label} risk, ${LIKELIHOOD_LABELS[l]} likelihood, ${CONSEQUENCE_LABELS[c]} consequence`}
                            className="inline-flex h-3.5 w-3.5 rounded-full border border-black/25 bg-white/95 transition-transform hover:scale-125 focus:scale-125 focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-blue-600"
                            style={{ transform: `translate(${idx * 3}px, ${idx * 3}px)` }}
                            onMouseEnter={() => setActiveCellTooltip(cellKey)}
                            onMouseLeave={() => setActiveCellTooltip(null)}
                            onFocus={() => setActiveCellTooltip(cellKey)}
                            onBlur={() => setActiveCellTooltip(null)}
                            title={risk.title}
                          />
                        ))}
                      </div>
                      {cellRisks.length > 1 && activeCellTooltip === cellKey && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-xs shadow-lg">
                          {cellRisks.map((r) => (
                            <div key={r.id} className="truncate text-slate-700 dark:text-slate-200">{r.title}</div>
                          ))}
                        </div>
                      )}
                      {cellRisks.length === 0 && (
                        <span className="sr-only">No risks currently rated at this level</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">Each dot is one risk. Click a dot to open its details.</p>

      <div className="flex flex-wrap gap-4 text-xs text-slate-700 dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: RISK_LEVEL_META.low.bgColor }} /> Green = Low risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: RISK_LEVEL_META.medium.bgColor }} /> Amber = Medium risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: RISK_LEVEL_META.high.bgColor }} /> Red = High risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: RISK_LEVEL_META.extreme.bgColor }} /> Dark red = Extreme risk — stop the activity and take immediate action
        </span>
      </div>
    </div>
  );
}

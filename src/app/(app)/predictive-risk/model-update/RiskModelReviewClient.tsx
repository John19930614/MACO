"use client";

import { useState, useTransition } from "react";
import {
  approveReweightProposal,
  rejectReweightProposal,
} from "@/lib/actions/risk-model-reweight";

export interface ProposalRow {
  id: string;
  correlation_coefficient: number | null;
  p_value: number | null;
  sample_size: number | null;
  false_positive_rate: number | null;
  fp_tolerance: number | null;
  proposed_indicators: { id: string; key: string; oldWeight: number; newWeight: number }[] | null;
  proposed_bands:
    | { id: string; band_key: string; oldMin: number; newMin: number; oldMax: number; newMax: number }[]
    | null;
}

type ActionResult = { ok: boolean; error?: string };

export function RiskModelReviewClient({ proposal }: { proposal: ProposalRow | null }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [showMath, setShowMath] = useState(false);

  if (!proposal) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="font-medium text-slate-800">Nothing to review yet</p>
        <p className="mt-1 text-sm text-slate-600">
          A new risk-model update appears here once enough incident history and outcome feedback has been
          collected and a validation run has been generated. Check back later.
        </p>
      </div>
    );
  }

  const coef = proposal.correlation_coefficient ?? 0;
  const fpRate = proposal.false_positive_rate ?? 0;
  const tolerance = proposal.fp_tolerance ?? 0.15;
  // Correlation can be negative; show a floor of 0% for the plain-English line.
  const accuracyPct = Math.max(0, Math.round(coef * 100));
  const fpPct = Math.round(fpRate * 100);
  const indicators = proposal.proposed_indicators ?? [];
  const bands = proposal.proposed_bands ?? [];

  function run(action: (i: { proposalId: string }) => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await action({ proposalId: proposal!.id });
      setResult(res);
    });
  }

  const done = result?.ok === true;

  return (
    <div className="space-y-6">
      {/* Plain-English summary */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <p className="text-base text-slate-800">
          Based on <strong>{proposal.sample_size ?? 0}</strong> historical data points, this updated scoring
          model lines up with about <strong>{accuracyPct}%</strong> of real incident patterns and had a
          false-alarm rate of <strong>{fpPct}%</strong> (the approved ceiling is {Math.round(tolerance * 100)}%).
        </p>
      </div>

      {/* Before / after diff */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 font-medium text-slate-900">What will change</h2>
        {indicators.length === 0 && bands.length === 0 ? (
          <p className="text-sm text-slate-500">No weight or cutoff changes are proposed in this run.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-4 font-medium">Item</th>
                  <th className="py-1 pr-4 font-medium">Current</th>
                  <th className="py-1 font-medium">Proposed</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {indicators.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-1 pr-4">{i.key} weight</td>
                    <td className="py-1 pr-4">{i.oldWeight}</td>
                    <td className="py-1">{i.newWeight}</td>
                  </tr>
                ))}
                {bands.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="py-1 pr-4">{b.band_key} range</td>
                    <td className="py-1 pr-4">
                      {b.oldMin}–{b.oldMax}
                    </td>
                    <td className="py-1">
                      {b.newMin}–{b.newMax}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reassurance — approval never enables alerting */}
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        ℹ️ Approving this only updates the risk score&rsquo;s inputs (indicator weights and score cutoffs).
        It does <strong>not</strong> turn on automatic alerts, paging, or escalations — those stay off and
        are configured separately.
      </div>

      {/* See the math */}
      <div>
        <button
          type="button"
          className="text-sm text-slate-500 underline"
          onClick={() => setShowMath((v) => !v)}
        >
          {showMath ? "Hide the math" : "See the math"}
        </button>
        {showMath && (
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            <p>Correlation coefficient: {coef.toFixed(3)}</p>
            <p>p-value: {(proposal.p_value ?? 1).toFixed(4)} (needs to be below 0.05 to approve)</p>
            <p>False-positive rate: {(fpRate * 100).toFixed(1)}%</p>
            <p>False-positive tolerance: {(tolerance * 100).toFixed(0)}%</p>
          </div>
        )}
      </div>

      {/* Result banners */}
      {result?.error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {result.error}
        </div>
      )}
      {done && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Saved. Your decision has been recorded and any approved weights and cutoffs are now live.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={isPending || done}
          onClick={() => run(approveReweightProposal)}
        >
          {isPending ? "Saving…" : "Approve"}
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={isPending || done}
          onClick={() => run(rejectReweightProposal)}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

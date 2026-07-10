# Phase 5 — Learning Loop / Evolve: Predictive Risk Engine

## What this is, in plain English
The risk score used to run on a fixed formula with placeholder weights that nobody
had checked against real events. This phase checks that formula against real
incident history and shows you, in plain terms:

- **How often the model's risk level matched what actually happened** — the
  correlation between the predicted band and whether an incident really followed.
- **How often it cried wolf** — flagged a site as high-risk (orange/red) when no
  incident followed within the window. That's the false-alarm / false-positive rate.

It then proposes small, bounded tweaks to the scoring and asks a human to approve
them. Nothing is applied automatically.

## Where to review it
Go to **Predictive Risk → Review & Approve Risk Model Update**
(`/predictive-risk/model-update`). It's visible to safety managers, EHS managers,
and admins (the same tier that sees Predictive Risk), plus Reliance platform
admins. You'll see:

1. A plain-English summary card ("matched about X% of real incidents, false-alarm
   rate of Y%, ceiling is Z%").
2. A before/after table of exactly which indicator **weights** and score-band
   **cutoffs** would change.
3. An optional "see the math" link with the correlation coefficient and p-value.
4. A clear note: **approving this does not turn on automatic alerts or paging.**

## How the numbers are computed
- **Predicted bands over time** come from `public.site_risk_scores` — every
  persisted row is already a point-in-time prediction (`score_date` + `band_key`).
  There is no separate snapshot table.
- For each prediction we open a follow-up window (default 30 days) and check
  whether an incident occurred at that site inside it.
- **Correlation** is a point-biserial correlation between the band rank
  (green=0 … red=3) and a 0/1 "incident happened" flag, with a two-sided
  significance test (Student-t). We require **p < 0.05** to consider a model valid.
- **False-positive rate** = high-risk periods (orange/red) with no following
  incident ÷ all high-risk periods. It must be **≤ the EHS-approved tolerance**
  (`risk_model_validation_runs.fp_tolerance`, default 0.15).

The pure math lives in `src/lib/risk-engine/validation.ts`; the dataset loader in
`src/lib/risk-engine/validation-data.ts`. Unit tests exercise the math directly;
the against-real-data assertions run only when a staging DB is wired up
(`SAFETYIQ_VALIDATION_DB`), because the standard test run is offline/mock.

## What approval does and does NOT do
- Approving **only** updates `leading_indicators.weight` values and
  `risk_score_bands` `min_score`/`max_score` cutoffs. The scoring engine reads
  these on the next recalculation (`loadScoringConfig`), so an approved change
  actually takes effect.
- It is gated twice: an EHS lead (manager/admin) must approve, **and** the run
  must be statistically significant (p < 0.05) with a false-positive rate within
  tolerance. If either fails, approval is refused with a plain-English reason.
- It **never** changes trigger conditions or escalation/paging behavior. Those are
  configured and enabled separately, and Phase 4 auto-escalation stays **off**
  (`PAGING_ENABLED = false`).
- Until this validation is reviewed and signed off by an EHS lead, Phase 4's
  auto-escalation must **not** be relied on for real paging.

> **Platform-wide scope.** `leading_indicators` and `risk_score_bands` are shared
> reference data, not per-tenant. An approved reweighting affects every tenant's
> scores — which is exactly why a human sign-off is required.

## Feedback loop
Every time a recommendation is followed (or not), and whether risk actually went
down afterward, is logged to `risk_model_feedback`
(`submitRiskModelFeedback`). That outcome data feeds the next reweighting
proposal — the model improves from real results, not guesses. Weight nudges are
bounded to ≤10% per run so the model evolves in small, reviewable steps.

## Who can do what
- **Safety managers / EHS managers / admins**: review validation results, approve
  or reject a proposed reweighting, submit outcome feedback.
- **The platform**: generates reweighting proposals on a schedule
  (`generateReweightProposal`); it never applies them without human approval.

## Related
- `docs/predictive-risk-engine.md` — Phase 1 scoring + the go-live sign-off
  checklist this validation feeds into.

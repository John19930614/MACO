# Predictive Risk Engine (Phase 1) — DRAFT, not yet live

**Status: draft for EHS-lead / superadmin review.** Nothing described below is
running in production yet — the migration is unapplied and the server action
is not wired to any button or scheduler until this is approved.

## What this is

A dashboard (`/predictive-risk`, nav label "Predictive Risk") that shows each
site's current safety risk as a numeric score and a color band (🟢 Green /
🟡 Amber / 🟠 Orange / 🔴 Red), based on data already in SafetyIQ:

- Overdue inspections (`audits` — scheduled/in-progress and past due)
- Expired chemical SDS (`chemical_inventory.sds_expiry` in the past)
- Missing/overdue employee training (`training_records.expiry_date` in the past)
- Recent open incidents (last 90 days, not near-misses, not closed)
- Recent open near-misses (last 90 days, not closed)

This is **not** the same thing as **Training & Competency** (`/training`,
employee course completions) — this is a **Risk Model** that looks across
several safety signals to estimate how much attention a site needs. Every
label in the UI and nav says "Predictive Risk Engine" / "Risk Model," never
"training a model," specifically to avoid that confusion.

## How often does it update?

Overnight, once per day, via a scheduled batch job — **not live**. The
dashboard shows "Updated overnight" next to each score's timestamp. An EHS
manager or admin can also click **Recalculate now** to refresh on demand; that
button is hidden from everyone else.

## What do the colors mean?

| Band | Meaning | Default cutoff (raw score) |
|------|---------|------|
| 🟢 Green | Low Risk | 0 – 2.99 |
| 🟡 Amber | Watch | 3 – 5.99 |
| 🟠 Orange | Elevated | 6 – 8.49 |
| 🔴 Red | Act Now | 8.5+ |

These cutoffs, and the weight given to each indicator, are **placeholders**
seeded by the draft migration — they have not been reviewed by an EHS/safety
manager yet. Once reviewed, they can be adjusted directly in the
`risk_score_bands` / `leading_indicators` tables (admin-editable) without a
code deploy. Requesting a threshold change is as simple as an admin updating
the relevant row — see an admin if a band doesn't match your real-world
judgment for a site.

## What happens when a site is flagged high-risk?

In this first release: **nothing happens automatically.** The score and a
plain-language explanation (e.g. "Risk rose because 3 inspections are overdue
and 2 SDS have expired") are shown on the dashboard. A human decides whether
to act, escalate, or notify someone.

Automatic alerts, paging, and AI-agent-triggered actions are **intentionally
not part of this phase** — they are deferred to a later phase and require a
separate sign-off from an EHS lead, including a statistical review of
false-positive rates, before being turned on.

## What's not in this release

- No model-health/monitoring screen (planned for a later phase)
- No automatic retraining loop
- No auto-escalation or paging
- No AI Gateway calls of any kind from this code path
- No changes to production data or deploys without explicit human approval

## Before this can go live

1. An EHS/safety manager reviews the seeded indicator weights and band
   cutoffs in `supabase/migrations/DRAFT_predictive_risk_engine.sql` and
   confirms they reflect real-world judgment.
2. The migration runs against a preview/staging Supabase branch first — never
   directly against production.
3. Scores are backfilled and sanity-checked for at least 5 real sites by an
   EHS manager ("does Red actually mean act this week here?").
4. The statistical validation test in
   `test/predictive-risk-engine.test.ts` (currently `it.skip`) is completed
   with real historical incident data and reviewed for an acceptable
   false-positive rate before anyone treats a score as "validated."
5. Role gating is manually verified: a non-admin/non-EHS-manager account
   cannot see the "Recalculate now" button and cannot call the server action
   directly.
6. RLS is confirmed to correctly scope `site_risk_scores` to a user's own
   tenant (cross-tenant access denied).

# Phase 3 — AI Agent Logic: Predictive Risk Engine

Building on the Phase 1 risk score (visible on the **Predictive Risk** page), this
phase adds three things. All of it is **read-only / observational** — no alert is
ever sent, and nothing retrains the model. Those are later phases.

> **How this maps to real roles.** This codebase has no `superadmin` or `ehs_lead`
> role string. Throughout Phase 3:
> - **"superadmin"** = a Reliance internal user (`isSuperadmin()`, i.e. `tenant_id IS NULL`).
> - **"EHS lead"** = the manager tier `canManage()` — `safety_manager`, `ehs_manager`, or `admin`.
>   This is the exact tier the Phase 1 go-live "EHS lead" sign-off already uses.

## What this adds

1. **Risk Score Reliability screen** (`/sa/risk-reliability`, superadmins only).
   Answers "Is the risk model working well right now?" It shows a plain-English
   summary, the EHS-lead review agreement (accurate / needs edit / inaccurate),
   the current indicator weights (what to watch for **drift**), recent scores, and
   a verifiable log of every gateway trigger. Non-technical terms ("accuracy",
   "drift") have explainers that open on click **and** keyboard focus.

   Renamed from "model-health monitoring" per UX feedback — that phrase appears
   nowhere in the UI.

2. **Quiet trigger logging** (`ai_gateway_trigger_log`). A server-side check fires
   only when (a) a site's risk band crosses to a worse band (e.g. Amber → Orange),
   or (b) two or more leading indicators worsen at the same time. When it fires it
   writes one structured, independently-verifiable row describing *what it would
   alert on* — and sends **nothing**. A human reads the log and decides. Actually
   sending alerts is **Phase 4**.

3. **AI-written prevention recommendations**. On the site risk page EHS managers
   already use, an "Generate recommendation" button calls the existing AI Gateway
   (`generateStructuredJson` — no new AI plumbing) to write specific, actionable
   guidance into `site_risk_scores.ai_recommendation_text`, shown in place of the
   generic templated explanation. If none has been generated yet, the templated
   `explanation_text` still shows (the fallback path).

## What "accuracy" and "drift" mean here

- **Accuracy**: when the model flagged a site as higher risk, did an EHS lead
  agree the recommendation was worth acting on? We measure it through **human
  reviews**, not an automatic score — because Phase 1 records *predictions*, not
  yet their real-world *outcomes*. (Outcome-based statistical accuracy is
  deferred until there's enough labelled history — see the skipped test in
  `test/predictive-risk-engine.test.ts`.)
- **Drift**: predictions gradually becoming less useful over time. A falling share
  of "accurate" reviews across successive weeks is the early-warning sign.

## Review process (so "reviewed by an EHS lead" is a real workflow, not a checkbox)

- **Reviewer**: the designated EHS Lead (manager tier) for the account. Their name
  is recorded on each review row (`ai_recommendation_reviews.reviewed_by`).
- **Sample size**: minimum **10 recommendations per site, or 20 total** across the
  account — whichever is greater — before this phase is signed off.
- **Cadence**: weekly spot-checks during rollout, then monthly once stable.
- **Sign-off record**: each review (accurate / needs edit / inaccurate + notes) is
  saved to `ai_recommendation_reviews` and surfaced in the Risk Score Reliability
  screen, so anyone can later check who reviewed what and when.

**Acceptance gate:** do not mark Phase 3 done until the required sample has been
reviewed with a **majority "accurate"** verdict. If it falls short, treat the
generated recommendations as not production-ready and iterate on the AI Gateway
prompt/context in `src/lib/actions/phase-3-ai-agent.ts`.

Audit query:

```sql
select site_risk_score_id, reviewed_by, verdict, reviewed_at, notes
from ai_recommendation_reviews
order by reviewed_at desc;
```

## Where things live

| Piece | Location |
| --- | --- |
| Migration (additive) | `supabase/migrations/20260707050000_phase3_ai_agent.sql` |
| Server actions | `src/lib/actions/phase-3-ai-agent.ts` |
| Reliability screen | `src/app/(app)/sa/risk-reliability/` |
| Recommendation card | `src/components/risk/SiteRiskRecommendationCard.tsx` (rendered on `/predictive-risk`) |
| Tests | `test/phase-3-ai-agent.test.ts` |

## Dependency & data flow

Phase 3 needs Phase 1 **persisting** scores. As part of this work,
`recalculateSiteRiskScores` was switched on to write to `site_risk_scores`
(service-role, tenant ownership enforced in-app), and after persisting it does a
best-effort `evaluateGatewayTrigger` per site to populate the trigger log. Under
`MOCK_MODE` there is no Supabase, so persistence, AI generation, and reviews all
no-op with a plain-English "runs on a connected environment" message.

## Explicit exclusions

- **No** auto-escalation, paging, email, or webhook — Phase 4.
- **No** automatic retraining of the scoring model — Phase 5.

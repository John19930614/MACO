# Predictive Risk Engine — Go-Live Checklist

**Status: Phase 1 go-live gate.** The dashboard (`/predictive-risk`) stays in
**Preview mode** for every tenant until the two-person sign-off below is
complete and the migrations are applied to staging. Production apply happens
only after all 6 engineering items are checked and both approvals are recorded.

## For safety managers (plain English)

When this dashboard says **Live**, the risk scores you see are calculated from
your real audits, chemical inventory, training records, and incidents —
refreshed **overnight, not in real time**. While it says **Preview mode**, treat
the numbers as a preview only; they are not yet confirmed for real decisions.

If go-live is ever paused or a migration step is rejected during setup, the
dashboard simply stays in **Preview mode** — nothing breaks, no data is lost,
and your team is not affected.

## What the colors mean

Every badge shows an icon **and** a word (never color alone), so it stays
legible under color-blindness.

| Band | Meaning | Default cutoff (raw score) |
|------|---------|------|
| 🟢 Green | Low risk | 0 – 2.99 |
| 🟡 Amber | Watch | 3 – 5.99 |
| 🟠 Orange | Elevated | 6 – 8.49 |
| 🔴 Red | High risk · Act Now | 8.5+ |

These cutoffs and the per-indicator weights are **seed placeholders** until an
EHS/safety manager reviews them (checklist item 1). After go-live they can be
tuned directly in the `risk_score_bands` / `leading_indicators` tables
(admin-editable) with no code deploy.

## Two-person sign-off (who does what)

1. **EHS lead** (a tenant manager — `safety_manager` / `ehs_manager` / `admin`)
   reviews the seeded weights/cutoffs and the backfilled scores for real sites,
   then clicks **Approve** on Step 1 of the dashboard's sign-off panel.
2. **Superadmin** (a Reliance platform superadmin — `profiles.tenant_id IS NULL`)
   confirms the migration applied cleanly to staging and that role/RLS checks
   pass, then clicks **Approve** on Step 2.
3. Once **both** approvals are recorded, the dashboard automatically flips to
   **Live** for that tenant and shows the trust banner once.

> Note: there is no `superadmin` *role* in this platform — a superadmin is a
> profile with no tenant. Because of that, the two approvers are genuinely
> distinct parties, and the superadmin approval is enforced by `isSuperadmin()`
> in `approveGoLiveStep()`, not by a role string.

## Engineering checklist (internal — do not surface to end users)

- [ ] 1. EHS/safety manager reviewed seeded `leading_indicators` weights and `risk_score_bands` cutoffs for real-world validity, and filled the `SEED VALUES` sign-off comment in the migration. Owner: _____ Date: _____
- [ ] 2. Both migrations (`20260707030000_predictive_risk_engine.sql`, `20260707040000_predictive_risk_go_live_signoff.sql`) applied to a preview/staging Supabase branch — never directly to prod. Owner: _____ Date: _____
- [ ] 3. Backfilled and sanity-checked scores for at least 5 real sites with an EHS manager ("does Red actually mean act this week here?"). Owner: _____ Date: _____
- [ ] 4. Verified role gating — a non-manager cannot see "Refresh risk scores" and `recalculateSiteRiskScores()` returns `{ ok: false }` (not a throw) when called directly. Owner: _____ Date: _____
- [ ] 5. Confirmed RLS scopes `site_risk_scores` and `predictive_risk_go_live` to the caller's own tenant (cross-tenant read denied). Owner: _____ Date: _____
- [ ] 6. Confirmed the dashboard always shows "Updated overnight — not real-time" in both states and never implies live data; band badges use icon+word, checked with a color-blindness simulator (Chrome DevTools vision-deficiency emulation or Coblis). Owner: _____ Date: _____

## Statistical validation (deferred to a later phase)

Correlation of predicted bands against historical incidents, plus a
false-positive-rate review, is **not** part of this gate. The corresponding
`it.skip` test in `test/predictive-risk-engine.test.ts` stays skipped until real
historical data and an explicit EHS sign-off exist. No alerting/escalation is
turned on in Phase 1, so a wrong band has no automated consequence yet.

## Rollback

If the staging migration fails or is rejected, or either sign-off is not
completed: the dashboard **stays in Preview mode**. No production impact, no data
loss — Preview is the safe default. Re-run the migration after fixes and restart
the checklist from item 2. The go-live flip is fully reversible by setting
`predictive_risk_go_live.status` back to `'preview'` for the tenant.

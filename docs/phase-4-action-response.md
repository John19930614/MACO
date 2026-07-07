# Action Needed: High-Risk Sites (Predictive Risk Engine — Phase 4)

## What this does
When a site's risk score crosses into high-risk (**Red** band, raw score ≥ 8.5), the system automatically:
1. Creates an **escalation record** (`risk_escalations`, status `needs_review`).
2. Drafts a **corrective task** (a `capa_records` row, `source_type = 'risk_score_escalation'`) linked back to the exact risk score that triggered it (`source_id = site_risk_scores.id`).
3. Puts it in a **Needs Review** queue at **/risk-escalations** for an EHS manager — **nobody is paged or notified yet.**

An EHS manager opens the queue, reads the plain-English reason the site turned Red, edits the suggested corrective task if needed, and clicks **"Yes, notify the team"** to send the in-app notification. Clicking **Dismiss** closes it with no notification (and closes the draft corrective task), logged for audit via the escalation record itself.

**Idempotent by design:** a unique index on `risk_escalations.site_risk_score_id` means re-running the evaluation against the same score can never create a duplicate escalation or duplicate corrective task.

## What this does NOT do (yet)
This phase does **not** page anyone's phone, send SMS, or call an on-call rotation. There is deliberately **no external paging provider wired anywhere in the codebase.** The flag `PAGING_ENABLED` in `src/lib/predictive-risk-engine/paging.ts` is hard-coded `false`. Real paging stays off until **all** of:
- Phase 3's Red-trigger logic has been observed running read-only for a meaningful period, **and**
- Phase 5's statistical validation shows an acceptable false-positive rate, **and**
- an EHS lead has signed off **in writing** that the false-alarm rate is acceptable for a specific real site.

## How "notification" works here
There is no separate notifications table in this platform — in-app notifications are computed live in the app shell (`src/app/(app)/layout.tsx`) from real domain records. A **confirmed** escalation surfaces there as a "risk" notification (with who was notified and when), which is the in-app delivery. Until a manager confirms, nothing appears.

## Who can use it
Mapped to this platform's real roles (there is no `ehs_lead` role):
- **View queue + confirm/dismiss:** `canManage()` — `safety_manager`, `ehs_manager`, `admin` — plus Reliance superadmins.
- Site supervisors/field officers can see corrective tasks in the normal CAPA module but **cannot** approve or dispatch escalations.

## Plain-English copy templates (reuse for support/training)
- "Action Needed: High-Risk Site" (not "Escalation")
- "Suggested corrective action (needs your review)" (not "CAPA action" with a raw ID)
- "Automatic notifications are paused for {{siteName}} — a manager must review and approve before anyone is paged."
- "Yes, notify the team" (the confirm button)
- "We notified {{recipientName/role}}. This is recorded with who and when for the audit trail." (after confirm)
- "Dismissed — no notification was sent. This is logged." (after dismiss)

## For admins: enabling paging later
Flipping `PAGING_ENABLED` is a manual, explicit change that must NOT happen without: (1) written EHS-lead sign-off, (2) an agreed escalation ladder (who is paged first, who is backup, and after how long), and (3) Phase 5's false-positive numbers in hand. This is a critical-risk boundary — see `docs/predictive-risk-engine.md`.

## Files
- Server actions: `src/lib/actions/phase-4-action-response.ts`
- Paging flag: `src/lib/predictive-risk-engine/paging.ts`
- Review UI: `src/app/(app)/risk-escalations/{page.tsx,Phase4Action.tsx}`
- Nav + notification wiring: `src/components/layout/LeftNav.tsx`, `src/app/(app)/layout.tsx`
- Migration: `supabase/migrations/20260707060000_risk_escalations.sql`
- Tests: `test/phase-4-action-response.test.ts`

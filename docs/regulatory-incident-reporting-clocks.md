# Regulatory Incident Reporting Clocks

Turns the incidents module's single "regulatory reportable" checkbox into live,
per-jurisdiction countdown clocks (federal OSHA, California Cal/OSHA, and EPA/state
for environmental releases), with a closure gate that keeps an incident open until
every required report is documented.

> ⚠ **Not legal advice.** The seeded reporting rules encode the deadlines named in
> the feature request but must be reviewed and completed by legal/compliance before
> this control is relied on. EPA/state timers vary by substance and state.

## For investigators and EHS managers

When you record a serious incident, open the **Reporting Status** panel on the
incident and answer a few plain yes/no questions — e.g. *"Was anyone admitted to a
hospital as an in-patient?"* You never need to know OSHA terminology. Based on your
answers, SafetyIQ starts the right countdown clock(s):

- **Federal OSHA** — fatality (report within 8 hours); in-patient hospitalization,
  amputation, or loss of an eye (within 24 hours).
- **California Cal/OSHA** — a serious injury, illness, or death in California
  (immediately, no later than 8 hours). This clock runs **independently** of the
  federal clock, so an incident can carry both at once.
- **EPA / state** — a reportable-quantity environmental release (see below).

Each clock shows a plain-language countdown (e.g. *"5 hours left to report"*) with a
green → amber → red visual. As a deadline nears, the clock escalates (amber at 75%,
red at 90%, overdue at 100%) and produces a notification naming exactly what's due
and when.

Once you've called in the report, enter the **confirmation number** right in the
Reporting Status panel. That marks the clock reported and records who entered it and
when, for legal defensibility.

## Immediate-response checklist

After a serious incident, follow the one-step-at-a-time checklist (mobile-friendly):
secure the scene, control hazards, identify affected people and witnesses, determine
reportability, start the clock, notify the right people, preserve evidence
(permits/JSA/training/video/photos/equipment data), and assign a lead investigator.

## Closing an incident

You **can't close an incident while a regulatory report is still outstanding.** This
is enforced both in the UI and server-side. If closure is blocked, you'll see exactly
which report(s) are missing and what to do — either enter the confirmation number, or,
if it turns out not to be reportable, provide a short explanation. The block clears as
soon as every clock is reported or marked not reportable.

## Environmental releases

Set an incident's type to **Environmental release** to get its own EPA/state timer
set, tracked separately from injury reporting. An environmental deadline never blocks
(or is blocked by) an unrelated injury report.

## Roles

Only Safety/EHS managers and admins (plus platform superadmins) can start/stop clocks,
enter confirmation numbers, or override the closure gate. Everyone else on the tenant
sees the Reporting Status panel read-only. (The platform has no separate
investigator/legal/HR roles; `MANAGER_ROLES` govern write access, mirrored by the
table RLS policies.)

## Admin: configuring the reporting rules

The deadlines live in `public.regulatory_reporting_rules` (columns: `jurisdiction`,
`event_type`, `deadline_hours`, `description`, `source_citation`, `active`). They are
platform-wide reference data; writes are service-role/superadmin only. **Changes must
be reviewed by Legal before they take effect.** The computation constant
(`REGULATORY_RULES` in `src/lib/regulatory/jurisdictionEngine.ts`) mirrors these rows
and must be kept in sync.

## Data model & audit trail

- `regulatory_reporting_rules` — the rule catalog (seeded federal/CA/EPA).
- `incident_regulatory_clocks` — one row per active clock on an incident, with
  `status`, `started_at`, `deadline_at`, `confirmation_number`, `justification_text`.
- `incident_regulatory_clock_events` — an append-only audit trail (`started`,
  `escalated`, `notified`, `reported`, `overridden`, `closed`) with actor + timestamp.
- `incidents.has_open_regulatory_clocks` — denormalized flag for the fast closure gate.
- `incidents.regulatory_reportable` is **deprecated** but retained for back-compat.

## Rollback / disabling

The feature is part of the **incidents** module. Turning the incidents module off for a
tenant (via `tenant_module_access`) hides the whole module; the reporting-clock data and
audit trail remain intact. To fully back out the schema, drop the three new tables and
the `has_open_regulatory_clocks` column — all changes are additive and reversible.

## Escalation job

`escalateOverdueClocks()` (in `src/lib/actions/regulatoryIncidentReportingClocks.ts`)
advances open clocks to their threshold band and logs `escalated`/`notified` events.
It uses the service-role client and is safe to call on demand by a manager. To run it
on a schedule, add an `/api/cron/*` route guarded by `CRON_SECRET` and register it in
`vercel.json` (mirroring the existing cron routes).

# Evacuation Drill Compliance Calendar

Part of the Emergency / EAP module. Lives at **Emergency → Drill Calendar**
(`/emergency/drill-calendar`).

## What this is for

This page keeps track of every drill your site needs to run — fire evacuation,
chemical release, shelter-in-place, severe weather, active threat, medical,
spill, RCRA contingency, confined-space rescue, accountability, comms test,
tabletop, and business continuity — based on your building type and what your
local fire code (AHJ) requires.

It does **not** assume one drill a year. Some occupancies need drills every
month, every quarter, or once per shift, and the calendar schedules whatever the
rules (or your own stricter policy) demand.

> **A note on wording.** The spec calls this a "facility." In SafetyIQ the unit
> of physical location is a **site**, so there is one facility profile per site,
> and everything is scoped to your tenant. "Facility" and "site" mean the same
> thing here.

## Facility (site) profile

Set up your site's basic facts once:

- **AHJ** — your local fire authority / authority having jurisdiction.
- **Occupancy classification** — often decides how often you must drill.
- **Shifts** — e.g. Day / Night / Weekend. Drills can be required per shift.
- **High-hazard operations** and **hazmat inventory** flags.
- **Generator category** and **alarm / suppression systems**.

Only a **Safety Manager**, **EHS Manager**, or **Admin** can edit the profile.

## Required vs. company frequency

For each drill type you record:

- The **legally required** frequency and its **legal source** (e.g. an IFC
  section, an OSHA citation, or a company policy reference). The legal source is
  always shown so anyone can see *why* a drill is scheduled.
- Your **company's own** frequency, if it's stricter.

The calendar always uses **whichever is more frequent**.

## The calendar

Press **Generate calendar** and the system builds the schedule from your
requirements. If a drill is required per shift, you get one entry per shift. Each
entry shows a due date and a status:

- **Scheduled** — upcoming.
- **Completed** — a drill has been logged against it.
- **Overdue** — past its due date (raised automatically by *Check overdue*).
- **Escalated** — overdue and escalated to coordinators/wardens.

Statuses use an **icon plus a word**, never colour alone.

Regenerating rebuilds only the outstanding (scheduled) entries; completed and
overdue history is left untouched.

## Logging a drill

Press **Log a drill** and fill in one form, grouped into short sections:

1. **Timing** — event type, date, start/end time.
2. **Participants & roster** — who took part; contractors/visitors present.
3. **Alarm & response times** — alarm method; evacuation, assembly, and
   accountability times (in seconds).
4. **Routes & equipment** — blocked/impassable routes; equipment issues.
5. **Wardens & observers** — who ran and who watched the drill.
6. **Problems & evidence** — notes and evidence links (photos/docs).
7. **Corrective actions & retraining** — follow-up actions, plan-revision and
   retraining dates, and the result (passed / failed / incomplete).

Coordinators and above can log drills.

## Alerts you might see

- **No warden logged** — a drill was recorded with no warden on duty.
- **Roster / accountability mismatch** — people were counted as participating
  but accountability was never reconciled (no accountability time captured).
- **Overdue drill** — a required drill is past its due date.
- **Failed drill** — the drill result was *failed*.

Alerts are written to the drill compliance action log and surface on the
Command Center for real-time readiness visibility.

## Corrective actions → CAPA

Any corrective action you enter on a drill record automatically creates a
**CAPA record** (`source_type = drill_record`), linked back to the drill so it's
fully traceable.

## EAP review

If a drill **fails**, or if a **real emergency** happened, the system raises an
**EAP review flag** (pending) against the site and logs an *EAP review required*
alert. This flags the Emergency Action Plan for review — it does **not** change
the EAP itself; a person still reviews and updates it.

## Overdue escalation

**Check overdue** (also callable by the ops cron) flips any past-due scheduled
drills to *Overdue* and logs a critical action for each, so nothing quietly
lapses.

## Permissions & data

- **Managers/Admins**: edit the facility profile and frequency requirements.
- **Coordinators and above**: generate the calendar, log drills, assign wardens,
  run overdue escalation.
- All tables are tenant-scoped with `in_tenant(tenant_id)` row-level security —
  a user cannot read or write another tenant's drill data. Writes additionally
  verify the target site belongs to the caller's tenant.
- In demo mode the page renders read-only and actions return a friendly
  "requires a live database" message.

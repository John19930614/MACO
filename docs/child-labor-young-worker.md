# Young Worker Profiles & Task Assignment Gate

## Who can see this
Only **safety managers, EHS managers, and admins** (plus Reliance platform superadmins) can view or edit young-worker profiles. Supervisors can see task-gate *decisions* (in the gate log) but **not** the underlying personal details — date of birth, permit documents, or parent/guardian contact — unless they also hold a manager role.

> Note: this platform has no separate "HR" or "owner" role. Access maps to the roles that actually exist here (`safety_manager`, `ehs_manager`, `admin`).

## What this does
For any employee under 18, we keep a profile with their verified date of birth, home/work state, school status, work-permit details, parent/guardian authorization, and their role type (for example, student learner or paid intern).

When a task is assigned (or restricted equipment is checked out), we automatically check the assignment against the worker's age, state, and the task's equipment and hazard type. If the assignment isn't allowed by law, **it is blocked — not just flagged** — and the assigner sees a short plain-English reason (e.g., "This task requires the worker to be 18 or older"). Every decision is written to a gate log.

> Current scope: this platform does not yet have a general task-assignment/scheduling module, so the gate ships as a **callable evaluator** (`evaluateTaskAssignmentGate` / `enforceEquipmentCheckoutGate`) plus its rule table and decision log. Whatever assignment or equipment-checkout flow is added next calls it to get the hard stop.

## Wisconsin (WI) specifics
- Workers ages 12–15 need a valid work permit on file.
- Hours-of-work postings are tracked.
- WI's hazardous-activity list is checked in addition to the federal list (add WI rows to `hazardous_task_rules` with `jurisdiction = 'WI'`).

## California (CA) specifics
- Both a **Permit to Employ** and a **Permit to Work** must be on file *before the worker's first shift*. Assignments are blocked until both permit numbers are recorded.

## Alerts
- You'll get an alert when a work permit is about to expire (14 days out) or has expired. Repeated evaluations don't spam duplicates — an open alert of the same type is reused.
- Alerts also cover hours and school-attendance conflicts (`hours_violation`, `school_attendance_conflict`).

## Minor injuries
If an incident is reported with a young worker linked (the incident's `young_worker_id`), the system automatically raises a high-priority alert (`minor_injury_capa`) and opens a **critical CAPA** (corrective action) — no manual step required.

## Important — not legal advice
This tool is a safety net, not a replacement for legal review. The seeded list of prohibited tasks is **illustrative only** (a subset of the federal FLSA hazardous occupations) and **must be reviewed and kept current by your compliance/legal team** for your specific states and industries before this control is relied on in production. The schema, RLS, and rule seed all require legal & compliance sign-off before go-live.

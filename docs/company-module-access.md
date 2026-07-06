# Per-Company Module Access

## What this is
Each company (tenant) can now have its own set of modules turned ON or OFF, on top of whatever its subscription plan nominally includes. This is used for pilots, phased rollouts, demos, and custom packages — a company can have a module switched off even if its plan would normally include it, or on even if the plan wouldn't (the toggle is the actual authority; the plan badge is shown for context only).

## Where to find it
Reliance superadmins: go to **Companies & Tenants** → open a company → **Modules** tab (`/sa/companies/[id]`). You'll see a count at the top, e.g. "8 of 10 modules included," and a card for each module with a single ON/OFF switch. Toggling is instant — there is no confirmation dialog, because turning a module off never deletes anything.

This is a superadmin-only surface today, matching where the platform-wide Module Control Panel also lives. There is no separate client-admin-facing UI for this yet.

## How it's different from the Module Control Panel
- **Module Control Panel** (`/sa/modules`) = platform-wide maintenance. If a module is put into maintenance there, it is unavailable to *every* company, no matter what — this is for things like a scheduled migration or an incident affecting one module for everyone.
- **Company > Modules tab** (this feature) = per-company access. Turning a module ON here only makes it available *if* it isn't also under platform-wide maintenance.
- Platform maintenance always wins over a company's ON setting. The combined result — "effective access" — is computed in one place: `src/lib/modules/moduleAccess.ts`.

## What happens when a module is turned OFF for a company
- It disappears from that company's left navigation (`LeftNav.tsx`).
- If a user has an old bookmark or link to that module's page, they see a friendly message — "This module isn't included in your plan" — instead of an error or blank page (`ModuleGateClient.tsx`).
- No data is deleted. Every record is preserved exactly as it was.

## What happens when it's turned back ON
- The module reappears in navigation immediately (next nav data refresh).
- All previously saved data for that module is exactly as it was left — the toggle only gates access, it never touches the module's own tables.

## Who can change this
Today, Reliance superadmins (profiles with `tenant_id IS NULL`), the same tier that manages the platform-wide Module Control Panel. Every change is written to `tenant_module_access` and logged to `tenant_module_access_audit` with who changed it, when, and the before/after value.

## Data model
- `public.tenant_module_access` — one row per (tenant, module) once someone has touched that toggle. A **missing row means enabled** — existing companies are unaffected until someone explicitly flips a module off for them.
- `public.tenant_module_access_audit` — append-only change log: `tenant_id`, `module_key`, `previous_value`, `new_value`, `changed_by`, `changed_at`.
- Reads are scoped by RLS to the company's own users plus superadmins; writes are superadmin-only.

## Known limitation
The platform-wide Module Control Panel (`src/lib/data/store.ts` `moduleStates`) is currently an in-memory store, not a database table — it resets on server restart / across serverless instances. This feature reads that same source rather than duplicating it into a second table, so it inherits that limitation until the Module Control Panel itself is backed by a durable table.

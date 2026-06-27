# SOP-07 — Database Migration SOP

| | |
|---|---|
| **Owner** | Engineer (authoring) + John (prod-apply gate) |
| **Trigger** | Any schema change to a Supabase project |
| **Definition of done** | Migration committed, applied to the intended project only, advisors clean, schema-consistency green |
| **Related** | [SOP-08 RLS](SOP-08-multitenancy-rls.md) · [SOP-01 Coding](SOP-01-coding.md) · `docs/migration-plan.md` |

---

## 1. Purpose & scope

How to change the database safely. Schema changes are the highest-blast-radius
edits in the platform: a bad one can reject every insert, silently empty a
filter, or expose another tenant's rows. This SOP gates them.

**The hard rule: a human applies migrations to production, never automatically.**
John holds the prod-apply gate. Every prod schema change is explained in plain
English *before* it is applied (standing preference — memory
`feedback_explain_changes`).

### The Supabase projects (know which one you're touching)
There are several projects under the org. The live app's production DB is
**`safetyiq`** (`bjgqjpekhicqlunxbobo`) — the one in `.env.local`. Never run a
migration against a project without naming it explicitly first.

---

## 2. Conventions

- **Location:** `supabase/migrations/`.
- **Naming:** timestamped, ordered — `YYYYMMDDHHMMSS_short_description.sql`
  (e.g. `20260626010000_chemical_inventory_storage_class_ppe.sql`). The three
  foundational files (`0001_init.sql`, `0002_rls.sql`, `0003_embeddings.sql`)
  define the ARC layer and sort first.
- **Idempotent where possible:** `create table if not exists`,
  `add column if not exists`, `create policy` guarded by drop-if-exists.
- **Enums are paired:** any new enum value goes in `src/lib/constants.ts` (or
  `arc.ts`) **and** the matching CHECK in the schema, together. The
  `schema-consistency` test fails if they drift.
- **Spec vs applied:** the ARC tables (`safety_cells`, etc.) are mock-backed and
  **not in the live DB** — `0001–0003` are the cutover *spec*, not applied to
  prod. Don't assume a migration file has been run; confirm with
  `list_migrations`.

---

## 3. Procedure

### Step 1 — Author (local)
1. Write the migration file under `supabase/migrations/` with the naming above.
2. If it adds/changes an enum, update the constant + CHECK in the same change.
3. Update `docs/data-dictionary.md` if columns/tables changed.

### Step 2 — Verify locally
```bash
npm run test           # schema-consistency + tenancy must pass
npm run test:live      # (needs Docker) boots local Supabase, db reset, RLS proof
```
`test:live` (`scripts/live-rls-test.sh`) applies the migrations to a throwaway
local Postgres and runs the live RLS contract — the closest thing to a dry run.

### Step 3 — Explain before applying (the gate) 🔴
Write a plain-English summary for John: what the migration does, which project,
what it changes, and the rollback. **Do not apply to prod without his go-ahead.**

### Step 4 — Apply to the named project
Use the Supabase migration tool against the **explicitly named** project
(prod = `safetyiq` / `bjgqjpekhicqlunxbobo`). Apply migrations as migrations
(not ad-hoc SQL) so they're tracked.

### Step 5 — Verify after apply
1. Run the **security/perf advisors** on the project and read every finding —
   this is how the earlier SECURITY DEFINER cross-tenant view leak was caught.
2. Confirm the new objects exist and RLS is on (SOP-08).
3. Spot-check the app against the changed area in the browser.

### Step 6 — Record
Commit the migration (SOP-03), note the apply in memory/docs, and if it was a
prod change, confirm it's reflected in `list_migrations`.

---

## 4. Rollback

- Prefer a **forward fix** (a new migration that corrects the prior one) over an
  in-place edit — applied migrations should be immutable history.
- For a destructive change, ensure SOP-09 (Backup) ran first.
- Never hand-edit a migration that's already been applied to prod; write the next
  one.

---

## 5. Checklist

```
[ ] migration file named/located correctly
[ ] enum change paired with matching CHECK (schema-consistency green)
[ ] data-dictionary updated if shape changed
[ ] test + test:live pass locally
[ ] plain-English summary written; John's go-ahead obtained for prod
[ ] applied to the EXPLICITLY NAMED project only
[ ] advisors run and clean after apply
[ ] RLS verified (SOP-08); app spot-checked
[ ] committed + recorded
```

---

*Revision: v1 · 2026-06-27 · first written.*

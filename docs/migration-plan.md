# AMAYA migration & consolidation plan

> Context (from project owner): each existing platform runs on its **own
> Supabase / PostgreSQL** database. The goal is to **consolidate them into one
> AMAYA backend**. Currently validating in **mock mode** — no live DB connected
> yet. This document is the plan for when you're ready to cut over.

## The good news
Because every source is already PostgreSQL/Supabase, this is a **schema +
data consolidation**, not a database conversion. No engine change, no SQL
dialect translation. AMAYA's tables are plain Postgres.

## The central decision: multi-tenancy
You are merging *N* separate databases into *one*. That makes isolation between
the original platforms the key design choice. Pick one before cutover:

| Option | What it means | When to choose |
| --- | --- | --- |
| **A. Shared schema + `tenant_id`** (recommended) | One set of tables; every row carries a `tenant_id`; RLS scopes each platform to its own rows. | Most platforms, want cross-platform intelligence (VELA depends on this). |
| **B. Schema-per-platform** | One Postgres DB, separate Postgres *schemas* per platform. | Strong isolation needed; little cross-platform analytics. |
| **C. Project-per-platform** | Keep separate Supabase projects, AMAYA app per project. | Hard data-residency/contractual separation. |

> **Decision: Option A — CHOSEN and IMPLEMENTED.** ARC's whole value (VELA
> cross-vertical learning, the compounding curve) needs data in one place.
> Option A is the only model where a failure mode proven on Platform 1 can
> pre-empt an event on Platform 2.
>
> Built: a `tenants` table, `tenant_id` on every tenant-scoped table + indexes
> (`0001_init.sql`), and tenant-aware RLS via `current_tenant_id()` / `in_tenant()`
> helpers (`0002_rls.sql`). A profile with `tenant_id = NULL` is a global
> operator. VELA insights are intentionally cross-tenant. In mock mode the repo
> emulates the exact same isolation, verified by `test/tenancy.test.ts` (7 tests).
> The live RLS must reproduce that behavioral contract after cutover.

## Cutover sequence (per source platform)
1. **Inventory** the source DB: `\d+` every table, row counts, FKs, and how the
   platform's code reads it (direct queries vs. an API).
2. **Map** source columns → AMAYA tables (`docs/data-dictionary.md`). Most safety
   data lands in `safety_cells` + `control_proofs` + `evidence_files` + `actions`.
3. **Stand up** a staging Supabase project. Apply `supabase/migrations/` (+ the
   tenant migration from the decision above).
4. **Write a one-shot ETL** (SQL `INSERT … SELECT` via `postgres_fdw`, or a small
   script) that loads one platform's data under its `tenant_id`. Keep source IDs
   in a `legacy_id` column for traceability and rollback.
5. **Reconcile**: row-count parity, spot-check high-value records, run the
   `test/integrity.test.ts` invariants against the migrated data (not just
   fixtures).
6. **Repoint** that platform to AMAYA (read path first, then write path).
7. **Run in parallel** (dual-write or read-only mirror) for a defined window
   before retiring the old DB. **Never drop the source until reconciled + parallel-tested.**

## What must be built/tested before a real cutover
- [x] Multi-tenancy (`tenants` table, `tenant_id` columns, tenant-scoped RLS) — **done (Option A)**, isolation tested in mock.
- [ ] Real Supabase Auth + `profiles` provisioning (replace the mock fixed user); set each user's `tenant_id`.
- [x] **Live** RLS test — **DONE on local Docker Postgres.** Migrations applied via
      `supabase db reset`; `test-live/rls.live.test.ts` signed in as real
      tenant-scoped users and proved Postgres blocks cross-tenant reads AND
      writes (4/4 passing). Run it with `npm run test:live`.
- [ ] Integration tests that run the migrations on a real Postgres and assert RLS
      actually blocks cross-tenant reads (the current `schema-consistency` test
      checks the schema statically; this would check it live).
- [~] ETL with a `legacy_id` mapping + reconciliation report — **built** (see below);
      idempotency (re-run via `legacy_id` upsert instead of insert) is the remaining step.
- [x] **AI Gateway staging + exception log** live backing — `0007_gateway_staging.sql`
      (staged_records + gateway_rejects, tenant-scoped RLS, role-gated) + live repo
      branches + `test-live/gateway-staging.live.test.ts` — **PASSING (4/4)** on local
      Docker Postgres. Mock enforces the same two-stage admission.
- [x] **Live-mode id generation** — `nextId()` returns a uuid when not in mock mode,
      so app-created records match the uuid primary keys (mock keeps readable ids).
- [x] **Live-mode write blockers fixed** (surfaced by the first user-context insert):
      `0008_grants.sql` grants table privileges to the API roles (PostgREST returned
      "permission denied" without them); `0009_rls_helpers_security_definer.sql` makes
      current_role_name()/current_tenant_id() SECURITY DEFINER to stop the
      profiles-RLS recursion ("stack depth limit exceeded"). Both live RLS suites now
      pass (8/8): `npm run test:live`.
- [ ] A documented rollback (keep source DB read-only during parallel run).

## Running the ETL (built)

Each source platform exports a CSV; a small JSON **mapping** translates its
columns → AMAYA fields (with per-field value maps and defaults). The importer
validates every row with the app's own schema, inserts the valid ones under the
caller's tenant (with `legacy_id` traceability), and prints a reconciliation
report. Always **dry-run first**.

```bash
# validate only — no writes
node scripts/etl-import.mjs --file export.csv --mapping mapping.json --dry
# import for real (against the running app or a deployed URL)
node scripts/etl-import.mjs --file export.csv --mapping mapping.json --base https://amaya.example.com
```

- Mapper + validator: `src/lib/etl/import.ts` (pure, unit-tested).
- API entry: `POST /api/etl/import` ({ csv, mapping, dry }) → report + created ids.
- Sample: `scripts/etl-samples/incidents.csv` + `mapping.json`.
- Reconciliation: rows read / valid / imported / rejected, with field-level
  reasons for each rejected row — run the `test/integrity-check.ts` invariants
  against the imported data as the acceptance gate.

Remaining for production: switch insert → **upsert on `legacy_id`** so re-runs
are idempotent, and stand up a per-tenant onboarding step (tenant + admin + sites)
before the first import.

## What is already de-risked (mock mode, 57 automated tests)
- Schema ↔ types ↔ enums are proven consistent (`test/schema-consistency.test.ts`).
- Referential integrity invariants are encoded and enforced (`test/integrity.test.ts`).
- AI governance (pending-by-default, forced human review) is locked by tests.
- API contract behavior (200/201/400/404) is covered.

These same tests become the **acceptance gate** for migrated real data: point the
integrity checks at the staging DB and they must stay green.

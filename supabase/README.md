# SafetyIQ database

## Where the real schema lives

The production SafetyIQ database is the source of truth, and its schema is
captured in **[`schema/baseline.sql`](schema/baseline.sql)** — a faithful
snapshot assembled from the production project's migration history (the 19
migrations applied 2026-06-18 → 2026-06-23).

To stand up a **fresh** database that matches production:

1. Create a new Supabase project.
2. Open the SQL editor and run `schema/baseline.sql` once.
3. Configure auth redirect URLs (see below) and set the app's env vars.

`baseline.sql` is **schema only** — it creates the tables, row-level security
policies, helper functions, and the storage bucket, but contains **no demo or
seed data**. (The production project still holds the "BioStar Research" demo
tenant from early development; that data is not reproduced here.)

> Do **not** run `baseline.sql` against the existing production project — it is
> already migrated. It's only for new/clean databases.

## Migration history (production)

These are the migrations actually applied to production, in order. They are
tracked inside Supabase itself (`supabase_migrations.schema_migrations`):

| # | Migration |
| --- | --- |
| 1 | `safetyiq_core_tables` — tenants, profiles, sites |
| 2–3 | `safetyiq_ehs_tables_1/2` — CAPA, incidents, chemicals, audits, risk, waste, equipment, training |
| 4–6 | demo-tenant anon read/write policies (early dev) |
| 7 | `create_legal_requirements_and_documents` |
| 8 | `create_workspace_tasks` |
| 9 | `create_biosafety_tables` |
| 10 | `workspace_tasks_completion_evidence` |
| 11–13 | crew, contractors, permits, JSA, observations, toolbox, DAP |
| 14 | `add_onboarding_to_tenants` |
| 15–16 | profiles RLS fixes |
| 17 | `create_client_documents_bucket` (storage) |
| 18 | `fix_rls_create_missing_tables` — authenticated tenant-scoped RLS + OSHA, ergonomics, compliance scores, AI findings, etc. |
| 19 | `harden_tenant_isolation_reliance_admin` — replaced the "null tenant = see all" bypass with an explicit `is_reliance_admin()` check |

To regenerate `baseline.sql` perfectly in the future, link the Supabase CLI to
the project and run `npx supabase db pull`.

## Making schema changes going forward

Apply changes through Supabase (CLI `supabase migration new` + `db push`, or the
dashboard), then refresh `schema/baseline.sql` so the repo stays in sync.

## `_legacy_amaya_migrations/`

This folder holds the original `0001_*` … `0012_*` migration files. They belong
to an **earlier, different product** ("Amaya / ARC" — a map-first safety tool)
and were **never** the schema this app runs on (e.g. they define a `chemicals`
table; production uses `chemical_inventory`). They're kept for reference only and
are not part of the active migration path.

## Auth redirect URLs

For employee invites and password resets to return to the app, add these to
**Supabase → Authentication → URL Configuration → Redirect URLs**:

```
<your-app-origin>/auth/callback
<your-app-origin>/auth/set-password
```

(e.g. `http://localhost:3000/auth/callback` for local dev.)

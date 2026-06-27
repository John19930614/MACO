# SOP-10 — ETL / Bulk Import SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | Importing a new tenant's existing data (CSV exports, prior platform) |
| **Definition of done** | Data imported into the correct tenant, reconciliation clean, spot-checked in-app |
| **Related** | [SOP-20 Tenant Provisioning](SOP-20-tenant-provisioning.md) · [SOP-08 RLS](SOP-08-multitenancy-rls.md) · `docs/onboarding-extraction-map.md` |

---

## 1. Purpose & scope

How to bulk-load a tenant's data safely. The cardinal risk: importing rows under
the **wrong `tenant_id`**, which both corrupts that tenant's view and can expose
data across tenants (SOP-08). Always dry-run first.

There are two import paths:
- **Structured ETL** — `scripts/etl-import.mjs` (CSV + field mapping →
  `/api/etl/import`, which validates and inserts). Run `npm run etl:import`.
- **AI onboarding extraction** — document uploads processed by
  `/api/onboarding/process` into module tables, per
  `docs/onboarding-extraction-map.md` (the authoritative category→table map).

---

## 2. Rules

1. **Dry-run before commit.** `etl-import.mjs --dry` produces a reconciliation
   report (what would insert / what's malformed). Read it; don't import blind.
2. **Tenant is explicit.** Every import is scoped to one known `tenant_id`. Verify
   it before and after — a spot query confirming all imported rows carry the
   right tenant.
3. **Validate at the boundary.** Imports go through the API's Zod validation
   (`/api/etl/import`), not raw SQL inserts that skip checks.
4. **Map deliberately.** Source columns → platform fields via an explicit
   `mapping.json` (see `scripts/etl-samples/`). Unmapped/garbage columns are
   dropped, not guessed.
5. **Idempotency / re-runs.** Know whether a re-run duplicates rows; prefer
   importing into a clean tenant or de-duping on a natural key.

---

## 3. Procedure

1. Confirm the target tenant exists (SOP-20) and capture its `tenant_id`.
2. Prepare the source CSV + `mapping.json`.
3. **Dry run:**
   ```bash
   node scripts/etl-import.mjs --file data.csv --mapping mapping.json --dry
   ```
   Review the reconciliation report; fix mapping/source issues.
4. **Real import** (against the running app) once dry-run is clean.
5. **Verify:** spot-check counts and that every imported row has the correct
   `tenant_id`; open the relevant module in-app for that tenant.
6. For document-based onboarding, follow `onboarding-extraction-map.md` and
   confirm each category landed in its target table.

---

## 4. Checklist

```
[ ] target tenant confirmed; tenant_id captured
[ ] mapping.json written deliberately (no guessed columns)
[ ] --dry reconciliation report reviewed and clean
[ ] import run through the validated API path (not raw SQL)
[ ] post-import: row counts + tenant_id correct on every row
[ ] spot-checked in-app for that tenant
[ ] re-run/duplication behavior understood
```

---

*Revision: v1 · 2026-06-27 · first written.*

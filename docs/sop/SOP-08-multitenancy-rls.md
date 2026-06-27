# SOP-08 — Multi-Tenancy & RLS Verification SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | New table, new query/storage path, or any change to tenant-scoped data — and pre-release |
| **Definition of done** | Every new read/write/storage path proven to be tenant-isolated, in mock and live |
| **Related** | [SOP-07 Migration](SOP-07-database-migration.md) · [SOP-17 Security Review](README.md) · `docs/migration-plan.md` |

---

## 1. Purpose & scope

Prove that one tenant can never see or touch another tenant's data. This is the
single most important correctness property of the platform — and it has been
broken before: a **cross-tenant storage IDOR** (predictable storage paths) and a
**SECURITY DEFINER view** that leaked across tenants have both shipped and been
fixed (memory `system_audit_findings`, `feature_ghs_chemical_module`). Assume
isolation is broken until you've proven it.

### The model (Option A — shared schema + `tenant_id` + RLS)
- Every tenant-scoped table carries a `tenant_id`.
- Live: Postgres RLS scopes rows via `current_tenant_id()` / `in_tenant(tenant_id)`
  (`0002_rls.sql`).
- Mock: `src/lib/data/repo.ts` emulates the *same* isolation contract on fixtures.
- A profile with `tenant_id = NULL` is a **global operator** (Reliance internal).
- **VELA insights are intentionally cross-tenant** — the one deliberate exception.

---

## 2. The rules

1. **Every tenant-scoped query filters by `tenant_id`** — no exceptions "because
   it's a quick read." `*ById` lookups must also scope by tenant (a prior bug
   was a `getById` that didn't).
2. **Storage paths must be unguessable AND access-checked** — never
   `bucket/{tenant}/{predictable-id}` served without an ownership check.
3. **RLS is ON for every new tenant-scoped table** (`enable row level security`
   + policies using `in_tenant(tenant_id)`).
4. **The mock repo must enforce the same isolation** as live, or tests pass while
   prod leaks.
5. **VELA / global-operator paths are the only cross-tenant reads** and must be
   intentional and reviewed.

---

## 3. Procedure

### When adding a tenant-scoped table
1. Add `tenant_id` + index in the migration (SOP-07).
2. `enable row level security` and add read/write policies via `in_tenant()`
   (`0002_rls.sql` pattern).
3. Add the repo functions with the mock branch enforcing the same scope.
4. Extend `test/tenancy.test.ts` to cover the new entity.

### When adding a query or storage path
1. Confirm the `tenant_id` filter (or ownership check for storage) is present.
2. Ask: "if I pass another tenant's id/path, what happens?" The answer must be
   *denied / empty*, and there must be a test that proves it.

### Verification (run before release)
```bash
npm run test            # test/tenancy.test.ts (7 tests) — mock isolation contract
npm run test:live       # (needs Docker) live RLS proof against real Postgres
```
Then on the live project, run the **Supabase security advisors** and resolve any
RLS / SECURITY DEFINER findings — this is how the view leak was caught.

---

## 4. Red flags (stop and fix)

- A repo function that takes an id but not the caller's tenant.
- A SQL view or function marked `SECURITY DEFINER` without an explicit tenant
  filter inside it.
- A storage URL that works without an auth/ownership check.
- A new table with RLS left **off**, or a policy that forgot `in_tenant(...)`.
- Mock and live disagreeing about what a cross-tenant access returns.

---

## 5. Checklist

```
[ ] new table has tenant_id + index
[ ] RLS enabled + policies use in_tenant(tenant_id)
[ ] every new query/storage path scoped to caller's tenant (incl. *ById)
[ ] mock repo enforces identical isolation
[ ] tenancy.test.ts extended to cover it
[ ] test + test:live pass
[ ] Supabase security advisors clean (no RLS/SECURITY DEFINER leaks)
[ ] any cross-tenant path (VELA/global op) is intentional + reviewed
```

---

*Revision: v1 · 2026-06-27 · first written.*

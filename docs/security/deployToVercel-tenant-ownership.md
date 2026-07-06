# Tenant Ownership Review — deployToVercel.ts

## Incoming report

A security ticket flagged `src/lib/actions/deployToVercel.ts` for performing
service-role (RLS-bypassing) writes without verifying that the `tenant_id`
being written matched the authenticated caller's tenant — i.e. a spoofed
`tenant_id` in a request payload could let one tenant's data land under
another tenant's records. The ticket assumed the file exported a
`deployToVercel(payload)` function with a `payload.tenant_id` field.

## What the file actually does

`triggerVercelDeploy(taskId?: string)` takes no `tenant_id` anywhere in its
signature or body. Its only service-role write is:

```ts
db.from("dev_audit_log").insert({ task_id, actor: "system", action, details })
```

There is no payload tenant_id to spoof, because none exists in this code path.

## Why this write is confirmed tenant-independent

1. **No tenant column exists.** Per
   `supabase/migrations/20260627010000_dev_command_center.sql`, neither
   `dev_audit_log` nor `dev_tasks` has a `tenant_id` column. Both are
   documented in the migration as "Superadmin-only" and gated by RLS via
   `is_reliance_admin()`, not by tenant.
2. **The only caller is already superadmin-gated, twice over.**
   `DeployButton.tsx` (under `src/app/(app)/admin/dev-command/`) is the sole
   call site. `src/middleware.ts` blocks all of `/admin/*` unless
   `profiles.tenant_id IS NULL`, and the route's `layout.tsx` additionally
   calls `requireDevCommandAccess()` (`src/lib/devcenter/access.ts`), which
   redirects any non-superadmin. `/sa/impl` does not call this function.
3. **No cross-tenant blast radius is possible even in principle** — there is
   no tenant-scoped data anywhere in this write to misattribute.

This is the tenant-independent carve-out described by the
`validate-tenant-ownership-before` pattern (see below): a write is only left
unguarded when it demonstrably has no tenant dimension and no non-privileged
caller can reach it. Both hold here.

## What changed

`src/lib/actions/deployToVercel.ts` now carries an inline
`TENANT-INDEPENDENT WRITE` comment directly above the `dev_audit_log` insert,
explaining the above and pointing back to this document. No functional
change was needed — there was nothing to guard.

`test/lib/actions/deployToVercel.test.ts` regression-tests the actual
security property: the `dev_audit_log` insert payload never contains a
`tenant_id` key, regardless of the `taskId` supplied, plus existing-behavior
coverage (missing deploy-hook error path, and the no-taskId path skipping
the service-role client entirely).

## Reference pattern

For any future server action that *does* carry a real, caller-influenced
`tenant_id` into a service-role write, use the existing, already-adopted
helper — do not add a new one:

- `getServerTenantId()`, `isSuperadmin()`, `assertTenantOwnership(claimedTenantId)`,
  and `TenantMismatchError` all live in `src/lib/auth/session.ts`.
- Documented in `docs/validate-tenant-ownership.md`.
- Already used by `src/lib/actions/sds.ts`, `src/lib/actions/team.ts`, and
  `src/app/api/onboarding/process/route.ts`.

A new `src/lib/auth/tenantGuard.ts` was considered and deliberately **not**
created — it would have duplicated the existing `session.ts` helpers under a
new name.

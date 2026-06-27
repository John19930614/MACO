# SOP-18 — Access Control & Offboarding SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | Granting or revoking access to any platform system or account |
| **Definition of done** | Access matches need; revocation is complete and verified; superadmin scope is tight |
| **Related** | [SOP-12 Secrets](SOP-12-secrets-management.md) · [SOP-08 RLS](SOP-08-multitenancy-rls.md) · [SOP-17 Security](SOP-17-security-review.md) |

---

## 1. Purpose & scope

Who can touch what — across the **infrastructure accounts** (GitHub, Vercel,
Supabase) and the **app's own roles**. Over-broad access is how a small breach
becomes a total one; stale access after offboarding is a classic gap.

---

## 2. Access surfaces

| Surface | Controls |
|---|---|
| **GitHub** (`MACO.git`, private) | Repo collaborators; least privilege |
| **Vercel** | Project/team members; who can deploy + see env vars (secrets!) |
| **Supabase** | Org/project members; who can run SQL / see the service key |
| **App roles** | `profiles.role` (viewer → admin) scoped per tenant |
| **Superadmin** | `is_reliance` / `tenant_id = NULL` global operators — cross-tenant reach; keep this set tiny |

---

## 3. Rules

1. **Least privilege.** Grant the narrowest role that does the job; prefer
   read-only where possible.
2. **Superadmin is rare and intentional.** `is_reliance` / global-operator
   profiles can see across tenants — only Reliance-internal staff, reviewed.
3. **Secrets travel with access.** Anyone with Vercel/Supabase access can reach
   secrets; treat granting that access as handing over keys (SOP-12).
4. **Offboarding is same-day and complete.** When someone leaves, revoke
   GitHub + Vercel + Supabase + app account, and **rotate any shared secret they
   could have seen** (SOP-12).
5. **App role changes are audited.** Role changes go through `addAudit(...)`.

---

## 4. Procedure

### Granting
1. Decide the minimum surface + role for the need.
2. Grant on each system; for app access, set `profiles.role` + correct
   `tenant_id`.
3. Record who has what (a simple access list).

### Offboarding / revoking
1. Revoke on GitHub, Vercel, Supabase, and the app (disable/delete profile).
2. Rotate shared secrets the person could have accessed (SOP-12).
3. Verify: confirm they can no longer authenticate anywhere.

---

## 5. Checklist

```
[ ] least-privilege role granted (read-only where possible)
[ ] superadmin/global-operator kept minimal + justified
[ ] access list updated
[ ] offboarding: GitHub + Vercel + Supabase + app all revoked same day
[ ] shared secrets rotated after a departure
[ ] app role changes audited
```

---

*Revision: v1 · 2026-06-27 · first written.*

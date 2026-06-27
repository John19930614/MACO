# SOP-17 — Security Review SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | Pre-release of any data-touching feature; periodically (monthly) on the whole app |
| **Definition of done** | The security checklist passes; advisors clean; no secret/tenant/authz gap |
| **Related** | [SOP-08 RLS](SOP-08-multitenancy-rls.md) · [SOP-12 Secrets](SOP-12-secrets-management.md) · [SOP-02 Review](SOP-02-code-review.md) · [SOP-19 AI Gov](SOP-19-ai-governance.md) |

---

## 1. Purpose & scope

A focused security pass over a change (or the whole app, periodically). It exists
because every real security issue this platform has hit falls into a small set of
classes — review against those classes deliberately, don't hope to notice them.

The known failure classes (all have shipped at least once):
- **Cross-tenant exposure** — IDOR via predictable storage paths; SECURITY
  DEFINER views/functions without a tenant filter.
- **Authz gaps** — a route/action missing or mis-scoping its role check.
- **Secret leakage** — a server-only key reachable from the client, or committed.
- **Unvalidated input** — an API boundary without Zod parsing.

The platform has a `/security-review` skill — use it to drive an automated pass,
then confirm against this checklist.

---

## 2. Review dimensions

**Tenant isolation (highest priority — SOP-08)**
- Every read/write/storage path scoped to the caller's tenant, incl. `*ById`.
- No `SECURITY DEFINER` object without an explicit internal tenant filter.
- Storage objects access-checked, not just unguessable.

**AuthN / AuthZ**
- Protected routes/actions enforce the right role (matches `permissions` /
  `authz-routes` tests).
- Middleware redirects unauthenticated users; no profile ⇒ denied (by design).

**Secrets (SOP-12)**
- No server secret in a `"use client"` path; nothing without `NEXT_PUBLIC_`
  shipped to the browser; nothing secret committed.

**Input & output**
- API boundaries Zod-validate input.
- AI output is grounded + stays advisory/pending (SOP-19); no injection path
  treats model output as trusted commands.

**Dependencies & platform**
- `npm audit` reviewed; known-critical CVEs addressed (SOP-16).
- Supabase **security advisors** run and clean.

---

## 3. Procedure

1. Scope the review: just the change, or a periodic full pass.
2. Run the automated aids:
   ```bash
   npm run test          # tenancy / permissions / authz-routes guards
   npm audit             # dependency CVEs
   ```
   plus the Supabase **security advisors** on the live project, and the
   `/security-review` skill on the diff.
3. Walk the dimensions in §2; for each, ask "how would this leak / be bypassed?"
4. File findings; fix or route to a follow-up. A confirmed exposure in prod is an
   incident (SOP-14).
5. Record the review + any guard added.

---

## 4. Checklist

```
[ ] tenant isolation verified on every new path (SOP-08); no naked SECURITY DEFINER
[ ] authz/role gates correct (permissions + authz-routes green)
[ ] no server secret client-side; nothing secret committed (SOP-12)
[ ] API inputs Zod-validated
[ ] AI output grounded + advisory/pending (SOP-19)
[ ] npm audit reviewed; Supabase security advisors clean
[ ] findings fixed or tracked; prod exposure escalated to SOP-14
```

---

*Revision: v1 · 2026-06-27 · first written.*

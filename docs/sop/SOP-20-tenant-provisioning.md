# SOP-20 — Tenant Provisioning SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | Onboarding a new client company onto the platform |
| **Definition of done** | Tenant created, identity set, admin can log in, modules enabled, data isolation verified |
| **Related** | [SOP-10 ETL](SOP-10-etl-bulk-import.md) · [SOP-08 RLS](SOP-08-multitenancy-rls.md) · [SOP-21 Pilot](SOP-21-pilot-management.md) · `docs/onboarding-extraction-map.md` |

---

## 1. Purpose & scope

How a new client becomes a working tenant — the moment isolation matters most. A
provisioning mistake (wrong tenant on data, an over-broad admin, modules not
gated) is hard to unwind once the client starts entering real records.

Each client = one tenant (shared-schema Option A: `tenant_id` + RLS).

---

## 2. Procedure

1. **Create the tenant.** A `tenants` row; capture the `tenant_id`. Canonical
   company identity (name, establishment, OSHA hours, etc.) lives in
   `onboarding_data` — set it so the whole app reads one source of truth
   (`getTenantName` / establishment helpers).
2. **Provision the admin user.** A Supabase auth user + a `profiles` row with the
   right `role` and **this `tenant_id`**. (A profile with no tenant is a global
   operator — not what a client admin should be.) Confirm they can log in.
3. **Enable the right modules** for this client via the Module Control Panel
   (`/sa/modules`) — don't leave demo/unused modules on.
4. **Onboard their content.** Document uploads run through the AI onboarding
   extraction (`/api/onboarding/process`, per
   `docs/onboarding-extraction-map.md`); structured data via ETL (SOP-10). The
   AI Program Builder can author the required EHS programs/SOPs from their
   manuals + live data.
5. **Verify isolation (critical).** Spot-check that every provisioned row carries
   the correct `tenant_id` and that this tenant cannot see another's data
   (SOP-08). Sign in as the client admin and confirm they see only their world.
6. **Track onboarding** in the Implementation Tracker (`/sa/impl`).

---

## 3. Rules

1. **Right tenant, every row.** Identity, users, and imported data all carry the
   correct `tenant_id` — verified, not assumed.
2. **Client admin ≠ global operator.** Never provision a client with a NULL
   tenant / `is_reliance` (SOP-18).
3. **Modules are gated per tenant** — only what they've bought / need.
4. **Isolation is proven before go-live**, not after.

---

## 4. Checklist

```
[ ] tenant row created; tenant_id captured
[ ] canonical identity set in onboarding_data (name/establishment/OSHA hours)
[ ] admin user provisioned with correct role + tenant_id; login confirmed
[ ] modules enabled per this client (/sa/modules)
[ ] content onboarded (AI extraction + ETL) under the right tenant
[ ] isolation verified: every row tenant-correct; cross-tenant access denied
[ ] tracked in /sa/impl
```

---

*Revision: v1 · 2026-06-27 · first written.*

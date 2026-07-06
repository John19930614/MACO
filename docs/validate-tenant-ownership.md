# Tenant ownership validation for service-role writes

**Status:** Shipped 2026-07-02. Preventive hardening — no exploitable gap was found in the current code, and no data was ever misfiled.

## What this is

Some parts of the platform write to the database with elevated (service-role) access that bypasses the normal per-company row security: onboarding document seeding, SDS uploads/approvals, and team invites. Before this change, those paths were safe because they always derived the company (tenant) ID from the signed-in user's session — but nothing *structurally* prevented a future code change from trusting a tenant ID supplied by the caller instead.

## What changed

- A shared guard, `assertTenantOwnership(claimedTenantId)` in `src/lib/auth/session.ts`, verifies that any tenant ID about to be used in a service-role write matches the signed-in user's actual company, and throws a typed `TenantMismatchError` if it doesn't.
- The guard now runs before every service-role write in:
  - `POST /api/onboarding/process` (onboarding seeding) — mismatch returns HTTP 403 with "We couldn't complete setup for this account. Please refresh and try again."
  - `src/lib/actions/sds.ts` (SDS upload, extraction, approve, reject) — mismatch returns "Action blocked: tenant ownership check failed."
  - `src/lib/actions/team.ts` (team invites) — same friendly error.
- A unit test (`test/tenant-ownership.test.ts`) proves a spoofed tenant ID is rejected, a matching one passes, and sessions with no tenant (including superadmins) are refused.

## What stayed the same

Normal onboarding, SDS uploads, and team invites work exactly as before for legitimate users — same clicks, same confirmations, no new steps. The check compares two values already resolved server-side, and the underlying profile lookup is request-cached, so there is no extra database round trip.

## Action for support

If a customer reports a "tenant ownership check failed" or the onboarding "couldn't complete setup" message, ask them to refresh and log in again first (a stale session is the most likely cause). If it persists, escalate to engineering — a persistent mismatch would mean something is genuinely wrong with session/tenant resolution.

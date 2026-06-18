# AMAYA — to-production checklist

> Status today: a mock-first app whose **live (Supabase) architecture is verified
> against local Docker Postgres** (RLS, two-stage gateway admission, auth
> stamping, error surfacing — all proven; see `docs/migration-plan.md` and
> `npm run test:live`). What remains is everything that needs a **real
> environment**: hosted Supabase, real auth users, real data, and deployment.
> Items below are ordered; 🔴 = blocker, 🟡 = needed before real users, 🟢 = polish.

---

## 0. Decisions to make first (yours, not the code's)
- 🔴 **Auth method** — email/password, magic link, or SSO/SAML (enterprise HSE buyers usually want SSO). Drives the login UI + Supabase Auth config.
- 🔴 **Hosting** — app on Vercel (it's Next.js 15) or self-host; backend = one hosted Supabase project (multi-tenancy is already decided: Option A, shared schema + `tenant_id` + RLS).
- 🟡 **Per-platform onboarding** — how each existing platform's users + data come in (one tenant each, per `migration-plan.md`).

## 1. Real Supabase Auth + identity 🔴 (the biggest gap)
The data layer is wired (`getSessionUser()` reads the session; RLS keys off `auth.uid()`), but there is **no login and no user provisioning**.
- [ ] Stand up a hosted Supabase project; configure Auth (chosen method).
- [ ] Build a **login flow** (sign-in page + sign-out). With `@supabase/ssr`, a small `/login` server action + the existing cookie-based `createServerSupabase` is enough.
- [ ] Add **middleware** (`middleware.ts`) to refresh the session and redirect unauthenticated users to `/login`. (Today every screen assumes a user.)
- [ ] **Provision profiles**: every Supabase auth user needs a `profiles` row with `role` + `tenant_id` (a trigger on `auth.users`, or an admin onboarding flow). RLS denies users with no profile (by design — see the anon-leak fix `0011`).
- [ ] Replace the mock "Dana Okafor / ADMIN" header chip with the real session user.
- [ ] Decide global-operator accounts (profiles with `tenant_id = null`).

## 2. Deploy the backend 🔴
- [ ] Apply migrations `0001`–`0011` to the hosted project (`supabase db push` / CI).
- [ ] Set env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, AI keys (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`), and **unset `NEXT_PUBLIC_AMAYA_MOCK`** so live mode engages.
- [ ] Run `npm run test:live` against a staging copy to confirm RLS holds on the hosted DB (it passed 8/8 locally).
- [ ] Wire Supabase Storage for evidence/photo uploads (today `createEvidence` stores metadata only; the binary upload path is a stub).

## 3. Deploy the app 🔴
- [ ] Deploy to Vercel; set the same env vars (server-only secrets server-side).
- [ ] Point an uptime monitor at `GET /api/health` (already returns the gateway report; 503 on a failing hard check).
- [ ] Confirm a smoke test through the real stack (the `scripts/live-*-e2e.mjs` harnesses show the pattern: sign in → POST → staged → approve).

## 4. Migrate existing platform data 🟡
The ETL is built (`scripts/etl-import.mjs`, `/api/etl/import`, mapping + `legacy_id`), but note the **two-stage gate**: `createCell` now **stages** every row, so a bulk import would dump thousands of records into the human-review queue.
- [ ] **Decide:** add a trusted **bulk-import path that bypasses staging** (admit directly, service role) for migrating already-validated historical data — only *new* operational submissions should go through human review. (Today the ETL route uses `createCell` → staging.)
- [ ] Per `migration-plan.md`: inventory → map columns → dry-run → import under each tenant with `legacy_id` → reconcile (row counts + `test/integrity.test.ts` invariants on real data) → parallel-run before retiring the source.
- [ ] Make the ETL idempotent (upsert on `legacy_id`, not insert).

## 5. Close the known code gaps 🟡 (small, but real for live)
- [ ] **Live read error surfacing** — a few non-gateway getters still use `const { data } = await q` and swallow errors (gateway reads are fixed; cells/proofs/etc. are not). Wrap with `dbRead`.
- [ ] **System-write session assumption** — `createEdge(aiGenerated)` and any future background job call `addAudit` → `getActingUser()`, which throws without a request session. Give system writes a service-role/system actor before running them outside a request.
- [ ] **Tenant stamping** — confirm `createEdge` (manual fallback) and `savePclssRun` callers pass the real tenant in live (they used `tenantScope()`/caller-supplied, which is mock-derived).
- [ ] Review the **pre-gateway** parts of the app (the gateway arc was reviewed; the rest of the codebase wasn't this pass).

## 6. Production hardening 🟢
- [ ] Rate-limiting / abuse protection on the API routes (esp. AI endpoints — cost).
- [ ] Secret management (Vercel/Supabase env, rotation); never ship the service-role key to the client.
- [ ] Backups + PITR on Supabase; a documented restore.
- [ ] Audit every RLS policy once more against the `in_tenant` fix (`0011`); confirm no table grants `anon` meaningful access.
- [ ] Error tracking (Sentry) + structured logs; alert on `/api/health` 503 and on reject-queue growth.
- [ ] Cost controls / model selection for the AI engine (the `aiProvider()` seam already supports Claude vs GPT).

## 7. Cutover 🟡
- [ ] Per source platform: read-path first, then write-path; dual-write or read-only mirror for a window; **never drop the source until reconciled + parallel-tested.**
- [ ] Documented rollback (keep source DB read-only during parallel run).

---

### The single biggest item
**Real Supabase Auth + profile provisioning (§1).** Everything else is deploy/migrate mechanics; the auth layer is the one piece that's architecturally wired but has no UI/onboarding yet, and it can only be finished against a real project. Once a user can log in and gets a `profiles` row, the verified live path (this session) carries the rest.

# `/api/ops` — design scope (for review, not yet built)

**Purpose:** give the standalone Ops Console (`SafetyIQ-Admin-Console.html`) the **live signals a browser can't compute itself** — so the last unbuilt tools become real:

| Console tool | Needs from `/api/ops` |
|---|---|
| #4 Live Health Monitor | real `/api/health` result (200/503 + gateway report) |
| #2 Migration Gate | list of **applied migrations** (lives in `supabase_migrations.schema_migrations`, a non-public schema the browser client can't read) |
| #8 RLS / Isolation Status | last `tenancy` / `test:live` result |
| (gate badges everywhere) | last `typecheck/build/test/test:system` result + commit SHA |

Today the console connects straight to Supabase with the anon/publishable key. It can read tables, but **cannot** read the migrations schema, run the gateway pipeline efficiently, or know CI results. `/api/ops` is a thin, **read-only**, superadmin-gated endpoint that returns those.

---

## The hard part: how the console authenticates (and why not `CRON_SECRET`)

The existing `/api/health` trusts a caller who presents `CRON_SECRET` **or** is an authenticated user (cookie session). Neither works cleanly for the standalone console:

- ❌ **`CRON_SECRET` in the console** — the console is a static HTML file. Embedding a server secret in client code **violates SOP-12** ("no server secret client-side"). Hard no.
- ❌ **Cookie session** — the console authenticates with `supabase-js` (token in `localStorage`), not a cookie on the `safetyiq-platform.vercel.app` domain. From a `file://` / installed-PWA origin, `getAuthUser()` (cookie-based) won't see it.

✅ **Chosen approach — the caller's own Supabase JWT.**
The console already holds a Supabase access token for the signed-in user. It sends that token as `Authorization: Bearer <supabase_jwt>`. `/api/ops` verifies it server-side (`supabase.auth.getUser(token)`) and confirms the user is a **Reliance superadmin** (`profiles.tenant_id IS NULL` / `is_reliance_admin()`). No shared secret leaves the server; each operator uses their own identity.

- **CORS:** `Access-Control-Allow-Origin: *` is acceptable here because auth is an **explicit Bearer token, not ambient cookies** (no `Allow-Credentials`). Allow `GET, OPTIONS` and the `Authorization` header. (`file://` sends `Origin: null`; `*` covers it.)
- Service-role mode in the console (no JWT) still works for direct Supabase reads, but **won't** reach `/api/ops` — service-role bypasses RLS in Supabase but isn't a user JWT. For `/api/ops`, John signs in normally as the superadmin. (Or: optionally also accept `CRON_SECRET` for a CLI/uptime probe — never from the console.)

---

## Response shape (single bundle, each section fails soft)

`GET /api/ops` →
```jsonc
{
  "generatedAt": "2026-06-27T…Z",
  "health":   { "overall": "pass|warn|fail", "blocked": 0, "checks": [ … ] },   // from runGatewayPipeline()
  "migrations": { "count": 27, "latest": "20260627002000_ops_access_secrets", "applied": [ … ] },
  "gate":     { "typecheck": "pass", "build": "pass", "test": "pass", "system": "pass",
                "sha": "6788478", "at": "…", "source": "ci" },                  // from ops_gate_status (F3)
  "rls":      { "tenancy": "pass", "live": "pass|unknown", "at": "…" },
  "error":    null
}
```
Any section that can't be computed returns `null` + a reason, so one failure never blanks the page.

---

## Server pieces to build

1. **`src/app/api/ops/route.ts`** — `GET` + `OPTIONS` (CORS preflight). Auth via Bearer-JWT → superadmin check. Assembles the bundle.
2. **Auth helper** — `requireSuperadmin(req)`: verify Supabase JWT, load profile, assert `is_reliance_admin`. Returns 401/403 otherwise. (Generalizes the `isTrusted()` idea to token auth.)
3. **Service-role read client** — to read `supabase_migrations.schema_migrations` and `ops_gate_status` (uses `SUPABASE_SERVICE_ROLE_KEY`, already a server secret; read-only queries only).
4. **`health`** — reuse `runGatewayPipeline()` (same call `/api/health` makes); summarize.
5. **CORS headers helper** — applied to both `GET` and `OPTIONS`.

## F3 dependency — `ops_gate_status` + CI writer (for the `gate`/`rls` sections)

`gate` and `rls` are only as fresh as something that writes them. Plan:
- **Migration:** `ops_gate_status` table (one row per run: typecheck/build/test/system/tenancy/live + sha + timestamp + source). Superadmin RLS, same `ops_*` pattern. → SOP-07 (explicit apply approval).
- **CI writer:** extend the existing CI gate (commit `acca702` already runs typecheck+test+build+system-test on push/PR) to `INSERT` its result into `ops_gate_status` via service role. One step.
- Until F3 exists, `/api/ops` returns `gate: null` / `rls: { live: "unknown" }` — the console shows "gate signal not wired yet" instead of faking green.

## Console changes (after the endpoint deploys)

- Add an `OPS_API` base URL (the prod domain) to config.
- On the existing pages, fetch `GET {OPS_API}/api/ops` with `Authorization: Bearer <session token>`.
- **Live Health Monitor** (upgrades System Health): show the real `overall` + blocked count + per-check rows.
- **Migration Gate** (#2): list applied migrations from `migrations.applied`; keep the explain-before-apply checklist (already have the Checklist Runner) as the human gate.
- **RLS Status** (#8) + gate badges: render from `gate`/`rls`.
- **Degrade gracefully:** if the fetch fails (CORS, old deploy, not superadmin) → "Live signals unavailable — deploy `/api/ops` / sign in as superadmin," never an error.

---

## SOP path to ship (this is app code, unlike the console-only tools so far)

- **SOP-01** gate (`typecheck`/`build`/`test`) green.
- **SOP-17** security review — endpoint is **read-only + superadmin-only**; no secret in client; service-role used only for read queries. New surface area is small.
- **SOP-08** — `ops_gate_status` RLS (if F3 included).
- **SOP-07** — explicit approval to apply the `ops_gate_status` migration.
- **SOP-11** — deploy: merge to `master` → Vercel build → smoke-check `/api/ops` returns 200 for a superadmin and 401/403 otherwise.
- **SOP-12** — no new secret needed (reuses `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET`, both already set).

**Blast radius:** new additive route + one optional table + one CI step. No change to existing routes. Rollback = delete the route (console degrades to its current Supabase-only checks).

---

## Open decisions for John

1. **Scope of v1:** ship `health` + `migrations` first (no CI dependency), add `gate`/`rls` once F3 (`ops_gate_status` + CI writer) is in? **(recommended)**
2. **Also accept `CRON_SECRET`** on `/api/ops` for a CLI/uptime probe (never from the console), or JWT-only?
3. **One bundle `GET /api/ops`** (simpler for the console) vs. sub-routes `/api/ops/health|migrations|gate`?
4. **Confirm the console's prod origin** it'll call from (installed PWA vs `file://`) so CORS + any allow-list is right.

# AI Software Development Command Center — Implementation Plan (Phase 0)

**Status:** Phase 0 — inspection & planning only. **No production code has been changed.**
**Date:** 2026-06-27
**Scope:** Admin-only (Reliance superadmin) feature that lets the operator hand software-development
tasks to an AI agent team. The team **plans, designs, drafts, tests, reviews, and requests human
approval** before any dangerous change. It **never** deploys, migrates, deletes, or touches
auth/RLS/secrets on its own.

> This document is a map and a proposal. It is the input to Phase 1. Building does not start until
> this plan is approved.

---

## 1. Existing platform structure found

**Project root:** `maco-platform/` (the live SafetyIQ app; deploys to Vercel from `master`).

**Stack (from `package.json`):**
- Next.js `^15.1.3` (App Router) · React `^19` · TypeScript `^5.7`
- Tailwind CSS `^4` (PostCSS plugin)
- Supabase: `@supabase/ssr ^0.5.2` + `@supabase/supabase-js ^2.47`
- AI SDKs already present: `@anthropic-ai/sdk ^0.104` and `openai ^4.77`
- `zod ^3.24` (validation), `vitest ^2` (tests)
- Export libs already present: `pptxgenjs`, `xlsx`, `qrcode`

**App routing (`src/app/`):**
- Route groups: `(auth)` (login), `(app)` (the authed product), plus top-level `onboarding`, `auth/*`.
- The authed product lives under `src/app/(app)/…` with a shared `(app)/layout.tsx`
  (`AuthGuard` → TopBar / LeftNav / content).
- **The admin area already exists**: `src/app/(app)/sa/…` — the "Reliance Internal" console.
  Existing SA routes include `sa/companies`, `sa/ai` (AI Model Configuration),
  `sa/gateway` (AI Gateway — EHS Validation), `sa/validation`, `sa/standup`, `sa/guardrails`,
  `sa/security`, `sa/modules`, `sa/history`, `sa/support`, etc.
- API routes: `src/app/api/**/route.ts`, including a `cron/` family (`api/cron/gateway-agent`,
  `api/cron/agent-standup`, `api/cron/pclss`) and a self-authenticating `api/ops` endpoint.

**Library layer (`src/lib/`):**
- `auth/session.ts` — `getServerTenantId`, `getEffectiveTenantId`, `getServerProfileId`,
  **`isSuperadmin()`** (superadmin = `profiles.tenant_id IS NULL`), `getServerUser`.
- `supabase/server.ts` — `createSupabaseServerClient()` (SSR cookie client),
  `createServerSupabase()` (anon, no session), cached `getAuthUser` / `getAuthProfile`.
- `supabase/client.ts` — browser client.
- `ops/auth.ts` — **`requireSuperadmin(req)`** for API routes (accepts the operator's Supabase JWT
  **or** `CRON_SECRET`) and **`opsServiceClient()`** (service-role client, bypasses RLS, read-only use).
- `gateway/` — the **existing AI Gateway** concept: `pipeline.ts`, `agent.ts` (health-check engine),
  `admit.ts`.
- `ai/` — the AI engine: `engine.ts`, `provider.ts`, `model-routing.ts`, `telemetry.ts`, `cache.ts`,
  `circuit.ts` (circuit breaker), `review-policy.ts`, `grounding.ts`, `embeddings.ts`.
- `actions/` — server actions (`"use server"`), e.g. `gatewayAgent.ts`, `csp.ts`, `sa.ts`.
- `env.ts` — `MOCK_MODE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `serverSecrets()`.

**Database (`supabase/migrations/`):** timestamped SQL files. Key reusable primitives already shipped:
- `is_reliance_admin()` — `SECURITY DEFINER` boolean, true when the caller's profile has
  `tenant_id IS NULL`. The canonical superadmin guard for RLS.
- `ops_set_updated_at()` — shared `updated_at` trigger function.
- The **`ops_*` table family** (Ops Console): `ops_console`, `ops_access`, `ops_secrets`,
  `ops_gate_status`, **`ops_fix_requests`**, `audit_log`. Every `ops_*` table is superadmin-only via
  `using (public.is_reliance_admin()) with check (public.is_reliance_admin())`.

**Strongly relevant precedent — there is already a Code-Fix Agent approval queue.**
`ops_fix_requests` + the `code_fix_agent_contract` memory already implement the exact safety shape we
need: a human logs a problem → the AI writes a **proposal (plain-English fix + diff + validation
plan)** → the human **approves a row** → only then is the change applied + validated. The Command
Center is a **superset/expansion** of this pattern (full task lifecycle + an agent team), not a
parallel reinvention. We extend, not duplicate.

**Conventions to match:**
- SA pages are React Server Components that fetch via `lib/data` / `lib/gateway` / `lib/ai`,
  pass props to a client dashboard component; `sa/layout.tsx` wraps them in a dark theme.
- Server actions return `{ ok: boolean; error?: string }` and call `revalidatePath(...)`.
- `MOCK_MODE` short-circuits everything to safe empty/default data so the app runs without Supabase.

---

## 2. Safe place to add the new admin module

**Route home:** `src/app/(app)/sa/devcenter/…` (a new sibling under the existing `/sa/` console).

**Why this is the safe location:**
- **Gating is automatic.** `src/middleware.ts` already enforces: any path that is `/sa` or starts
  with `/sa/` requires `profiles.tenant_id IS NULL` (Reliance superadmin); everyone else is redirected
  to `/dashboard`. Adding routes under `/sa/devcenter` inherits this with **zero new auth code**.
- **No collision.** `devcenter` is an unused segment; nothing existing is renamed, moved, or deleted.
- **Pattern reuse.** It sits beside `sa/gateway`, `sa/validation`, `sa/standup` — same RSC + client
  dashboard + server-action shape, same dark `sa/layout.tsx`.

**Defense in depth (do all three, matching existing practice):**
1. Middleware `/sa/*` redirect (already in place — automatic).
2. Each new page calls `isSuperadmin()` and returns a denied state if false (belt-and-suspenders;
   matches `sa/companies`, `sa/ai`).
3. Every new table is RLS `is_reliance_admin()`-only; every API route uses `requireSuperadmin(req)`;
   every server action re-checks `isSuperadmin()` before writing.

**Nav:** add entries to the `SA_NAV` "🔒 Reliance Internal" group in
`src/components/layout/LeftNav.tsx` (visible only when `user.is_reliance`).

---

## 3. Proposed routes

All under `src/app/(app)/sa/devcenter/` (superadmin-gated by existing middleware):

| Route | Purpose |
|---|---|
| `/sa/devcenter` | Command Center home — task board (queue / in-progress / awaiting-approval / done), agent activity feed, pending approval count. |
| `/sa/devcenter/new` | Create a new dev task (title, description, target area, priority). |
| `/sa/devcenter/tasks/[id]` | Task detail — the full lifecycle: plan → design → file/SQL recommendations → code drafts → test plan → review → **approval gates**. |
| `/sa/devcenter/approvals` | Central approval inbox — every pending dangerous action across all tasks, one place to approve/reject. |
| `/sa/devcenter/agents` | Agent roster — each agent's role, what it may/may not do, recent runs. |
| `/sa/devcenter/activity` | Append-only audit log of every agent action and human decision. |
| `/sa/devcenter/settings` | Command Center settings — enable/disable, model tier per agent, approval thresholds. |

**API routes** (`src/app/api/devcenter/…`, each `requireSuperadmin`):
- `POST /api/devcenter/tasks` — create a task.
- `POST /api/devcenter/tasks/[id]/run` — kick an agent step (plan/design/draft/test/review).
- `POST /api/devcenter/approvals/[id]/decide` — approve/reject a gated action.
- (Optional, later) `GET /api/cron/devcenter` — scheduled agent tick, mirroring `api/cron/gateway-agent`.

> Approvals can also be implemented purely as **server actions** (the existing `sa/*` style) instead
> of API routes. Recommendation: use server actions for browser-driven approve/reject (simpler, same
> as `gatewayAgent.ts`); reserve API routes for cron / external triggers.

---

## 4. Proposed components

Under `src/app/(app)/sa/devcenter/` (client components, `"use client"` where interactive):

- `DevCenterDashboard.tsx` — top-level board; columns by task status; summary cards (mirrors
  `EhsGatewayDashboard` + `GatewayAgentPanel`).
- `TaskCard.tsx` — one task summary tile.
- `TaskDetail.tsx` — lifecycle view with stage tabs (Plan · Design · Files · SQL · Code · Tests · Review).
- `AgentTimeline.tsx` — chronological agent actions + human decisions for a task.
- `ApprovalGate.tsx` — the core safety widget: shows the proposed dangerous action (diff / SQL /
  config change) with **Approve** / **Reject** + required note. Reused on task detail and the
  approvals inbox.
- `ApprovalInbox.tsx` — list of all `pending` gated actions platform-wide.
- `AgentRoster.tsx` — agent cards (role, allowed/forbidden capabilities, status).
- `NewTaskForm.tsx` — create-task form (server action backed).
- `DevCenterSettingsForm.tsx` — settings (modeled on `updateGatewaySettings`).

**Server-side (no new UI):**
- `src/lib/devcenter/types.ts` — task / agent-run / approval / artifact types.
- `src/lib/devcenter/repo.ts` — read helpers (RSC-friendly, `MOCK_MODE`-aware), like `gateway/agent.ts`.
- `src/lib/devcenter/orchestrator.ts` — runs an agent step, persists artifacts, and **creates an
  approval row instead of acting** whenever an action is on the dangerous list.
- `src/lib/devcenter/agents.ts` — agent definitions + per-agent capability allow/deny lists (the
  policy that encodes the safety rules in code).
- `src/lib/actions/devcenter.ts` — `"use server"` actions: `createDevTask`, `runAgentStep`,
  `decideApproval`, `updateDevCenterSettings` (each re-checks `isSuperadmin()`).

---

## 5. Proposed database tables

New `dc_*` table family (naming mirrors `ops_*`/`csp_*`). **Every table:** RLS enabled,
`is_reliance_admin()`-only policy, `ops_set_updated_at()` trigger, additive, reversible (drop table).
**No changes to existing tables.**

| Table | Purpose |
|---|---|
| `dc_tasks` | One software-dev task: `title`, `description`, `target_area`, `priority`, `status` (`queued/planning/drafting/awaiting_approval/in_review/done/rejected/failed`), `created_by`, timestamps. |
| `dc_agent_runs` | One agent step on a task: `task_id`, `agent`, `phase` (`plan/design/recommend/draft/test/review`), `status`, `input`, `output` (jsonb), `model`, `tokens`, `started_at`, `finished_at`. |
| `dc_artifacts` | Agent outputs: `task_id`, `run_id`, `kind` (`plan/design/file_recommendation/code_draft/sql_draft/test_plan/doc`), `path` (proposed, for code/sql), `content` (text/jsonb), `status` (`draft/proposed/approved/rejected/applied`). **Drafts only — never written to real files or the DB without approval.** |
| `dc_approvals` | The human-approval gate: `task_id`, `artifact_id`, `action_type` (e.g. `apply_code`, `run_migration`, `modify_auth`, `modify_rls`, `change_env`, `deploy`, `access_customer_data`), `risk` (`low/medium/high/critical`), `summary`, `proposed_change` (diff/SQL/config), `status` (`pending/approved/rejected`), `decided_by`, `decided_at`, `decision_note`. |
| `dc_activity_log` | Append-only audit: `task_id`, `actor` (agent name or human id), `action`, `detail`, `created_at`. Self-auditing, like `audit_log`. |
| `dc_settings` | Singleton config: `enabled`, per-agent model tier, approval thresholds, which `action_type`s require approval (defaults = the full dangerous list, hard-coded as a backstop even if a row says otherwise). |

> **Reuse vs. new:** `ops_fix_requests` already covers the "approve a code fix" slice. Options for
> Phase 1: (a) generalize `ops_fix_requests` into `dc_approvals`, or (b) keep `ops_fix_requests` for
> the lightweight chat-driven fix flow and add `dc_*` for the full task lifecycle. **Recommendation:**
> keep both, and have `dc_approvals` be the superset; decide at Phase 1 design review.

---

## 6. Proposed agents

A small team, each with a **fixed capability allow/deny list** enforced in `agents.ts` and at the
orchestrator (read-only + draft-only; dangerous actions always route to `dc_approvals`):

| Agent | Does | Never does |
|---|---|---|
| **Planner** | Reads a task, produces a step-by-step plan, identifies impacted areas. | Writes code, touches DB. |
| **Architect / Designer** | Recommends files to add/modify, proposes schema/table changes as **drafts**, flags risks. | Applies any change; runs SQL. |
| **Coder** | Generates code **drafts** (proposed diffs) against recommended files. | Writes to disk, deploys, edits auth. |
| **SQL Author** | Generates **migration drafts** (SQL text) + a plain-English explanation. | Runs migrations, alters RLS. |
| **Test Author** | Generates a test plan + test-code drafts (`vitest` / system-test style). | Runs against prod, deploys. |
| **Reviewer** | Reviews drafts for correctness/safety, scores risk, writes the approval summary. | Approves anything (humans approve). |
| **Doc Writer** | Drafts docs/SOP updates for the change. | Publishes anything irreversible. |
| **Orchestrator** (system, not an LLM persona) | Sequences the agents, persists artifacts, **opens approval gates** for dangerous actions, logs everything. | Bypass a gate; act without an approved row. |

These run via the existing `lib/ai` engine (`provider.ts` / `model-routing.ts`), so telemetry,
circuit breaker, and caching apply for free.

---

## 7. Required approval gates

The orchestrator must create a `pending` `dc_approvals` row — and **stop** — before **any** of these.
Nothing on this list executes without an `approved` row decided by a superadmin:

- **Deploy to production** (any deploy / Vercel trigger) — blocked; the agent may only *recommend*.
- **Delete data** (any destructive DB or file operation).
- **Run a database migration** / apply DDL to a real database.
- **Modify authentication** (anything under `lib/auth`, `middleware.ts`, session logic).
- **Modify Supabase RLS** (any `policy` / `is_reliance_admin` / `enable row level security` change).
- **Change production environment variables / secrets** (`env.ts`, `serverSecrets`, Vercel env).
- **Apply code to the working tree / repo** (write proposed drafts to real files, commit, push).
- **Access customer/tenant data** unless the task explicitly and narrowly authorizes it.

**Enforcement model (3 layers, matching the platform):**
1. **Code policy** — `agents.ts` capability lists make these actions un-callable by agents; the
   orchestrator only ever *describes* them into an approval row.
2. **Hard-coded backstop** — the dangerous `action_type` set is a constant in `dc_settings` defaults
   that cannot be emptied to "auto-approve"; the orchestrator checks the constant, not just the row.
3. **DB + route auth** — RLS `is_reliance_admin()` on `dc_approvals`; `requireSuperadmin` on the
   decide endpoint; server action re-checks `isSuperadmin()`. A non-superadmin literally cannot
   create an approved row.

Default posture: **deny**. Unknown/unclassified actions are treated as `critical` and gated.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| An agent performs a dangerous action directly. | Agents are read/draft-only by capability list; dangerous actions only ever become `dc_approvals` rows. Orchestrator has no code path that executes them. |
| Approval gate bypassed by a bug. | Hard-coded dangerous-action constant + DB RLS + route/action superadmin re-check (defense in depth); default-deny on unknown actions. |
| Cross-tenant / customer-data exposure. | New tables are superadmin-only (`is_reliance_admin()`), no `tenant_id` join into customer data; "access customer data" is itself a gated action. |
| Service-role client misuse. | `opsServiceClient()` stays read-only here; writes go through the SSR session client under RLS. No new service-role writes to customer tables. |
| Breaking existing platform. | Purely additive: new routes, new `dc_*` tables, new lib files, one nav entry. No existing file's behavior changes; no route/table/file deleted. |
| Cost / runaway LLM usage. | Reuse `lib/ai` telemetry + circuit breaker + model-routing; `dc_settings` per-agent tiering; tasks run on explicit human trigger (no autonomous loop in Phase 1). |
| `MOCK_MODE` / OneDrive+git path flakiness (per memory). | All new reads are `MOCK_MODE`-aware (return empty/defaults). Migrations are *not* auto-applied; commit discipline per the concurrent-session lesson. |
| Secrets in client code. | All AI calls + secrets stay server-only (`"server-only"` import guard), like `gateway/agent.ts`. |

---

## 9. Files likely to be created

**Routes / pages (`src/app/(app)/sa/devcenter/`):**
- `page.tsx`, `new/page.tsx`, `tasks/[id]/page.tsx`, `approvals/page.tsx`, `agents/page.tsx`,
  `activity/page.tsx`, `settings/page.tsx`

**Components (same folder):**
- `DevCenterDashboard.tsx`, `TaskCard.tsx`, `TaskDetail.tsx`, `AgentTimeline.tsx`,
  `ApprovalGate.tsx`, `ApprovalInbox.tsx`, `AgentRoster.tsx`, `NewTaskForm.tsx`,
  `DevCenterSettingsForm.tsx`

**Library (`src/lib/devcenter/`):**
- `types.ts`, `repo.ts`, `orchestrator.ts`, `agents.ts`
- `src/lib/actions/devcenter.ts`

**API (`src/app/api/devcenter/`):**
- `tasks/route.ts`, `tasks/[id]/run/route.ts`, `approvals/[id]/decide/route.ts`
- (later) `src/app/api/cron/devcenter/route.ts`

**Database (`supabase/migrations/`):**
- `2026XXXXXXXXXX_devcenter.sql` — creates `dc_tasks`, `dc_agent_runs`, `dc_artifacts`,
  `dc_approvals`, `dc_activity_log`, `dc_settings` with RLS + triggers. **Not auto-applied** —
  needs explicit approval before running against any real DB.

**Docs/tests:**
- This file (already created).
- `src/lib/devcenter/__tests__/*.test.ts` (vitest), and a `scripts/system-test.mjs` nav entry for the
  new routes (per SOP-06).

## 10. Files likely to be modified

Kept deliberately minimal — additive only:
- `src/components/layout/LeftNav.tsx` — add `/sa/devcenter` entries to `SA_NAV`.
- `scripts/system-test.mjs` — add the new `/sa/devcenter*` routes to the all-nav gate (SOP-06).
- `docs/sop/README.md` / a new SOP (optional) — document the Command Center operating procedure.
- (Optional) `MEMORY.md` + a memory file — record the feature once Phase 1 lands.

**No modifications to:** `middleware.ts` (gating already covers `/sa/*`), `lib/auth/*`,
`lib/supabase/*`, `lib/gateway/*`, `lib/ai/*`, any existing route/table/migration. If a future phase
needs to touch any of these, that change is itself a gated, human-approved step.

---

## 11. Next recommended phase

**Phase 1 — Additive shell + data model (read-only, no agent execution):**
1. Review & approve this plan (and the reuse-vs-new decision for `ops_fix_requests` → `dc_approvals`).
2. Write `supabase/migrations/2026XXXX_devcenter.sql` (the `dc_*` tables). **Present the SQL + a
   plain-English explanation first; do not apply it** until explicitly approved (per the explain-
   changes preference and the Code-Fix Agent contract).
3. Build `src/lib/devcenter/types.ts` + `repo.ts` (MOCK_MODE-aware), the `/sa/devcenter` home page,
   the task board, and `NewTaskForm` — all **read/CRUD on `dc_tasks` only**, no agents yet.
4. Add the nav entry and the system-test routes; run `typecheck` + `test` + `test:system` (SOP-06).

This delivers a visible, gated, do-no-harm shell. **Agent execution and the approval-gate engine
(`orchestrator.ts` + `dc_approvals` flow) come in Phase 2**, once the shell and tables are approved
and merged — keeping every dangerous capability behind a human decision from the very first line.

---

### Phase 0 done-when — confirmation
- ✅ No production code behavior changed (only this doc was written).
- ✅ A clear implementation plan exists (this file).
- ✅ The plan explains how to add the module without breaking the platform (additive routes/tables/
  lib files under the already-gated `/sa/` area; nothing renamed or deleted; three-layer approval
  enforcement before any dangerous action).

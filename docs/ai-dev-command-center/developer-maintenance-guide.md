# Developer Maintenance Guide — Dev Command Center

> **Who this is for:** Developers who maintain, extend, or debug the Dev Command Center module.

---

## Module location

All Dev Command Center code lives under:

```
src/app/(app)/admin/dev-command/      ← Next.js pages and components
src/lib/devcenter/                    ← Business logic (pure, no DB calls)
src/lib/actions/devcenter.ts          ← Server actions (all DB writes go here)
supabase/migrations/2026062[x]*_dev_* ← All schema migrations
docs/ai-dev-command-center/           ← This documentation
```

The route is `/admin/dev-command/*` (not `/sa/devcenter` — that was the original plan, moved to `/admin` in Phase 2).

---

## Access control — three layers

The module is protected at three independent levels. All three must hold:

1. **Middleware** (`src/middleware.ts`): `/admin/*` redirects any user where `profiles.tenant_id IS NOT NULL`. This runs on every request before any code.

2. **Page guard** (`requireDevCommandAccess()` in `src/lib/auth/session.ts`): called at the top of every Dev Command Center page. Verifies the session independently of middleware. In MOCK_MODE (preview deployments with no DB), it returns sample data.

3. **Database RLS** (Supabase): every `dev_*` table has `is_reliance_admin()` as its RLS policy. Even a direct Supabase client call from a tenant session returns 0 rows.

---

## The workflow engine

**File:** `src/lib/devcenter/workflow.ts`

Defines the 17 ordered stages as a const array `WORKFLOW_STAGES`. Helper functions:
- `stageIndex(status)` — returns 0-based position in the array
- `nextStage(status)` — returns the next stage string
- `isTerminal(status)` — true for complete / cancelled / failed
- `isWorkflowStage(status)` — true for anything in the array

**The runner** (`runNextStep` in `src/lib/actions/devcenter.ts`): a single server action that reads the current task status, computes `nextStage`, inserts the run record, calls the relevant stage handler (1a through 1g blocks), advances the task status, and records an audit log entry.

Adding a new stage: add it to `WORKFLOW_STAGES` in the right position, then add a corresponding `if (next === "your_stage")` block in `runNextStep`.

---

## AI / deterministic fallback pattern

**File:** `src/lib/ai/provider.ts`

All agent stages use `generateStructuredJson()` with a `hasLiveAi()` gate. In production (no `ANTHROPIC_API_KEY`), it falls through to deterministic heuristic logic built directly into the stage handler. This means:

- The system works fully without an AI key (deterministic fallbacks)
- With an AI key, the AI provides richer, task-specific output
- The UI shows a "Live AI" or "Heuristic" badge to indicate which mode is active

The pure business logic files (`security-review.ts`, `qa-tests.ts`, `release.ts`, `github-plan.ts`, etc.) contain the heuristic implementations. These are the fallbacks when AI is unavailable.

---

## Adding a new agent stage (checklist)

1. Add the stage name to `WORKFLOW_STAGES` in `workflow.ts` at the right position
2. Add a `if (next === "your_stage")` block in the `runNextStep` server action in `devcenter.ts`
3. If the stage produces structured output, add the relevant table insert and type
4. If the stage produces a UI panel, create the component in `_components/`
5. Import and render the new panel in `tasks/[taskId]/page.tsx`
6. If the stage has a sample for preview mode, add to `sample.ts`
7. Add the stage to `WORKFLOW_STAGES` labels in `labels.ts`
8. Write a migration if a new table or column is needed (see migration pattern below)
9. Run `npm run typecheck` — fix all errors before committing

---

## Migration pattern

All `dev_*` migrations follow this pattern (see existing `supabase/migrations/2026062*_dev_*.sql`):

```sql
-- Always additive: ADD COLUMN IF NOT EXISTS
-- Always safe: CHECK constraints as supersets of existing data
-- Always RLS on: no table without enable row level security
-- Always trigger: attach ops_set_updated_at()
-- Always seed: agent rows use ON CONFLICT DO NOTHING

alter table public.dev_my_table add column if not exists my_col text;
alter table public.dev_my_table drop constraint if exists dev_my_table_my_col_check;
alter table public.dev_my_table add constraint dev_my_table_my_col_check
  check (my_col is null or my_col in ('value_a', 'value_b'));
```

**Never use:** `drop table`, `alter column type` on a live column, `delete from` without a `where` on 0 rows first.

**Migration filename format:** `YYYYMMDDHHMMSS_dev_description_phaseN.sql`

---

## MOCK_MODE

`MOCK_MODE` is true when `process.env.NEXT_PUBLIC_SUPABASE_URL` is not set (Vercel preview deployments, local dev without `.env.local`).

In MOCK_MODE:
- `getTaskDetail()` returns sample data from `sample.ts` for known sample task IDs
- `runNextStep` returns an error (can't run without a DB)
- All server actions return `{ ok: false, error: "This needs the live database." }`
- The page renders with sample data so the UI can be reviewed without a DB connection

To test with real data locally: copy `.env.local.example` to `.env.local` and fill in the Supabase credentials.

---

## Sample data

**File:** `src/lib/devcenter/sample.ts`

Contains sample versions of every `dev_*` type for use in MOCK_MODE and preview deployments. When adding a new table/type, add a corresponding `SAMPLE_*` export.

`taskBundle(taskId)` assembles a full view for a sample task ID. The sample task IDs are `task-1` and `task-2`.

When you add new fields to an existing type, update the `SAMPLE_*` arrays — TypeScript will catch missing fields at compile time.

---

## UI components

**Directory:** `src/app/(app)/admin/dev-command/_components/`

Each panel is a separate component. All client components are marked `"use client"` at the top. Server components fetch data at the page level and pass it down as props.

Panel naming convention: `[Noun]Panel.tsx` (e.g. `SecurityReviewPanel.tsx`, `TestResultsPanel.tsx`).

The `badges.tsx` file exports the `Badge`, `TaskStatusBadge`, `PriorityBadge`, and `RiskLevelBadge` components. Use these for any status/severity display — do not create new badge styles.

---

## Types

**File:** `src/lib/devcenter/types.ts`

All `dev_*` table types are defined here. When adding a new column, add it to the relevant type and update `SAMPLE_*` in `sample.ts`.

When adding a new CHECK constraint value, also update the corresponding union type (e.g. `TestType`, `ApprovalType`, `RiskLevel`).

---

## Labels

**File:** `src/lib/devcenter/labels.ts`

Human-readable labels for every enum value — task status, risk level, approval type, test type, etc. When adding a new enum value, always add a corresponding label here.

---

## Completion gate

The task cannot reach "complete" status if any of these are true (checked in `runNextStep` at the `next === "complete"` block):

1. No final approval granted (`dev_approvals.approval_type = 'final_human_approval', status = 'approved'`)
2. Experience score too low (average below threshold across `dev_experience_scores`)
3. Any open review gate marked not passed (`dev_review_gates.passed = false, status != 'resolved'`)
4. Any failing or errored test (`dev_test_results.status in ('failed', 'error')`)
5. Any open critical security finding (`dev_security_reviews.verdict = 'fail', status = 'open'`)

All five gates are additive — they each push a message into a `need[]` array and the task is blocked if the array is not empty.

---

## CI and deploy

- **GitHub Actions** (`.github/workflows/ci.yml`): runs `typecheck → test → build → system-test` on every push/PR to master. The system-test step uses `scripts/system-test.mjs` to verify all 56 nav routes return 200.
- **Branch protection**: master requires all four checks to pass before merge.
- **Vercel**: auto-deploys master on every push. Preview deployments for branches run in MOCK_MODE.
- **Production deploys for non-master commits**: use `vercel --prod --yes` from the local branch tip (used when GitHub push is blocked).

---

## Common debugging commands

```bash
# Typecheck only
npm run typecheck

# Full lint
npm run lint

# System test (all 56 nav routes)
npm run test:system

# Check what's on the current branch
git log --oneline master..HEAD

# List all dev_* tables on prod
# (run in Supabase SQL editor)
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'dev_%'
order by table_name;
```

---

## Things to never do

- **Never disable RLS on a `dev_*` table** — not even temporarily in development
- **Never put the Supabase service role key in client-side code**
- **Never skip the `requireDevCommandAccess()` guard in a new page**
- **Never push directly to master** — all changes go through a feature branch and CI
- **Never run a migration on prod without approval** — follow the migration pattern and get explicit authorization
- **Never delete from `dev_audit_log`** — it is append-only and is the system's record of truth

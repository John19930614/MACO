# AI Dev Command Center — Phase 11 Scoping Plan (Execution Layer)

**Status:** Scoping / proposal only. **Nothing built.** This is the input to a future Phase 11 build.

> Phases 1–10 are "plan and draft, never apply." Phase 11 is the **first phase that
> would touch real files, the real database, or a real deploy.** Because of that, it
> needs more safety than any prior phase — this doc proposes how to do it without
> ever weakening the guarantees we built.

---

## 1. The one-line goal
Let the operator turn an **already-approved** artifact (a code draft, a file change plan, or a
migration draft) into a **real change** — through a single, audited, reversible path that a
non-technical admin can drive with confidence.

## 2. Hard rules (carried over, non-negotiable)
- **Approval first, always.** Nothing executes unless the corresponding `dev_approvals` row is
  `approved` AND the required `dev_review_gates` are passed/waived. Phase 11 only *acts on* what
  Phase 9/10 already cleared.
- **One change at a time, explicit.** No batch "apply everything." The operator picks a specific
  approved artifact and clicks apply on *that one*.
- **Reversible by default.** Every apply must have a defined undo (git revert, down-migration, or
  redeploy of the previous build).
- **Everything audited.** Every apply writes to `dev_audit_log` with before/after detail.
- **Admin-only**, same three-layer gate (middleware + page guard + RLS).
- **The agents never trigger an apply.** Only a human click starts execution. Phase 11 is *not*
  autonomy.

## 3. What "execution" means — split by risk (build in this order)

| Tier | Action | How it applies | Reversibility | Build priority |
|---|---|---|---|---|
| A | **Write a draft to a file in a branch** | Commit the artifact's content to a new git branch (never `master`) | Delete the branch | 1st — lowest risk |
| B | **Open a pull request** | Push the branch + open a PR for human review on GitHub | Close the PR | 2nd |
| C | **Run a migration on a preview/branch DB** | Apply the SQL draft to a Supabase **branch** database, not prod | Reset the branch DB | 3rd |
| D | **Deploy a preview** | Build the branch to a Vercel **preview** URL | Delete the preview | 4th |
| E | **Production migration / release** | Apply to prod / promote to production | Down-migration / redeploy previous | LAST — only behind a second explicit confirmation |

Tiers A–D never touch production. Tier E is the only one that does, and it should reuse the exact
high-risk confirmation pattern from Phase 10.

## 4. The safe execution path (proposed)
1. Operator opens an **approved** artifact/file-plan and clicks **"Apply this change."**
2. System re-checks: approval is `approved`, reviews cleared, not already applied. (Defense in depth —
   never trust the button alone.)
3. **Dry run / preview the diff** — show exactly what will change (the git diff or the SQL), and the
   rollback that will be recorded.
4. **Confirmation** — plain-English summary + (for Tier E) the high-risk modal.
5. **Execute** through a single controlled runner (see §5), capturing stdout/result.
6. **Record**: update the artifact/plan status to `applied` (or `applied_later` → `applied`), write a
   `dev_deployments` and `dev_audit_log` row with the result + the rollback handle.
7. **On failure**: stop, mark `failed`, surface the error in plain English, leave nothing half-applied.

## 5. The execution runner — the hard part
The app (Next.js on Vercel) **cannot write to the project's own source files** at runtime, and
shouldn't run `git`/`supabase`/`vercel` from a request handler. So Phase 11 needs an **execution
boundary**. Options to evaluate:
- **(Recommended) A separate, gated worker** (GitHub Action / a small CLI the operator or Claude runs)
  that reads `approved` rows from `dev_*`, performs the git/SQL/deploy action, and writes the result
  back. The web app only *requests* and *displays*; it never executes. This keeps the dangerous
  capability out of the public web surface entirely.
- A Supabase Edge Function with tightly-scoped secrets (only for the DB-branch tier).
- Manual-assisted: the app generates an exact, copy-pasteable command + the operator (or Claude in a
  session) runs it. Lowest engineering cost, still fully audited via the approval record.

**Security note:** whatever runs git/deploy holds powerful tokens. Those tokens must live **only** in
the worker's environment, never in the web app, never in `dev_*`, never client-reachable.

## 6. New data (minimal)
- `dev_executions` (or extend `dev_deployments`): `task_id`, `artifact_id`/`plan_id`, `tier`,
  `status` (queued/running/succeeded/failed/rolled_back), `result`, `rollback_handle`,
  `executed_by`, `created_at`. Superadmin RLS, like every `dev_*` table.
- Statuses `applied` / `applied_later` already exist on artifacts and file plans from Phases 7–8.

## 7. What we explicitly will NOT do in Phase 11
- No autonomous execution (no "run all", no agent-triggered apply).
- No direct production file writes from the web app.
- No bypassing approvals or reviews.
- No storing deploy/git tokens anywhere the web app or browser can reach them.

## 8. Recommended first slice
Build **Tier A only** first: "apply an approved code draft to a new git branch" via the gated worker,
fully audited, with branch-delete as the undo. It proves the whole execution boundary safely, touches
nothing in production, and is the smallest useful step. Everything else layers on after that works.

## 9. Open decisions for the operator (before building)
1. Which execution boundary (§5) — recommended is the separate gated worker.
2. Where the git/deploy tokens live (must be outside the web app).
3. Whether Tier E (production) is in scope at all yet, or stop at preview/branch for now.

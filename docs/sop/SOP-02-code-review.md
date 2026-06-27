# SOP-02 — Code Review SOP

| | |
|---|---|
| **Owner** | Reviewer (John, or AI review pass when solo) |
| **Trigger** | Before merging non-trivial work to `master` |
| **Definition of done** | Diff reviewed against the checklist; correctness + safety confirmed; merged or sent back |
| **Related** | [SOP-01 Coding](SOP-01-coding.md) · [SOP-08 RLS](SOP-08-multitenancy-rls.md) · [SOP-17 Security](SOP-17-security-review.md) · [SOP-19 AI Gov](SOP-19-ai-governance.md) |

---

## 1. Purpose & scope

A second look before code goes to `master` (which deploys — SOP-11). This is a
mostly-solo project, so "review" is pragmatic: for trivial changes, the SOP-01
self-review is enough; for anything touching **data, tenancy, auth, AI, or
schema**, do a deliberate review pass — yourself after a break, or via an AI
review (`/code-review`, `/review`, or the `code-review` skill).

Reviewing is about *correctness and safety*, not style — lint/format is automated.

---

## 2. What a review must confirm

Read the **whole diff**, then check:

**Correctness**
- Does it do what it claims? Any obvious logic bug, off-by-one, unhandled error,
  or missing `await`?
- Mock **and** live repo branches both handled? Mock mode still works?
- Tests added/updated for the new behavior? Suite green?

**Safety (the high-stakes axes — never skip)**
- **Tenancy:** every new read/write/storage path scoped to `tenant_id` (SOP-08)?
- **Auth:** correct role gate on the route/action (matches `permissions` /
  `authz-routes` tests)?
- **Secrets:** nothing server-only leaking to a client component (SOP-12)?
- **AI:** outputs stay `pending`; high/critical forces review (SOP-19)?
- **Vocabulary:** new enum values only via constants + matching CHECK (SOP-07)?
- **Audit:** sensitive mutations go through `addAudit(...)`?

**Blast radius**
- Does it touch schema (→ SOP-07) or tenant data (→ SOP-08) — i.e. does it need
  more than a code review before shipping?

---

## 3. Procedure

1. Get the diff in front of you (`git diff master...<branch>` or the PR).
2. Run the SOP-01 gate if not already green (`typecheck`, `build`, `test`).
3. Walk the checklist in §2. For data/auth/AI/schema changes, this is mandatory,
   not optional.
4. Leave findings as concrete, actionable notes (or apply fixes).
5. **Decision:** approve & merge (SOP-03 → SOP-11), or send back with reasons.
6. If you found a *class* of issue (not just this instance), consider whether a
   test or an SOP update should prevent it next time.

---

## 4. Review heuristics

- **Diff size:** if it's too big to hold in your head, it's too big to review —
  ask for it to be split.
- **The scary lines first:** jump to anything touching `repo.ts`, RLS, auth,
  `serverSecrets()`, or the AI engine before reading the cosmetic parts.
- **Trust the guards:** if a change makes `tenancy`/`permissions`/`schema-
  consistency` fail, the change is wrong until proven otherwise — don't weaken
  the test to pass.

---

## 5. Checklist

```
[ ] whole diff read
[ ] SOP-01 gate green
[ ] correctness: no obvious bug; mock+live both handled; tests updated
[ ] tenancy scoped (SOP-08)        [ ] auth/role gate correct
[ ] no server secret client-side   [ ] AI stays pending/forced-review (SOP-19)
[ ] enums via constants + CHECK     [ ] addAudit on sensitive mutations
[ ] schema/tenant-data changes routed through SOP-07 / SOP-08
[ ] decision recorded (merge or send back with reasons)
```

---

*Revision: v1 · 2026-06-27 · first written.*

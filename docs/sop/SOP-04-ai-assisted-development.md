# SOP-04 — AI-Assisted Development SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | Using an AI coding assistant (Claude Code, etc.) on this repo |
| **Definition of done** | AI-made changes meet the same gate and review bar as hand-written ones |
| **Related** | [SOP-01 Coding](SOP-01-coding.md) · [SOP-02 Review](SOP-02-code-review.md) · `AGENTS.md` · [SOP-23 Docs/Memory](SOP-23-docs-memory-sync.md) |

---

## 1. Purpose & scope

Most changes here are AI-assisted. That is fine — but AI output is **advisory for
the codebase too**: it must clear the same gate and review as anything you'd type
yourself. This SOP keeps AI velocity from outrunning the safety rails.

---

## 2. Rules

1. **`AGENTS.md` is the assistant's brief.** It's loaded automatically; keep it
   accurate (a stale claim there propagated a wrong fact into an SOP once — fixed
   2026-06-27). When conventions change, update `AGENTS.md` first.
2. **The gate is non-negotiable.** AI changes still must pass
   `typecheck` + `build` + `test` (SOP-01), and the system test if routes changed
   (SOP-06). "The AI wrote it" is not evidence it works.
3. **Review the diff, not the prose.** Read what actually changed (SOP-02),
   especially on the high-stakes axes (tenancy, auth, secrets, AI, schema). AI is
   confidently wrong in exactly these places.
4. **Verify factual claims.** When the assistant asserts a file/symbol/flag
   exists, trust-but-verify (grep/build) before relying on it — recalled memory
   and model knowledge can be stale.
5. **Guard the OneDrive risk.** Long AI sessions accumulate uncommitted diffs;
   commit at checkpoints (SOP-03).
6. **Memory hygiene.** Persist non-obvious decisions to the memory library
   (SOP-23) so the next session doesn't relearn or contradict them.

---

## 3. Procedure

1. Point the assistant at the task; let it read `AGENTS.md` + relevant code.
2. Have it make the change on a branch (SOP-03).
3. Run the SOP-01 gate (+ SOP-06 if routes/UI changed).
4. Do the SOP-02 review pass on the diff yourself.
5. For DB/cloud/infra changes, require a **plain-English explanation before**
   anything is applied (standing preference — memory `feedback_explain_changes`).
6. Commit; update docs/memory if the change is non-obvious.

---

## 4. Checklist

```
[ ] AGENTS.md still accurate for what changed
[ ] gate green (typecheck/build/test [+ system test if routes changed])
[ ] diff reviewed on tenancy/auth/secrets/AI/schema axes
[ ] AI's factual claims verified (grep/build), not taken on faith
[ ] committed at checkpoints (OneDrive risk)
[ ] DB/infra change explained in plain English before apply
[ ] non-obvious decisions saved to memory
```

---

*Revision: v1 · 2026-06-27 · first written.*

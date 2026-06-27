# SOP-13 — Rollback & Hotfix SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | Production is broken or a regression is found after deploy |
| **Definition of done** | Prod restored to a known-good state; root cause noted; follow-up planned |
| **Related** | [SOP-11 Release](SOP-11-release-deployment.md) · [SOP-03 Branching](SOP-03-branching-version-control.md) · [SOP-14 Incident](SOP-14-incident-response.md) · [SOP-07 Migration](SOP-07-database-migration.md) |

---

## 1. Purpose & scope

Get production back to working **fast and safely** when a deploy goes wrong.
The instinct under pressure is to `reset --hard` or hand-patch prod — both make
things worse. This SOP is the calm path.

First question, always: **is this a code problem or a data/schema problem?** They
roll back differently.

---

## 2. Decide: roll back vs. fix forward

| Use **rollback** when… | Use **hotfix (fix forward)** when… |
|---|---|
| A deploy clearly broke prod and the prior deploy was good | The bug is small, well-understood, and reverting would lose other good changes |
| You can't diagnose quickly and users are impacted | The broken state involves a migration that can't simply be "un-deployed" |

When in doubt and users are impacted: **roll back first, diagnose after.**

---

## 3. Code rollback (the common case)

Because `master` auto-deploys to Vercel (SOP-11), reverting code = redeploying
good code:

```bash
git revert <bad-sha>        # makes a NEW commit that undoes the bad one
git push origin master      # Vercel redeploys the restored state
```
- **Never** `git reset --hard` a pushed `master` or force-push it (SOP-03).
- Faster alternative: in the **Vercel dashboard**, promote the previous
  successful deployment while you prepare the revert.
- Confirm recovery with a prod smoke-check (SOP-11 §5) + `/api/health`.

---

## 4. Hotfix (fix forward)

1. Branch from `master` (`fix/<name>`), make the minimal change.
2. Run the SOP-01 gate (`typecheck`, `build`, `test`) — do **not** skip it even
   under pressure; a broken hotfix doubles the outage.
3. Merge and push (SOP-11). Smoke-check prod.

---

## 5. Schema / data rollback (be careful)

A bad **migration** is not undone by reverting app code:
- Prefer a **forward-fix migration** that corrects the prior one (applied via
  SOP-07's gate — yes, even in an incident; the explain step can be one line).
- If data was corrupted, restore from backup (SOP-09) — never hand-edit prod rows
  blind.
- If app code and schema both changed, roll back **in the right order**: restore
  the schema-compatible app version first, then address the schema.

---

## 6. After recovery

- Note what broke, how it was restored, and the root cause (feeds SOP-14).
- Add a test or guard so the same break can't ship again.
- Update memory/docs if it revealed a non-obvious fact.

---

## 7. Checklist

```
[ ] decided rollback vs fix-forward (rollback first if users impacted)
[ ] code: git revert + push (NOT reset --hard / force-push), or Vercel promote
[ ] gate green before any hotfix push
[ ] schema issue → forward-fix migration via SOP-07 (not hand-edits)
[ ] data issue → restore from backup (SOP-09), not blind row edits
[ ] prod smoke-checked + /api/health green
[ ] root cause noted; guard/test added; docs/memory updated
```

---

*Revision: v1 · 2026-06-27 · first written.*

# SOP-03 — Branching & Version Control SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | Start of any code change |
| **Definition of done** | Work is committed and pushed; no large uncommitted diff left under OneDrive |
| **Related** | [SOP-01 Coding](SOP-01-coding.md) · [SOP-11 Release](SOP-11-release-deployment.md) · [SOP-13 Rollback](README.md) |

---

## 1. Purpose & scope

How to use git safely on this repo. It exists because of one specific, already-
realized hazard: **the repo lives inside OneDrive**, and an out-of-band sync /
`git reset --hard` has **wiped uncommitted edits mid-session before**. Frequent
commits are not hygiene here — they are data-loss insurance.

Facts about this repo:
- Git root: `maco-platform/` · default branch: `master`.
- Remote: `origin` → `github.com/John19930614/MACO.git` (private).
- **Vercel auto-deploys `master`.** A push to `master` ships to production
  (see SOP-11). Treat `master` as a release branch, not a scratchpad.

---

## 2. The rules

1. **Commit early, commit often.** Never let a large change sit uncommitted. If
   you've written more than ~30 minutes of work, it should be committed. This is
   the primary defense against the OneDrive wipe.
2. **A push to `master` is a deploy.** Don't push half-finished work to `master`
   — it goes live. Finish, verify (SOP-01 gate), *then* push.
3. **Use a short-lived branch for anything non-trivial.** Bug-fix or multi-file
   feature → branch off `master`, commit there, merge back when green. Trivial
   one-liners may go straight to `master` if verified.
4. **Never commit secrets.** `.gitignore` already excludes `.env`, `.env*.local`,
   `.env.local`, and `supabase/.env`. Don't override it (no `git add -f` on env
   files). See SOP-12.
5. **Never force-push `master`** and never `git reset --hard` without first
   confirming there's nothing uncommitted you care about. `git status` first,
   every time.

---

## 3. Procedure

### Start of work
```bash
git status                      # confirm clean tree; rescue any stray edits first
git checkout master && git pull # start from latest
git checkout -b fix/<short-name># branch for non-trivial work
```

### During work
- Commit at each working checkpoint with a clear message:
  ```bash
  git add -A && git commit -m "<what changed and why>"
  ```
- If you must stop mid-change, commit a WIP commit rather than leaving it
  uncommitted under OneDrive. You can amend/squash later.

### Finishing
1. Run the SOP-01 gate: `npm run typecheck && npm run build && npm run test`.
2. Merge to `master` (fast-forward or merge commit):
   ```bash
   git checkout master && git merge fix/<short-name>
   ```
3. Push **only when you intend to deploy** (this triggers Vercel — SOP-11):
   ```bash
   git push origin master
   ```
4. Delete the merged branch: `git branch -d fix/<short-name>`.

---

## 4. Recovery — "did I just lose work?"

- **Uncommitted edits vanished (OneDrive/reset):** check `git reflog` and
  `git fsck --lost-found` for dangling commits; check OneDrive's *Version
  history* / recycle bin for the file. This is why rule §2.1 exists — committed
  work is recoverable, uncommitted work often isn't.
- **Bad commit on `master`:** `git revert <sha>` (safe, makes a new commit). Do
  **not** `reset --hard` a pushed `master`.
- **Need to undo a deploy:** that's SOP-13 (Rollback) — revert the commit and
  push, or roll back in Vercel.

---

## 5. Checklist

```
[ ] git status was clean before I started (or I rescued stray edits)
[ ] non-trivial work was on a branch
[ ] committed at every checkpoint (nothing large left uncommitted)
[ ] no .env / secret staged
[ ] SOP-01 gate green before merging to master
[ ] pushed to master only when I meant to deploy
```

---

*Revision: v1 · 2026-06-27 · first written.*

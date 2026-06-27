# SOP-11 — Release & Deployment SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | Shipping a change to production |
| **Definition of done** | Verified build pushed to `master`, Vercel deploy green, prod smoke-checked |
| **Related** | [SOP-03 Branching](SOP-03-branching-version-control.md) · [SOP-12 Secrets](SOP-12-secrets-management.md) · [SOP-13 Rollback](README.md) · `docs/to-production.md` |

---

## 1. Purpose & scope

How a change goes live. The deploy mechanism is simple and unforgiving:
**a push to `master` auto-deploys to Vercel.** There is no separate "deploy"
button to forget — which means there is also no safety gap between "pushed" and
"in front of customers." This SOP is the gate that fills that gap.

Facts:
- App: Next.js 15 on **Vercel**, live at `safetyiq-platform.vercel.app`.
- Source: `master` on `github.com/John19930614/MACO.git` (private) auto-deploys.
- Backend: Supabase project `safetyiq` (`bjgqjpekhicqlunxbobo`).

---

## 2. Pre-release gate (must be green before pushing `master`)

```bash
npm run typecheck     # zero type errors
npm run build         # compiles + lints + prerenders every route
npm run test          # full vitest suite
```
Plus, scaled to the change:
- **Routes/UI touched →** run the System Test (SOP-06): build + all-nav route
  smoke test (all nav routes should return 200).
- **Tenant data touched →** SOP-08 (mock + live RLS).
- **Schema touched →** SOP-07 (applied to `safetyiq`, advisors clean) **before**
  the app code that depends on it ships.

> Order matters: apply the DB migration first, confirm it, *then* deploy the app
> that uses it — never the reverse.

---

## 3. Procedure

1. **Confirm env readiness (SOP-12).** Any new env var the build needs must
   exist in **Vercel** project settings, not just `.env.local`. Outstanding
   today: John still owes 2 secret env keys + the Supabase redirect URL
   (memory `deployment_vercel`) — a deploy that needs them will fail or run
   degraded until they're set.
2. **Merge to `master`** (SOP-03) with the gate green.
3. **Deploy = push:**
   ```bash
   git push origin master
   ```
4. **Watch the Vercel build** to green. If it fails, the previous deploy stays
   live (Vercel doesn't promote a failed build) — fix forward.
5. **Smoke-check production** after the deploy:
   - Load the app; sign in; open a few key nav routes (Dashboard, a Compliance
     module, an SA page).
   - Check `/api/health` (authenticated/cron-secret) returns 200.
   - Watch for runtime errors (Vercel runtime logs / Supabase logs).
6. **Record** the release (what shipped) in memory/docs.

---

## 4. If something is wrong post-deploy

→ **SOP-13 (Rollback & Hotfix).** Fastest safe options:
- `git revert <sha> && git push origin master` (re-deploys the prior good state).
- Or promote the previous successful deployment in the Vercel dashboard.
Never `reset --hard` a pushed `master` (SOP-03).

---

## 5. Checklist

```
[ ] pre-release gate green (typecheck + build + test)
[ ] system test run if routes/UI changed
[ ] RLS verified if tenant data changed
[ ] schema migration applied + advisors clean BEFORE app deploy (if schema changed)
[ ] required env vars present in Vercel (not just .env.local)
[ ] merged to master with gate green
[ ] pushed; Vercel build watched to green
[ ] prod smoke-checked (login + key routes + /api/health + logs)
[ ] release recorded
```

---

*Revision: v1 · 2026-06-27 · first written.*

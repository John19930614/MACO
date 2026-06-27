# SOP-14 — Production Incident Response SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | Outage, data bug, or a reported security issue in production |
| **Definition of done** | Impact contained, service restored, affected tenants informed if needed, post-incident note written |
| **Related** | [SOP-13 Rollback](SOP-13-rollback-hotfix.md) · [SOP-08 RLS](SOP-08-multitenancy-rls.md) · [SOP-15 Monitoring](README.md) · [SOP-17 Security](SOP-17-security-review.md) |

---

## 1. Purpose & scope

What to do when prod is *actually* on fire — distinct from a routine bad deploy
(that's SOP-13). Covers outages, data-integrity bugs, and **security incidents**
(especially the worst case for this platform: cross-tenant data exposure). The
goal is a calm, ordered response that contains damage before chasing root cause.

This matters more than usual here because the platform holds **multiple clients'
safety data** under one schema — a tenant-isolation failure is a reportable
event, not just a bug.

---

## 2. The response order (don't reorder these)

1. **Assess severity & scope.** What's broken, for whom, since when?
   - **SEV-1:** data exposed across tenants, data loss/corruption, or full
     outage. → all hands, act now.
   - **SEV-2:** a module broken or wrong data for one tenant; app still up.
   - **SEV-3:** minor/cosmetic, no data risk.
2. **Contain.** Stop the bleeding before fixing the cause:
   - Bad deploy → roll back (SOP-13).
   - Suspected secret leak → rotate the key immediately (SOP-12).
   - Cross-tenant exposure → if you can't fix in minutes, take the affected path
     offline (disable the feature/module) rather than leave data exposed.
3. **Restore** service to a known-good state (SOP-13).
4. **Verify** with a prod smoke-check + `/api/health` + Supabase/Vercel logs +
   the relevant guard test (e.g. `tenancy` for an isolation bug).
5. **Communicate.** For SEV-1 affecting a tenant (esp. data exposure), inform the
   affected client per your agreement — promptly and honestly.
6. **Post-incident note.** Write it down (§4) while it's fresh.

---

## 3. Diagnosis sources

- **Vercel** runtime logs + build logs (app/runtime errors).
- **Supabase** logs + the **security/perf advisors** (RLS, SECURITY DEFINER,
  exposed objects).
- **`/api/health`** — the gateway pipeline report (authenticated / cron-secret).
- The guard tests: `tenancy`, `permissions`, `authz-routes`, `schema-consistency`.

---

## 4. Post-incident note (keep it short, keep it honest)

Record:
- **What happened** and the timeline (detected → contained → restored).
- **Impact:** which tenants/data, how long.
- **Root cause.**
- **Fix** shipped + the **guard** added so it can't recur (test/SOP/advisor).
- Update memory/docs; if it's a class of bug, update the relevant SOP.

> Precedent: the cross-tenant storage IDOR and the SECURITY DEFINER view leak
> were both found, fixed, and recorded this way (memory `system_audit_findings`).

---

## 5. Checklist

```
[ ] severity assessed (SEV-1/2/3) and scope identified
[ ] CONTAINED before root-cause chase (rollback / rotate key / disable path)
[ ] service restored to known-good (SOP-13)
[ ] verified: smoke-check + /api/health + logs + relevant guard test
[ ] affected tenant(s) informed if data was exposed/lost (SEV-1)
[ ] post-incident note written; guard added; docs/memory updated
```

---

*Revision: v1 · 2026-06-27 · first written.*

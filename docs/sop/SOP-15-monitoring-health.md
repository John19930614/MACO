# SOP-15 — Monitoring & Health-Check SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | After every deploy; a light daily/automated check |
| **Definition of done** | Prod confirmed healthy via health endpoint + logs; anomalies triaged |
| **Related** | [SOP-11 Release](SOP-11-release-deployment.md) · [SOP-14 Incident](SOP-14-incident-response.md) · [SOP-19 AI Gov](SOP-19-ai-governance.md) |

---

## 1. Purpose & scope

How to know prod is healthy *before a customer tells you it isn't*. Lightweight
for a small operation: a health endpoint, the gateway agent's self-checks, and
the platform logs.

---

## 2. The signals

| Signal | Where | Tells you |
|---|---|---|
| **`/api/health`** | App route (auth / `CRON_SECRET`) | Runs the full gateway pipeline; **200** = pass/warn, **503** = a hard check fails (a record would be blocked) |
| **Gateway agent health** | `gateway_agent_health_log` + `GatewayAgentPanel` on `/sa/gateway` | The AI gateway's own health-check engine over live data |
| **Vercel logs** | Vercel dashboard | App/runtime errors, deploy status |
| **Supabase logs + advisors** | Supabase dashboard | DB errors, RLS/security findings, slow queries |

---

## 3. Procedure

### After each deploy (SOP-11)
1. Hit `/api/health` (with the cron secret or an authenticated session) — expect
   200. A 503 means a gateway hard-check is failing; investigate before walking
   away.
2. Skim Vercel runtime logs for new errors.
3. Open `/sa/gateway` and confirm the agent health panel is green.

### Daily / lightweight
1. `/api/health` 200?
2. Any error spike in Vercel/Supabase logs?
3. Gateway agent health log clean?

### On anomaly
- A failing health check or error spike → triage as an incident if it impacts
  users or data (SOP-14).

---

## 4. Toward automation (as it scales)

- Point an uptime monitor at `/api/health` with the cron secret (it's built to be
  a probe: 200 healthy / 503 degraded).
- Consider a scheduled job that records the gateway agent health log and alerts
  on a hard fail.

---

## 5. Checklist

```
[ ] post-deploy: /api/health == 200
[ ] Vercel runtime logs scanned for new errors
[ ] /sa/gateway agent health panel green
[ ] Supabase logs/advisors clean
[ ] anomalies triaged (→ SOP-14 if user/data impact)
```

---

*Revision: v1 · 2026-06-27 · first written.*

# SOP-22 — Customer Support & QA SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | A tenant reports an issue, question, or request |
| **Definition of done** | Issue reproduced, resolved or routed, tenant updated, recurrence guarded |
| **Related** | [SOP-14 Incident](SOP-14-incident-response.md) · [SOP-13 Rollback](SOP-13-rollback-hotfix.md) · [SOP-05 Testing](SOP-05-testing.md) |

---

## 1. Purpose & scope

How a client report becomes a tracked, resolved outcome — not a lost Slack
message. Keeps support consistent and feeds real issues back into tests and SOPs.
The Support & QA panel (`/sa/support`) is the internal home for tickets/QA checks.

---

## 2. Triage — classify first

| Class | Examples | Path |
|---|---|---|
| **Incident** | Data wrong/exposed/lost, can't log in, module down | → SOP-14 immediately |
| **Bug** | Feature misbehaves, no data risk | Reproduce → fix via gate (SOP-01/02) |
| **Question / how-to** | Usage confusion | Answer; if common, improve docs/UX |
| **Feature request** | "Can it also…" | Log to backlog; set expectations |

**Security-sensitive reports** (anything hinting at cross-tenant visibility) jump
the queue → SOP-14 + SOP-17.

---

## 3. Procedure

1. **Acknowledge** the client promptly; capture exactly what they saw (tenant,
   user, screen, steps, time).
2. **Reproduce** — ideally in mock mode or against the right tenant. A report you
   can't reproduce isn't fixed yet.
3. **Resolve or route** per the triage class. Fixes go through the normal gate +
   review; never hot-patch prod.
4. **Add a guard** — for a real bug, a regression test (SOP-05) so it can't
   return.
5. **Close the loop** with the client (what changed, when it deploys).
6. **Record** the ticket/outcome (`/sa/support`); if it reveals a pattern, update
   the relevant SOP.

---

## 4. Checklist

```
[ ] report classified (incident / bug / question / request)
[ ] security-sensitive reports escalated (SOP-14/17)
[ ] details captured (tenant/user/screen/steps/time)
[ ] reproduced before "fixed"
[ ] fix shipped through gate + review (no prod hot-patch)
[ ] regression test added for real bugs
[ ] client updated; ticket recorded
```

---

*Revision: v1 · 2026-06-27 · first written.*

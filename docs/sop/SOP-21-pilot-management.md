# SOP-21 — Pilot Management SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | Running a live-mode pilot with a real client on prod |
| **Definition of done** | Pilot runs on real data with gaps tracked, findings captured, and a go/no-go at the end |
| **Related** | [SOP-20 Tenant Provisioning](SOP-20-tenant-provisioning.md) · [SOP-14 Incident](SOP-14-incident-response.md) · [SOP-15 Monitoring](SOP-15-monitoring-health.md) |

---

## 1. Purpose & scope

How to run a real client pilot on production without the wheels coming off. A
pilot is the first time the platform meets *real* data and *real* users — it
surfaces live-mode gaps that mock mode never shows (the 6-month Cortexa pilot did
exactly this: two real bugs + ~9 live-mode gaps, all later fixed — memory
`pilot_live_mode_findings`).

---

## 2. Rules

1. **Pilot on a real, isolated tenant.** Provisioned per SOP-20; isolation
   verified before the client touches it.
2. **Watch live mode specifically.** Bugs that only appear with real data/auth
   (the `*ById` tenant scoping, the biosafety `lab_code`, etc.) are the whole
   point — look for them.
3. **Capture every gap, fix deliberately.** Log each finding; fix through the
   normal gate (SOP-01) + review (SOP-02), not hot-patched on prod.
4. **A pilot bug affecting the client is an incident** if it impacts their data
   or access (SOP-14).
5. **Monitor more closely than usual** (SOP-15) for the pilot's duration.

---

## 3. Procedure

1. **Provision** the pilot tenant (SOP-20); verify isolation.
2. **Define scope + success criteria** with the client (which modules, what
   "good" looks like, duration).
3. **Run & observe.** Keep a running list of bugs and live-mode gaps. Triage:
   blocker (fix now) vs. backlog.
4. **Fix through the pipeline** — branch, gate, review, deploy, verify.
5. **Check in regularly** with the client; keep monitoring (SOP-15).
6. **Close out:** review findings, confirm fixes, and make a **go / no-go /
   extend** decision. Record outcomes (memory/docs).

---

## 4. Checklist

```
[ ] pilot tenant provisioned + isolation verified (SOP-20)
[ ] scope + success criteria agreed with client
[ ] live-mode gaps actively hunted, not just feature bugs
[ ] findings logged; fixes shipped through the normal gate (no prod hot-patches)
[ ] client-impacting bugs handled as incidents (SOP-14)
[ ] closer monitoring for the pilot window (SOP-15)
[ ] close-out review + go/no-go decision recorded
```

---

*Revision: v1 · 2026-06-27 · first written.*

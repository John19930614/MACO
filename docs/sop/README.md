# SafetyIQ — Platform Management SOP Library

**Owner:** John Haldemann (Reliance Predictive Safety Technologies)
**Purpose:** The standard operating procedures that keep the SafetyIQ platform
safe to change, ship, and operate. Each SOP is a repeatable, checklist-driven
procedure with a clear **owner**, **trigger** (when you run it), and **definition
of done**.

> SOPs vs. the rest of the docs: `AGENTS.md` states *conventions and guardrails*
> (the rules). The `docs/sop/` library states *procedures* (how to actually do a
> thing, step by step, every time). `docs/to-production.md`, `docs/test-plan.md`,
> and `docs/migration-plan.md` are reference material the SOPs link into.

---

## How to use this library

- Every SOP has an ID (`SOP-NN`), an owner, a trigger, and a checklist.
- When a procedure changes, update the SOP **first**, then do the work.
- An SOP is "live" only when it's been run at least once end-to-end and the
  checklist matched reality. Until then it's "draft."
- Keep SOPs short enough that you'll actually follow them. If a step is obvious
  from tooling, link the tool instead of re-explaining it.

---

## The catalog — every SOP the platform needs

Status legend: 🟢 written · 🟡 drafting · ⚪ planned

### Domain A — Engineering & Code
| ID | SOP | Trigger | Owner | Status |
|----|-----|---------|-------|--------|
| **SOP-01** | **Coding SOP** | Any code change | Engineer/AI | 🟢 |
| **SOP-02** | **Code Review SOP** | Before merge to `master` | Reviewer | 🟢 |
| **SOP-03** | **Branching & Version Control SOP** | Start of any change (OneDrive+git is fragile here) | Engineer | 🟢 |
| **SOP-04** | **AI-Assisted Development SOP** | Using Claude Code / Cursor on this repo | Engineer | 🟢 |
| **SOP-05** | **Testing SOP** | Writing/maintaining tests | Engineer | 🟢 |
| **SOP-06** | **System Test SOP** | Pre-release, post-merge, on demand | Engineer | 🟢 |

### Domain B — Database & Data
| ID | SOP | Trigger | Owner | Status |
|----|-----|---------|-------|--------|
| **SOP-07** | **Database Migration SOP** | Any schema change to a Supabase project | Engineer + John (prod gate) | 🟢 |
| **SOP-08** | **Multi-Tenancy & RLS Verification SOP** | New table, new query path, pre-release | Engineer | 🟢 |
| **SOP-09** | **Data Backup & Recovery SOP** | Weekly + before risky migrations | John | 🟢 |
| **SOP-10** | **ETL / Bulk Import SOP** | Importing a tenant's existing data | Engineer | 🟢 |

### Domain C — Release & Environments
| ID | SOP | Trigger | Owner | Status |
|----|-----|---------|-------|--------|
| **SOP-11** | **Release & Deployment SOP** | Shipping to Vercel prod | John | 🟢 |
| **SOP-12** | **Environment & Secrets Management SOP** | Adding/rotating any key | John | 🟢 |
| **SOP-13** | **Rollback & Hotfix SOP** | Prod is broken / regression found | John | 🟢 |

### Domain D — Operations & Reliability
| ID | SOP | Trigger | Owner | Status |
|----|-----|---------|-------|--------|
| **SOP-14** | **Production Incident Response SOP** | Outage, data bug, security report | John | 🟢 |
| **SOP-15** | **Monitoring & Health-Check SOP** | Daily/automated; after deploy | John | 🟢 |
| **SOP-16** | **Dependency & Patch SOP** | Monthly + on CVE | Engineer | 🟢 |

### Domain E — Security & Governance
| ID | SOP | Trigger | Owner | Status |
|----|-----|---------|-------|--------|
| **SOP-17** | **Security Review SOP** | Pre-release of any data-touching feature | Engineer | 🟢 |
| **SOP-18** | **Access Control & Offboarding SOP** | Granting/revoking Supabase/Vercel/GitHub access | John | 🟢 |
| **SOP-19** | **AI Governance SOP** | Any change to the AI engine, gateway, or prompts | Engineer | 🟢 |

### Domain F — Customer & Tenant
| ID | SOP | Trigger | Owner | Status |
|----|-----|---------|-------|--------|
| **SOP-20** | **Tenant Provisioning SOP** | Onboarding a new client company | John | 🟢 |
| **SOP-21** | **Pilot Management SOP** | Running a live-mode pilot (e.g. Cortexa) | John | 🟢 |
| **SOP-22** | **Customer Support & QA SOP** | A tenant reports an issue | John | 🟢 |

### Domain G — Knowledge
| ID | SOP | Trigger | Owner | Status |
|----|-----|---------|-------|--------|
| **SOP-23** | **Documentation & Memory Sync SOP** | After any significant change | Engineer/AI | 🟢 |

---

## Rollout plan (priority phasing)

**P0 — write first (the ones that prevent disasters): ✅ ALL WRITTEN**
SOP-01 Coding · SOP-03 Branching/Git (OneDrive+git has already wiped uncommitted
work once) · SOP-07 Database Migration (prod migrations need a hard gate) ·
SOP-11 Release & Deployment · SOP-12 Secrets · SOP-08 RLS Verification (a
cross-tenant IDOR has already been found and fixed once).

**P1 — write next (steady-state quality & safety): ✅ ALL WRITTEN**
SOP-02 Code Review · SOP-06 System Test · SOP-13 Rollback/Hotfix ·
SOP-14 Incident Response · SOP-17 Security Review · SOP-19 AI Governance.

**P2 — write as you scale (multi-tenant operations): ✅ ALL WRITTEN**
SOP-04 AI-Assisted Dev · SOP-05 Testing · SOP-09 Backup/Recovery · SOP-10 ETL ·
SOP-15 Monitoring · SOP-16 Dependencies · SOP-18 Access Control ·
SOP-20 Tenant Provisioning · SOP-21 Pilot Management · SOP-22 Support ·
SOP-23 Docs/Memory.

> **Status: all 23 SOPs written (v1).** Each is marked "v1 — mark live after the
> next time it's run end-to-end." Keep this catalog's statuses honest as they're
> exercised.

---

## Index of written SOPs (all 23)
- [SOP-01 — Coding SOP](SOP-01-coding.md)
- [SOP-02 — Code Review SOP](SOP-02-code-review.md)
- [SOP-03 — Branching & Version Control SOP](SOP-03-branching-version-control.md)
- [SOP-04 — AI-Assisted Development SOP](SOP-04-ai-assisted-development.md)
- [SOP-05 — Testing SOP](SOP-05-testing.md)
- [SOP-06 — System Test SOP](SOP-06-system-test.md)
- [SOP-07 — Database Migration SOP](SOP-07-database-migration.md)
- [SOP-08 — Multi-Tenancy & RLS Verification SOP](SOP-08-multitenancy-rls.md)
- [SOP-09 — Data Backup & Recovery SOP](SOP-09-backup-recovery.md)
- [SOP-10 — ETL / Bulk Import SOP](SOP-10-etl-bulk-import.md)
- [SOP-11 — Release & Deployment SOP](SOP-11-release-deployment.md)
- [SOP-12 — Environment & Secrets Management SOP](SOP-12-secrets-management.md)
- [SOP-13 — Rollback & Hotfix SOP](SOP-13-rollback-hotfix.md)
- [SOP-14 — Production Incident Response SOP](SOP-14-incident-response.md)
- [SOP-15 — Monitoring & Health-Check SOP](SOP-15-monitoring-health.md)
- [SOP-16 — Dependency & Patch SOP](SOP-16-dependencies-patching.md)
- [SOP-17 — Security Review SOP](SOP-17-security-review.md)
- [SOP-18 — Access Control & Offboarding SOP](SOP-18-access-control-offboarding.md)
- [SOP-19 — AI Governance SOP](SOP-19-ai-governance.md)
- [SOP-20 — Tenant Provisioning SOP](SOP-20-tenant-provisioning.md)
- [SOP-21 — Pilot Management SOP](SOP-21-pilot-management.md)
- [SOP-22 — Customer Support & QA SOP](SOP-22-support-qa.md)
- [SOP-23 — Documentation & Memory Sync SOP](SOP-23-docs-memory-sync.md)

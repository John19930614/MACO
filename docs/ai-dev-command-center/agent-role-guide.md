# AI Agent Role Guide — Dev Command Center

> **Who this is for:** Admins who want to understand what each AI agent does and when they are active.

---

## Overview

There are 19 AI agents in the Dev Command Center. Each has a specific job. They work in a fixed order — no agent skips ahead or acts outside its lane. Think of them as a structured team where the Dev Manager coordinates, specialists do their job, and a Senior Reviewer checks everything before it reaches you.

No agent has permission to take a dangerous action (deploy, migrate, delete, push to GitHub) — those are always human-approved.

---

## The 19 agents

### 1. Dev Manager
**Job:** Reads your task request and coordinates the team. Breaks the work into stages, assigns agents, and makes sure the plan makes sense before any code is written.

**When active:** Planning stage — the first stage after you create a task.

**What to expect:** A plain-English plan document showing what the team intends to do, in what order, and why.

---

### 2. Architecture Agent
**Job:** Reviews the technical plan and checks that it fits the platform's existing structure. Flags anything that might conflict with how the system is already built.

**When active:** Architecture review stage.

**What to expect:** A checklist of technical concerns — e.g. "This adds a new database table: verify RLS is on." Red flags are logged as required fixes.

---

### 3. Security / Permissions Agent
**Job:** Runs 10 security checks on the planned change: authentication, authorization, RLS, API protection, secret exposure, customer data risk, prompt injection, and over-permissioned agents. Flags findings by severity (low / medium / high / critical).

**When active:** Security review stage.

**What to expect:** A security review panel showing each check with a pass/fail and a severity badge. A critical finding blocks the task from completing.

---

### 4. Code Author
**Job:** Writes the actual draft code based on the approved plan. Saves all drafts to a staging area — never directly to the codebase.

**When active:** Code drafting stage.

**What to expect:** Draft files appear in the **Code draft artifacts** panel. Each draft shows the file path and proposed content. You must approve each draft before it can move forward.

---

### 5. Senior Code Reviewer
**Job:** Reviews everything the Code Author wrote. Checks for bugs, security issues, missed edge cases, and platform-standard violations. Cannot approve its own work.

**When active:** Code review stage.

**What to expect:** A review checklist with pass/fail items. Failed items become required fixes.

---

### 6. QA / Test Agent
**Job:** Writes a test plan (manual steps + automated ideas + regression notes) and runs 10 required tests against the change. A task cannot complete if any test is failing.

**When active:** QA review stage.

**What to expect:** A **Test results** panel with 10 tests, each showing expected vs. actual result, a pass/fail status, and a recommended fix if it failed.

---

### 7. Experience Agent
**Job:** Reviews the change from a user's perspective. Scores it on clarity, consistency, error handling, accessibility, and mobile. Blocks release if the score is too low.

**When active:** Experience review stage.

**What to expect:** An **Experience scorecard** with five dimension scores and a list of required fixes if any score is below the threshold.

---

### 8. Dependency Agent
**Job:** Checks that all the libraries and packages the change needs are already in the project, and flags any that would introduce a security risk or conflict.

**When active:** During the planning and code review stages.

**What to expect:** A dependency check log in the audit trail.

---

### 9. Database Migration Agent
**Job:** Drafts any database migration (new table, new column, new index) needed for the change. Always writes migrations as additive and reversible. Never runs them — only drafts them for your review.

**When active:** When a task has `database_changes_allowed = true` and a migration is needed.

**What to expect:** A migration draft in the artifacts panel. You must approve it before a separate database-change approval is requested.

---

### 10. File Change Planner
**Job:** Lists every file that will be created, edited, or deleted by the change, along with the reason. Deletions always require a separate file-delete approval.

**When active:** Planning and code review stages.

**What to expect:** A **File change plan** panel showing the full list of planned file operations.

---

### 11. Code Documentation Agent
**Job:** Writes or updates inline documentation (comments, function descriptions) for any code the Code Author produces. Keeps docs in sync with the actual change.

**When active:** After the code draft is approved.

**What to expect:** Documentation updates appear as part of the code draft artifacts.

---

### 12. Release Manager
**Job:** Builds the release checklist, writes changelog notes, and coordinates the production deployment request. Never deploys — only prepares and requests approval.

**When active:** Release stage.

**What to expect:** A **Release panel** with a checklist of conditions (all approvals granted, no failing tests, no critical security findings, experience score passing) and a **Changelog** panel with the plain-English description of what changed.

---

### 13. Monitoring Agent
**Job:** Logs which metrics to watch after the release (error rates, load times, user flows). Creates a post-release monitoring plan so you know what success looks like.

**When active:** Release stage.

**What to expect:** Monitoring notes appear in the release panel and the audit log.

---

### 14. Rollback Planner
**Job:** Documents how to undo the change if something goes wrong after release. Every release must have a rollback plan before production is approved.

**When active:** Release stage.

**What to expect:** A rollback plan section in the release panel.

---

### 15. Compliance Agent
**Job:** Checks the change against relevant regulations (OSHA, EPA, EHS standards) that the SafetyIQ platform must follow. Flags anything that might create a compliance gap.

**When active:** During the planning and review stages for tasks that touch compliance-sensitive areas.

**What to expect:** Compliance notes in the review checklist panel.

---

### 16. UX Copywriter
**Job:** Reviews any text the user will see (labels, error messages, button text, empty states) and improves it for clarity, tone, and consistency with the rest of the platform.

**When active:** Experience review stage.

**What to expect:** Copywriting feedback in the experience review panel.

---

### 17. Performance Agent
**Job:** Checks whether the change might slow the platform down — slow database queries, large files, unnecessary re-renders. Flags performance risks before code goes to production.

**When active:** Code review stage.

**What to expect:** Performance notes in the review checklist panel.

---

### 18. Accessibility Agent
**Job:** Checks that every UI element is accessible — keyboard navigable, screen-reader friendly, colour-contrast compliant. Fails the experience review if accessibility is below standard.

**When active:** Experience review stage.

**What to expect:** Accessibility scores and issues in the experience scorecard.

---

### 19. Change Communication Agent
**Job:** Writes the user-facing and internal communication for the change — what changed, why, and what users should expect. Produces the changelog entry and optional release notes.

**When active:** Release stage.

**What to expect:** Changelog text in the **Changelog panel** on the task detail page.

---

## Agent permissions summary

| Agent | Can draft code | Can run migrations | Can deploy | Can push to GitHub | Needs your approval |
|---|---|---|---|---|---|
| All agents | Only to staging | Never | Never | Never | Yes — for any dangerous action |

No agent has write access to your live codebase, database, or production environment. Every dangerous action requires an explicit human approval.

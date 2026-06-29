# Release Workflow Guide — Dev Command Center

> **Who this is for:** Admins who want to understand the full path from task creation to production release.

---

## Overview

Every change in the Dev Command Center follows a fixed 17-step workflow. No stage can be skipped. The system is designed so that by the time a change reaches the release stage, it has been reviewed by multiple agents across security, quality, experience, and technical correctness.

You control the pace. Nothing moves forward until you click **Run next step**.

---

## The 17 stages

```
Draft → Planning → Architecture Review → Security Review → Code Review
→ Code Drafting → Artifact Review → Experience Review → QA Review
→ Approval Required → Refinement → Human Final Approval
→ GitHub Branch → Release → Deployment → Monitoring → Complete
```

Here is what happens at each stage:

---

### Stage 1: Draft
The task exists. Nothing has happened yet. The Dev Manager is waiting to start.

**Your action:** Click **Run next step** to begin planning.

---

### Stage 2: Planning
The Dev Manager reads your task description and writes a detailed plan: what the change involves, which files it will touch, what risks exist, and how long it might take.

**What to look for:** Does the plan match what you asked for? Is the scope right — not too big, not too small?

**Your action:** Read the plan in the **Planning output** panel. If it looks right, click **Run next step**.

---

### Stage 3: Architecture review
The Architecture agent checks the plan for technical problems: conflicts with the existing platform, missing components, or structural issues.

**What to look for:** Any red flags in the review checklist. Required fixes must be addressed before moving forward.

**Your action:** Review the architecture checklist. Click **Run next step** to continue.

---

### Stage 4: Security review
The Security agent runs 10 checks. A critical finding blocks the task until it is resolved or a security approval is granted.

**What to look for:** Any findings in the **Security review** panel, especially anything marked as **Critical**.

**Your action:** Address any critical findings. Click **Run next step** to continue.

---

### Stage 5: Code review
The Senior Code Reviewer checks the planned change against platform standards: security, correctness, patterns, and maintainability.

**What to look for:** Review gate items in the **Review checklist** panel. Required fixes must be resolved.

**Your action:** Address any required fixes. Click **Run next step** to continue.

---

### Stage 6: Code drafting
The Code Author writes the actual draft code based on the approved plan. All drafts go to a staging area — nothing changes in the live codebase.

**What to look for:** Artifacts appear in the **Code draft artifacts** panel. Read them to confirm they match your intent.

**Your action:** Approve or reject each artifact. Click **Run next step** to continue.

---

### Stage 7: Artifact review
Agents review the draft artifacts for completeness. Are all the planned files covered? Are any required pieces missing?

**Your action:** Click **Run next step** to continue.

---

### Stage 8: Experience review
The Experience agent scores the change on clarity, consistency, error handling, accessibility, and mobile usability. Low scores become required fixes.

**What to look for:** The **Experience scorecard** and **Required fixes** panel. The task cannot release until scores are acceptable.

**Your action:** Address required fixes. Click **Run next step** to continue.

---

### Stage 9: QA review
The QA agent writes a test plan and runs 10 required tests. Failing tests block completion.

**What to look for:** The **Test results** panel. Each failing test shows the expected vs. actual result and a recommended fix.

**Your action:** Address failing tests. Click **Run next step** to continue.

---

### Stage 10: Approval required
This is the first formal gate. A human approval is required before the work can proceed to the final review.

**What to look for:** An approval card in the **Approvals** panel. Read it carefully.

**Your action:** Approve or reject. If you approve, click **Run next step** to continue.

---

### Stage 11: Refinement
Agents make any final adjustments based on the review gates, test results, and experience findings. The Dev Manager writes the final version of the plan.

**Your action:** Click **Run next step** to continue.

---

### Stage 12: Human final approval
The last gate before any external action (GitHub, database, deploy). You approve the complete package: the code, the tests, the security review, the experience scores.

**What to look for:** The full release checklist must be green before you approve this stage.

**Your action:** Read the full task detail page. Approve the final-approval card. Click **Run next step**.

---

### Stage 13: GitHub branch
The system prepares a branch plan and pull request. This does **not** automatically push to GitHub — it creates a GitHub branch approval in the Approvals panel.

**What to look for:** A **Branch plan** and **Pull request plan** in the task detail page.

**Your action:** If a GitHub branch is needed, approve the GitHub branch approval. Click **Run next step**.

---

### Stage 14: Release
The Release Manager builds the release checklist and the changelog. Every condition must be met before the production-release approval can be granted.

**Release checklist items:**
- ✅ Final approval granted
- ✅ No open critical security findings
- ✅ All QA tests passing
- ✅ Experience score above threshold
- ✅ All required fixes resolved
- ✅ Rollback plan documented

**Your action:** Review the checklist and changelog. If all items are green, click **Request production release**. Click **Run next step**.

---

### Stage 15: Deployment
The production-release approval is active. Approve it to allow the deploy to proceed.

**Warning:** This is the final gate. Once the deploy is approved and run, it goes live for all users.

**Your action:** Read the production-release approval card. Approve it. The deploy is then run (by the developer using the CLI, not automatically by the AI). Click **Run next step** after the deploy is confirmed.

---

### Stage 16: Monitoring
The Monitoring agent logs what to watch after release: which metrics, which pages, which user flows. Post-release monitoring notes appear in the release panel.

**Your action:** Note the monitoring items. Click **Run next step** to mark the task complete.

---

### Stage 17: Complete
The task is done. The changelog is written. The audit log is sealed.

---

## The release checklist — what each item means

| Item | What it means |
|---|---|
| ✅ Final approval granted | You clicked Approve on the human-final-approval card |
| ✅ No critical security findings open | All critical security findings are resolved or have a security approval |
| ✅ All QA tests passing | No test result has status "failed" or "error" |
| ✅ Experience score above threshold | The experience review average is above the minimum |
| ✅ All required fixes resolved | Every required fix from reviews has been addressed |
| ✅ Rollback plan documented | The Release Manager has written a rollback plan |

**If any item is red:** The production release cannot proceed. Address the issue and re-run the relevant stage.

---

## What the changelog contains

The changelog is auto-generated by the Change Communication agent. It includes:
- A plain-English summary of what changed
- Which area of the platform was affected
- Any user-visible changes (new buttons, new pages, new behaviour)
- Who approved it and when

The changelog is visible in the **Changelog panel** on the task detail page.

---

## What never happens automatically

No matter what stage the task is at:
- GitHub pushes **do not happen automatically** — they require a GitHub branch approval and are then executed by a developer
- Database migrations **do not run automatically** — they require a database-change approval and are then applied by a developer
- Production deploys **do not happen automatically** — they require a production-release approval and are then deployed by a developer using the CLI

The system prepares everything and asks for your permission. The actual execution is always a human action.

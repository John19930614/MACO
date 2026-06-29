# Approval Center Guide — Dev Command Center

> **Who this is for:** Admins who need to approve or reject actions the AI team has requested.

---

## What is the Approval Center?

The Approval Center is where the AI team asks for your permission before taking a risky action. Every dangerous step — database migrations, GitHub pushes, production deploys, file deletions, auth changes — must be approved by you before anything happens.

Think of the Approval Center as a gatekeeper. The AI team cannot do anything risky without passing through it.

---

## Where to find approvals

**Two places:**

1. **Task detail page** — The Approvals panel on each task shows all pending decisions for that task. If the task is waiting on an approval, you will see a banner at the top of the page.

2. **Approvals page** — Go to **Admin → Dev Command Center → Approvals** to see all pending approvals across all tasks in one view.

---

## Types of approvals

| Approval type | What it covers |
|---|---|
| **Database change** | Running a database migration (adding a table, column, or index) |
| **File delete** | Permanently deleting a file |
| **Production release** | Deploying code to the live production environment |
| **GitHub branch / pull request** | Creating a branch or pull request on GitHub |
| **Auth / permission change** | Changing login rules, roles, or access permissions |
| **Environment variable change** | Adding or modifying a secret or config value |
| **Security approval** | Clearing a critical security finding to unblock a task |

---

## What an approval card shows

Each approval card includes:

- **Title** — what action is being requested
- **Plain-English summary** — what this means in simple terms
- **Technical summary** — what will actually happen in the system
- **Why approval is needed** — the reason this action is gated
- **Experience impact** — what users will notice (if anything)
- **Risk level** — Low / Medium / High / Critical
- **Requested by** — which agent is asking

---

## How to approve

1. Read the card in full — especially the plain-English and technical summaries.
2. Ask yourself: is this what I asked for? Does it seem right?
3. Click the green **Approve** button.
4. The action is logged in the audit trail with your name and the time.
5. The task moves forward automatically on the next **Run next step** click.

---

## How to reject

1. Click the red **Reject** button on the approval card.
2. Type a short reason — this is logged and shown to the agents.
3. The task stops at this point. The AI team will not proceed.
4. You can then:
   - Edit the task description and create a new task
   - Ask a developer to manually address the issue
   - Mark the task as Cancelled if it is no longer needed

---

## Risk-level decision guide

### Low risk
Safe to approve quickly. These are small, easily reversible changes.

**Examples:** Approve a new label, approve a styling fix.

### Medium risk
Read the plain-English summary before approving. These changes affect a feature area.

**Examples:** Approve a new page, approve a new database column.

### High risk
Read both the plain-English and technical summaries. Consider whether the change scope matches your original request. These changes touch important system areas.

**Examples:** Approve a database migration, approve a new authentication rule.

### Critical risk
Do not approve without fully understanding the impact. These are high-stakes changes.

**Before approving a critical-risk action:**
- Confirm the security review has no open critical findings
- Confirm all QA tests are passing
- Confirm the experience score is acceptable
- Read the rollback plan (in the Release panel)

**Examples:** Approve a production deploy, approve a security-sensitive auth change.

---

## The approval is logged

Every approval and rejection is recorded in the audit log with:
- Which admin made the decision
- The date and time
- The approval type
- The task it belongs to

You can see this log at the bottom of any task detail page.

---

## What happens if you approve the wrong thing?

First: no approval triggers an instant irreversible action. The AI team still needs to run the next step manually. So there is a small window after an approval where you can reject it in the audit log or simply not run the next step.

However, once a production deploy, database migration, or GitHub action is actually executed, it may be difficult to reverse. That is why the checklist on the Release panel must be green before you approve a production release.

If something goes wrong after a deploy, use the rollback plan in the Release panel.

---

## Approval FAQs

**Q: Can I approve something I rejected earlier?**
A: Yes — rejections are final for the current approval card, but you can create a new approval request by re-running the relevant step. The system will generate a new card.

**Q: Do I need to approve every single step?**
A: No. Most stages (planning, code review, QA) run automatically when you click **Run next step**. Approvals only appear for the dangerous actions listed in the approval types table above.

**Q: Can an agent approve its own work?**
A: No. No agent can approve any action. All approvals require a human superadmin.

**Q: What if a task is stuck waiting for an approval I already gave?**
A: Check the task status. If it shows **Approval required**, click the approval card and confirm it is in **Pending** status. Then click **Run next step** to continue.

**Q: Can multiple tasks be approved at once?**
A: Yes — from the Approvals overview page you can see all pending approvals, but each must be individually approved or rejected.

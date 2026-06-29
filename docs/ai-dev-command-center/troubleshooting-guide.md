# Troubleshooting Guide — Dev Command Center

> **Who this is for:** Admins who are stuck, seeing unexpected behaviour, or trying to understand why a task is not progressing.

---

## A task is stuck and won't move forward

**Symptom:** The **Run next step** button is greyed out, or clicking it does nothing.

**Check these in order:**

1. **Is the task waiting on an approval?**
   Look for a purple banner at the top of the task page: "This task is waiting on your approval." Scroll to the Approvals panel and approve or reject the pending item. Then click **Run next step**.

2. **Is the task blocked by a required fix?**
   Look for a **Required fixes** panel near the top of the page. The task cannot move forward until each fix is addressed or overridden.

3. **Is the task complete or cancelled?**
   Terminal statuses (Complete, Cancelled, Failed) cannot be advanced. If it should not be complete, check the audit log at the bottom of the page to see what happened.

4. **Is this a sample/demo task?**
   The sample tasks (visible when no real task exists at that ID) cannot run real steps — they are for preview only. Create a real task from the **New Task** button to run actual stages.

---

## An agent produced output that doesn't match what I asked for

**What to do:**

1. Read the output carefully — sometimes the agent interpreted the request differently than intended.
2. Check the original task description. Was it specific enough? (See [Task Intake Guide](./task-intake-guide.md).)
3. Reject the agent output using the rejection option on the relevant panel. Add a clear note explaining what was wrong.
4. Update the task description with more specific instructions.
5. Click **Run next step** — the agent will try again with the additional context.

> **Tip:** The more specific your task description, the better the output. Vague requests produce vague plans.

---

## A critical security finding is blocking the task

**Symptom:** A red banner says "Critical security risk. This task can't complete until it's reviewed and resolved."

**What to do:**

1. Read the security finding in the **Security review** panel — understand what the concern is.
2. Decide which option applies:
   - **The finding is a real risk that needs fixing:** Reject the current output, describe the fix needed, and re-run the security review stage.
   - **The finding has already been addressed another way:** Click **Mark reviewed & resolve**. Add a note in the task audit log explaining how it was addressed.
   - **You want to proceed despite the risk (with a formal record):** Click **Request security approval**, then approve it in the Approvals panel.

---

## A QA test is failing and blocking completion

**Symptom:** The Test results panel shows a red failing test, and the task cannot be marked complete.

**What to do:**

1. Click on the failing test to see the **Expected result** vs. **Actual result** and the **Recommended fix**.
2. Address the fix — this usually means editing the relevant code draft or artifact.
3. Re-run the QA review stage from the Workflow panel.

---

## The experience score is too low

**Symptom:** A **Required fixes** panel appears listing experience issues. The release is blocked.

**What to do:**

1. Read each required fix — they explain exactly what needs to change and why.
2. Options:
   - Address the fix by updating the relevant content or code, then re-run the experience review.
   - If the fix doesn't apply to this specific change, resolve it manually (your name is logged).
3. Re-run the experience review stage.

---

## An approval I need to make isn't showing up

**Symptom:** The task status says "Approval required" but there is nothing in the Approvals panel.

**What to do:**

1. Reload the page — the panel is loaded at page render; if it was created after the page loaded, a reload will show it.
2. Check the **Approvals overview page** (Admin → Dev Command Center → Approvals) — the approval may have been created but is showing as a different type than expected.
3. If there is genuinely no approval card, re-run the current step — some stages create the approval card on their run; if the run failed silently, no card was created.

---

## A task is in "Failed" status

**Symptom:** The task status shows **Failed**.

**What this means:** An agent run encountered an error it could not recover from, or a required check failed permanently.

**What to do:**

1. Check the audit log at the bottom of the task page — the failure reason will be logged there.
2. If the failure is recoverable (e.g. a database connection issue), create a new task with the same description once the underlying issue is fixed.
3. If the failure was due to the change being unsafe or unworkable, mark the task as Cancelled and create a new, revised task.

---

## The system says it's in "mock mode"

**Symptom:** Actions return messages like "This needs the live database" or the task detail shows sample data even for real task IDs.

**What this means:** The app is running without a Supabase connection (usually in a preview/demo environment, or the environment variables are not set).

**What to do:**
- This is expected behaviour in preview deployments (e.g. Vercel preview URLs for branches).
- Real tasks only work on the production deployment (safetyiq-platform.vercel.app) where the database is connected.
- If the production site is showing mock mode, contact your developer — the Supabase environment variables may be misconfigured.

---

## A "Run next step" click produced no visible change

**Symptom:** You clicked the button, saw a brief loading state, but the task page looks the same.

**What to do:**

1. Reload the page — some stage transitions update the database but not the displayed page until refresh.
2. Check the audit log — if the step ran, there will be a new entry.
3. Check the **Current stage** indicator in the Workflow panel — it may have advanced even if the visible panels look the same.
4. If nothing changed in the audit log, try clicking **Run next step** again — some steps (like AI-generated planning) can take a moment.

---

## I can't access the Dev Command Center

**Symptom:** The page doesn't appear in navigation, or you are redirected away.

**What this means:** Access is restricted to Reliance superadmins. If you believe you should have access, contact the Reliance team to confirm your account has superadmin status.

---

## A deploy or migration was requested but I didn't approve it

**What to do:**

1. First: check the Approvals page to confirm no approval was granted accidentally.
2. Check the audit log for the relevant task — every approved action is logged with the approving admin's name.
3. If an action was taken without approval, this is a serious issue. Contact your developer immediately with the task ID and the audit log export.

> The system is designed so this cannot happen automatically — every dangerous action requires a human approval click. If it appears to have happened without one, the audit log will show the exact sequence of events.

---

## The audit log shows an action I didn't take

**What to do:**

1. Note the task ID, action, and timestamp shown in the log.
2. Check which admin account is logged in your session — the action is attributed to the logged-in account.
3. If someone else has your login, change your password immediately.
4. Contact your developer with the task ID and timestamp — every action is logged with the session user.

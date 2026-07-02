# Admin User Guide — AI Dev Command Center

> **Who this is for:** Reliance superadmins who give software tasks to the AI team and approve their work.

---

## What is the AI Dev Command Center?

The Dev Command Center is a private area inside SafetyIQ where you can give software-development tasks to a team of 19 AI agents. The agents plan, write, review, and test changes — but they never touch your real code, database, or production system without your explicit approval at every dangerous step.

Think of it like having an AI development team that does all the drafting work, then hands everything to you for a final human decision before anything goes live.

---

## The golden rule

**The AI can plan and draft. You decide if anything happens.**

The agents cannot:
- Push code to GitHub without a GitHub approval
- Run a database migration without a database-change approval
- Deploy to production without a production-release approval
- Delete files without a file-delete approval
- Change login or permission rules without an auth/permission-change approval

If it's risky, it stops and waits for you.

---

## How to create a task

1. Go to **Admin → Dev Command Center** in the top navigation.
2. Click **New Task** in the top-right corner.
3. Fill in the form:
   - **Title** — a short description of what you want (e.g. "Add CSV export to the incidents page").
   - **Description** — a few sentences about why you need it and how it should work.
   - **Priority** — Low / Medium / High / Critical.
   - **Risk level** — How risky is this change? When in doubt, pick Medium.
   - **Target area** — Which part of the platform does this touch? (e.g. "Incidents", "Chemicals", "User auth").
   - **Business goal** — What problem are you solving for users?
   - **Success criteria** — How will you know the change worked?
4. Click **Create task**. The task starts in the **Draft** stage.

> **Tip:** The more detail you give in the description, the better the AI plans. A one-line description gets a one-line plan.

---

## How agents review the task

After you create a task, you run it stage by stage using the **Run next step** button on the task detail page. Each click moves the task forward one step. Here is what happens at each stage:

| Stage | What happens |
|---|---|
| **Draft** | Task is created and saved. |
| **Planning** | The Dev Manager and Architecture agents read your request and write a detailed plan. |
| **Architecture review** | The Architecture agent checks the plan for technical problems. |
| **Security review** | The Security agent checks for login, data-access, and permission risks. |
| **Experience review** | The Experience agent checks that the change will be easy to use. |
| **Code review** | The Senior Code Reviewer checks the draft against platform standards. |
| **QA review** | The QA/Test agent writes a test plan and runs 10 required checks. |
| **Approval required** | A human (you) must approve a risky action before the work continues. |
| **Final approval** | One last human approval before anything goes to production. |
| **Release** | The Release Manager prepares a release plan. |
| **Complete** | The task is finished. |

You are in control of the pace. Nothing moves forward until you click **Run next step**.

---

## How to read agent outputs

On each task detail page you will see panels showing what each agent found. Here is what each one means:

### Planning output
The Dev Manager's plan — a breakdown of what the change involves, which files it will touch, and how long it might take. Read this to understand what the AI intends to do before approving anything.

### Code draft artifacts
Draft code the Code Author agent wrote. This is a **draft only** — it is saved to a staging area, not your actual codebase. You can read it, approve it, or reject it.

### Test results
10 required tests the QA agent ran. Green = passed. Red = failed. A task cannot complete if any tests are failing.

### Security review
10 security checks. Each check shows whether it passed and, if not, why. A **critical** finding blocks the task from completing until you resolve it or grant a security approval.

### Experience review
Scores from the Experience agent — does the change meet the platform's usability standards? A task cannot complete if the experience score is too low.

### Approvals
A list of every risky action the AI wants to take, waiting for your decision.

### Audit log
A record of every action taken on this task — by agents and by you.

---

## How to approve or reject changes

When a task reaches the **Approval required** stage, an approval card appears on the task detail page. Each approval card shows:

- **What the AI wants to do** — in plain English.
- **Why it needs your permission** — the risk reason.
- **What will happen if you approve** — the specific action.
- **Risk level** — Low / Medium / High / Critical.

To approve: click the green **Approve** button on the card.
To reject: click the red **Reject** button and type a reason. The task stops and the reason is logged.

> **Warning:** Approving is a real decision. Read what the AI wants to do before clicking Approve. You can always reject and ask for changes.

---

## How to understand risk levels

| Risk level | What it means |
|---|---|
| **Low** | Routine change — a label, a colour, a small fix. Unlikely to cause problems. |
| **Medium** | Moderate change — a new feature, a UI restructure. Should be tested. |
| **High** | Significant change — touches important data, login flows, or multiple parts of the platform. Needs careful review. |
| **Critical** | High-impact change — security, authentication, database structure, or production deploy. Requires your explicit approval and a security sign-off. |

When in doubt, treat something as higher risk, not lower.

---

## How to read experience scores

The Experience agent scores every change across five dimensions before it can be released:

| Score | What it means |
|---|---|
| **Clarity** | Is the change easy to understand? |
| **Consistency** | Does it look and behave like the rest of the platform? |
| **Error handling** | Does it handle mistakes gracefully? |
| **Accessibility** | Can all users use it? |
| **Mobile** | Does it work on small screens? |

Each score is 1–5. A task needs a minimum average before it can complete. If the score is too low, the Experience agent flags required fixes that must be addressed first.

---

## How to review draft code

1. Open the task detail page and scroll to **Code draft artifacts**.
2. Click on a draft to expand it — you will see the file path and proposed code.
3. Read the change. Ask yourself: does this look like what I asked for?
4. If it looks right, click **Approve artifact**. If not, click **Reject** and add a note.

You do not need to understand every line of code. Look for:
- Does it affect the right part of the system?
- Does anything look unexpected or out of scope?
- Is the change bigger than you asked for?

> **Remember:** Approving a draft saves it to the staging working area. It does not change your live code or database. That only happens after a separate production-release approval.

---

## How to handle failed reviews

If a review fails (security check, experience score, or QA test), the task detail page shows a **Required fixes** list at the top. Each fix item explains what needs to change and why.

Options:
1. **Fix it yourself** — If the fix is simple (e.g. a label change), you can edit the relevant field and re-run the step.
2. **Ask the AI to redo the step** — Reject the current output, add a note about what to change, and the agent will try again on the next run.
3. **Resolve a critical finding** — For security reviews, use the **Mark reviewed & resolve** button after confirming the risk is understood and acceptable.
4. **Abandon the task** — If the change is too risky or not worth fixing, set the status to Cancelled.

---

## How to prepare a release

After the task reaches the **Release** stage:

1. Check the **Release checklist** panel — it shows every condition that must be true before production.
2. Check the **Changelog** panel — this is the plain-English description of what changed, ready to share.
3. If all checklist items are green, click **Request production release** to create a production-release approval.
4. Approve the production-release approval in the Approvals panel.
5. The Release Manager agent logs the deployment and marks the task complete.

> **Warning:** Never approve a production release if any checklist items are red. The checklist is there to protect you.

---

## What AI is not allowed to do

The system is designed so that the AI team **cannot** do any of the following without your explicit approval:

- Push code to GitHub
- Merge a pull request
- Run a Supabase database migration
- Deploy to production (Vercel)
- Delete any file
- Modify login or permission rules
- Change environment variables or secrets
- Access customer data for any purpose other than the specific task

These rules are enforced at the system level, not by trusting the AI.

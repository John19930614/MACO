# Task Intake Guide — Dev Command Center

> **Who this is for:** Admins creating new development tasks. A good task description leads to a better plan and a faster, safer outcome.

---

## Before you create a task

Ask yourself three questions:

1. **What exactly do I want to change?** (not "make it better" — what specifically?)
2. **Why does this need to change?** (what problem does it solve for users?)
3. **How will I know it worked?** (what does success look like?)

If you can answer all three, you are ready to create a task.

---

## How to create a task

1. Go to **Admin → Dev Command Center**.
2. Click **New Task** in the top-right corner.
3. Fill in every field — the more detail you give, the better the AI performs.
4. Click **Create task**.

---

## Field-by-field guide

### Title
A short, specific label for the change. Aim for 5–10 words.

| Good | Not helpful |
|---|---|
| Add CSV export button to Incidents page | Improve exports |
| Fix TRIR calculation for multi-site tenants | Fix the bug |
| Add dark mode toggle to Settings page | UI improvements |

---

### Description
A few sentences explaining what you want. Include:
- Where in the platform the change is (which page, which feature)
- What the current behaviour is
- What the new behaviour should be
- Any specific rules or edge cases

**Example:**
> The Incidents page currently has no way to export data. Users need to be able to download all incidents for their site as a CSV file. The export should include: date, incident type, location, severity, and status. The button should be visible to all users with access to the Incidents page, not just admins.

---

### Priority
How urgent is this?

| Priority | Use when |
|---|---|
| **Low** | Nice to have — can wait weeks |
| **Medium** | Should happen this sprint |
| **High** | Needed soon — affecting users |
| **Critical** | Breaking something right now |

---

### Risk level
How risky is this change? Be honest — underestimating risk means fewer safety checks.

| Risk | Use when |
|---|---|
| **Low** | Label change, colour fix, copy update |
| **Medium** | New feature, new page, new export |
| **High** | Touches user data, login flows, or permissions |
| **Critical** | Changes database structure, auth rules, or production config |

> **When in doubt, go higher.** The AI team applies more checks to higher-risk tasks, which is always safer.

---

### Target area
Which part of the platform does this touch? Examples:
- Incidents
- Chemicals / GHS
- Training
- Dashboard
- Settings
- OSHA reporting
- User authentication
- Admin panel
- Reports
- API

If it touches multiple areas, list them all.

---

### Business goal *(optional but helpful)*
Why does this matter to the business or the user? This helps agents understand the intent behind the request.

**Example:** "Safety managers need to share incident data with their legal team, who don't have platform access."

---

### Success criteria *(optional but helpful)*
How will you know the task worked? Be specific.

**Example:** "A CSV file downloads when the export button is clicked, containing all incidents for the current site and date filter."

---

### Who uses it *(optional)*
Which type of user will use this feature? (e.g. Safety Manager, Admin, All users, Superadmin only)

---

### Data involved *(optional)*
What kind of data does this feature touch? (e.g. incident records, chemical inventory, user accounts, OSHA hours)

> **Important:** Mention if the change involves customer data, personal information, or anything regulated. The Security agent will flag it for review.

---

### AI's role *(optional)*
Will this feature use AI (e.g. AI-generated summaries, AI-powered search)? If so, describe how.

---

### Notes *(optional)*
Anything else the team should know — related tasks, known constraints, things to avoid.

---

## Permissions checklist

After creating the task, you can also set which risky actions are allowed:

| Permission | What it unlocks |
|---|---|
| **Database changes allowed** | The Database Migration agent can draft a migration |
| **File changes allowed** | The Code Author can draft file edits |
| **GitHub branch allowed** | The system can request a branch/PR approval |
| **Deploy allowed** | The system can request a production-release approval |

These permissions are **off by default**. Only turn them on when the task genuinely needs them. The AI team will still ask for your approval before taking any of these actions — these settings just control whether the request can even be made.

---

## Common task types and tips

### Bug fix
- Describe the exact symptoms (what page, what action, what error)
- Include the expected behaviour vs. the actual behaviour
- Set risk to Medium unless it touches auth or data

### New feature
- Describe the user journey (what does the user do, step by step)
- Set risk to High if it touches user data or login

### UI/copy change
- Set risk to Low
- Include exact text you want changed
- Reference the page and element

### Database change
- Set risk to High or Critical
- Turn on **Database changes allowed**
- Describe the new table/column and why it's needed

### Security fix
- Set risk to Critical immediately
- Turn on **Auth/permission changes allowed** in the approval settings
- The Security agent will flag it for mandatory review

---

## After creating the task

1. Go to the task detail page.
2. Click **Run next step** to start the Planning stage.
3. The Dev Manager will produce a plan — read it before approving.
4. Continue clicking **Run next step** through each stage, reviewing agent output as you go.
5. When an approval is needed, it will appear in the **Approvals** panel — read it carefully before deciding.

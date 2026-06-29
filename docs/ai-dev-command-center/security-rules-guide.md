# Security Rules Guide — Dev Command Center

> **Who this is for:** Admins who want to understand how the system stays secure, and what to do when a security finding appears.

---

## The 7 things that always require approval

These seven actions are blocked by the system. The AI team cannot do any of them without an explicit human approval — this is enforced at the code level, not by trusting the AI.

| Blocked action | Why |
|---|---|
| **Service/secret key exposed** | A leaked key gives anyone admin access to the database |
| **RLS bypass** | Row-level security keeps each company's data separate — bypassing it could expose one company's data to another |
| **Customer data leak** | Customer data must never be readable by the wrong person |
| **Unauthorized admin action** | Admin-only operations must only happen when a real admin is logged in |
| **Production deploy bypass** | Every production deploy must go through the approval checklist |
| **Destructive action without approval** | Deleting a file or dropping a table cannot be undone |
| **Auth change without approval** | Changing who can log in or what they can do is high-impact |

---

## The 10 security checks the Security agent runs

At the **security review** stage, the Security agent checks every planned change against these 10 criteria:

### 1. Authentication
**What it checks:** Does the change ensure only logged-in users can access it?

**Pass:** The route or action verifies the user is signed in before doing anything.

**Fail:** The route or action can be called without a valid session.

---

### 2. Authorization
**What it checks:** Does the change confirm the user has the right role before acting?

**Pass:** The system checks that the user is a superadmin (or the right role) before allowing the action.

**Fail:** Any logged-in user could trigger the action, not just the intended role.

---

### 3. Supabase RLS
**What it checks:** If a new database table is involved, does it have row-level security enabled?

**Pass:** All tables have RLS on and only the right users can read/write their own data.

**Fail:** A new table is missing RLS, which could allow cross-tenant data access.

---

### 4. API route protection
**What it checks:** Are all Next.js API routes (files under `/api/`) protected by an auth check?

**Pass:** Every API route verifies the session before responding.

**Fail:** An API route responds to requests without checking who is asking.

---

### 5. Server action protection
**What it checks:** Are all server actions (functions marked `"use server"`) protected?

**Pass:** Every server action checks the user's session and role before running.

**Fail:** A server action can be called by an unauthenticated or unauthorized user.

---

### 6. Dangerous tool permissions
**What it checks:** Does the change accidentally give an agent permission to do something it shouldn't?

**Pass:** Agent permissions are limited to what the task explicitly requires.

**Fail:** An agent is granted a wide permission (e.g. deploy, delete) that isn't needed for this task.

---

### 7. Customer data exposure
**What it checks:** Could the change accidentally expose one customer's data to another, or to an unauthenticated user?

**Pass:** Data access is filtered by tenant and gated by auth.

**Fail:** A query or export returns data without filtering by the logged-in user's tenant.

---

### 8. Secret exposure
**What it checks:** Does the change put any secret key, API key, or password in client-side code?

**Pass:** All secrets stay in server-side environment variables and are never sent to the browser.

**Fail:** A secret appears in a client component, a `.env` file committed to git, or a response body.

---

### 9. Prompt injection risk
**What it checks:** If the change uses AI, could user-supplied text manipulate the AI's instructions?

**Pass:** User input is separated from AI instructions and sanitised before use.

**Fail:** User text is concatenated directly into an AI prompt, which could let a user override the AI's instructions.

---

### 10. Over-permissioned agents
**What it checks:** Are any agents in this task granted more permissions than they need?

**Pass:** Each agent only has the minimum permissions required for its job.

**Fail:** An agent is granted a permission (e.g. GitHub branch, database change) that isn't needed for this specific task.

---

## Severity levels

| Severity | What it means | What to do |
|---|---|---|
| **Low** | Minor concern — worth noting but not blocking | Review and monitor |
| **Medium** | Should be addressed before release | Fix before the release approval |
| **High** | Could cause real problems — needs a fix | Required fix before the release stage |
| **Critical** | Blocks completion — the task cannot complete until resolved | Resolve or grant a security approval |

---

## What to do when a critical security finding appears

A **critical** finding shows a red banner on the task detail page: "Critical security risk. This task can't complete until it's reviewed and resolved, or a security approval is granted."

**Option 1: Resolve the finding**
If you have reviewed the finding and confirmed it is either not a real risk for this task, or it has been addressed by other means, click **Mark reviewed & resolve**. This clears the block. The action is logged with your name.

**Option 2: Request a security approval**
If the finding is real but you still want to proceed (e.g. a senior developer has confirmed the change is safe), click **Request security approval**. This creates a special approval card in the Approvals panel. Approve it to clear the block. This creates a formal record that you understood the risk and chose to proceed.

**Option 3: Fix the underlying issue**
Reject the task output, describe the security problem in the rejection note, and the agent will try again with the fix in mind.

---

## Admin-only access — how it works

The Dev Command Center is only visible to **Reliance superadmins**. This is enforced at three independent layers:

1. **Middleware** — The `/admin/*` routes redirect non-superadmins before the page even loads.
2. **Page guard** — Each page calls `requireDevCommandAccess()` which verifies the session independently.
3. **Database RLS** — All `dev_*` tables have a Supabase RLS policy (`is_reliance_admin()`) that prevents any read or write from a non-superadmin session, even if someone bypasses the UI.

Even if one layer failed, the other two would still block access.

---

## No service role key in client code

The Supabase **service role key** bypasses all RLS rules. It must never appear in:
- Browser-side JavaScript
- React components
- Environment variables prefixed `NEXT_PUBLIC_`
- Any file that gets bundled and sent to users

It may only be used in server-side code (server actions, API routes, server components). The Security agent checks for this at every review.

---

## Audit trail

Every action in the Dev Command Center — by agents and by you — is logged in `dev_audit_log` with:
- The task it belongs to
- Who did it (agent name or admin name)
- What action was taken
- The risk level at that moment
- The date and time

This log is visible at the bottom of every task detail page and cannot be deleted or edited.

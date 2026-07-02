# AI Dev Command Center — Documentation

The Dev Command Center is an admin-only module inside SafetyIQ where Reliance superadmins give software-development tasks to a 19-agent AI team. Agents plan, draft, review, test, and release changes — but nothing dangerous happens without your explicit approval.

---

## Guides

| Guide | Who it's for |
|---|---|
| [Admin User Guide](./admin-user-guide.md) | How to create tasks, read agent outputs, approve changes, and release |
| [Agent Role Guide](./agent-role-guide.md) | What each of the 19 agents does and when they are active |
| [Task Intake Guide](./task-intake-guide.md) | How to write a good task description to get the best results |
| [Approval Center Guide](./approval-center-guide.md) | How approvals work and how to make good approval decisions |
| [Security Rules Guide](./security-rules-guide.md) | What is always blocked, what the Security agent checks, and what to do when a finding appears |
| [Experience Review Guide](./experience-review-guide.md) | How the Experience agent scores changes and what to do when scores are low |
| [Troubleshooting Guide](./troubleshooting-guide.md) | What to do when a task is stuck, an agent output is wrong, or something unexpected happens |
| [Release Workflow Guide](./release-workflow-guide.md) | The full 17-stage workflow from task creation to production release |
| [Database Guide](./database-guide.md) | All 20 `dev_*` tables — what they store and how they are protected |
| [Developer Maintenance Guide](./developer-maintenance-guide.md) | How to extend, debug, and maintain the module |

---

## The one rule

**The AI team drafts. You decide.**

No agent can deploy to production, run a database migration, push to GitHub, delete a file, or change login rules without your explicit approval. This is enforced at the code level — not by trusting the AI.

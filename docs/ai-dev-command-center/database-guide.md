# Database Guide — Dev Command Center

> **Who this is for:** Developers and admins who need to understand what database tables power the Dev Command Center, and what each one stores.

---

## Overview

The Dev Command Center uses a family of tables with the prefix `dev_`. All 20 tables are in the `public` schema on Supabase, and every single one has:

- **Row-level security (RLS) enabled** — non-superadmins cannot read or write any of these tables, even with a direct database connection
- **`is_reliance_admin()` policy** — access is only granted when `profiles.tenant_id IS NULL` (the superadmin marker)
- **`ops_set_updated_at()` trigger** — `updated_at` is maintained automatically

No customer data lives in `dev_*` tables. These tables track internal platform development work only.

---

## The 20 tables

### dev_tasks
**Purpose:** The master task record. One row per development task.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| title | text | Short task name |
| description | text | Full task description |
| status | text | Current workflow stage (e.g. "planning", "complete") |
| priority | text | low / medium / high / critical |
| risk_level | text | low / medium / high / critical |
| target_area | text | Which part of the platform this touches |
| metadata | jsonb | Business goal, success criteria, who uses it, AI role, etc. |
| created_by | text | Name of the admin who created the task |
| created_at | timestamptz | When the task was created |
| updated_at | timestamptz | When the task was last updated |

---

### dev_agents
**Purpose:** The 19 AI agents — their names, roles, and capabilities. Seeded once, rarely changes.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| name | text | Agent name (e.g. "Dev Manager") |
| role | text | Agent role label |
| capabilities | text[] | List of what this agent can do |
| is_active | bool | Whether this agent is currently active |

---

### dev_runs
**Purpose:** Each time an agent stage is executed, a run is recorded here.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task this run belongs to |
| agent_id | uuid | Which agent ran |
| stage | text | Which workflow stage this run corresponds to |
| status | text | running / complete / failed |
| started_at | timestamptz | When the run started |
| completed_at | timestamptz | When the run finished |
| duration_ms | int | How long it took in milliseconds |

---

### dev_agent_messages
**Purpose:** The messages agents write during their runs — their reasoning, findings, and recommendations.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| run_id | uuid | Which run |
| agent_id | uuid | Which agent sent the message |
| role | text | "agent" or "system" |
| content | text | The message content |
| message_type | text | Type of message (plan, review, note, etc.) |

---

### dev_artifacts
**Purpose:** Everything the Code Author produces — draft code, planning docs, release notes.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| run_id | uuid | Which run produced this |
| title | text | Artifact name |
| path | text | File path this artifact corresponds to |
| artifact_type | text | code_draft / planning_doc / release_notes / etc. |
| content | text | The full content of the artifact |
| status | text | draft / approved / rejected / ready_for_branch |
| structured | jsonb | Structured metadata (e.g. agent name for planning outputs) |

---

### dev_approvals
**Purpose:** Every approval request — database changes, file deletes, deploys, GitHub branches, auth changes.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| approval_type | text | The type of approval (see list below) |
| status | text | pending / approved / rejected |
| risk_level | text | low / medium / high / critical |
| summary | text | Short description |
| plain_english_summary | text | What this means in plain English |
| technical_summary | text | What will actually happen |
| experience_impact | text | What users will notice |
| reason | text | Why approval is required |
| requested_by | text | Which agent requested it |
| decided_by | text | Which admin approved/rejected it |
| decided_at | timestamptz | When the decision was made |
| rejection_reason | text | The admin's rejection note (if rejected) |

**Approval types:** `database_change`, `file_delete`, `production_release`, `github_branch`, `pull_request`, `auth_permission_change`, `environment_variable_change`

---

### dev_audit_log
**Purpose:** An append-only record of every action taken in the system — by agents and by humans.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| actor_type | text | "agent" or "human" |
| actor_id | text | Agent name or admin name |
| agent_id | uuid | Foreign key to dev_agents (if agent) |
| action | text | What happened (e.g. "stage_advanced", "approval_granted") |
| entity | text | Which table was affected |
| entity_id | text | The ID of the affected record |
| risk_level | text | Risk level at the time of action |
| detail | jsonb | Additional context for this action |
| created_at | timestamptz | When this happened |

---

### dev_review_gates
**Purpose:** Review checklist items — pass/fail results from the Architecture, Code, and Experience review stages.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| run_id | uuid | Which run created this gate |
| agent_name | text | Which agent produced this gate |
| gate_type | text | The type of check (architecture / security / experience / code) |
| item | text | The check description |
| passed | bool | Did the check pass? |
| notes | text | Why it passed or failed |
| required_fix | text | What needs to change if it failed |

---

### dev_security_reviews
**Purpose:** Results of the Security agent's 10-check review.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| run_id | uuid | Which run |
| reviewer_agent_id | uuid | The security agent |
| summary | text | Plain-English verdict |
| findings | jsonb | Array of {category, severity, ok, note} for all 10 checks |
| risk_level | text | The highest severity finding |
| verdict | text | pass / needs_changes / fail |
| status | text | open / resolved |

---

### dev_experience_reviews
**Purpose:** Results of the Experience agent's usability scoring.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| run_id | uuid | Which run |
| reviewer_agent_id | uuid | The experience agent |
| summary | text | Plain-English verdict |
| findings | jsonb | Detailed dimension findings |
| risk_level | text | Severity of experience issues |
| verdict | text | pass / needs_changes / fail |
| status | text | open / resolved |

---

### dev_test_results
**Purpose:** Results of the 10 required QA tests.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| run_id | uuid | Which run |
| kind | text | "qa" or "integration" |
| test_type | text | The type of test (unit / component / form_validation / route_loading / supabase_query / rls_access / approval_gate / agent_workflow / experience_review / audit_log) |
| test_name | text | Short test name |
| expected_result | text | What should happen |
| actual_result | text | What actually happened |
| status | text | passed / failed / error / skipped |
| recommended_fix | text | What to do if it failed |
| created_by_agent | text | Which agent created this result |

---

### dev_file_change_plans
**Purpose:** The list of every file operation planned for a task.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| run_id | uuid | Which run |
| file_path | text | The file path |
| change_type | text | create / edit / delete |
| reason | text | Why this file is being changed |
| status | text | planned / approved / applied / rejected |

---

### dev_applied_changes
**Purpose:** A record of artifacts that have been "applied" to the staging working area (NOT the live codebase).

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| artifact_id | uuid | Which artifact was applied |
| file_path | text | Which file this corresponds to |
| content_snapshot | text | The content at the time of application |
| applied_by | text | Who approved the application |
| applied_at | timestamptz | When it was applied |

---

### dev_deployments
**Purpose:** A record of every deploy request and its outcome.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| environment | text | production / preview |
| status | text | pending / in_progress / succeeded / failed |
| deploy_url | text | The URL of the deployed version |
| requested_by | text | Who requested the deploy |
| deployed_at | timestamptz | When it succeeded |

---

### dev_memories
**Purpose:** The AI team's persistent memory — rules, patterns, and context they carry between tasks.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task created this memory |
| kind | text | The type of memory (e.g. "security_rule", "pattern") |
| title | text | Short memory name |
| content | text | The memory content |
| created_by | text | Which agent created it |

---

### dev_github_settings
**Purpose:** GitHub integration settings — repo URL, branch prefix, PR template.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| repo_url | text | The GitHub repository URL |
| branch_prefix | text | Prefix for branch names (e.g. "feature/dev-command-") |
| pr_title_template | text | Template for PR titles |
| default_base_branch | text | The base branch (e.g. "master") |

---

### dev_experience_scores
**Purpose:** Individual dimension scores from the Experience agent.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| review_id | uuid | Which experience review |
| dimension | text | clarity / consistency / error_handling / accessibility / mobile |
| score | int | 1–5 |
| notes | text | Why this score was given |

---

### dev_fix_requests
**Purpose:** Required fixes logged by agents — each item the task must address before advancing.

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| task_id | uuid | Which task |
| run_id | uuid | Which run created this fix request |
| source_agent | text | Which agent flagged it |
| description | text | What needs to be fixed |
| severity | text | low / medium / high / critical |
| status | text | open / resolved / overridden |
| resolved_at | timestamptz | When it was resolved |

---

### dev_ops_fix_requests
**Purpose:** Fix requests logged in the Ops Console for platform-level issues (separate from task-level fixes).

| Column | Type | What it stores |
|---|---|---|
| id | uuid | Primary key |
| title | text | Short description |
| description | text | Full description |
| status | text | open / in_progress / resolved |
| priority | text | low / medium / high / critical |
| created_at | timestamptz | When it was created |

---

## Database safety rules

1. **Never run a migration without approval.** All `dev_*` migrations follow the same safety pattern as the main platform: additive only, CHECK constraints as supersets, 0 rows before any destructive step.

2. **Never disable RLS on a `dev_*` table.** Even in development, RLS must stay on. The `is_reliance_admin()` policy is the only thing between these tables and a logged-in tenant user.

3. **Never put customer data in `dev_*` tables.** These tables track internal development work. Customer incidents, chemicals, training records, and personal data must never be referenced here by content — only by ID if strictly necessary.

4. **The audit log is append-only.** Do not delete or update `dev_audit_log` rows. This is the system's record of truth.

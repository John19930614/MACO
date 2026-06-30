# SafetyIQ / MACO — Platform Inventory (Restructure Phase 0)

**Date:** 2026-06-27 · **Scope:** Phase 0 of the phased restructure — *inventory only, no code changed.*
**Method:** read-only scan of `maco-platform/src`, `supabase/migrations`, `docs/`, and `scripts/`.
**Golden rule for every later phase:** controlled restructure, **not** a rebuild. Preserve VELA, GUS, ARC (EXP/P-CLSS/HSL), Safety Cell, EHS modules, Supabase RLS, server-only AI, human review before sensitive AI actions, and audit logging.

> Note: the app runs in two modes. **Mock mode** (`NEXT_PUBLIC_SAFETYIQ_MOCK=true` or no Supabase keys) serves deterministic in-memory fixtures so every screen works offline. **Live mode** hits Supabase + the AI provider. The app layer mirrors the Postgres RLS rules so behaviour is identical before/after cutover.

---

## 1. What exists now

### 1a. Routes & pages (Next.js App Router, `src/app`)
**Auth/entry:** `/` (landing) · `/login` · `/auth/set-password` · `/onboarding`.

**Company app (`(app)` group) — 19 nav routes:**
- Overview: `/dashboard` (Command Center), `/workspace` (My Work)
- Compliance: `/legal`, `/risk`, `/audits`, `/capa`, `/osha` (+ `[id]` detail pages)
- Operations: `/training`, `/documents` (+`/import`), `/chemicals`, `/biosafety`, `/waste`, `/ergonomics`, `/monitoring` (equipment), `/incidents`
- Insights: `/ai` (assistant), `/reports`
- Admin: `/team`, `/settings`

**Superadmin (`/sa/*`, Reliance-internal) — 18 routes:** `/sa/modules`, `/sa/companies` (+`[id]`), `/sa/impl`, `/sa/globallegal`, `/sa/templates`, `/sa/ai`, `/sa/gateway`, `/sa/validation`, `/sa/standup`, `/sa/guardrails`, `/sa/predictive`, `/sa/imports`, `/sa/analytics`, `/sa/support`, `/sa/history`, `/sa/security`, `/sa/billing`, `/sa/wiring`.

**ARC / Safety-Cell (Operate + ARC) — 19 routes:** `/cells` (+`[id]`,`/new`), `/arc/map`, `/arc/proof`, `/arc/review`, `/arc/activity`, `/arc/causality`, `/arc/graph` (3D), `/arc/framework`, `/arc/rdash`, `/arc/trends`, `/arc/reports`, `/arc/data`, `/arc/gateway`, `/arc/forecast`, `/arc/intake` (EXP), `/arc/method`, `/arc/hsl`, `/arc/intelligence` (P-CLSS·EXP·VELA), `/arc/verticals` (GUS).

**Total: 56 nav routes**, enumerated canonically in `scripts/system-test.mjs` (the `npm run test:system` gate hits all 56 for HTTP 200). SOP-06: any nav change must update both `LeftNav.tsx` and that ROUTES list.

### 1b. Layouts & navigation
- `src/app/layout.tsx` — root (metadata, skip link).
- `src/app/(app)/layout.tsx` — main authed shell: **AuthGuard**, **LeftNav** (sidebar), **TopBar**, CommandPalette, GusStatusBriefing, GusMaintenancePanel, AssistantDrawer, MobileNavDrawer, **ModuleGateClient** (role/module gating), GuidedTour.
- `(auth)/layout.tsx`, `(app)/sa/layout.tsx`, `onboarding/layout.tsx` — themed wrappers.
- **`src/components/layout/LeftNav.tsx`** — role-gated sidebar; selects nav by `user.is_reliance`, `user.role`, `canCoordinate()`. Badge counts for workspace/CAPA/risk. **This is the source of truth for navigation today.**

### 1c. Key components (`src/components`)
- `layout/`: LeftNav, TopBar, AuthGuard, CommandPalette, NotificationsDropdown, ModuleGateClient, GusStatusBriefing, GusMaintenancePanel, MobileNavDrawer, AssistantDrawer.
- `arc/`: CellGraph3D, CausalityMap, PreventionWebView, ExpIntakeForm, ActivityFeed, ReviewQueue, SiteMapView, ReportView, DataSpaceView, VerticalsView, GatewayHealth.
- `ui/`: primitives, badges, EmptyState, PrintButton · `charts/Charts.tsx` · `modals/Modal.tsx` · `tour/GuidedTour.tsx` · `dashboard/OnboardingWelcomeBanner.tsx`.

### 1d. Database — tables by domain (~95 tables; see `docs/data-dictionary.md`)
- **Core:** tenants, profiles, sites, locations.
- **Incidents & Risk:** incidents, osha_cases, risk_assessments, **audit_log**.
- **Audits/Findings/CAPA:** audits, audit_findings, capa_records, compliance_scores.
- **Chemicals & GHS (bridge edition):** chemical_inventory (live flat master) + ghs_classifications, chemical_control_recommendations, chemical_waste_review_flags, label_print_log + reference tables (ghs_pictograms, ghs_hazard_statements, ghs_precautionary_statements, ghs_ppe_controls, chemical_storage_compatibility_rules, ghs_audit_question_mapping, ghs_training_requirement_mapping) + `chemical_inventory_risk_view`.
- **Waste:** waste_streams (+ vendor/pickup/inspection/profile data via repo).
- **Equipment/Biosafety/Ergo:** equipment, biosafety_labs, biohazard_agents, ergonomics_workstations, ergonomics_job_tasks.
- **Training/Legal/Docs:** training_courses, training_records, legal_requirements, documents, document_acknowledgments, document_staged_rows.
- **Field Safety:** crew, contractors, contractor_prequal, permits, jsa_templates, jsa_steps, observations, toolbox_meetings, daily_activity_plans, dap_tasks.
- **AI governance — CSP Validation Agent:** csp_agents, csp_legal_sources, csp_rules, csp_rule_versions, csp_record_requirements, csp_validation_runs, csp_validation_findings, csp_review_queue, csp_review_decisions, csp_record_change_history, csp_audit_packages, csp_guardrails, csp_agent_qualifications, csp_agent_memory.
- **AI observability:** ai_telemetry, ehs_ai_findings, predictability_runs.
- **Gateway Agent (monitoring):** gateway_agent_health_log (+ settings/versions/qualifications/notes).
- **Ops Console (superadmin, built this session):** ops_checklist_runs, ops_incidents, ops_releases, ops_support_tickets, ops_provisioning, ops_access_register, ops_secrets_register, ops_gate_status, ops_fix_requests.
- **ARC core (mock-fixture-backed — see Risks):** safety_cells, control_proofs, causal_edges, ai_findings, actions, hsl_signals, exp_captures, pclss_runs, vela_insights, cell_embeddings (pgvector).

### 1e. RLS pattern & helpers
- Helpers: `auth_tenant_id()` (caller's tenant), `is_reliance_admin()` (tenant_id IS NULL = superadmin), legacy `current_tenant_id()`/`in_tenant()` (ARC).
- **Tenant-scoped** (`for all using (tenant_id = auth_tenant_id() or is_reliance_admin())`): all EHS module + CSP run/review tables.
- **Global reference** (`select using(true)`, write = admin): GHS code tables, csp rules/sources/requirements/guardrails/qualifications.
- **Superadmin-only** (`is_reliance_admin()`): all `ops_*`, gateway_agent_health_log, ai_telemetry (read).
- **Cross-tenant by design:** vela_insights (shared intelligence).
- Security-definer fns: `match_cells()` (pgvector ANN), `csp_enqueue_review()` (auto-enqueues human review), `ops_migrations()` (service-role-only migration reader).

### 1f. Storage buckets
- `client-documents` (private, tenant-folder RLS) — SOP/doc uploads.
- `sds-documents` (private, tenant-folder RLS) — SDS PDFs.
- `ghs-pictograms` (public-read, admin-write) — 9 standard GHS symbols.

### 1g. API routes (~36, `src/app/api`)
- **AI:** `/api/ai/chat`, `/analyze-cell` (causality engine → pending findings), `/extract-cell`, `/findings`.
- **ARC:** `/api/arc/exp`, `/hsl`, `/pclss`, `/vela`.
- **Cells/graph:** `/api/cells` (+`[id]`,`/comments`,`/outcomes`,`/similar`), `/api/events`, `/api/evidence`, `/api/proof`, `/api/graph` (+`/edges`), `/api/actions`.
- **Gateway/review:** `/api/gateway/rejects`, `/api/staged`, `/api/audit`.
- **Onboarding/ETL:** `/api/onboarding/process` (**~1824 lines**, AI doc-extraction → seeds ~12 modules), `/api/etl/import` (CSV, dry-run).
- **Platform ops:** `/api/health` (gateway report 200/503), `/api/ops` (superadmin live signals), `/api/platform/modules`, `/api/profiles`, `/api/embeddings/reindex`, `/api/dev/reset` (mock only).
- **Cron (Vercel, `vercel.json`):** `/api/cron/pclss` (hourly), `/api/cron/agent-standup` (daily 13:00), `/api/cron/gateway-agent` (daily 12:30). All CRON_SECRET-gated + service role.

### 1h. AI & intelligence layer (the SafetyIQ framework — preserve verbatim)
- **VELA** — cross-tenant/vertical master intelligence (`src/lib/arc/intelligence.ts deriveVelaInsights`, `vela_insights`).
- **GUS** — 19 per-vertical engines (`src/lib/arc/arc.ts GUS_VERTICALS`, `sites.vertical`). *"Amaya" is fully retired — GUS is the term.*
- **ARC Method** + **EXP** (experience capture → geo-tagged hazard memory; `exp_captures`, `ai/extract.ts`), **P-CLSS** (always-on predictive scan; `ai/engine.ts buildPredictabilityForecast`, `pclss_runs`), **HSL** (6 human-signal dimensions; `arc/intelligence.ts computeHsl`, `hsl_signals`).
- **Safety Cell** — atomic hazard unit + hazard genome; gates through admission checks before write (`gateway/admit.ts`, `safety_cells`).
- **AI Gateway** (`src/lib/gateway/*`): `pipeline.ts` (3 gateways × checks + "Nothing Missed" final review), `admit.ts` (write-time gate), `agent.ts` (health monitor → `gateway_agent_health_log`).
- **AI engine** (`src/lib/ai/*`): engine, grounding (anti-hallucination), model-routing (triage/deep tiering), review-policy (`requiresHumanReview`), telemetry, circuit breaker, cache (input-hash reuse), provider (OpenAI/Anthropic), prompt.
- **CSP Validation Agent** (`src/lib/csp/*`): deterministic validator + optional LLM; "CSP-informed, not a licensed CSP"; high-stakes always → human review; daily standup with GUS.
- **Server-only secrets:** `src/lib/env.ts serverSecrets()` + `server-only` imports; keys never reach the client.

### 1i. Audit logging
- `repo.addAudit()` → `audit_log` (live) / in-memory (mock). Actions: cell.stage/admit/reject/update, event.admit/reject, finding.accept/reject. **Fixed this session** (table was missing in prod + id generation bug — see Risks).

### 1j. Tenant handling
- Live: Supabase JWT → `getAuthProfile()` → `getServerTenantId()`/`getEffectiveTenantId()` (NIL_UUID fallback), `isSuperadmin()` = tenant_id NULL.
- Mock: cookie `maco-mock-tenant`/`maco-mock-profile`, in-memory `tenantScope()`.
- `middleware.ts`: public paths + `/sa/*` superadmin gate + `/api/ops` self-auth bypass.
- Write guard: `assertCanWrite()` mirrors RLS at the app layer.

### 1k. Reports/exports & deploy
- `src/lib/reports/xlsx.ts` + `pptx.ts` — branded Excel/PowerPoint (dependency-light), used by `/reports` and `actions/ehs.generateReport`.
- Deploy: **manual** `vercel --prod` from `maco-platform/` (Vercel project `safetyiq-platform`, live at safetyiq-platform.vercel.app). GitHub `master` is **protected** (requires the `typecheck · test · build · system-test` CI check; direct push rejected → PRs only). CI = `.github/workflows/ci.yml`.

---

## 2. What each item does
Captured inline in §1 (each route/table/module annotated). The single most important behavioural contract to preserve: **every EHS record and AI finding passes deterministic validation → grounding → `requiresHumanReview` → human signoff (findings default `pending`) before being trusted, and every sensitive action writes an audit event.**

---

## 3. What MUST be preserved (do not delete/rename without a mapping)
1. **The 56-route nav + `LeftNav.tsx` + `system-test.mjs` ROUTES** (kept in lockstep, SOP-06).
2. **All Supabase tables, RLS policies, helpers, buckets** — especially tenant isolation (`auth_tenant_id`/`is_reliance_admin`) and the `/sa` superadmin gate.
3. **The full AI/intelligence stack:** VELA, GUS, ARC (EXP/P-CLSS/HSL), Safety Cell, Gateway pipeline+admit+agent, engine, grounding, model-routing, review-policy, telemetry, circuit, cache, provider, CSP agent.
4. **Human-review gates:** `requiresHumanReview`, findings-default-`pending`, gateway blocking, CSP mandatory-review conditions. AI stays advisory.
5. **Server-only secrets** (`serverSecrets`, `server-only`) — no keys client-side (SOP-12).
6. **Audit logging** (`addAudit` → `audit_log`) and the CSP tamper-evident chain.
7. **Onboarding/ETL pipeline** (`/api/onboarding/process`, `/api/etl/import`) and mock/live parity.
8. **The guard tests** (`tenancy`, `permissions`, `authz-routes`, `schema-consistency`, `gateway`, `grounding`, `model-routing`, `review-policy`, `eval`) — the safety net for the whole restructure.

---

## 4. What MAY move/consolidate later (candidates for the new shell)
- **Nav generation** → drive `LeftNav` from a **module registry** (Phase 3) instead of hardcoded groups (keep the 56 routes working; registry generates them).
- **Route grouping** → the plan's target shell (`/dashboard`, `/modules/*`, `/ai-gateway`, `/safety-cells`, `/arc/*`, `/admin/*`, `/settings`). Today modules live at top-level (`/chemicals`, `/audits`…) and `/sa/*`; these would map into `/modules/*` and `/admin/*` **via redirects, not deletion** (Phase 2 route-map).
- **Admin surface** → today split across `/settings`, `/team`, and 18 `/sa/*` pages; the plan consolidates into `/admin/*` (companies, users, roles, module-access, review-queue, audit-logs, ai-logs, settings) — much already exists under `/sa/*` and can be re-pathed/aliased.
- **Support & Maintenance dashboards** (Phase 5/6) — partially exist (`/sa/support`, the standalone Ops Console + `/api/ops`, gateway agent); consolidate rather than rebuild.
- **AI Gateway standardization** (Phase 7) — a single gateway wrapper already exists (`gateway/pipeline.ts` + telemetry); future AI features should route through it.

---

## 5. Risks before restructuring (read before Phase 1)
1. **ARC core layer is mock-fixture-backed, NOT guaranteed in live prod DB.** `safety_cells`, `control_proofs`, `causal_edges`, `ai_findings`, `actions`, `hsl_signals`, `exp_captures`, `pclss_runs`, `vela_insights` come from migrations `0001/0002/0003` that the live `baseline.sql` superseded — the ARC `/arc/*` and `/cells` pages work in **mock mode** but may not have live tables. **Verify before moving ARC routes.**
2. **`audit_log` was missing in prod entirely** (fixed 2026-06-27: table created + id-generation bug fixed + deployed). Confirm audit writes now succeed live. Other "mock-only" tables may have the same gap — audit each before relying on it live.
3. **Background `gateway-agent` cron is silent** — `gateway_agent_health_log` is empty. Root cause is config: it fail-closes without `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` in **Vercel** env. Maintenance/health dashboards (Phase 6) will read empty until John sets these in Vercel + redeploys.
4. **Deploys are MANUAL** (`vercel --prod`) — pushing GitHub `master` does **not** auto-deploy. `master` is protected (CI check required → PRs only). Plan each phase's ship step accordingly.
5. **Console login / roles:** John's everyday logins are **tenant users** (can't reach `/sa` or ops tools); only `safety360docs11@gmail.com` is superadmin (tenant_id NULL). RBAC cleanup (Phase 13) must not weaken this.
6. **Source-of-truth split:** the standalone `SafetyIQ-Admin-Console.html` (outer `MACO/` folder, **not** in git) overlaps the in-app `/sa/*` + Ops Console. The restructure should decide which is canonical (recommend: the in-app `/admin` shell; keep the HTML as a zero-deploy operator fallback).
7. **OneDrive + git is fragile** (has wiped uncommitted work once). Commit/push (via PR) at every phase boundary.
8. **Two modes to keep in parity** — every move must keep mock AND live working; the `authz-routes`/`tenancy` guards + `system-test` are the gate.

---

## Phase 0 status: ✅ COMPLETE — inventory only, **no code changed.**
**Recommended next:** Phase 1 (new platform shell) — additive layouts/route scaffold only, existing features untouched, placeholder links. Await approval per the plan's one-phase-at-a-time rule.

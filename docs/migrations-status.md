# Database Update Status: What's Live in Production

Generated: 2026-07-10T16:29:42.616Z by `scripts/check-migration-status.ts`
Environment: safetyiq prod
Prod history snapshot: retrieved 2026-07-07 from project `bjgqjpekhicqlunxbobo` via Supabase MCP list_migrations (supabase_migrations.schema_migrations) + read-only information_schema probes

**51 of 59 local database updates are live in production** — 50 recorded in the migration history and 1 applied by hand and verified directly against the live schema. **8 are NOT applied**, and 8 of those have application code that already depends on them.

> Safety note: this only checks, it doesn't change anything. This is a read-only audit — applying any pending migration requires a separate, explicitly approved follow-up.

## Flagged — Pending & Code-Blocking

- 🚨 **ACTION NEEDED**: `20260625000000_create_ai_telemetry.sql` — AI usage tracking table (durable per-call latency/token/cost log for /sa/ai)
  - Referenced in `src/lib/ai/telemetry.ts:8` — `*   • Durable persistence to the `ai_telemetry` table in live mode, so the`
  - Referenced in `src/lib/ai/telemetry.ts:40` — `const { error } = await supabase.from("ai_telemetry").insert({`
  - Referenced in `src/lib/ai/telemetry.ts:50` — `console.error("[safetyiq] ai_telemetry insert failed:", error.message);`
  - Referenced in `src/lib/ai/telemetry.ts:54` — `console.error("[safetyiq] ai_telemetry persist error:", String(err));`
  - Referenced in `src/lib/ai/telemetry.ts:69` — `/** Map a persisted ai_telemetry row back to the in-app AiCall shape (pure). */`
  - Referenced in `src/lib/ai/telemetry.ts:84` — `* `ai_telemetry` table (survives cold starts); in mock mode, or if the query`
- 🚨 **ACTION NEEDED**: `20260707030000_predictive_risk_engine.sql` — predictive risk engine
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:9` — `// and applied before this can run against a real leading_indicators /`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:10` — `// risk_score_bands / site_risk_scores schema.`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:29` — `// import { createSupabaseServerClient } from "@/lib/supabase/server"; // needed once site_risk_scores exists`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:100` — `//   await client.from("site_risk_scores").upsert({`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:122` — `// mirroring how site_risk_scores writes work — because a Reliance superadmin`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:230` — `// site_risk_scores exists; once the migration is applied, scope by`
- 🚨 **ACTION NEEDED**: `20260707040000_predictive_risk_go_live_signoff.sql` — predictive risk go live signoff
  - Referenced in `src/app/(app)/predictive-risk/page.tsx:11` — `// Reliance superadmin both sign off (see Phase1Go + predictive_risk_go_live),`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:119` — `// sign-off panel. State lives in public.predictive_risk_go_live (one row per`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:120` — `// tenant, see 20260707040000_predictive_risk_go_live_signoff.sql). Reads/writes`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:148` — `.from("predictive_risk_go_live")`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:203` — `.from("predictive_risk_go_live")`
  - Referenced in `src/lib/actions/predictive-risk-engine.ts:211` — `.from("predictive_risk_go_live")`
- 🚨 **ACTION NEEDED**: `20260710000000_phase5_learning_loop.sql` — phase5 learning loop
  - Referenced in `src/app/(app)/predictive-risk/model-update/page.tsx:23` — `.from("risk_model_validation_runs")`
  - Referenced in `src/lib/actions/risk-model-feedback.ts:57` — `const { error } = await client.from("risk_model_feedback").insert({`
  - Referenced in `src/lib/actions/risk-model-reweight.ts:94` — `.from("risk_model_feedback")`
  - Referenced in `src/lib/actions/risk-model-reweight.ts:129` — `.from("risk_model_validation_runs")`
  - Referenced in `src/lib/actions/risk-model-reweight.ts:168` — `.from("risk_model_validation_runs")`
  - Referenced in `src/lib/actions/risk-model-reweight.ts:215` — `.from("risk_model_validation_runs")`
- 🚨 **ACTION NEEDED**: `20260710010000_universal_waste_recycling_tracking.sql` — universal waste recycling tracking
  - Referenced in `src/app/(app)/waste/universal-waste-recycling/page.tsx:25` — `client.from("waste_determinations").select("*").eq("tenant_id", tenantId).order("determined_at", { ascending: false }),`
  - Referenced in `src/app/(app)/waste/universal-waste-recycling/page.tsx:26` — `client.from("universal_waste_items").select("*").eq("tenant_id", tenantId).order("accumulation_deadline", { ascending: t`
  - Referenced in `src/app/(app)/waste/universal-waste-recycling/page.tsx:27` — `client.from("nonhaz_recycling_records").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),`
  - Referenced in `src/app/(app)/waste/universal-waste-recycling/page.tsx:28` — `client.from("waste_vendors").select("id,name,permit_expiry,insurance_expiry,recycler_authorization_expiry,status").eq("t`
  - Referenced in `src/app/(app)/waste/universal-waste-recycling/page.tsx:29` — `client.from("recycling_certificates").select("*").eq("tenant_id", tenantId).order("issued_date", { ascending: false }),`
  - Referenced in `src/app/(app)/waste/universal-waste-recycling/page.tsx:30` — `client.from("rejected_loads").select("*").eq("tenant_id", tenantId).is("resolved_at", null).order("rejected_at", { ascen`
- 🚨 **ACTION NEEDED**: `20260710020000_young_worker_module.sql` — young worker module
  - Referenced in `src/app/(app)/team/young-workers/page.tsx:8` — `// Young-worker PII is manager-only. Gate here (mirrors young_workers RLS) and`
  - Referenced in `src/app/api/young-workers/route.ts:8` — `// RLS on young_workers is the second line of defence.`
  - Referenced in `src/app/api/young-workers/route.ts:34` — `.from("young_workers")`
  - Referenced in `src/app/api/young-workers/route.ts:36` — `"id, dob, classification, work_permit_expiry_date, profiles!young_workers_profile_id_fkey(display_name)",`
  - Referenced in `src/components/layout/LeftNav.tsx:125` — `// below, matching the young_workers RLS policy. Superadmins use the /sa console,`
  - Referenced in `src/lib/actions/minor-injury-escalation.ts:10` — `// incidents.young_worker_id — set it when reporting an incident for a young`
- 🚨 **ACTION NEEDED**: `20260710030000_hazardous_waste_generator_category_and_minimization.sql` — hazardous waste generator category and minimization
  - Referenced in `src/app/(app)/waste/compliance/HazardousWasteGenerator.tsx:13` — `current_generator_category: GeneratorCategory | null;`
  - Referenced in `src/app/(app)/waste/compliance/page.tsx:35` — `.select("id, name, current_generator_category")`
  - Referenced in `src/app/(app)/waste/compliance/page.tsx:39` — `.from("waste_hierarchy_record")`
  - Referenced in `src/app/(app)/waste/compliance/page.tsx:44` — `.from("waste_compliance_action")`
  - Referenced in `src/app/(app)/waste/compliance/page.tsx:49` — `.from("waste_minimization_program")`
  - Referenced in `src/app/(app)/waste/compliance/page.tsx:70` — `.map((s) => s.current_generator_category)`
- 🚨 **ACTION NEEDED**: `20260710040000_evacuation_drill_compliance.sql` — evacuation drill compliance
  - Referenced in `src/app/(app)/emergency/drill-calendar/page.tsx:47` — `client.from("facility_profiles").select("*").eq("tenant_id", tenantId).eq("site_id", siteId).maybeSingle(),`
  - Referenced in `src/app/(app)/emergency/drill-calendar/page.tsx:49` — `.from("drill_calendar_events")`
  - Referenced in `src/app/(app)/emergency/drill-calendar/page.tsx:55` — `.from("drill_frequency_requirements")`
  - Referenced in `src/app/(app)/emergency/drill-calendar/page.tsx:61` — `.from("drill_wardens")`
  - Referenced in `src/app/(app)/emergency/drill-calendar/page.tsx:67` — `.from("drill_compliance_action")`
  - Referenced in `src/lib/actions/evacuation-drill-compliance-calendar.ts:142` — `.from("facility_profiles")`

Until these are applied, the code paths above hit a missing table/column at runtime in live mode. Applying them is a separate task requiring explicit approval.

## Full Migration List (local files)

Matching is by migration name (local filename timestamps are synthetic; the prod history records execution time). "Live (untracked)" means the change was applied by hand — the schema was verified directly, but there is no migration-history record.

| Local Version | Filename | What it does | Status | Prod history record |
|---|---|---|---|---|
| 0001 | `0001_init.sql` | 0001 init | ✅ Live (tracked) | 20260627161930 (as `arc_0001_init`) |
| 0002 | `0002_rls.sql` | 0002 rls | ✅ Live (tracked) | 20260627162019 (as `arc_0002_rls`) |
| 0003 | `0003_embeddings.sql` | 0003 embeddings | ✅ Live (tracked) | 20260627162106 (as `arc_0003_embeddings`) |
| 20260625000000 | `20260625000000_create_ai_telemetry.sql` | AI usage tracking table (durable per-call latency/token/cost log for /sa/ai) | 🚨 Pending — code depends on it | — (schema probe: `table:ai_telemetry`) |
| 20260625010000 | `20260625010000_chemical_ghs_intelligence.sql` | chemical ghs intelligence | ✅ Live (tracked) | 20260625183721 (as `chemical_ghs_intelligence_bridge`) |
| 20260625020000 | `20260625020000_ghs_hp_code_seed.sql` | ghs hp code seed | ✅ Live (tracked) | 20260625183837 |
| 20260625030000 | `20260625030000_chemical_storage_buckets.sql` | chemical storage buckets | ✅ Live (tracked) | 20260625183913 |
| 20260625040000 | `20260625040000_chemical_ghs_security_hardening.sql` | chemical ghs security hardening | ✅ Live (tracked) | 20260625184146 |
| 20260625050000 | `20260625050000_csp_validation_agent.sql` | csp validation agent | ✅ Live (tracked) | 20260625194151 |
| 20260625060000 | `20260625060000_csp_agent_learning.sql` | csp agent learning | ✅ Live (tracked) | 20260625202037 |
| 20260625070000 | `20260625070000_csp_agent_standup.sql` | csp agent standup | ✅ Live (tracked) | 20260625203632 |
| 20260625080000 | `20260625080000_csp_meeting_agenda.sql` | csp meeting agenda | ✅ Live (tracked) | 20260625235132 |
| 20260625090000 | `20260625090000_ehs_validator_spec_phase1.sql` | ehs validator spec phase1 | ✅ Live (tracked) | 20260626003242 |
| 20260625100000 | `20260625100000_ehs_validator_spec_phase2.sql` | ehs validator spec phase2 | ✅ Live (tracked) | 20260626004450 |
| 20260625110000 | `20260625110000_incident_evidence_fields.sql` | incident evidence fields | ✅ Live (tracked) | 20260626010329 |
| 20260625120000 | `20260625120000_ehs_validator_spec_gaps.sql` | ehs validator spec gaps | ✅ Live (tracked) | 20260626022839 |
| 20260625130000 | `20260625130000_gateway_agent.sql` | gateway agent | ✅ Live (tracked) | 20260626112329 |
| 20260625140000 | `20260625140000_gateway_agent_phase3.sql` | gateway agent phase3 | ✅ Live (tracked) | 20260626115518 |
| 20260625150000 | `20260625150000_gateway_agent_profile.sql` | gateway agent profile | ✅ Live (tracked) | 20260626120815 |
| 20260626010000 | `20260626010000_chemical_inventory_storage_class_ppe.sql` | chemical inventory storage class ppe | ✅ Live (tracked) | 20260626004900 |
| 20260627000000 | `20260627000000_ops_console.sql` | ops console | ✅ Live (tracked) | 20260627130952 |
| 20260627001000 | `20260627001000_ops_console_fix_search_path.sql` | ops console fix search path | ✅ Live (tracked) | 20260627131059 |
| 20260627002000 | `20260627002000_ops_access_secrets.sql` | ops access secrets | ✅ Live (tracked) | 20260627132525 |
| 20260627003000 | `20260627003000_ops_gate_status.sql` | ops gate status | ✅ Live (tracked) | 20260627135730 |
| 20260627004000 | `20260627004000_ops_fix_requests.sql` | ops fix requests | ✅ Live (tracked) | 20260627144307 |
| 20260627005000 | `20260627005000_audit_log.sql` | audit log | ✅ Live (tracked) | 20260627150532 |
| 20260627006000 | `20260627006000_arc_live_hardening.sql` | arc live hardening | ✅ Live (tracked) | 20260627162243 (as `arc_hardening`) |
| 20260627010000 | `20260627010000_dev_command_center.sql` | dev command center | ✅ Live (tracked) | 20260627163630 |
| 20260627020000 | `20260627020000_dev_tasks_status_lifecycle.sql` | dev tasks status lifecycle | ✅ Live (tracked) | 20260627173220 |
| 20260627030000 | `20260627030000_dev_tasks_workflow_stages.sql` | dev tasks workflow stages | ✅ Live (tracked) | 20260627181151 |
| 20260627040000 | `20260627040000_dev_file_change_plans_phase7.sql` | dev file change plans phase7 | ✅ Live (tracked) | 20260627184920 |
| 20260627050000 | `20260627050000_dev_artifacts_phase8.sql` | dev artifacts phase8 | ✅ Live (tracked) | 20260627190543 |
| 20260629000000 | `20260629000000_dev_review_gates.sql` | dev review gates | ✅ Live (tracked) | 20260629120247 |
| 20260629010000 | `20260629010000_dev_approvals_phase10.sql` | dev approvals phase10 | ✅ Live (tracked) | 20260629121902 |
| 20260629020000 | `20260629020000_dev_github_settings.sql` | dev github settings | ✅ Live (tracked) | 20260629131332 |
| 20260629030000 | `20260629030000_dev_applied_changes.sql` | dev applied changes | ✅ Live (tracked) | 20260629133155 |
| 20260629040000 | `20260629040000_dev_deployments_phase13.sql` | dev deployments phase13 | ✅ Live (tracked) | 20260629135302 |
| 20260629050000 | `20260629050000_dev_learning_loop.sql` | dev learning loop | ✅ Live (tracked) | 20260629141740 |
| 20260629060000 | `20260629060000_dev_review_gates_phase15.sql` | dev review gates phase15 | ✅ Live (tracked) | 20260629143308 |
| 20260629070000 | `20260629070000_dev_test_results_phase16.sql` | dev test results phase16 | ✅ Live (tracked) | 20260629145528 |
| 20260630000000 | `20260630000000_ai_findings_rejection_reason.sql` | Audit-trail column recording why an AI finding was rejected | ✅ Live (tracked) | 20260706131210 |
| 20260630020000 | `20260630020000_waste_profile_composition.sql` | waste profile composition | ✅ Live (tracked) | 20260630192750 |
| 20260701000000 | `20260701000000_chemical_container_capacity.sql` | Container capacity field driving EU CLP label sizing | ✅ Live (untracked) | — (schema probe: `column:chemical_inventory.container_capacity`) |
| 20260701010000 | `20260701010000_chemical_concentration_hazard.sql` | Concentration-based chemical hazard classification columns (incl. hazard_review_status) | ✅ Live (tracked) | 20260630125515 (as `add_concentration_hazard_columns_to_chemical_inventory`) |
| 20260702000000 | `20260702000000_ai_model_benchmarks.sql` | ai model benchmarks | ✅ Live (tracked) | 20260702162243 |
| 20260702010000 | `20260702010000_arc_missing_tables.sql` | arc missing tables | ✅ Live (tracked) | 20260702181601 |
| 20260702020000 | `20260702020000_dev_review_findings.sql` | dev review findings | ✅ Live (tracked) | 20260702184905 |
| 20260706000000 | `20260706000000_event_embeddings.sql` | event embeddings | ✅ Live (tracked) | 20260706121742 |
| 20260706010000 | `20260706010000_tenant_module_access.sql` | tenant module access | ✅ Live (tracked) | 20260706175857 |
| 20260707000000 | `20260707000000_chemical_container_label.sql` | chemical container label | ✅ Live (tracked) | 20260707121225 |
| 20260707010000 | `20260707010000_sds_review_due_date.sql` | sds review due date | ✅ Live (tracked) | 20260707134446 |
| 20260707020000 | `20260707020000_daily_suggestion_dismiss_rotation.sql` | daily suggestion dismiss rotation | ✅ Live (tracked) | 20260707144410 |
| 20260707030000 | `20260707030000_predictive_risk_engine.sql` | predictive risk engine | 🚨 Pending — code depends on it | — |
| 20260707040000 | `20260707040000_predictive_risk_go_live_signoff.sql` | predictive risk go live signoff | 🚨 Pending — code depends on it | — |
| 20260710000000 | `20260710000000_phase5_learning_loop.sql` | phase5 learning loop | 🚨 Pending — code depends on it | — |
| 20260710010000 | `20260710010000_universal_waste_recycling_tracking.sql` | universal waste recycling tracking | 🚨 Pending — code depends on it | — |
| 20260710020000 | `20260710020000_young_worker_module.sql` | young worker module | 🚨 Pending — code depends on it | — |
| 20260710030000 | `20260710030000_hazardous_waste_generator_category_and_minimization.sql` | hazardous waste generator category and minimization | 🚨 Pending — code depends on it | — |
| 20260710040000 | `20260710040000_evacuation_drill_compliance.sql` | evacuation drill compliance | 🚨 Pending — code depends on it | — |

## Prod-Only History Entries

39 entries exist in the prod migration history with no matching local file. These are expected: they predate the local migration-file convention (2026-06-18 → 2026-06-25 era) or were applied directly via the Supabase MCP under ad-hoc names. They are listed for completeness, not as problems.

| Prod Version | Name |
|---|---|
| 20260618000344 | `safetyiq_core_tables` |
| 20260618000403 | `safetyiq_ehs_tables_1` |
| 20260618000422 | `safetyiq_ehs_tables_2` |
| 20260618002913 | `anon_insert_policies_demo_tenant` |
| 20260618004309 | `anon_update_policies_demo_tenant` |
| 20260618004807 | `anon_update_risk_waste_equipment` |
| 20260618015754 | `create_legal_requirements_and_documents` |
| 20260618021122 | `create_workspace_tasks` |
| 20260618022050 | `create_biosafety_tables` |
| 20260618023350 | `workspace_tasks_completion_evidence` |
| 20260619173540 | `add_crew_and_contractors` |
| 20260619173548 | `add_permits_and_jsa` |
| 20260619173559 | `add_observations_toolbox_dap` |
| 20260622163435 | `add_onboarding_to_tenants` |
| 20260622165843 | `fix_profiles_rls_for_authenticated` |
| 20260622170016 | `fix_profiles_rls_drop_recursive_policy` |
| 20260622181526 | `create_client_documents_bucket` |
| 20260622183417 | `fix_rls_create_missing_tables` |
| 20260623130626 | `harden_tenant_isolation_reliance_admin` |
| 20260623175120 | `sites_tenant_update_policy` |
| 20260624122906 | `documents_content_and_traceability` |
| 20260624130326 | `document_staged_rows` |
| 20260624140340 | `documents_add_regulation_ref` |
| 20260624144454 | `superadmin_hotmail_autopromote` |
| 20260624145714 | `audit_findings_capa_link` |
| 20260624151931 | `exposure_readings_and_fk_indexes` |
| 20260624155725 | `waste_workflow_tables` |
| 20260624161028 | `sa_console_tables` |
| 20260624164014 | `sa_templates_table` |
| 20260625001821 | `revoke_public_rpc_on_internal_functions` |
| 20260625003024 | `add_missing_fk_indexes` |
| 20260625003128 | `rls_perf_subselect_cache` |
| 20260625113424 | `private_schema_rls_functions` |
| 20260625114438 | `tenants_sa_write_policies` |
| 20260625121230 | `create_saved_reports` |
| 20260625124122 | `create_waste_profiles` |
| 20260625153540 | `create_sds_documents` |
| 20260625194234 | `csp_validation_agent_hardening` |
| 20260706121842 | `event_embeddings_match_events_search_path` |

## Draft Files (not migrations)

- `DRAFT_build-smart-chemical-passport.sql` — draft without a version prefix; never applied and not counted above.

## How to Refresh This Document

1. Refresh `docs/prod-migration-history.json` — via the Supabase MCP `list_migrations` tool for the safetyiq project (or `supabase migration list --linked`), plus re-running the read-only `information_schema` probes listed under `schemaProbes`.
2. Run `node scripts/check-migration-status.ts` from the repo root (Node >= 23.6; or `npx tsx`).
3. Review the Flagged section — the code-reference scan is heuristic, so spot-check `file:line` hits before acting on them.

/**
 * Data layer for the CSP validation agent (server-only).
 *
 *  • Loads versioned rules / requirements from the csp_* tables, falling back to
 *    the built-in defaults so the agent never silently no-ops.
 *  • Runs validation on a module row and PERSISTS the run + findings. A DB
 *    trigger auto-enqueues the human review when human_review_required = true.
 *  • Serves the superadmin review panel (runs, queue, sign-off, agent registry).
 *
 * Writes use the caller's session client (RLS-bound to their tenant); the
 * superadmin panel reads across all tenants via is_reliance_admin() in RLS.
 *
 * IMPORTANT: never import into a client component.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateEhsRecord } from "./validator";
import { DEFAULT_REQUIREMENTS, DEFAULT_RULES, CSP_AGENT_NAME, CSP_AGENT_VERSION, CSP_PROMPT_VERSION } from "./defaults";
import type {
  CspRecordRequirement, CspRule, CspRecordType, CspValidationInput,
  CspValidationResult, CspValidationRunRow, CspReviewStatus, CspSignals,
  CspAgentContext, CspGuardrail, CspQualification, CspMemoryLesson,
  CspQualKind, CspMemoryDirective, CspAutonomyBlocker, CspEvidenceRule,
  CspTriggeredBlocker, CspEscalationRule, CspModelVersion, CspOverrideLogRow,
} from "./types";

type DB = SupabaseClient;

async function sb(): Promise<DB | null> { return createSupabaseServerClient(); }

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

// ── Rule / requirement loading (DB first, defaults as fallback) ───────────────

export async function loadRequirement(client: DB | null, recordType: CspRecordType): Promise<CspRecordRequirement | undefined> {
  const fallback = DEFAULT_REQUIREMENTS.find((r) => r.record_type === recordType);
  if (!client) return fallback;
  const { data } = await client
    .from("csp_record_requirements")
    .select("record_type, module_name, required_fields, recommended_fields, evidence_requirements, mandatory_human_review_conditions, version_label")
    .eq("record_type", recordType)
    .eq("active", true)
    .order("version_label", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return fallback;
  return {
    record_type: data.record_type,
    module_name: data.module_name,
    required_fields: (data.required_fields as string[]) ?? [],
    recommended_fields: (data.recommended_fields as string[]) ?? [],
    evidence_requirements: (data.evidence_requirements as string[]) ?? [],
    mandatory_human_review_conditions: (data.mandatory_human_review_conditions as string[]) ?? [],
    version_label: data.version_label,
  };
}

export async function loadRules(client: DB | null): Promise<CspRule[]> {
  if (!client) return DEFAULT_RULES;
  const { data } = await client
    .from("csp_rules")
    .select("rule_code, rule_title, source_type, citation, rule_summary, applies_to_record_types, human_review_triggers, source_url, version_label")
    .eq("active", true);
  if (!data || data.length === 0) return DEFAULT_RULES;
  return data.map((r) => ({
    rule_code: r.rule_code,
    rule_title: r.rule_title,
    source_type: r.source_type,
    citation: r.citation ?? null,
    rule_summary: r.rule_summary ?? null,
    applies_to_record_types: (r.applies_to_record_types as CspRecordType[]) ?? [],
    human_review_triggers: (r.human_review_triggers as string[]) ?? [],
    source_url: r.source_url ?? null,
    version_label: r.version_label,
  }));
}

// ── Agent context: guardrails, qualifications, memory ─────────────────────────

function mapQual(r: Record<string, unknown>): CspQualification {
  return {
    id: String(r.id),
    kind: r.kind as CspQualKind,
    code: String(r.code),
    title: String(r.title),
    description: (r.description as string) ?? null,
    scope_record_types: (r.scope_record_types as CspRecordType[]) ?? [],
    record_types: (r.record_types as string[]) ?? [],
    grants_autonomy: !!r.grants_autonomy,
    status: r.status as CspQualification["status"],
    granted_by: (r.granted_by as string) ?? null,
    granted_at: String(r.granted_at),
    expires_at: (r.expires_at as string) ?? null,
  };
}

function mapMemory(r: Record<string, unknown>): CspMemoryLesson {
  return {
    id: String(r.id),
    tenant_id: (r.tenant_id as string) ?? null,
    scope: r.scope as CspMemoryLesson["scope"],
    record_type: (r.record_type as CspRecordType) ?? null,
    finding_category: (r.finding_category as string) ?? null,
    directive: r.directive as CspMemoryDirective,
    lesson: String(r.lesson),
    weight: Number(r.weight) || 0,
    source: r.source as CspMemoryLesson["source"],
    times_applied: Number(r.times_applied) || 0,
    active: !!r.active,
    created_at: String(r.created_at),
  };
}

function mapBlocker(r: Record<string, unknown>): CspAutonomyBlocker {
  return {
    id: String(r.id), trigger_key: String(r.trigger_key), label: String(r.label),
    action: (r.action as CspAutonomyBlocker["action"]) ?? "human_review_required", active: !!r.active,
  };
}

function mapEvidenceRule(r: Record<string, unknown>): CspEvidenceRule {
  return {
    id: String(r.id), record_type: String(r.record_type), module_label: (r.module_label as string) ?? null,
    required_fields: (r.required_fields as string[]) ?? [], optional_fields: (r.optional_fields as string[]) ?? [],
    autonomy_allowed: !!r.autonomy_allowed, autonomy_limit: (r.autonomy_limit as string) ?? null, active: !!r.active,
  };
}

/** Load everything the validator needs to apply governance. Empty = no DB / pre-migration. */
export async function loadAgentContext(client: DB | null): Promise<CspAgentContext> {
  const empty: CspAgentContext = { guardrails: {}, qualifications: [], memory: [], blockers: [] };
  if (!client) return empty;
  try {
    const [g, q, m, b] = await Promise.all([
      client.from("csp_guardrails").select("*"),
      client.from("csp_agent_qualifications").select("*").eq("status", "active"),
      client.from("csp_agent_memory").select("*").eq("active", true),
      client.from("ehs_autonomy_blockers").select("*").eq("active", true),
    ]);
    const guardrails: Record<string, CspGuardrail> = {};
    for (const r of g.data ?? []) {
      guardrails[r.key] = {
        id: r.id, key: r.key, label: r.label, description: r.description ?? null,
        enabled: !!r.enabled, threshold: r.threshold != null ? Number(r.threshold) : null, locked: !!r.locked,
      };
    }
    return {
      guardrails,
      qualifications: (q.data ?? []).map(mapQual),
      memory: (m.data ?? []).map(mapMemory),
      blockers: (b.data ?? []).map(mapBlocker),
    };
  } catch {
    return empty;
  }
}

export async function getAutonomyBlockers(): Promise<CspAutonomyBlocker[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from("ehs_autonomy_blockers").select("*").order("action").order("label");
  return (data ?? []).map(mapBlocker);
}

export async function getEvidenceRules(): Promise<CspEvidenceRule[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from("ehs_evidence_rules").select("*").order("record_type");
  return (data ?? []).map(mapEvidenceRule);
}

export async function setBlockerActive(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Unavailable in mock mode." };
  const client = await sb();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const { error } = await client.from("ehs_autonomy_blockers").update({ active }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getEscalationMatrix(): Promise<CspEscalationRule[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from("ehs_escalation_matrix").select("*").eq("active", true);
  const order: Record<string, number> = { immediate: 0, same_day: 1, normal: 2 };
  return (data ?? [])
    .map((r) => ({
      id: r.id, condition_key: r.condition_key, label: r.label,
      escalate_to: (r.escalate_to as string[]) ?? [], urgency: r.urgency, active: !!r.active,
    }))
    .sort((a, b) => (order[a.urgency] ?? 9) - (order[b.urgency] ?? 9));
}

export async function getModelRuleVersions(): Promise<CspModelVersion[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from("ehs_model_rule_versions").select("*").order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id, agent_name: r.agent_name, agent_version: r.agent_version,
    ai_model_name: r.ai_model_name ?? null, ai_model_version: r.ai_model_version ?? null,
    rule_version: r.rule_version, change_summary: r.change_summary ?? null,
    changed_by_name: r.changed_by_name ?? null, active: !!r.active, created_at: r.created_at,
  }));
}

export async function getReviewerOverrides(limit = 50): Promise<CspOverrideLogRow[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from("ehs_reviewer_override_log").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id, record_type: r.record_type, ai_recommendation: r.ai_recommendation ?? null,
    ai_status: r.ai_status ?? null, human_decision: r.human_decision, override_reason: r.override_reason,
    reviewer_name: r.reviewer_name ?? null, created_at: r.created_at,
  }));
}

// ── Module → validator input mappers ──────────────────────────────────────────

function incidentToInput(row: Record<string, unknown>): CspValidationInput {
  const sev = str(row.severity);
  const med = row.medical_treatment_required;
  const lost = typeof row.lost_time_days === "number" ? row.lost_time_days : null;
  const incidentType = str(row.incident_type);
  const signals: CspSignals = {
    fatality: incidentType === "fatality",
    medical_treatment_beyond_first_aid: med === true ? true : med === false ? false : undefined,
    lost_time_days: lost,
    regulatory_reportable: row.regulatory_reportable === true,
    high_or_critical_potential: sev === "high" || sev === "critical",
  };
  return {
    tenant_id: str(row.tenant_id),
    site_id: row.site_id ? str(row.site_id) : null,
    source_type: "incident",
    source_id: str(row.id),
    record_type: "incident",
    module_name: "Incident Management",
    fields: {
      title: str(row.title),
      severity: sev,
      event_date: str(row.occurred_at),
      location: str(row.location),
      person_involved: str(row.injured_party),
      description: str(row.description),
      immediate_action: str(row.immediate_actions),
      injury_or_illness: str(row.injuries_description) || (["injury", "illness"].includes(incidentType) ? incidentType : ""),
      treatment_level: med === true ? "medical_treatment_beyond_first_aid" : med === false ? "first_aid_or_none" : "",
      work_relatedness: "work_related", // workplace incident records are work-related by construction
      corrective_action: str(row.root_cause) || str(row.immediate_actions),
    },
    evidence_count: 0,
    signals,
  };
}

function auditFindingToInput(row: Record<string, unknown>, siteId: string | null): CspValidationInput {
  const sev = str(row.severity);
  return {
    tenant_id: str(row.tenant_id),
    site_id: siteId,
    source_type: "audit_finding",
    source_id: str(row.id),
    record_type: "audit_finding",
    module_name: "Audit Management",
    fields: {
      title: str(row.title),
      severity: sev,
      finding_description: str(row.description),
      risk_level: sev,
      responsible_party: row.owner_id ? str(row.owner_id) : "",
      corrective_action: row.capa_id ? "linked_capa" : "",
      due_date: str(row.due_date),
      // audit_date / auditor / location come from the parent audit; left for the
      // reviewer to confirm (flagged as missing if absent).
      audit_date: "",
      auditor: "",
      location: "",
    },
    evidence_count: 0,
    signals: {
      high_or_critical_potential: sev === "high" || sev === "critical",
      repeat_finding: false,
      regulatory_reportable: false,
    },
  };
}

// ── Persist a validation result as a run (+ findings) ─────────────────────────

async function persistRun(client: DB, input: CspValidationInput, result: CspValidationResult): Promise<string | null> {
  const { data: run, error } = await client
    .from("csp_validation_runs")
    .insert({
      tenant_id: input.tenant_id,
      site_id: input.site_id,
      source_type: input.source_type,
      source_id: input.source_id,
      record_type: input.record_type,
      module_name: input.module_name,
      agent_name: CSP_AGENT_NAME,
      agent_version: CSP_AGENT_VERSION,
      model_name: result.model,
      model_provider: result.model.includes(":") ? result.model.split(":")[0] : "deterministic",
      prompt_version: CSP_PROMPT_VERSION,
      input_snapshot: input.fields,
      validation_status: result.validation_status,
      risk_level: result.risk_level,
      confidence_score: result.confidence_score,
      rules_checked: result.rules_checked,
      citations_used: result.citations_used,
      evidence_reviewed: result.evidence_reviewed,
      missing_fields: result.missing_fields,
      inconsistencies_found: result.inconsistencies_found,
      regulatory_triggers: result.regulatory_triggers,
      ai_summary: result.ai_summary,
      ai_reasoning_summary: result.ai_reasoning_summary,
      ai_recommendation: result.ai_recommendation,
      recommended_corrections: result.recommended_corrections,
      human_review_required: result.human_review_required,
      human_review_reason: result.human_review_reason,
      autonomy_blockers_triggered: result.autonomy_blockers_triggered,
      human_review_status: result.human_review_required ? "pending" : "not_required",
      final_output: { ...result },
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !run) return null;

  if (result.findings.length > 0) {
    // Resolve rule_code -> rule_id for the FK where possible.
    const codes = [...new Set(result.findings.map((f) => f.rule_code).filter(Boolean))] as string[];
    const ruleIdByCode = new Map<string, string>();
    if (codes.length > 0) {
      const { data: ruleRows } = await client.from("csp_rules").select("id, rule_code").in("rule_code", codes);
      for (const r of ruleRows ?? []) ruleIdByCode.set(r.rule_code, r.id);
    }
    await client.from("csp_validation_findings").insert(
      result.findings.map((f) => ({
        validation_run_id: run.id,
        tenant_id: input.tenant_id,
        finding_title: f.finding_title,
        finding_description: f.finding_description,
        finding_category: f.finding_category,
        risk_level: f.risk_level,
        rule_id: f.rule_code ? ruleIdByCode.get(f.rule_code) ?? null : null,
        citation: f.citation ?? null,
        source_url: f.source_url ?? null,
        recommended_action: f.recommended_action ?? null,
        requires_corrective_action: f.requires_corrective_action,
        requires_human_review: f.requires_human_review,
      })),
    );
  }
  return run.id;
}

// ── Public: validate a single record in the background ────────────────────────

/**
 * Validate one module row and persist the run. Designed to be called from a
 * server action right after the row is created/updated. Never throws — a
 * validation failure must not break the user's save. Returns the run id or null.
 */
export async function validateRecordInBackground(
  client: DB,
  recordType: CspRecordType,
  row: Record<string, unknown>,
  siteId: string | null,
  opts: { enrich?: boolean } = {},
): Promise<string | null> {
  try {
    if (MOCK_MODE) return null; // no DB to persist to in mock mode
    const input = recordType === "incident" ? incidentToInput(row) : auditFindingToInput(row, siteId);
    if (!input.tenant_id || !input.source_id) return null;
    const [requirement, rules, ctx] = await Promise.all([
      loadRequirement(client, recordType), loadRules(client), loadAgentContext(client),
    ]);
    const result = await validateEhsRecord(input, requirement, rules, { enrich: opts.enrich, ctx });
    return await persistRun(client, input, result);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[csp] background validation failed", err);
    return null;
  }
}

/**
 * One-time backfill: validate existing incident rows that don't yet have a run.
 * Idempotent — skips any incident already validated. Superadmin runs this; RLS
 * lets the admin read all tenants' incidents and write runs for each tenant.
 */
export async function backfillValidations(opts: { enrich?: boolean; limit?: number } = {}): Promise<{ created: number; skipped: number }> {
  if (MOCK_MODE) return { created: 0, skipped: 0 };
  const client = await sb();
  if (!client) return { created: 0, skipped: 0 };

  const { data: existing } = await client.from("csp_validation_runs").select("source_id").eq("source_type", "incident");
  const done = new Set((existing ?? []).map((r) => r.source_id as string));

  const { data: incidents } = await client.from("incidents").select("*").limit(opts.limit ?? 200);
  if (!incidents || incidents.length === 0) return { created: 0, skipped: 0 };

  const [requirement, rules, ctx] = await Promise.all([
    loadRequirement(client, "incident"), loadRules(client), loadAgentContext(client),
  ]);
  let created = 0, skipped = 0;
  for (const row of incidents) {
    if (done.has(row.id)) { skipped++; continue; }
    const input = incidentToInput(row as Record<string, unknown>);
    if (!input.tenant_id || !input.source_id) { skipped++; continue; }
    try {
      const result = await validateEhsRecord(input, requirement, rules, { enrich: opts.enrich, ctx });
      const id = await persistRun(client, input, result);
      if (id) created++; else skipped++;
    } catch { skipped++; }
  }
  return { created, skipped };
}

// ── Review-panel reads (superadmin; RLS returns all tenants for admin) ─────────

export async function getCspValidationRuns(limit = 100): Promise<CspValidationRunRow[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];

  const { data: runs } = await client
    .from("csp_validation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!runs || runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const tenantIds = [...new Set(runs.map((r) => r.tenant_id))];

  const [{ data: findings }, { data: decisions }, { data: queue }, { data: tenants }] = await Promise.all([
    client.from("csp_validation_findings").select("*").in("validation_run_id", runIds),
    client.from("csp_review_decisions").select("*").in("validation_run_id", runIds).order("created_at", { ascending: false }),
    client.from("csp_review_queue").select("id, validation_run_id, priority, status").in("validation_run_id", runIds),
    client.from("tenants").select("id, name").in("id", tenantIds),
  ]);

  const tenantName = new Map((tenants ?? []).map((t) => [t.id, t.name as string]));
  type DecisionRow = NonNullable<typeof decisions>[number];
  const decisionByRun = new Map<string, DecisionRow>();
  for (const d of decisions ?? []) if (!decisionByRun.has(d.validation_run_id)) decisionByRun.set(d.validation_run_id, d);
  const queueByRun = new Map((queue ?? []).map((q) => [q.validation_run_id, q]));

  return runs.map((r) => {
    const q = queueByRun.get(r.id);
    const d = decisionByRun.get(r.id);
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      tenant_name: tenantName.get(r.tenant_id) ?? "Unknown tenant",
      site_id: r.site_id,
      source_type: r.source_type,
      source_id: r.source_id,
      record_type: r.record_type,
      module_name: r.module_name,
      agent_name: r.agent_name,
      agent_version: r.agent_version,
      model_name: r.model_name,
      prompt_version: r.prompt_version,
      validation_status: r.validation_status,
      risk_level: r.risk_level,
      confidence_score: r.confidence_score != null ? Number(r.confidence_score) : null,
      missing_fields: (r.missing_fields as string[]) ?? [],
      regulatory_triggers: (r.regulatory_triggers as string[]) ?? [],
      ai_summary: r.ai_summary,
      ai_recommendation: r.ai_recommendation,
      human_review_required: r.human_review_required,
      human_review_status: r.human_review_status,
      human_review_reason: r.human_review_reason,
      autonomy_blockers_triggered: (r.autonomy_blockers_triggered as CspTriggeredBlocker[]) ?? [],
      input_hash: r.input_hash,
      final_output_hash: r.final_output_hash,
      created_at: r.created_at,
      queue_id: q?.id ?? null,
      queue_priority: q?.priority ?? null,
      findings: (findings ?? []).filter((f) => f.validation_run_id === r.id).map((f) => ({
        id: f.id,
        finding_title: f.finding_title,
        finding_description: f.finding_description,
        finding_category: f.finding_category,
        risk_level: f.risk_level,
        citation: f.citation,
        source_url: f.source_url,
        recommended_action: f.recommended_action,
        requires_corrective_action: f.requires_corrective_action,
        status: f.status,
      })),
      decision: d
        ? {
            id: d.id,
            reviewer_name: d.reviewer_name,
            reviewer_credentials: d.reviewer_credentials,
            decision: d.decision,
            decision_summary: d.decision_summary,
            signed_at: d.signed_at,
            created_at: d.created_at,
          }
        : null,
    };
  });
}

export interface CspReviewSummary {
  pending: number;
  urgent: number;
  total: number;
  autoAccepted: number;
}

export async function getCspReviewSummary(): Promise<CspReviewSummary> {
  if (MOCK_MODE) return { pending: 0, urgent: 0, total: 0, autoAccepted: 0 };
  const client = await sb();
  if (!client) return { pending: 0, urgent: 0, total: 0, autoAccepted: 0 };
  const [{ count: total }, { count: pending }, { count: urgent }, { count: autoAccepted }] = await Promise.all([
    client.from("csp_validation_runs").select("*", { count: "exact", head: true }),
    client.from("csp_review_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
    client.from("csp_review_queue").select("*", { count: "exact", head: true }).eq("status", "pending").eq("priority", "urgent"),
    client.from("csp_validation_runs").select("*", { count: "exact", head: true }).eq("human_review_required", false),
  ]);
  return { total: total ?? 0, pending: pending ?? 0, urgent: urgent ?? 0, autoAccepted: autoAccepted ?? 0 };
}

export interface CspAgentInfo {
  agent_name: string;
  positioning: string;
  model_name: string | null;
  prompt_version: string;
  active: boolean;
}

export async function getCspAgent(): Promise<CspAgentInfo | null> {
  if (MOCK_MODE) return null;
  const client = await sb();
  if (!client) return null;
  const { data } = await client
    .from("csp_agents")
    .select("agent_name, positioning, model_name, prompt_version, active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// ── Review-panel writes: record a credentialed human decision ─────────────────

export interface ReviewDecisionInput {
  runId: string;
  queueId: string | null;
  tenantId: string;
  reviewerName: string;
  reviewerCredentials: string;
  decision: Extract<CspReviewStatus, "approved" | "approved_with_changes" | "rejected" | "escalated">;
  decisionSummary: string;
  reviewerNotes?: string;
  signatureText: string;
}

export async function recordReviewDecision(input: ReviewDecisionInput): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Review sign-off is unavailable in mock mode." };
  const client = await sb();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const now = new Date().toISOString();

  const { data: decision, error: decErr } = await client.from("csp_review_decisions").insert({
    review_queue_id: input.queueId,
    validation_run_id: input.runId,
    tenant_id: input.tenantId,
    reviewer_name: input.reviewerName,
    reviewer_credentials: input.reviewerCredentials || null,
    reviewer_role: "EHS Reviewer",
    decision: input.decision,
    decision_summary: input.decisionSummary,
    reviewer_notes: input.reviewerNotes || null,
    reviewer_signature_text: input.signatureText,
    signed_at: now,
  }).select("id").single();
  if (decErr) return { ok: false, error: decErr.message };

  const reviewStatus: CspReviewStatus = input.decision === "escalated" ? "escalated" : "closed";
  await client.from("csp_validation_runs").update({ human_review_status: input.decision }).eq("id", input.runId);
  if (input.queueId) {
    await client.from("csp_review_queue")
      .update({ status: reviewStatus, closed_at: input.decision === "escalated" ? null : now })
      .eq("id", input.queueId);
  }

  // Reviewer override log — record when the human's decision diverges from the
  // AI's stance (human cleared a flagged record, or rejected an accepted one).
  try {
    const { data: run } = await client.from("csp_validation_runs")
      .select("validation_status, ai_recommendation, record_type, source_id").eq("id", input.runId).maybeSingle();
    if (run) {
      const aiFlagged = !["accepted", "accepted_with_minor_corrections"].includes(run.validation_status);
      const humanCleared = input.decision === "approved" || input.decision === "approved_with_changes";
      const isOverride = (aiFlagged && humanCleared) || (!aiFlagged && input.decision === "rejected");
      if (isOverride) {
        await client.from("ehs_reviewer_override_log").insert({
          tenant_id: input.tenantId, record_id: run.source_id ?? null, record_type: run.record_type,
          validation_run_id: input.runId, ai_recommendation: run.ai_recommendation,
          ai_status: run.validation_status, human_decision: input.decision,
          override_reason: input.decisionSummary, reviewer_name: input.reviewerName,
        });
      }
    }
  } catch { /* override logging is best-effort */ }

  // Learn from the decision — gated by the learn_from_* guardrails. Best-effort;
  // a learning failure must never fail the sign-off.
  if (decision?.id) await learnFromDecision(client, input, decision.id).catch(() => {});
  return { ok: true };
}

/**
 * Turn a human decision into a memory lesson, if the matching guardrail is on.
 * Approvals teach the agent to trust similar records more; rejections/escalations
 * teach it to be more cautious. Lessons are scoped to (record_type, finding
 * category) so they don't broadly erode scrutiny.
 */
async function learnFromDecision(client: DB, input: ReviewDecisionInput, decisionId: string): Promise<void> {
  const isApproval = input.decision === "approved" || input.decision === "approved_with_changes";
  const isRejection = input.decision === "rejected" || input.decision === "escalated";
  if (!isApproval && !isRejection) return;

  const { data: guards } = await client.from("csp_guardrails").select("key, enabled")
    .in("key", ["learn_from_approvals", "learn_from_rejections"]);
  const enabled = new Map((guards ?? []).map((g) => [g.key, g.enabled]));
  if (isApproval && !enabled.get("learn_from_approvals")) return;
  if (isRejection && !enabled.get("learn_from_rejections")) return;

  const { data: run } = await client.from("csp_validation_runs").select("record_type").eq("id", input.runId).maybeSingle();
  if (!run) return;
  const { data: finds } = await client.from("csp_validation_findings").select("finding_category").eq("validation_run_id", input.runId).limit(1);
  const category = (finds?.[0]?.finding_category as string) ?? null;

  const directive: CspMemoryDirective = isApproval
    ? (category ? "raise_confidence" : "note")
    : (category ? "lower_confidence" : "escalate");
  const verb = isApproval ? "approved" : input.decision === "escalated" ? "escalated" : "rejected";
  const who = `${input.reviewerCredentials ? input.reviewerCredentials + " " : ""}${input.reviewerName}`.trim();
  const lesson = `Reviewer ${who} ${verb} a ${String(run.record_type).replace(/_/g, " ")}${category ? ` flagged for ${category.replace(/_/g, " ")}` : ""}.`;

  await client.from("csp_agent_memory").insert({
    tenant_id: null, scope: "global", record_type: run.record_type, finding_category: category,
    directive, lesson, weight: 3, source: "human_decision",
    source_run_id: input.runId, source_decision_id: decisionId, created_by: input.reviewerName,
  });
}

// ── Agent Profile panel: guardrails / qualifications / memory reads + writes ───

export async function getGuardrails(): Promise<CspGuardrail[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from("csp_guardrails").select("*").order("locked", { ascending: false }).order("label");
  return (data ?? []).map((r) => ({
    id: r.id, key: r.key, label: r.label, description: r.description ?? null,
    enabled: !!r.enabled, threshold: r.threshold != null ? Number(r.threshold) : null, locked: !!r.locked,
  }));
}

export async function getQualifications(): Promise<CspQualification[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from("csp_agent_qualifications").select("*").order("kind").order("title");
  return (data ?? []).map(mapQual);
}

export async function getMemory(limit = 100): Promise<CspMemoryLesson[]> {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from("csp_agent_memory").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map(mapMemory);
}

export async function setGuardrail(key: string, patch: { enabled?: boolean; threshold?: number | null }): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Unavailable in mock mode." };
  const client = await sb();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  // Locked guardrails are platform-enforced and cannot be toggled off.
  const { data: g } = await client.from("csp_guardrails").select("locked").eq("key", key).maybeSingle();
  if (g?.locked) return { ok: false, error: "This guardrail is platform-enforced and cannot be changed." };
  const update: Record<string, unknown> = {};
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.threshold !== undefined) update.threshold = patch.threshold;
  const { error } = await client.from("csp_guardrails").update(update).eq("key", key);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface NewQualificationInput {
  kind: CspQualKind;
  title: string;
  description?: string;
  scopeRecordTypes: CspRecordType[];
  grantsAutonomy: boolean;
  grantedBy: string;
}

export async function addQualification(input: NewQualificationInput): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Unavailable in mock mode." };
  const client = await sb();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const code = `${input.kind.toUpperCase()}-${input.title.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`.slice(0, 60);
  const { error } = await client.from("csp_agent_qualifications").insert({
    kind: input.kind, code, title: input.title, description: input.description || null,
    scope_record_types: input.scopeRecordTypes, grants_autonomy: input.grantsAutonomy,
    status: "active", granted_by: input.grantedBy,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setQualificationStatus(id: string, status: "active" | "revoked"): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Unavailable in mock mode." };
  const client = await sb();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const { error } = await client.from("csp_agent_qualifications").update({ status }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setMemoryActive(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Unavailable in mock mode." };
  const client = await sb();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const { error } = await client.from("csp_agent_memory").update({ active }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMemory(id: string): Promise<{ ok: boolean; error?: string }> {
  if (MOCK_MODE) return { ok: false, error: "Unavailable in mock mode." };
  const client = await sb();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const { error } = await client.from("csp_agent_memory").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

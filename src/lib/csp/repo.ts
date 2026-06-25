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
    const [requirement, rules] = await Promise.all([loadRequirement(client, recordType), loadRules(client)]);
    const result = await validateEhsRecord(input, requirement, rules, { enrich: opts.enrich });
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

  const [requirement, rules] = await Promise.all([loadRequirement(client, "incident"), loadRules(client)]);
  let created = 0, skipped = 0;
  for (const row of incidents) {
    if (done.has(row.id)) { skipped++; continue; }
    const input = incidentToInput(row as Record<string, unknown>);
    if (!input.tenant_id || !input.source_id) { skipped++; continue; }
    try {
      const result = await validateEhsRecord(input, requirement, rules, { enrich: opts.enrich });
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

  const { error: decErr } = await client.from("csp_review_decisions").insert({
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
  });
  if (decErr) return { ok: false, error: decErr.message };

  const reviewStatus: CspReviewStatus = input.decision === "escalated" ? "escalated" : "closed";
  await client.from("csp_validation_runs").update({ human_review_status: input.decision }).eq("id", input.runId);
  if (input.queueId) {
    await client.from("csp_review_queue")
      .update({ status: reviewStatus, closed_at: input.decision === "escalated" ? null : now })
      .eq("id", input.queueId);
  }
  return { ok: true };
}

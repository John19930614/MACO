/**
 * Extract-only document AI (server-only) for the ongoing Import flow.
 *
 * Unlike the onboarding processor (which blind-inserts), this returns CANDIDATE
 * rows that get staged for human review, then committed to live tables on accept.
 * Each kind defines: extraction prompt/schema, a display label, a dedup key, and
 * a mapper to the live-table insert shape.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverSecrets, hasLiveAi } from "@/lib/env";
import type { SourceBlock } from "./programBuilder";

export type RowKind = "chemical" | "waste" | "legal" | "training" | "incident" | "equipment";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

interface KindDef {
  table: string;
  toolName: string;
  system: string;
  instruction: string;
  schema: Anthropic.Tool.InputSchema;
  label: (r: Record<string, unknown>) => string;
  dedupKey: (r: Record<string, unknown>) => string;
  toLive: (r: Record<string, unknown>, ctx: { tenantId: string; siteId: string | null; createdBy: string }) => Record<string, unknown>;
}

const arr = (items: Record<string, unknown>): Anthropic.Tool.InputSchema => ({
  type: "object", required: ["items"], additionalProperties: false,
  properties: { items: { type: "array", items: { type: "object", ...items } } },
} as Anthropic.Tool.InputSchema);

export const KIND_DEFS: Record<RowKind, KindDef> = {
  chemical: {
    table: "chemical_inventory", toolName: "extract_chemicals",
    system: "You are an EHS data specialist. Extract chemical inventory records. For ghs_classes use the GHS H-codes exactly as written (e.g. 'H225','H314').",
    instruction: "Extract all chemicals listed in this document.",
    schema: arr({
      required: ["name", "quantity", "unit", "storage_location"], additionalProperties: false,
      properties: { name: { type: "string" }, cas_number: { type: ["string", "null"] }, quantity: { type: "number" }, unit: { type: "string" }, storage_location: { type: "string" }, supplier: { type: ["string", "null"] }, ghs_classes: { type: "array", items: { type: "string" } }, is_scheduled: { type: "boolean" } },
    }),
    label: (r) => String(r.name ?? "Unnamed chemical"),
    dedupKey: (r) => `${norm(r.name)}|${norm(r.cas_number)}`,
    toLive: (r, c) => ({
      tenant_id: c.tenantId, site_id: c.siteId, name: String(r.name ?? "Unnamed Chemical"),
      cas_number: r.cas_number ? String(r.cas_number) : null, quantity: Number(r.quantity) || 0,
      unit: String(r.unit || "units"), storage_location: String(r.storage_location || ""),
      supplier: r.supplier ? String(r.supplier) : null,
      ghs_classes: Array.isArray(r.ghs_classes) ? r.ghs_classes : [],
      hazard_statements: Array.isArray(r.ghs_classes) ? r.ghs_classes : [],
      is_scheduled: Boolean(r.is_scheduled), status: "active", created_by: c.createdBy,
    }),
  },
  waste: {
    table: "waste_streams", toolName: "extract_waste",
    system: "You are an EHS data specialist. Extract hazardous waste stream records. For classification use: hazardous, non-hazardous, universal-waste, mixed, clinical. For disposal_method use: incineration, landfill, recycling, treatment, neutralisation, other.",
    instruction: "Extract all waste streams from this document.",
    schema: arr({
      required: ["waste_name", "classification", "quantity", "unit", "disposal_method"], additionalProperties: false,
      properties: { waste_name: { type: "string" }, waste_code: { type: ["string", "null"] }, classification: { type: "string" }, quantity: { type: "number" }, unit: { type: "string" }, disposal_method: { type: "string" }, disposal_contractor: { type: ["string", "null"] }, manifest_number: { type: ["string", "null"] } },
    }),
    label: (r) => String(r.waste_name ?? "Unnamed waste"),
    dedupKey: (r) => `${norm(r.waste_name)}|${norm(r.classification)}`,
    toLive: (r, c) => ({
      tenant_id: c.tenantId, waste_name: String(r.waste_name ?? "Unknown Waste"),
      waste_code: r.waste_code ? String(r.waste_code) : null, classification: String(r.classification || "hazardous"),
      quantity: Number(r.quantity) || 0, unit: String(r.unit || "kg"), disposal_method: String(r.disposal_method || "other"),
      disposal_contractor: r.disposal_contractor ? String(r.disposal_contractor) : null,
      manifest_number: r.manifest_number ? String(r.manifest_number) : null, status: "active", created_by: c.createdBy,
    }),
  },
  legal: {
    table: "legal_requirements", toolName: "extract_legal",
    system: "You are an EHS regulatory specialist. Extract every regulation, permit, or legal requirement. For category use: chemical, training, emergency, waste, air, water, biosafety, general.",
    instruction: "Extract all legal/regulatory requirements from this document.",
    schema: arr({
      required: ["title", "regulation_ref", "jurisdiction", "category"], additionalProperties: false,
      properties: { title: { type: "string" }, regulation_ref: { type: "string" }, jurisdiction: { type: "string" }, category: { type: "string" }, description: { type: "string" } },
    }),
    label: (r) => `${String(r.regulation_ref ?? "")} — ${String(r.title ?? "Requirement")}`.replace(/^ — /, ""),
    dedupKey: (r) => norm(r.regulation_ref || r.title),
    toLive: (r, c) => ({
      tenant_id: c.tenantId, title: String(r.title || "Regulatory Requirement"), regulation_ref: String(r.regulation_ref || ""),
      jurisdiction: String(r.jurisdiction || ""), category: String(r.category || "general"), description: String(r.description || ""),
      applicable_sectors: [], review_frequency_days: 365,
      next_review_date: new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10), status: "not_assessed",
    }),
  },
  training: {
    table: "training_courses", toolName: "extract_training",
    system: "You are an EHS training specialist. Extract training courses/requirements. For course_type use: safety, hazmat, emergency-response, regulatory, equipment, general. duration_minutes in minutes (estimate if stated as hours). validity_period_days is how long the certification lasts (null if none).",
    instruction: "Extract all training courses or requirements from this document.",
    schema: arr({
      required: ["title", "description", "course_type", "duration_minutes"], additionalProperties: false,
      properties: { title: { type: "string" }, description: { type: "string" }, course_type: { type: "string" }, duration_minutes: { type: "number" }, regulatory_ref: { type: ["string", "null"] }, validity_period_days: { type: ["number", "null"] } },
    }),
    label: (r) => String(r.title ?? "Training course"),
    dedupKey: (r) => norm(r.title),
    toLive: (r, _c) => ({
      tenant_id: _c.tenantId, title: String(r.title || "Training Course"), description: String(r.description || ""),
      course_type: String(r.course_type || "general"), duration_minutes: Number(r.duration_minutes) || 60,
      pass_score: 80, validity_period_days: r.validity_period_days ? Number(r.validity_period_days) : null,
      required_roles: [], regulatory_ref: r.regulatory_ref ? String(r.regulatory_ref) : null, active: true,
    }),
  },
  incident: {
    table: "incidents", toolName: "extract_incidents",
    system: "You are an EHS data specialist. Extract injury/illness or near-miss cases. For incident_type use: near_miss, first_aid, medical_treatment, lost_time_injury, property_damage, environmental_spill, chemical_release, fire_explosion. For severity: low, medium, high, critical. occurred_date must be YYYY-MM-DD.",
    instruction: "Extract all incidents, injuries, illnesses, or near-misses from this document.",
    schema: arr({
      required: ["title", "incident_type", "severity", "occurred_date"], additionalProperties: false,
      properties: { title: { type: "string" }, description: { type: "string" }, incident_type: { type: "string" }, severity: { type: "string" }, occurred_date: { type: "string" }, location: { type: ["string", "null"] }, injured_party: { type: ["string", "null"] }, lost_time_days: { type: ["number", "null"] } },
    }),
    label: (r) => String(r.title ?? "Incident"),
    dedupKey: (r) => norm(r.title),
    toLive: (r, c) => {
      const d = String(r.occurred_date || "");
      const occurredAt = d && !Number.isNaN(new Date(d).getTime()) ? new Date(d).toISOString() : new Date().toISOString();
      return {
        tenant_id: c.tenantId, site_id: c.siteId, title: String(r.title || "Incident"), description: String(r.description || ""),
        incident_type: String(r.incident_type || "medical_treatment"), severity: String(r.severity || "medium"),
        occurred_at: occurredAt, location: String(r.location || ""),
        injured_party: r.injured_party ? String(r.injured_party) : null,
        lost_time_days: r.lost_time_days != null ? Number(r.lost_time_days) : null,
        reported_by: c.createdBy, status: "reported",
      };
    },
  },
  equipment: {
    table: "equipment", toolName: "extract_equipment",
    system: "You are an EHS equipment specialist. Extract equipment/calibration records. For type use: general, air_monitor, gas_detector, noise_meter, pressure_vessel, electrical, lifting, ppe, fire_suppression, emergency, hvac, laboratory. Dates must be YYYY-MM-DD.",
    instruction: "Extract all equipment records from this register.",
    schema: arr({
      required: ["name", "type", "location"], additionalProperties: false,
      properties: { name: { type: "string" }, type: { type: "string" }, serial_number: { type: ["string", "null"] }, location: { type: "string" }, next_calibration_date: { type: ["string", "null"] }, next_inspection_date: { type: ["string", "null"] }, calibration_interval_days: { type: ["number", "null"] } },
    }),
    label: (r) => String(r.name ?? "Equipment"),
    dedupKey: (r) => `${norm(r.name)}|${norm(r.serial_number)}`,
    toLive: (r, c) => ({
      tenant_id: c.tenantId, site_id: c.siteId, name: String(r.name || "Unknown Equipment"), type: String(r.type || "general"),
      serial_number: r.serial_number ? String(r.serial_number) : null, location: String(r.location || ""),
      next_calibration_date: r.next_calibration_date ? String(r.next_calibration_date) : null,
      next_inspection_date: r.next_inspection_date ? String(r.next_inspection_date) : null,
      calibration_interval_days: r.calibration_interval_days ? Number(r.calibration_interval_days) : null,
      status: "operational",
    }),
  },
};

/** Run AI extraction for one kind across the provided source files. Returns candidate rows. */
export async function extractRows(kind: RowKind, sources: SourceBlock[]): Promise<Record<string, unknown>[]> {
  if (!hasLiveAi()) return [];
  const def = KIND_DEFS[kind];
  const { anthropicKey, anthropicModel } = serverSecrets();
  const client = new Anthropic({ apiKey: anthropicKey });
  const out: Record<string, unknown>[] = [];
  for (const s of sources) {
    const blocks: Anthropic.MessageParam["content"] = [];
    if (s.base64 && s.mimeType === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: s.base64 } } as Anthropic.DocumentBlockParam);
    } else if (s.text) {
      blocks.push({ type: "text", text: `File: ${s.name}\n\n${s.text}` });
    } else continue;
    blocks.push({ type: "text", text: def.instruction });
    try {
      const resp = await client.messages.create({
        model: anthropicModel, max_tokens: 4096, system: def.system,
        messages: [{ role: "user", content: blocks }],
        tools: [{ name: def.toolName, description: "Return extracted rows.", input_schema: def.schema }],
        tool_choice: { type: "tool", name: def.toolName },
      });
      const block = resp.content.find((b) => b.type === "tool_use");
      const rows = block?.type === "tool_use" ? (block.input as { items?: Record<string, unknown>[] }).items : null;
      if (Array.isArray(rows)) out.push(...rows);
    } catch (err) {
      console.error(`[extractDocuments] ${kind} extraction failed for ${s.name}:`, err);
    }
  }
  return out;
}

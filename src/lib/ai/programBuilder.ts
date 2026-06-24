/**
 * AI Program Builder (server-only).
 *
 * Reads the company's uploaded manuals/SOPs + live platform data and AUTHORS
 * the EHS programs & SOPs they're required to maintain — tailored to their
 * actual chemicals, site, and operations. Output is structured DocSection[]
 * that gets stored in documents.content (a real, editable body), linked to the
 * regulation it satisfies, and surfaced where the platform needs it.
 *
 * Never import into a client component — it reads server secrets.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverSecrets, hasLiveAi } from "@/lib/env";
import type { Chemical, BiosafetyLab, WasteStream, DocSection } from "@/lib/types";

export interface ProgramCtx {
  chemicals: Chemical[];
  biosafetyLabs: BiosafetyLab[];
  wasteStreams: WasteStream[];
}

export interface ProgramDef {
  key: string;
  title: string;
  category: string;            // documents.category
  regulation: string;          // documents.regulation_ref
  required: (ctx: ProgramCtx) => boolean;
  reason: (ctx: ProgramCtx) => string;
  outline: string[];           // section headings the AI must author
}

const ghs = (c: Chemical) => c.ghs_classes ?? [];
const hasFormaldehyde = (chems: Chemical[]) =>
  chems.some((c) => /formaldehyde|formalin/i.test(c.name) || (c.schedule_ref ?? "").includes("1910.1048"));
const hasCarcinogen = (chems: Chemical[]) =>
  chems.some((c) => ghs(c).some((g) => ["H350", "H351", "H340", "H341"].includes(g)));

// ── Program catalogue — what's required, when, and the structure to author ─────
export const PROGRAM_DEFS: ProgramDef[] = [
  { key: "chp", title: "Chemical Hygiene Plan", category: "plan", regulation: "OSHA 29 CFR 1910.1450",
    required: (c) => c.chemicals.length > 0,
    reason: () => "Required for any laboratory that uses hazardous chemicals.",
    outline: ["Purpose & Scope", "Roles & Responsibilities", "Standard Operating Procedures", "Exposure Control & PPE", "Engineering Controls (Fume Hoods & Ventilation)", "Particularly Hazardous Substances", "Training Requirements", "Recordkeeping & Annual Review"] },
  { key: "hazcom", title: "Hazard Communication Program", category: "plan", regulation: "OSHA 29 CFR 1910.1200",
    required: (c) => c.chemicals.length > 0,
    reason: () => "Required wherever hazardous chemicals are present.",
    outline: ["Purpose", "Container Labeling", "Safety Data Sheet Management", "Employee Information & Training", "Non-Routine Tasks", "Program Maintenance"] },
  { key: "formaldehyde", title: "Formaldehyde Exposure Control Plan", category: "plan", regulation: "OSHA 29 CFR 1910.1048",
    required: (c) => hasFormaldehyde(c.chemicals),
    reason: () => "Formaldehyde is present in the chemical inventory.",
    outline: ["Scope & Application", "Exposure Monitoring", "Regulated Areas & Signage", "PPE & Engineering Controls", "Medical Surveillance", "Emergency & Spill Procedures", "Training"] },
  { key: "bbp", title: "Bloodborne Pathogens Exposure Control Plan", category: "plan", regulation: "OSHA 29 CFR 1910.1030",
    required: (c) => c.biosafetyLabs.length > 0,
    reason: () => "BSL labs / human-derived materials require a written Exposure Control Plan.",
    outline: ["Exposure Determination", "Methods of Compliance", "Hepatitis B Vaccination", "Post-Exposure Evaluation & Follow-up", "Training", "Recordkeeping"] },
  { key: "biosafety", title: "Biosafety Manual (BSL-2)", category: "plan", regulation: "CDC-NIH BMBL 6th Edition",
    required: (c) => c.biosafetyLabs.length > 0,
    reason: () => "Registered BSL-2 laboratories require a biosafety manual.",
    outline: ["Containment & Facility", "Biological Safety Cabinets", "PPE & Practices", "Biohazardous Waste & Decontamination", "Agent Inventory & Risk Groups", "Exposure & Incident Response", "Training & IBC Oversight"] },
  { key: "hazwaste", title: "Hazardous Waste Management Program", category: "plan", regulation: "EPA 40 CFR 262 (SQG)",
    required: (c) => c.wasteStreams.length > 0,
    reason: () => "Hazardous waste streams require a generator management program.",
    outline: ["Generator Status & Accumulation Limits", "Satellite & Central Accumulation Areas", "Labeling & Manifesting", "Inspections & Recordkeeping", "Disposal & TSDF Selection", "Contingency & Spill Response"] },
  { key: "eap", title: "Emergency Action Plan", category: "emergency_procedure", regulation: "OSHA 29 CFR 1910.38",
    required: () => true,
    reason: () => "Required for all establishments.",
    outline: ["Emergency Reporting", "Evacuation Routes & Procedures", "Assembly Areas & Headcount", "Critical Operations Shutdown", "Medical & Rescue Duties", "Alarm System", "Training & Drills"] },
];

export function requiredPrograms(ctx: ProgramCtx) {
  return PROGRAM_DEFS.filter((d) => d.required(ctx)).map((d) => ({
    key: d.key, title: d.title, category: d.category, regulation: d.regulation, reason: d.reason(ctx),
  }));
}

export interface SourceBlock { name: string; text?: string; base64?: string; mimeType?: string }

/** Author a complete, company-specific program, grounded in uploaded manuals + live data. */
export async function generateProgram(
  def: ProgramDef,
  info: { company: string; site: string; cho: string },
  chemicals: Chemical[],
  sources: SourceBlock[],
): Promise<DocSection[]> {
  // Heuristic fallback (no AI key) — still produces a real, editable skeleton.
  if (!hasLiveAi()) {
    return def.outline.map((h) => ({
      heading: h,
      body: `${info.company} — ${def.title} (${def.regulation}).\n\nThis section covers ${h.toLowerCase()}. [Draft skeleton generated without an AI key — add an ANTHROPIC_API_KEY to auto-author full content from your manuals and inventory.]`,
    }));
  }

  const { anthropicKey, anthropicModel } = serverSecrets();
  const client = new Anthropic({ apiKey: anthropicKey });
  const chemList = chemicals.slice(0, 40).map((c) =>
    `${c.name}${c.cas_number ? ` (CAS ${c.cas_number})` : ""}${ghs(c).length ? ` [${ghs(c).join(",")}]` : ""}${c.is_scheduled ? " *scheduled*" : ""}`,
  ).join("; ") || "none recorded";

  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["sections"], additionalProperties: false,
    properties: { sections: { type: "array", items: {
      type: "object", required: ["heading", "body"], additionalProperties: false,
      properties: { heading: { type: "string" }, body: { type: "string" } },
    } } },
  };

  const blocks: Anthropic.MessageParam["content"] = [];
  for (const s of sources) {
    if (s.base64 && s.mimeType === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: s.base64 } } as Anthropic.DocumentBlockParam);
    } else if (s.text && s.text.trim().length > 40) {
      blocks.push({ type: "text", text: `Company source document "${s.name}":\n${s.text.slice(0, 12000)}` });
    }
  }
  blocks.push({ type: "text", text:
    `Author a complete, audit-ready ${def.title} for ${info.company} (site: ${info.site}). ` +
    `Designated EHS lead / Chemical Hygiene Officer: ${info.cho}. Regulatory basis: ${def.regulation}. ` +
    `Current chemical inventory: ${chemList}. ` +
    `Where the company's uploaded source documents above contain relevant procedures, incorporate and build on them; otherwise write best-practice content that complies with ${def.regulation}. ` +
    `Reference the company's actual name, site, and chemicals. Each section body must be substantive, specific, and ready to adopt (not placeholders). ` +
    `Produce exactly these sections: ${def.outline.join("; ")}.`,
  });

  try {
    const resp = await client.messages.create({
      model: anthropicModel, max_tokens: 16000, // full multi-section programs need headroom or the tool call truncates
      system: "You are a senior EHS consultant who writes complete, audit-ready EHS programs and SOPs tailored to a specific company. Write in clear policy language specific to the company and its chemicals/operations, cite the relevant regulation in-text, and never invent facts not implied by the inputs.",
      messages: [{ role: "user", content: blocks }],
      tools: [{ name: "write_program", description: "Return the authored program sections.", input_schema: schema }],
      tool_choice: { type: "tool", name: "write_program" },
    });
    const block = resp.content.find((b) => b.type === "tool_use");
    const sections = block?.type === "tool_use" ? (block.input as { sections?: DocSection[] }).sections : null;
    if (Array.isArray(sections) && sections.length) return sections;
  } catch (err) {
    console.error("[programBuilder] generation failed:", err);
  }
  return def.outline.map((h) => ({ heading: h, body: "" }));
}

export { hasCarcinogen };

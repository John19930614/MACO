/**
 * AI Program Builder (server-only).
 *
 * Reads the company's uploaded manuals/SOPs + live platform data and AUTHORS
 * the EHS programs & SOPs they're required to maintain — tailored to their
 * actual chemicals, site, and operations. Output is structured DocSection[]
 * that gets stored in documents.content (a real, editable body), linked to the
 * regulation it satisfies, and surfaced where the platform needs it.
 *
 * Every document is authored in the Reliance Document Generator master structure
 * (Purpose/Scope → Regulatory Basis → Roles → Definitions → Risk/PPE/Stop-Work →
 * Procedure → Records → Training → Corrective Actions → the matching Type Module
 * (SOP / Form / Program / Emergency / Regulatory) → Final Review Checklist) so
 * every generated doc shares one consistent format. Section 1 (Document Control)
 * is rendered/exported from the document's live metadata, not authored here.
 *
 * Never import into a client component — it reads server secrets.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverSecrets, hasLiveAi } from "@/lib/env";
import { getHText, getPText } from "@/lib/ghsData";
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
  outline: string[];           // regulation-specific topics the AI must cover within the master structure
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

// ── Reliance Document Generator — master template structure ───────────────────
// The fixed section spine every generated document follows. Section 1 of the
// Word master (Document Control) is rendered/exported deterministically from the
// document's live metadata (see DocSections.DocControlBlock + docExport), so it
// is NOT authored here. Section 12 (Platform Formatting Standard) is a styling
// rule, not content, so it is also omitted. `{module}` is replaced by the
// category's Type Module.
const MASTER_SECTIONS: { heading: string; intent: string }[] = [
  { heading: "Purpose, Scope & When to Use",
    intent: "Purpose in 2–4 sentences (the risk, process, site, and compliance reason). Scope (departments, tasks, equipment, chemicals/biological materials/waste streams, contractors, employees covered). When to Use (the trigger that requires this document)." },
  { heading: "Applicability & Regulatory Basis",
    intent: "List the governing requirement(s) including the primary regulation. For each: jurisdiction, whether it applies (Yes/No/NA), the plain-language requirement, and the record/evidence that proves compliance." },
  { heading: "Roles & Responsibilities",
    intent: "For Document Owner, Supervisor/Manager, Employee/Contractor, and EHS/Safety: a specific accountable action (not just a title), required training/competency, and records owned." },
  { heading: "Definitions",
    intent: "Key terms and acronyms used in this document, each with a short plain-language, field-usable definition." },
  { heading: "Risk, PPE, Permits & Stop-Work Triggers",
    intent: "The quick field-read panel: each primary hazard for this company's chemicals/operations, its minimum control (engineering/admin/work-practice), required PPE/permit, and the condition that requires stop-work or escalation. Call out any step that could cause serious injury, release, fire, or shutdown." },
  { heading: "Procedure / Workflow",
    intent: "Numbered steps. Each step states the action to take, the acceptance criteria (what 'good' looks like), and the record/output it produces." },
  { heading: "Inspection, Verification & Records",
    intent: "The records this document generates: record name, owner role, frequency, retention period, and storage location." },
  { heading: "Training & Acknowledgment",
    intent: "Who must be trained, when, and how competency is verified; include the worker acknowledgment statement." },
  { heading: "Corrective Actions & Escalation",
    intent: "How findings are handled: the issue, risk level (Low/Medium/High/Critical), the immediate action, assigned owner, due date, and status; plus the escalation path." },
  { heading: "{module}", intent: "{module-intent}" },
  { heading: "Final Review Checklist",
    intent: "The pre-release checks: control block complete; regulatory basis accurate; roles assigned to accountable owners; steps clear and field-usable; PPE/permits/training/records defined; stop-work triggers and escalation included; all placeholders/instruction text removed." },
];

// Type Module (section 11) selected by document category, mirroring blocks A–E.
function moduleFor(category: string): { heading: string; intent: string } {
  switch (category) {
    case "sop":
    case "procedure":
      return { heading: "SOP Detail",
        intent: "Author the SOP module block: Purpose, Scope, Materials/Equipment (tools, chemicals, PPE, forms, permits), Safety Requirements (hazards, PPE, stop-work triggers), Procedure (numbered steps with acceptance criteria), Cleanup/Closeout (waste, decontamination, storage, records), and References (regulations, company standards, SDS, manufacturer instructions)." };
    case "form":
    case "permit":
      return { heading: "Form / Checklist Detail",
        intent: "Author the Form/Checklist module block: inspection items/requirements as a list, each with Yes / No / NA options and a Notes / Corrective Action field." };
    case "emergency_procedure":
      return { heading: "Emergency Plan Detail",
        intent: "Author the Emergency Plan module block: Emergency Type(s), Alarm/Notification (who is contacted, how, in what order), Immediate Actions (first 60 seconds), Evacuation/Shelter (routes, muster points, accountability), Equipment/Supplies, and Post-Event (investigation, reporting, cleanup, restart approval)." };
    case "plan":
    case "policy":
    case "guideline":
    default:
      return { heading: "Program Requirements",
        intent: "Author the EHS Program module block: Policy Statement (company commitment/minimum standard), Program Scope, Responsibilities, Risk Assessment (hazard identification and ranking method), Control Requirements (controls, permits, PPE, inspection, training), Monitoring/Audits (frequency, scoring, records, escalation), and Review & Improvement (annual + incident-based review and corrective-action tracking)." };
  }
}

/** Resolve the ordered master section spine for a document of the given category. */
function masterSpine(category: string): { heading: string; intent: string }[] {
  const mod = moduleFor(category);
  return MASTER_SECTIONS.map((s) =>
    s.heading === "{module}" ? mod : s,
  );
}

export interface SourceBlock { name: string; text?: string; base64?: string; mimeType?: string }

// ── Live-data grounding for the Risk/PPE and Applicability tables ──────────────
// Builds factual anchors from the actual chemical inventory so those tables
// reflect real hazards/regulations rather than AI guesses. The AI must cover
// every anchor and supply the control/PPE/stop-work expertise around it.

/** Hazardous chemicals with their real GHS hazard + precautionary statements. */
function hazardProfile(chemicals: Chemical[]): string {
  const hazardous = chemicals.filter(
    (c) => (c.hazard_statements?.length ?? 0) > 0 || ghs(c).length > 0,
  );
  return hazardous.slice(0, 30).map((c) => {
    const hs = (c.hazard_statements ?? []).slice(0, 6).map((h) => `${h} ${getHText(h)}`.trim()).join("; ");
    const ps = (c.precautionary_statements ?? []).slice(0, 6).map((p) => `${p} ${getPText(p)}`.trim()).join("; ");
    const tag = c.is_scheduled && c.schedule_ref ? ` [regulated: ${c.schedule_ref}]` : "";
    return `- ${c.name}${c.cas_number ? ` (CAS ${c.cas_number})` : ""}${tag}`
      + (hs ? `\n   Hazards: ${hs}` : "")
      + (ps ? `\n   Precautions: ${ps}` : "");
  }).join("\n");
}

/** The governing regulation plus any controlled-substance lists the inventory triggers. */
function regulatoryAnchors(def: ProgramDef, chemicals: Chemical[]): string[] {
  const set = new Set<string>([def.regulation]);
  for (const c of chemicals) {
    if (c.is_scheduled && c.schedule_ref) set.add(c.schedule_ref);
  }
  return [...set];
}

/** Author a complete, company-specific program, grounded in uploaded manuals + live data. */
export async function generateProgram(
  def: ProgramDef,
  info: { company: string; site: string; cho: string },
  chemicals: Chemical[],
  sources: SourceBlock[],
): Promise<DocSection[]> {
  const spine = masterSpine(def.category);

  // Heuristic fallback (no AI key) — still produces a real, editable skeleton in
  // the master template structure.
  if (!hasLiveAi()) {
    return spine.map((s) => ({
      heading: s.heading,
      body: `${info.company} — ${def.title} (${def.regulation}).\n\n${s.intent}\n\n[Draft skeleton generated without an AI key — add an ANTHROPIC_API_KEY to auto-author full content from your manuals and inventory.]`,
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
  // Factual anchors derived from the live inventory — the tables must be built
  // from these, not invented.
  const hazards = hazardProfile(chemicals);
  const regAnchors = regulatoryAnchors(def, chemicals);
  if (hazards) {
    blocks.push({ type: "text", text:
      `LIVE HAZARD PROFILE — the company's actual hazardous chemicals with their real GHS hazard (H) and precautionary (P) statements:\n${hazards}` });
  }

  const sectionSpec = spine.map((s, i) => `${i + 1}. ${s.heading} — ${s.intent}`).join("\n");
  blocks.push({ type: "text", text:
    `Author a complete, audit-ready ${def.title} for ${info.company} (site: ${info.site}). ` +
    `Designated EHS lead / Chemical Hygiene Officer: ${info.cho}. Regulatory basis: ${def.regulation}. ` +
    `Current chemical inventory: ${chemList}. ` +
    `Where the company's uploaded source documents above contain relevant procedures, incorporate and build on them; otherwise write best-practice content that complies with ${def.regulation}. ` +
    `Reference the company's actual name, site, and chemicals. Each section body must be substantive, specific, and ready to adopt (not placeholders).\n\n` +
    `Produce EXACTLY these sections, in this order, using each heading verbatim:\n${sectionSpec}\n\n` +
    `In addition, this document MUST substantively cover these regulation-specific topics within the sections above (especially Risk/PPE, Procedure, and the Type Module section): ${def.outline.join("; ")}.\n\n` +
    `GROUNDING — build the data tables from the live facts, do not invent or omit:\n` +
    (hazards
      ? `• "Risk, PPE, Permits & Stop-Work Triggers": include a row for EVERY chemical/hazard in the LIVE HAZARD PROFILE above. Base the Hazard column on its actual H-statements and the PPE column on its actual P-statements; supply the minimum control and stop-work trigger. Do not list chemicals or hazards that are not in the profile.\n`
      : ``) +
    `• "Applicability & Regulatory Basis": include a row for each of these governing requirements that this document satisfies: ${regAnchors.join("; ")}. Mark Applies = Yes and give the plain-language requirement and the record/evidence that proves it.\n\n` +
    `FORMATTING — write each section body in GitHub-flavored Markdown so it renders cleanly: ` +
    `present tabular content as Markdown pipe tables with a header row and a |---| separator (Roles, Risk/PPE, Procedure (Step | Action | Acceptance Criteria | Record/Output), Inspection/Records, Corrective Actions, and the Type Module blocks as tables with clear column headers). ` +
    `Use a numbered list for sequential procedure steps and "- [ ]" checkbox items for the Final Review Checklist. Use **bold** for field labels. Keep narrative sections (Purpose, Definitions) as short prose or simple tables.`,
  });

  try {
    const resp = await client.messages.create({
      model: anthropicModel, max_tokens: 20000, // the 12-section master structure needs headroom or the tool call truncates
      system: "You are a senior EHS consultant who writes complete, audit-ready EHS programs and SOPs tailored to a specific company, following a fixed master document structure. Author every requested section in the exact order and with the exact heading given, in clear policy language specific to the company and its chemicals/operations. Cite the relevant regulation in-text, and never invent facts not implied by the inputs.",
      messages: [{ role: "user", content: blocks }],
      tools: [{ name: "write_program", description: "Return the authored program sections.", input_schema: schema }],
      tool_choice: { type: "tool", name: "write_program" },
    });
    const block = resp.content.find((b) => b.type === "tool_use");
    const sections = block?.type === "tool_use" ? (block.input as { sections?: DocSection[] }).sections : null;
    if (Array.isArray(sections) && sections.length) return sections;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") { console.error("[programBuilder] generation failed:", err); }
  }
  return spine.map((s) => ({ heading: s.heading, body: "" }));
}

export { hasCarcinogen, hazardProfile, regulatoryAnchors };

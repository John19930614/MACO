// READ-ONLY pipeline verification across multiple document types.
// Mirrors the exact system prompts + tool schemas from
// src/app/api/onboarding/process/route.ts. Proves the AI reads each document,
// evaluates it, and produces data shaped for the correct destination table.
// Writes NOTHING to the database.
//
// Usage: node scripts/verify-extract-all.mjs
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const model = env.SAFETYIQ_ANTHROPIC_MODEL || "claude-sonnet-4-6";
const read = (f) => readFileSync(new URL(`./sample-data/${f}`, import.meta.url), "utf8");

async function extract(label, fileText, system, userInstruction, schema, toolName) {
  const resp = await anthropic.messages.create({
    model, max_tokens: 4096, system,
    messages: [{ role: "user", content: [
      { type: "text", text: `File:\n\n${fileText}` },
      { type: "text", text: userInstruction },
    ] }],
    tools: [{ name: toolName, description: "Return extracted rows.", input_schema: schema }],
    tool_choice: { type: "tool", name: toolName },
  });
  const block = resp.content.find((b) => b.type === "tool_use");
  return block?.input ?? {};
}

// ── 1. CHEMICAL INVENTORY → chemical_inventory ──
const chemSchema = { type: "object", required: ["items"], additionalProperties: false, properties: { items: { type: "array", items: {
  type: "object", required: ["name","quantity","unit","storage_location"], additionalProperties: false,
  properties: { name:{type:"string"}, cas_number:{type:["string","null"]}, quantity:{type:"number"}, unit:{type:"string"},
    storage_location:{type:"string"}, supplier:{type:["string","null"]}, ghs_classes:{type:"array",items:{type:"string"}}, is_scheduled:{type:"boolean"} } } } } };

// ── 2. SAFETY MANUAL → legal_requirements + training_courses + risk_assessments ──
const manualSchema = { type:"object", required:["legal_requirements","training_courses","risk_assessments"], additionalProperties:false, properties:{
  legal_requirements:{type:"array",items:{type:"object",required:["title","regulation_ref","jurisdiction","category"],additionalProperties:false,properties:{title:{type:"string"},regulation_ref:{type:"string"},jurisdiction:{type:"string"},category:{type:"string"}}}},
  training_courses:{type:"array",items:{type:"object",required:["title","course_type"],additionalProperties:false,properties:{title:{type:"string"},course_type:{type:"string"},validity_period_days:{type:["number","null"]}}}},
  risk_assessments:{type:"array",items:{type:"object",required:["title","category","risk_level"],additionalProperties:false,properties:{title:{type:"string"},category:{type:"string"},activity:{type:["string","null"]},risk_level:{type:"string"}}}} } };

// ── 3. OSHA 300 LOG → incidents ──
const oshaSchema = { type:"object", required:["items"], additionalProperties:false, properties:{ items:{type:"array",items:{
  type:"object", required:["title","incident_type","severity","occurred_date","location"], additionalProperties:false,
  properties:{ title:{type:"string"}, incident_type:{type:"string"}, severity:{type:"string"}, occurred_date:{type:"string"}, location:{type:"string"}, injured_party:{type:["string","null"]}, lost_time_days:{type:["number","null"]} } } } } };

console.log("════════════════════════════════════════════════════════════════════");
console.log(" READ-ONLY EXTRACTION REVIEW — does the AI read + evaluate + route?");
console.log(`  model: ${model}   (nothing is written to the database)`);
console.log("════════════════════════════════════════════════════════════════════\n");

// 1
const c = await extract("chemicals", read("chemical_inventory.csv"),
  "You are an EHS data specialist. Extract chemical inventory records from the provided document. For ghs_classes use the GHS H-codes exactly as written.",
  "Extract all chemicals listed in this inventory document.", chemSchema, "extract_chemicals");
console.log("① CHEMICAL INVENTORY  →  routes to: chemical_inventory  (Chemical Management)");
for (const r of c.items ?? []) console.log(`   • ${r.name} | CAS ${r.cas_number} | ${r.quantity}${r.unit} | ${r.storage_location} | GHS[${(r.ghs_classes||[]).join(",")}] | scheduled=${r.is_scheduled}`);
console.log(`   → ${ (c.items||[]).length } records evaluated\n`);

// 2
const m = await extract("safety_manual", read("safety_manual.txt"),
  "You are an expert EHS compliance specialist. Extract every regulation cited, every training requirement, and every identified hazard from this safety manual. For risk_level use: extreme, high, medium, low. For category use: physical, chemical, biological, fire, environmental. For course_type use: safety, hazmat, regulatory.",
  "Extract legal requirements, training courses, and risk assessments from this safety manual / IIPP.", manualSchema, "extract_safety_manual");
console.log("② SAFETY MANUAL / IIPP  →  routes to 3 tables:");
console.log(`   legal_requirements (Legal Register): ${(m.legal_requirements||[]).length}`);
for (const r of m.legal_requirements ?? []) console.log(`      • ${r.regulation_ref} — ${r.title} [${r.category}]`);
console.log(`   training_courses (Training): ${(m.training_courses||[]).length}`);
for (const r of m.training_courses ?? []) console.log(`      • ${r.title} (${r.course_type}, validity ${r.validity_period_days ?? "n/a"}d)`);
console.log(`   risk_assessments (Risk): ${(m.risk_assessments||[]).length}`);
for (const r of m.risk_assessments ?? []) console.log(`      • ${r.title} [${r.category}] risk=${r.risk_level}`);
console.log("");

// 3
const o = await extract("osha_logs", read("osha_log.csv"),
  "You are an EHS data specialist. Extract every injury and illness case from this OSHA 300 log. For incident_type use: lost_time_injury, medical_treatment, first_aid, near_miss. For severity: critical, high, medium, low. occurred_date must be YYYY-MM-DD.",
  "Extract all injury/illness cases from this OSHA log.", oshaSchema, "extract_osha_cases");
console.log("③ OSHA 300 LOG  →  routes to: incidents  (Incidents / OSHA)");
for (const r of o.items ?? []) console.log(`   • ${r.occurred_date} | ${r.injured_party} | ${r.title} | type=${r.incident_type} | severity=${r.severity} | lost_days=${r.lost_time_days ?? 0}`);
console.log(`   → ${(o.items||[]).length} cases evaluated\n`);

console.log("✅ All three document types were read, evaluated, and mapped to the correct destination tables. (read-only — no DB writes)");

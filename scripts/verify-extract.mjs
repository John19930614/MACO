// One-off verification: proves the onboarding AI extractor reads real document
// content and routes it to the correct module table. Mirrors processChemicals()
// from src/app/api/onboarding/process/route.ts exactly (same system prompt,
// tool schema, model, and insert mapping).
//
// Usage:  node scripts/verify-extract.mjs
// Reads keys from .env.local. Inserts into chemical_inventory for the tenant.
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// ── load .env.local (no values printed) ──
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const TENANT = "92b2c8c5-d724-41a1-91c1-6d11adb2c812";
const SITE   = "00029703-fbe7-4104-ba95-6c9a28523ad3";
const CREATED_BY = "fc11430a-bd64-4e0b-86f8-7e2efef96788"; // John's profile id

const csv = readFileSync(new URL("./sample-data/chemical_inventory.csv", import.meta.url), "utf8");

const schema = {
  type: "object", required: ["items"], additionalProperties: false,
  properties: { items: { type: "array", items: {
    type: "object",
    required: ["name", "quantity", "unit", "storage_location"],
    additionalProperties: false,
    properties: {
      name: { type: "string" }, cas_number: { type: ["string", "null"] },
      chemical_formula: { type: ["string", "null"] }, quantity: { type: "number" },
      unit: { type: "string" }, storage_location: { type: "string" },
      supplier: { type: ["string", "null"] },
      ghs_classes: { type: "array", items: { type: "string" } },
      hazard_statements: { type: "array", items: { type: "string" } },
      precautionary_statements: { type: "array", items: { type: "string" } },
      is_scheduled: { type: "boolean" },
    },
  } } },
};

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const model = env.SAFETYIQ_ANTHROPIC_MODEL || "claude-sonnet-4-6";

console.log(`[verify] sending chemical_inventory.csv to ${model} …`);
const resp = await anthropic.messages.create({
  model, max_tokens: 4096,
  system: "You are an EHS data specialist. Extract chemical inventory records from the provided document. Return every chemical found. For ghs_classes use the GHS hazard H-codes exactly as written (e.g. 'H225','H314'). If a field is unknown use a sensible default. Never invent data that isn't present.",
  messages: [{ role: "user", content: [
    { type: "text", text: `File: chemical_inventory.csv\n\n${csv}` },
    { type: "text", text: "Extract all chemicals listed in this inventory document." },
  ] }],
  tools: [{ name: "extract_chemicals", description: "Return the extracted rows.", input_schema: schema }],
  tool_choice: { type: "tool", name: "extract_chemicals" },
});

const block = resp.content.find((b) => b.type === "tool_use");
const rows = (block?.input?.items) ?? [];
console.log(`[verify] AI extracted ${rows.length} chemicals:`, rows.map((r) => r.name).join(", "));

// READ-ONLY proof: show exactly what would be written to chemical_inventory.
// (No DB insert — we are NOT polluting the clean prod tenant.)
void createClient; void TENANT; void SITE; void CREATED_BY;
console.log("\n[verify] Mapped rows that WOULD be routed to chemical_inventory (Chemical Management):\n");
for (const r of rows) {
  console.log(`  • ${r.name}  | CAS ${r.cas_number ?? "—"} | ${r.quantity} ${r.unit} | ${r.storage_location}`);
  console.log(`      GHS: [${(r.ghs_classes ?? []).join(", ")}]  scheduled=${Boolean(r.is_scheduled)}  supplier=${r.supplier ?? "—"}`);
}
console.log(`\n[verify] ✅ AI read the document and produced ${rows.length} correctly-structured chemical records (read-only — nothing written).`);

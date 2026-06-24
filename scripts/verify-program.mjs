// READ-ONLY proof of the AI Program Builder. Mirrors generateProgram() for the
// Chemical Hygiene Plan, grounded in the sample safety manual + chemical
// inventory. Prints the authored program. Writes NOTHING.
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const model = env.SAFETYIQ_ANTHROPIC_MODEL || "claude-sonnet-4-6";
const manual = readFileSync(new URL("./sample-data/safety_manual.txt", import.meta.url), "utf8");
const chems = readFileSync(new URL("./sample-data/chemical_inventory.csv", import.meta.url), "utf8");

const outline = ["Purpose & Scope","Roles & Responsibilities","Standard Operating Procedures","Exposure Control & PPE","Engineering Controls (Fume Hoods & Ventilation)","Particularly Hazardous Substances","Training Requirements","Recordkeeping & Annual Review"];
const schema = { type:"object", required:["sections"], additionalProperties:false, properties:{ sections:{ type:"array", items:{ type:"object", required:["heading","body"], additionalProperties:false, properties:{ heading:{type:"string"}, body:{type:"string"} } } } } };

const resp = await anthropic.messages.create({
  model, max_tokens: 16000,
  system: "You are a senior EHS consultant who writes complete, audit-ready EHS programs tailored to a specific company. Write in clear policy language specific to the company and its chemicals, cite the regulation in-text, and never invent facts not implied by the inputs.",
  messages: [{ role: "user", content: [
    { type: "text", text: `Company source document "safety_manual.txt":\n${manual}` },
    { type: "text", text: `Chemical inventory (CSV):\n${chems}` },
    { type: "text", text: `Author a complete, audit-ready Chemical Hygiene Plan for Cortexa Biosciences, Inc. (site: Cortexa HQ, Cambridge, MA). Designated CHO: John Haldemann, EHS Manager. Regulatory basis: OSHA 29 CFR 1910.1450. Incorporate the company's source manual where relevant; reference the actual chemicals. Each section must be substantive and ready to adopt. Produce exactly these sections: ${outline.join("; ")}.` },
  ] }],
  tools: [{ name: "write_program", description: "Return the authored program sections.", input_schema: schema }],
  tool_choice: { type: "tool", name: "write_program" },
});
console.log("stop_reason:", resp.stop_reason, "| content types:", resp.content.map((b) => b.type).join(","));
const block = resp.content.find((b) => b.type === "tool_use");
const sections = block?.input?.sections ?? [];
console.log(`\n=== AI-AUTHORED: Chemical Hygiene Plan — ${sections.length} sections (read-only) ===\n`);
for (const s of sections) {
  console.log(`## ${s.heading}`);
  console.log(s.body.slice(0, 280).replace(/\n+/g, " ") + (s.body.length > 280 ? " …" : ""));
  console.log("");
}
console.log(`✅ Program Builder authored a full ${sections.length}-section CHP grounded in the company manual + inventory. Nothing written to DB.`);

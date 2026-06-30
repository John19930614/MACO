import type { WasteProfileConstituent, WasteProfileAiSuggestions } from "@/lib/types";

/**
 * Deterministic, rules-based RCRA characterization from the selected chemical
 * constituents + the guided answers. Used as the no-AI fallback AND as a hint
 * seeded into the AI prompt. This is real EHS logic (mapping GHS hazard
 * statements to EPA characteristic codes), not placeholder output — but it is
 * still ADVISORY: every profile requires human approval before activation.
 *
 * H-code → characteristic mapping (40 CFR 261 Subpart C, conservative):
 *   D001 Ignitable   — flammable liquid/solid/gas H-codes, or reported ignitable
 *   D002 Corrosive   — skin-corrosive / metal-corrosive H-codes
 *   D003 Reactive    — explosive / self-reactive / organic-peroxide H-codes
 */
const IGNITABLE_H = ["H220", "H221", "H222", "H223", "H224", "H225", "H226", "H228"];
const CORROSIVE_H = ["H290", "H314"];
const REACTIVE_H = ["H200", "H201", "H202", "H203", "H204", "H205", "H240", "H241", "H242", "H271", "H272"];

export function rulesDraft(
  constituents: WasteProfileConstituent[],
  answers: Record<string, string>,
): WasteProfileAiSuggestions {
  const allH = [...new Set(constituents.flatMap((c) => c.hazard_statements ?? []))];
  const allClasses = [...new Set(constituents.flatMap((c) => c.ghs_classes ?? []))];

  const codes: string[] = [];
  if (allH.some((h) => IGNITABLE_H.includes(h)) || answers.ignitable === "yes") codes.push("D001");
  if (allH.some((h) => CORROSIVE_H.includes(h))) codes.push("D002");
  if (allH.some((h) => REACTIVE_H.includes(h))) codes.push("D003");

  const hazardous =
    codes.length > 0 || allH.length > 0 || allClasses.length > 0 || answers.ignitable === "yes";

  const constituentList = constituents
    .map((c) => `${c.name}${c.cas_number ? ` (CAS ${c.cas_number})` : ""} — ${c.percentage}%`)
    .join("; ");

  const hazard_summary =
    `Mixture of ${constituents.length} characterized constituent(s): ${constituentList || "none"}. ` +
    `Aggregated GHS hazard statements: ${allH.length ? allH.join(", ") : "none recorded"}.` +
    (answers.free_liquids === "yes" ? " Contains free liquids." : "") +
    (answers.ph ? ` Reported pH: ${answers.ph}.` : "");

  const rationale = codes.length
    ? `Suggested EPA characteristic code(s) ${codes.join(", ")} from aggregated hazard statements` +
      `${answers.ignitable === "yes" ? " and the reported ignitability answer" : ""}. ` +
      `Verify constituent concentrations against 40 CFR 261 and the SDS before approval.`
    : `No characteristic hazard codes were triggered by the recorded GHS data. ` +
      `Confirm with generator knowledge and the SDS — list a waste code manually if one applies.`;

  return {
    classification: hazardous ? "hazardous" : "non_hazardous",
    waste_code: codes.join(", "),
    physical_state: answers.physical_state || constituents[0]?.physical_state || "liquid",
    process_description: answers.generation_process || "",
    hazard_summary,
    rationale,
    codes_considered: codes,
    generated_by: "rules",
  };
}

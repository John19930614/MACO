/**
 * EXP intake extractor (pure, deterministic). Turns a free-text observation or
 * interview transcript into a draft Safety Cell — the "Convert" step of the ARC
 * Experience Intelligence Protocol. Heuristic keyword model in mock mode; the
 * live route swaps in an LLM. Output is always a DRAFT for human review.
 */
import { SEVERITIES, type Severity } from "@/lib/constants";

export interface CellDraft {
  title: string;
  description: string;
  task: string;
  severity: Severity;
  likelihood: number;
  hazard_genome: {
    energySource: string;
    exposureType: string;
    trigger: string;
    controlGap: string;
    environment: string;
  };
}

export interface ExtractResult {
  draft: CellDraft;
  confidence: number;
  signals: string[]; // human-readable cues the extractor matched
}

interface Rule {
  re: RegExp;
  energy?: string;
  exposure?: string;
  signal: string;
}

// Order matters: earlier rules win for energy/exposure. Patterns use a leading
// word boundary + stem (no trailing \b) so inflections match ("bypassed",
// "energized", "removed").
const HAZARD_RULES: Rule[] = [
  { re: /\b(fall|fell|height|edge|guardrail|scaffold|ladder|roof|opening)/, energy: "gravity", exposure: "fall", signal: "fall / height language" },
  { re: /\b(dropped|falling object|overhead|suspended|load)/, energy: "gravity", exposure: "struck_by", signal: "dropped/overhead object" },
  { re: /\b(forklift|vehicle|truck|mobile plant|revers|struck|hit by|run over)/, energy: "motion", exposure: "struck_by", signal: "vehicle / struck-by" },
  { re: /\b(pinch|caught|entangle|nip point|conveyor|rotating|gear)/, energy: "mechanical", exposure: "caught_in", signal: "caught-in / machinery" },
  { re: /\b(electric|voltage|live wire|energi|loto|lockout|shock)/, energy: "electrical", exposure: "contact", signal: "electrical" },
  { re: /\b(chemical|spill|fume|gas|vapou?r|inhal|toxic|corrosive)/, energy: "chemical", exposure: "inhalation", signal: "chemical exposure" },
  { re: /\b(hot|burn|steam|thermal|fire|flame|heat)/, energy: "thermal", exposure: "contact", signal: "thermal / burn" },
  { re: /\b(pressure|hose|hydraulic|pneumatic|compressed)/, energy: "pressure", exposure: "struck_by", signal: "stored pressure" },
  { re: /\b(line of fire|in the path|swing radius|crush zone)/, energy: "motion", exposure: "line_of_fire", signal: "line-of-fire" },
  { re: /\b(strain|ergonom|repetitive|awkward posture|manual handling)/, energy: "motion", exposure: "ergonomic", signal: "ergonomic / manual handling" },
];

const GAP_RULES: { re: RegExp; gap: string; signal: string }[] = [
  { re: /\b(bypass|defeat|tape|overrid|disabl|propp|jumper)/, gap: "bypassed", signal: "control bypassed" },
  { re: /\b(missing|absent|remove|not present|not in place|no spotter|no barrier|without a)/, gap: "missing", signal: "control missing" },
  { re: /\b(expire|overdue|out of date|lapse)/, gap: "expired", signal: "control expired" },
  { re: /\b(not verified|unverified|assume|on paper|claim|unchecked)/, gap: "unverified", signal: "control unverified" },
  { re: /\b(weak|inadequate|movable|cones|temporary|partial)/, gap: "weak", signal: "control weak" },
];

const SEVERITY_RULES: { re: RegExp; sev: Severity }[] = [
  { re: /\b(fatal|death|killed|life.?threatening|critical|catastroph)/, sev: "critical" },
  { re: /\b(serious|major|hospital|amputat|fracture|severe)/, sev: "high" },
  { re: /\b(near miss|close call|could have|minor|first aid)/, sev: "medium" },
];

const TASK_RULES: { re: RegExp; task: string }[] = [
  { re: /\b(unload|loading|load out|stevedor)/, task: "Loading / unloading" },
  { re: /\b(crane|lift|hoist|rig)/, task: "Lifting operations" },
  { re: /\b(weld|cut|grind|hot work)/, task: "Hot work" },
  { re: /\b(excavat|dig|trench)/, task: "Excavation" },
  { re: /\b(electric|wiring|termination|panel)/, task: "Electrical work" },
  { re: /\b(scaffold|height|roof|edge)/, task: "Work at height" },
  { re: /\b(confined|tank|vessel|manhole)/, task: "Confined space entry" },
  { re: /\b(forklift|pedestrian|traffic)/, task: "Vehicle / pedestrian movement" },
];

function titleFrom(text: string): string {
  const firstSentence = text.split(/[.!?\n]/)[0].trim();
  const words = firstSentence.split(/\s+/).slice(0, 12).join(" ");
  return words.length >= 4 ? words.charAt(0).toUpperCase() + words.slice(1) : "Field observation";
}

export function extractCellDraft(text: string): ExtractResult {
  const t = ` ${text.toLowerCase()} `;
  const signals: string[] = [];

  let energy = "motion";
  let exposure = "struck_by";
  for (const r of HAZARD_RULES) {
    if (r.re.test(t)) {
      if (r.energy) energy = r.energy;
      if (r.exposure) exposure = r.exposure;
      signals.push(r.signal);
      break;
    }
  }

  let gap = "unverified";
  for (const r of GAP_RULES) {
    if (r.re.test(t)) { gap = r.gap; signals.push(r.signal); break; }
  }

  let severity: Severity = "medium";
  for (const r of SEVERITY_RULES) {
    if (r.re.test(t)) { severity = r.sev; signals.push(`severity: ${r.sev}`); break; }
  }

  let task = "";
  for (const r of TASK_RULES) {
    if (r.re.test(t)) { task = r.task; break; }
  }
  if (!task) task = "General work activity";

  const likelihood = severity === "critical" ? 4 : severity === "high" ? 3 : 2;
  const confidence = Math.min(0.9, 0.4 + signals.length * 0.15);

  return {
    draft: {
      title: titleFrom(text),
      description: text.trim(),
      task,
      severity: SEVERITIES.includes(severity) ? severity : "medium",
      likelihood,
      hazard_genome: { energySource: energy, exposureType: exposure, trigger: "observed condition", controlGap: gap, environment: "" },
    },
    confidence,
    signals,
  };
}

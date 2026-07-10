// Pure, I/O-free decision logic for the Young-Worker task-assignment gate.
//
// Kept free of Supabase / React / server-only imports on purpose so the whole
// decision surface can be unit-tested in the repo's Node vitest environment
// (same pattern as src/lib/nav/activeKey.ts). The server action in
// src/lib/actions/task-assignment-gate.ts does the DB I/O and delegates the
// actual decision to decideGate() here.

export type Classification =
  | "paid_intern"
  | "unpaid_intern"
  | "student_learner"
  | "youth_apprentice"
  | "job_shadow"
  | "volunteer"
  | "temp";

// Only the fields the decision needs — a subset of the young_workers row.
export type GateProfile = {
  dob: string;                         // ISO date
  work_state: string;                  // 2-letter
  classification: Classification;
  work_permit_expiry_date?: string | null;
  ca_permit_to_employ_number?: string | null;
  ca_permit_to_work_number?: string | null;
};

export type HazardousTaskRule = {
  id: string;
  jurisdiction: string;                // 'FEDERAL' | 'WI' | 'CA' | ...
  task_code: string;
  task_label: string;
  min_age: number;
  equipment_codes: string[];
  student_learner_exception: boolean;
  requires_supervision: boolean;
  is_prohibited: boolean;
  source_citation?: string | null;
};

export type GateInput = {
  taskCode: string;
  equipmentCode?: string;
  scheduledAt: string;                 // ISO datetime the work is to start
  supervisionDocumented?: boolean;
};

export type GateDecision = {
  decision: "allowed" | "blocked" | "allowed_with_alert";
  reasons: string[];
  ruleIdsMatched: string[];
};

// Whole-years age at a given instant, no external date lib.
export function computeAge(dobISO: string, atISO: string): number {
  const dob = new Date(dobISO);
  const at = new Date(atISO);
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const m = at.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

// blocked > allowed_with_alert > allowed. Once blocked, nothing downgrades it.
function escalate(
  current: GateDecision["decision"],
  next: GateDecision["decision"],
): GateDecision["decision"] {
  const rank = { allowed: 0, allowed_with_alert: 1, blocked: 2 } as const;
  return rank[next] > rank[current] ? next : current;
}

/**
 * Evaluate a proposed task assignment for a young worker against the hazardous
 * task rules that apply to them (federal + their work-state overlay). Pure —
 * every input is passed in; nothing is read or written here.
 */
export function decideGate(
  profile: GateProfile,
  rules: HazardousTaskRule[],
  input: GateInput,
): GateDecision {
  const age = computeAge(profile.dob, input.scheduledAt);
  const reasons: string[] = [];
  const ruleIdsMatched: string[] = [];
  let decision: GateDecision["decision"] = "allowed";

  const applicable = rules.filter(
    (r) =>
      r.task_code === input.taskCode &&
      (r.jurisdiction === "FEDERAL" || r.jurisdiction === profile.work_state),
  );

  for (const rule of applicable) {
    // A rule with equipment_codes only bites when the work uses that equipment.
    const equipmentMatch =
      rule.equipment_codes.length === 0 ||
      !input.equipmentCode ||
      rule.equipment_codes.includes(input.equipmentCode);
    if (!equipmentMatch) continue;

    if (age >= rule.min_age) continue;

    ruleIdsMatched.push(rule.id);

    const studentLearnerOk =
      rule.student_learner_exception &&
      (profile.classification === "student_learner" ||
        profile.classification === "youth_apprentice") &&
      !!input.supervisionDocumented;

    if (studentLearnerOk) {
      decision = escalate(decision, "allowed_with_alert");
      reasons.push(
        `Allowed under the supervised student-learner / youth-apprentice exception for ${rule.task_label}. Documented supervision required for the whole assignment (${rule.source_citation ?? rule.jurisdiction}).`,
      );
    } else if (rule.is_prohibited) {
      decision = escalate(decision, "blocked");
      const why =
        rule.student_learner_exception &&
        (profile.classification === "student_learner" ||
          profile.classification === "youth_apprentice")
          ? " Documented supervision is required to use the student-learner exception."
          : "";
      reasons.push(
        `Blocked: ${rule.task_label} is prohibited for workers under ${rule.min_age} (${rule.source_citation ?? rule.jurisdiction}).${why}`,
      );
    }
  }

  // Work permit must not be expired as of the scheduled start.
  if (profile.work_permit_expiry_date) {
    const expired =
      new Date(profile.work_permit_expiry_date).getTime() <
      new Date(input.scheduledAt).getTime();
    if (expired) {
      decision = escalate(decision, "blocked");
      reasons.push("Blocked: the worker's work permit has expired.");
    }
  }

  // California: both the Permit to Employ and the Permit to Work must be on file
  // before the first shift.
  if (
    profile.work_state === "CA" &&
    (!profile.ca_permit_to_employ_number || !profile.ca_permit_to_work_number)
  ) {
    decision = escalate(decision, "blocked");
    reasons.push(
      "Blocked: California Permit to Employ and Permit to Work must both be on file before the first shift.",
    );
  }

  return { decision, reasons, ruleIdsMatched };
}

// Federal hazardous-occupation baseline, mirrored from the migration seed so the
// gate can still evaluate in mock mode (where there is no database) and so tests
// have a fixed, legally-annotated rule set. ILLUSTRATIVE — see the migration.
export const FEDERAL_HAZARDOUS_RULES: HazardousTaskRule[] = [
  {
    id: "fed-roofing",
    jurisdiction: "FEDERAL",
    task_code: "ROOFING",
    task_label: "Roofing work and work on or near a roof",
    min_age: 18,
    equipment_codes: ["roofing_equipment"],
    student_learner_exception: true,
    requires_supervision: true,
    is_prohibited: true,
    source_citation: "FLSA HO 16 / 29 CFR 570.67",
  },
  {
    id: "fed-demolition",
    jurisdiction: "FEDERAL",
    task_code: "DEMOLITION",
    task_label: "Wrecking, demolition, and shipbreaking",
    min_age: 18,
    equipment_codes: [],
    student_learner_exception: false,
    requires_supervision: false,
    is_prohibited: true,
    source_citation: "FLSA HO 15 / 29 CFR 570.66",
  },
  {
    id: "fed-trenching",
    jurisdiction: "FEDERAL",
    task_code: "TRENCHING",
    task_label: "Excavation / trenching operations",
    min_age: 18,
    equipment_codes: ["trench_box", "excavator"],
    student_learner_exception: true,
    requires_supervision: true,
    is_prohibited: true,
    source_citation: "FLSA HO 17 / 29 CFR 570.68",
  },
  {
    id: "fed-forklift",
    jurisdiction: "FEDERAL",
    task_code: "FORKLIFT",
    task_label: "Operating power-driven hoisting apparatus (forklift)",
    min_age: 18,
    equipment_codes: ["forklift"],
    student_learner_exception: false,
    requires_supervision: false,
    is_prohibited: true,
    source_citation: "FLSA HO 7 / 29 CFR 570.58",
  },
  {
    id: "fed-skid-steer",
    jurisdiction: "FEDERAL",
    task_code: "SKID_STEER",
    task_label: "Operating skid-steer / power-driven earth-moving equipment",
    min_age: 18,
    equipment_codes: ["skid_steer"],
    student_learner_exception: false,
    requires_supervision: false,
    is_prohibited: true,
    source_citation: "FLSA HO 7 / 29 CFR 570.58",
  },
];

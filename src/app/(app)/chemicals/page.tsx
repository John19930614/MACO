import { getChemicals, getTrainingCourses } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { BrainCircuit, GraduationCap, Zap } from "lucide-react";
import { ChemicalsTable } from "./ChemicalsTable";
import { AddChemicalButton } from "./AddChemicalButton";
import type { Chemical, TrainingCourse } from "@/lib/types";

const HIGH_HAZARD_H = ["H350", "H351", "H300", "H310", "H311", "H330", "H331"];

function sdsStatus(c: { sds_url: string | null; sds_expiry: string | null }) {
  if (!c.sds_url) return "missing";
  if (!c.sds_expiry) return "on_file";
  const exp = new Date(c.sds_expiry);
  const now = new Date();
  if (exp < now) return "expired";
  if (exp.getTime() - now.getTime() < 90 * 24 * 60 * 60 * 1000) return "expiring";
  return "on_file";
}

// ── GHS H-code → required training course_type mapping ───────────────────────
// Each rule: which H-code prefix triggers which course types
const H_TRAINING_RULES: { test: (h: string) => boolean; types: string[]; hazardLabel: string }[] = [
  { test: (h) => /^H2[0-6]/.test(h),          types: ["fire_safety"],        hazardLabel: "Flammable / Explosive" },
  { test: (h) => /^H27/.test(h),              types: ["fire_safety"],        hazardLabel: "Oxidizing" },
  { test: (h) => /^H(30[0-2]|31[0-2]|33[0-2])/.test(h), types: ["chemical", "ppe"], hazardLabel: "Acute Toxicity" },
  { test: (h) => /^H(314|315|317|318|319)/.test(h),      types: ["chemical", "ppe"], hazardLabel: "Corrosive / Irritant" },
  { test: (h) => /^H(334|335)/.test(h),       types: ["chemical"],           hazardLabel: "Respiratory Sensitizer" },
  { test: (h) => /^H(340|341)/.test(h),       types: ["chemical"],           hazardLabel: "Mutagen" },
  { test: (h) => /^H(350|351)/.test(h),       types: ["chemical"],           hazardLabel: "Carcinogen" },
  { test: (h) => /^H(360|361)/.test(h),       types: ["chemical"],           hazardLabel: "Reproductive Hazard" },
  { test: (h) => /^H(370|371|372|373)/.test(h), types: ["chemical"],         hazardLabel: "Target Organ Toxin" },
  { test: (h) => /^H4/.test(h),               types: ["chemical"],           hazardLabel: "Aquatic / Environmental" },
];

interface TriggeredCourse {
  course: TrainingCourse;
  triggeringHazards: string[];   // human-readable hazard labels
  triggeringChemicals: string[]; // chemical names
}

function buildTriggeredCourses(chemicals: Chemical[], courses: TrainingCourse[]): TriggeredCourse[] {
  // For each course type, find which H-codes trigger it and which chemicals carry those codes
  const courseTypeMap = new Map<string, { hazards: Set<string>; chemicals: Set<string> }>();

  for (const chem of chemicals) {
    for (const h of chem.hazard_statements) {
      for (const rule of H_TRAINING_RULES) {
        if (rule.test(h)) {
          for (const ct of rule.types) {
            if (!courseTypeMap.has(ct)) courseTypeMap.set(ct, { hazards: new Set(), chemicals: new Set() });
            courseTypeMap.get(ct)!.hazards.add(rule.hazardLabel);
            courseTypeMap.get(ct)!.chemicals.add(chem.name);
          }
        }
      }
    }
  }

  // Match triggered course types to actual courses in the DB/store
  const result: TriggeredCourse[] = [];
  for (const course of courses) {
    const match = courseTypeMap.get(course.course_type);
    if (match) {
      result.push({
        course,
        triggeringHazards:   Array.from(match.hazards),
        triggeringChemicals: Array.from(match.chemicals).slice(0, 4),
      });
    }
  }
  return result;
}

const COURSE_TYPE_COLOR: Record<string, string> = {
  fire_safety: "bg-orange-100 text-orange-700",
  chemical:    "bg-red-100 text-red-700",
  ppe:         "bg-blue-100 text-blue-700",
  emergency:   "bg-amber-100 text-amber-700",
  equipment:   "bg-slate-100 text-slate-600",
  compliance:  "bg-purple-100 text-purple-700",
  induction:   "bg-teal-100 text-teal-700",
};

export default async function ChemicalsPage() {
  const [chemicals, courses] = await Promise.all([getChemicals(), getTrainingCourses()]);

  const highHazard = chemicals.filter(
    (c) =>
      c.is_scheduled ||
      c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh))),
  );
  const sdsOnFile  = chemicals.filter((c) => sdsStatus(c) === "on_file").length;
  const sdsProblem = chemicals.filter((c) => {
    const s = sdsStatus(c);
    return s === "missing" || s === "expired";
  }).length;

  const triggeredCourses = buildTriggeredCourses(chemicals, courses);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Chemical Management"
        subtitle="Inventory-driven AI hazard classification · SDS management · Training chain · Waste profiles"
        actions={<AddChemicalButton />}
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Chemicals"     value={chemicals.length} hint="Active inventory" />
          <Stat label="AI High-Hazard Flags" value={highHazard.length} hint="Immediate attention needed" accent="#dc2626" />
          <Stat label="SDS on File"         value={sdsOnFile}  hint="Current & valid"   accent="#10b981" />
          <Stat label="SDS Missing / Expired" value={sdsProblem} hint="Required by HazCom" accent={sdsProblem > 0 ? "#dc2626" : "#10b981"} />
        </div>

        {/* AI scan alert */}
        {highHazard.length > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border-l-4 border-violet-500 bg-violet-50 p-4">
            <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-violet-900">
                AI Inventory Scan — {highHazard.length} High-Hazard Flag{highHazard.length > 1 ? "s" : ""} Raised
              </div>
              <div className="mt-0.5 text-xs text-violet-700">
                {highHazard.map((c) => c.name).join(", ")}. Training triggers reviewed. Waste profiles auto-generated.
              </div>
            </div>
          </div>
        )}

        {/* ── Inventory-driven training chain ──────────────────────────────── */}
        {triggeredCourses.length > 0 && (
          <Card className="mb-5">
            <CardHeader
              title="Training Requirements Triggered by Inventory"
              subtitle={`${triggeredCourses.length} course${triggeredCourses.length !== 1 ? "s" : ""} required — automatically identified from GHS hazard classes in your chemical inventory`}
              right={
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  <Zap className="h-3 w-3" />
                  Inventory-driven
                </div>
              }
            />
            <div className="divide-y divide-slate-50">
              {triggeredCourses.map(({ course, triggeringHazards, triggeringChemicals }) => (
                <div key={course.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{course.title}</span>
                      <Pill className={COURSE_TYPE_COLOR[course.course_type] ?? "bg-slate-100 text-slate-600"}>
                        {course.course_type.replace(/_/g, " ")}
                      </Pill>
                      {course.validity_period_days && (
                        <Pill className="bg-slate-100 text-slate-500">
                          Valid {course.validity_period_days}d
                        </Pill>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-slate-500">
                      <span>
                        <span className="font-medium text-slate-600">Hazards: </span>
                        {triggeringHazards.join(" · ")}
                      </span>
                      <span>
                        <span className="font-medium text-slate-600">From: </span>
                        {triggeringChemicals.join(", ")}
                        {triggeringChemicals.length === 4 && " …"}
                      </span>
                    </div>
                  </div>
                  {course.regulatory_ref && (
                    <div className="shrink-0 text-[10.5px] text-slate-400 font-mono">{course.regulatory_ref}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Inventory table */}
        <Card>
          <CardHeader
            title="Chemical Inventory"
            subtitle={`${chemicals.length} chemicals · ${highHazard.length} high-hazard · ${sdsProblem} SDS issues`}
          />
          <ChemicalsTable chemicals={chemicals} />
        </Card>
      </div>
    </div>
  );
}

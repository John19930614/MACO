"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, Upload, X, Printer, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, FileCheck2, ClipboardCheck, Shield,
  Bot, Check,
} from "lucide-react";
import type { Audit, Profile } from "@/lib/types";
import { submitAuditConduct, addCapaFromFinding } from "@/lib/actions/ehs";
import { useDemoUser } from "@/lib/context/demo-user";
import { OSHA_CHECKLISTS } from "./oshaChecklists";

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemResult = "pass" | "partial" | "fail" | "na" | null;

interface Item {
  id: string;
  section: string;
  text: string;
  result: ItemResult;
  notes: string;
  photos: string[];
  requiresEvidence: boolean;
}

export interface SectionTemplate {
  title: string;
  items: { text: string; requiresEvidence?: boolean }[];
}

// ── Checklist Templates ───────────────────────────────────────────────────────

const TEMPLATES: Record<string, SectionTemplate[]> = {
  internal: [
    {
      title: "Emergency Preparedness",
      items: [
        { text: "Emergency evacuation routes posted and unobstructed at all exits", requiresEvidence: true },
        { text: "Fire extinguishers inspected, tagged within 12 months, and accessible" },
        { text: "First aid kits fully stocked and accessible to all employees" },
        { text: "Emergency contact numbers posted at each workstation and lab entry" },
        { text: "Emergency eyewash/shower stations tested within past 7 days", requiresEvidence: true },
        { text: "Emergency action plan current and employees familiar with procedures" },
      ],
    },
    {
      title: "Hazard Communication",
      items: [
        { text: "SDS accessible at all points of chemical use (digital or binder)", requiresEvidence: true },
        { text: "All chemical containers properly labeled with GHS label elements" },
        { text: "HazCom training records current for all employees (within 12 months)" },
        { text: "Incompatible chemicals properly segregated with adequate spacing" },
        { text: "Flammable storage cabinets in use where flammable liquids are present" },
      ],
    },
    {
      title: "Personal Protective Equipment",
      items: [
        { text: "Appropriate PPE available and accessible for all tasks performed" },
        { text: "PPE inspection and maintenance records maintained" },
        { text: "PPE disposal/decontamination procedure established and followed" },
        { text: "Employees observed wearing correct PPE for tasks being performed" },
      ],
    },
    {
      title: "Housekeeping & General Safety",
      items: [
        { text: "Aisles, exits, and egress routes unobstructed (36-inch minimum)", requiresEvidence: true },
        { text: "Floors clean, dry, and free from slip/trip hazards" },
        { text: "Electrical panels have 36-inch clear space in front" },
        { text: "No open food or drink in lab or chemical work areas" },
        { text: "Ladders and step stools in good condition and appropriately rated" },
      ],
    },
    {
      title: "Waste Management",
      items: [
        { text: "Waste containers properly labeled with contents and hazards", requiresEvidence: true },
        { text: "Satellite accumulation areas compliant (containers closed when not adding)" },
        { text: "Waste disposal records current and maintained on site" },
        { text: "Weekly inspection of hazardous waste areas documented" },
      ],
    },
  ],

  regulatory: [
    {
      title: "OSHA Recordkeeping (29 CFR 1904)",
      items: [
        { text: "OSHA 300 Log current, accurate, and available for inspection" },
        { text: "OSHA 300A posted from Feb 1 – Apr 30 of the following year" },
        { text: "Injury/illness reports filed within required timeframes" },
        { text: "Privacy case protections applied appropriately in the 300 Log" },
      ],
    },
    {
      title: "Hazard Communication (29 CFR 1910.1200)",
      items: [
        { text: "Written HazCom program in place and available to employees" },
        { text: "SDS accessible for all chemicals at each point of use", requiresEvidence: true },
        { text: "Container labeling fully compliant with GHS format" },
        { text: "Employee HazCom training documented with dates and topics" },
      ],
    },
    {
      title: "Respiratory Protection (29 CFR 1910.134)",
      items: [
        { text: "Written respiratory protection program in place" },
        { text: "Medical evaluations on file for all respirator users" },
        { text: "Fit testing records current (annual for tight-fitting respirators)" },
        { text: "Respirator inspection, cleaning, and storage records maintained" },
      ],
    },
    {
      title: "Formaldehyde Standard (29 CFR 1910.1048)",
      items: [
        { text: "Exposure monitoring conducted per required schedule" },
        { text: "Medical surveillance program in place for exposed employees" },
        { text: "Hazard warning signs posted in all formaldehyde use areas", requiresEvidence: true },
        { text: "Emergency and spill response procedures posted; employees trained" },
      ],
    },
    {
      title: "Emergency Planning (29 CFR 1910.38)",
      items: [
        { text: "Written Emergency Action Plan (EAP) in place and accessible" },
        { text: "Evacuation drills conducted annually and documented" },
        { text: "Fire prevention plan in place" },
        { text: "Designated assembly areas known to all staff" },
      ],
    },
    {
      title: "PPE Program (29 CFR 1910.132)",
      items: [
        { text: "Hazard assessment for PPE conducted and certified in writing" },
        { text: "PPE selection documented per hazard assessment results" },
        { text: "Employee PPE training records current" },
      ],
    },
  ],

  biosafety: [
    {
      title: "Containment & Facility",
      items: [
        { text: "BSL designation posted at all laboratory entry points", requiresEvidence: true },
        { text: "Access restricted to trained and authorized personnel only" },
        { text: "Self-closing, lockable entry doors in good working order" },
        { text: "Handwashing sink accessible near each laboratory exit" },
        { text: "No carpeting or fabric-covered furniture in laboratory areas" },
      ],
    },
    {
      title: "Biological Safety Cabinets",
      items: [
        { text: "All BSCs certified by accredited certifier within past 12 months", requiresEvidence: true },
        { text: "NSF/ANSI 49 certification records on file and posted at each BSC" },
        { text: "Correct BSC operating technique posted at the cabinet" },
        { text: "Chemical decontamination or UV protocol in use and documented" },
        { text: "BSC sash height mark visible and airflow alarm functional" },
      ],
    },
    {
      title: "Personal Protective Equipment",
      items: [
        { text: "Lab coats worn at all times in laboratory areas" },
        { text: "Gloves appropriate for biohazardous work available and in use" },
        { text: "Eye/face protection available and used when splash risk exists" },
        { text: "Dedicated lab footwear or shoe covers in use" },
        { text: "PPE removed before leaving lab; not worn in common areas" },
      ],
    },
    {
      title: "Waste Decontamination & Sharps Safety",
      items: [
        { text: "Autoclave biological indicator (spore) testing current (weekly or monthly)", requiresEvidence: true },
        { text: "Sharps containers in place and not overfilled (≤ ¾ full)" },
        { text: "Biohazard waste properly labeled, sealed, and segregated" },
        { text: "Liquid waste decontaminated before disposal per written protocol" },
        { text: "Autoclave maintenance and load validation records current" },
      ],
    },
    {
      title: "Training & Documentation",
      items: [
        { text: "Biosafety training current for all lab personnel (annual)" },
        { text: "Institutional Biosafety Committee (IBC) approval current (if applicable)" },
        { text: "Biosafety manual accessible in the laboratory" },
        { text: "Exposure incident response procedure known to all staff" },
        { text: "Bloodborne pathogen training current where exposure risk exists" },
      ],
    },
  ],

  chemical: [
    {
      title: "Chemical Hygiene Plan",
      items: [
        { text: "Written Chemical Hygiene Plan (CHP) in place and accessible to all staff" },
        { text: "CHP reviewed and updated annually with revision date visible" },
        { text: "Chemical Hygiene Officer (CHO) designated and contact info posted" },
        { text: "Particularly Hazardous Substances (PHS) identified in CHP" },
        { text: "Prior-approval procedure in place for PHS work" },
      ],
    },
    {
      title: "Chemical Storage & Segregation",
      items: [
        { text: "Flammables stored in approved FM-rated flammable storage cabinet", requiresEvidence: true },
        { text: "Acids and bases stored separately with secondary containment" },
        { text: "Oxidizers stored away from organics and flammables" },
        { text: "Container size and quantity limits observed per fire code" },
        { text: "Temperature-sensitive chemicals stored at required conditions" },
        { text: "Peroxide-forming chemicals dated on receipt; tested per schedule" },
      ],
    },
    {
      title: "Inventory & Documentation",
      items: [
        { text: "Chemical inventory current, accurate, and includes all chemicals on site" },
        { text: "SDS available for all chemicals in inventory", requiresEvidence: true },
        { text: "Chemicals tracked by expiration or opening date" },
        { text: "Highly toxic or reactive chemicals access-controlled" },
      ],
    },
    {
      title: "Engineering Controls",
      items: [
        { text: "Fume hoods certified by accredited firm within past 12 months", requiresEvidence: true },
        { text: "Fume hood sash height marked at safe working level" },
        { text: "All volatile chemical work conducted inside fume hood or LEV" },
        { text: "Ventilation rates adequate for volume and nature of chemicals used" },
      ],
    },
    {
      title: "Spill Response",
      items: [
        { text: "Chemical spill kits stocked, accessible, and labeled", requiresEvidence: true },
        { text: "Spill response procedures posted at chemical use areas" },
        { text: "Employees trained in spill response with documented records" },
        { text: "Neutralizing agents present for acid/base spill areas" },
      ],
    },
  ],

  waste: [
    {
      title: "Generator Status & Accumulation Limits",
      items: [
        { text: "Generator status classification current and documented" },
        { text: "Accumulation start dates tracked on all hazardous waste containers" },
        { text: "Accumulation time limits not exceeded (SQG: 270 days; LQG: 90 days)" },
        { text: "Total on-site quantity within applicable limits" },
      ],
    },
    {
      title: "Waste Storage Area Conditions",
      items: [
        { text: "Weekly inspections of hazardous waste storage areas documented", requiresEvidence: true },
        { text: "Containers closed when not actively adding waste", requiresEvidence: true },
        { text: "All containers in good condition — no leaks, bulging, or corrosion" },
        { text: "Secondary containment in place for liquid hazardous waste" },
        { text: "Incompatible wastes properly segregated" },
        { text: "Adequate aisle space maintained for inspection" },
      ],
    },
    {
      title: "Labeling & Manifesting",
      items: [
        { text: "All containers labeled 'Hazardous Waste' with contents and hazards" },
        { text: "Accumulation start date on each container label" },
        { text: "Uniform Hazardous Waste Manifests maintained for all shipments" },
        { text: "Land Disposal Restriction (LDR) notifications on file" },
      ],
    },
    {
      title: "Disposal Records & Reporting",
      items: [
        { text: "Disposal records retained for minimum 3 years" },
        { text: "Only licensed/permitted hazardous waste disposal vendors used" },
        { text: "Exception reports filed when required" },
        { text: "Biennial report filed (LQGs only)" },
      ],
    },
  ],

  supplier: [
    {
      title: "Documentation & Qualification",
      items: [
        { text: "Supplier qualification questionnaire completed and on file" },
        { text: "Insurance and liability certificates current" },
        { text: "Regulatory permits and operating licenses verified" },
        { text: "QMS certification verified (ISO 9001 or equivalent, if applicable)" },
      ],
    },
    {
      title: "EHS Management",
      items: [
        { text: "Supplier EHS policy in place and accessible to employees" },
        { text: "EHS incident reporting and investigation procedures defined" },
        { text: "Employee EHS training records maintained" },
        { text: "Hazardous material handling procedures in place and followed" },
      ],
    },
    {
      title: "Site Conditions",
      items: [
        { text: "General housekeeping adequate for operation type", requiresEvidence: true },
        { text: "Emergency equipment in place, accessible, and maintained", requiresEvidence: true },
        { text: "Chemical storage and handling meets regulatory requirements" },
        { text: "Waste management practices compliant with applicable regulations" },
      ],
    },
    {
      title: "Corrective Action History",
      items: [
        { text: "Open corrective actions from prior audits reviewed and on track" },
        { text: "Root cause analysis conducted for significant findings" },
        { text: "Corrective action timelines met" },
      ],
    },
  ],

  system: [
    {
      title: "Policy & Leadership Commitment",
      items: [
        { text: "EHS policy approved by top management and current (reviewed within 3 years)" },
        { text: "EHS roles, responsibilities, and authorities defined and communicated" },
        { text: "Management review of EHS system conducted at planned intervals" },
        { text: "EHS objectives documented, measured, and tracked" },
      ],
    },
    {
      title: "Risk Assessment & Planning",
      items: [
        { text: "Hazard identification and risk assessment process in place" },
        { text: "Legal and regulatory compliance obligations identified and current" },
        { text: "EHS programs established to address significant risks" },
        { text: "Management of change (MOC) procedure in place" },
      ],
    },
    {
      title: "Operational Controls",
      items: [
        { text: "Documented procedures for all significant EHS aspects" },
        { text: "Contractor EHS management process established and followed" },
        { text: "Emergency preparedness and response plans current and tested" },
        { text: "Operational controls verified as effective" },
      ],
    },
    {
      title: "Monitoring & Continual Improvement",
      items: [
        { text: "EHS KPIs tracked and reviewed regularly by management" },
        { text: "Internal audit program active; findings closed on schedule" },
        { text: "CAPA system functioning; root cause analysis conducted" },
        { text: "Incidents investigated; findings used to prevent recurrence" },
        { text: "System performance reviewed against objectives" },
      ],
    },
  ],

  process: [
    {
      title: "Process Documentation",
      items: [
        { text: "Process descriptions, flow diagrams, and P&IDs current" },
        { text: "SOPs in place for all critical process steps" },
        { text: "Process parameters and critical limits defined" },
        { text: "Deviation handling and out-of-spec procedures established" },
      ],
    },
    {
      title: "Equipment & Safety Controls",
      items: [
        { text: "Equipment calibration and preventive maintenance current", requiresEvidence: true },
        { text: "Safety interlocks and alarms functional and tested" },
        { text: "Pressure relief and venting systems adequate and uninhibited" },
        { text: "Emergency shutdown procedures known to all operators" },
      ],
    },
    {
      title: "Hazard Controls",
      items: [
        { text: "Chemical hazards identified and engineering/admin controls in place" },
        { text: "Reaction hazards reviewed (e.g., exotherm, pressure buildup) and mitigated" },
        { text: "Temperature and pressure monitoring/controls verified" },
        { text: "Secondary containment adequate for maximum process quantities" },
      ],
    },
    {
      title: "Change Management",
      items: [
        { text: "Management of Change (MOC) procedure followed for all process changes" },
        { text: "Pre-startup safety review (PSSR) conducted for new/modified processes" },
        { text: "Process changes documented, approved, and communicated" },
        { text: "Operators trained on all process changes before implementation" },
      ],
    },
  ],
};

// ── AI CAPA Suggestion ────────────────────────────────────────────────────────

interface CapaSuggestion {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  root_cause: string;
  verification_method: string;
  daysToResolve: number;
}

interface CapaQueueEntry {
  status: "loading" | "ready";
  suggestion: CapaSuggestion | null;
  accepted: boolean;
  editedTitle: string;
}

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
};

const SEV_DAYS: Record<string, number> = { critical: 7, high: 30, medium: 60, low: 90 };

function generateCapaSuggestion(item: Item): CapaSuggestion {
  const hay = `${item.section} ${item.text}`.toLowerCase();

  // ── Critical ──────────────────────────────────────────────────────────────
  if (/eyewash|emergency shower/.test(hay))
    return {
      title: "Emergency Eyewash/Shower — Restore Compliance",
      description: "Emergency eyewash/shower station failed inspection. Ensure equipment is functional, tested weekly, and accessible within 10 seconds of all chemical use areas per 29 CFR 1910.151.",
      severity: "critical", daysToResolve: 3,
      root_cause: "Preventive maintenance lapse — eyewash/shower testing not scheduled or documented.",
      verification_method: "EHS manager physically tests station; documents results in the eyewash/shower log; re-audits within 5 days.",
    };
  if (/sharps.*¾|sharps.*overfill|overfill.*sharps/.test(hay))
    return {
      title: "Sharps Container — Replace Overfilled Container",
      description: "One or more sharps containers exceeds safe fill line. Replace immediately to prevent needlestick injuries per 29 CFR 1910.1030.",
      severity: "critical", daysToResolve: 1,
      root_cause: "No routine sharps container inspection schedule; no assigned responsibility for monitoring fill levels.",
      verification_method: "All sharps containers confirmed ≤¾ full; container checks added to weekly safety inspection.",
    };
  if (/accumulation.*time|time.*limit|90.day|270.day/.test(hay))
    return {
      title: "RCRA — Resolve Accumulation Time Exceedance",
      description: "Hazardous waste has exceeded the applicable accumulation limit (SQG 270 days / LQG 90 days) per 40 CFR 262. Ship to permitted TSDF immediately.",
      severity: "critical", daysToResolve: 5,
      root_cause: "Waste shipment scheduling not tied to accumulation start dates; no alert system for approaching limits.",
      verification_method: "Waste shipped to licensed TSDF; manifest on file; tracking system flags containers approaching limits.",
    };
  if (/bsc.*certif|certif.*bsc|biological safety cabinet.*certif/.test(hay))
    return {
      title: "BSC Certification — Schedule Immediate Recertification",
      description: "One or more Biological Safety Cabinets lacks current NSF/ANSI 49 certification. No biological work may occur in uncertified BSCs.",
      severity: "critical", daysToResolve: 14,
      root_cause: "BSC certification due dates not tracked in equipment PM system; no automated reminder.",
      verification_method: "Accredited certifier provides written report; certification posted at each BSC; copies filed in EHS system.",
    };
  if (/regulated area.*formaldehyde|formaldehyde.*sign|warning sign.*formaldehyde/.test(hay))
    return {
      title: "Formaldehyde — Post OSHA-Required Warning Signs",
      description: "Warning signs for formaldehyde regulated areas are missing or non-compliant. Signs must state: DANGER — FORMALDEHYDE — IRRITANT AND POTENTIAL CANCER HAZARD per 29 CFR 1910.1048.",
      severity: "critical", daysToResolve: 3,
      root_cause: "Area setup did not include required hazard signage; no periodic signage audit in place.",
      verification_method: "Compliant signs posted at all formaldehyde area entrances; photographed for the audit record.",
    };

  // ── High ──────────────────────────────────────────────────────────────────
  if (/sds.*accessible|accessible.*sds|sds.*available/.test(hay))
    return {
      title: "SDS — Restore Point-of-Use Access",
      description: "Safety Data Sheets are not accessible at the point of chemical use. SDS must be immediately available during all shifts per 29 CFR 1910.1200(g). Implement binders and/or digital access at each work station.",
      severity: "high", daysToResolve: 14,
      root_cause: "SDS management system not maintained; no designated owner for keeping point-of-use binders current.",
      verification_method: "Spot-check confirms SDS available for 10 randomly selected chemicals at their use locations.",
    };
  if (/fume hood.*certif|certif.*fume hood/.test(hay))
    return {
      title: "Chemical Fume Hood — Schedule Annual Certification",
      description: "One or more fume hoods lacks valid certification. Volatile chemical work must halt in uncertified hoods per 29 CFR 1910.1450 and the Chemical Hygiene Plan.",
      severity: "high", daysToResolve: 21,
      root_cause: "Fume hood certification dates not tracked in equipment PM; responsibility not clearly assigned.",
      verification_method: "Accredited certifier provides written report with face velocity data; report filed in CHP documentation.",
    };
  if (/exposure monitoring|air sampling/.test(hay))
    return {
      title: "Exposure Monitoring — Conduct Required Air Sampling",
      description: "Occupational exposure monitoring is not conducted or overdue. Industrial hygiene air sampling must characterize employee exposures per applicable OSHA standards.",
      severity: "high", daysToResolve: 30,
      root_cause: "Industrial hygiene monitoring program not established or allowed to lapse.",
      verification_method: "Industrial hygienist completes air sampling; results documented; employees notified within 15 working days.",
    };
  if (/respiratory protection program|respirator.*program|written.*respirator/.test(hay))
    return {
      title: "Respiratory Protection — Establish Written Program",
      description: "Written Respiratory Protection Program meeting 29 CFR 1910.134 requirements is missing or incomplete. Must designate administrator and cover selection, use, maintenance, fit testing, and training.",
      severity: "high", daysToResolve: 30,
      root_cause: "Respirator use expanded without formal program development; no designated program administrator.",
      verification_method: "Written program approved; administrator designated in writing; all current users trained.",
    };
  if (/fit test/.test(hay))
    return {
      title: "Respiratory Protection — Complete Annual Fit Testing",
      description: "Fit testing records are not current for one or more respirator users per 29 CFR 1910.134. Tight-fitting respirators may not be used until fit testing is current.",
      severity: "high", daysToResolve: 21,
      root_cause: "No automated tracking for fit test due dates; annual reminders not sent to affected employees.",
      verification_method: "Fit test records updated for all users; next-due dates entered in EHS calendar with 30-day advance reminder.",
    };
  if (/hbv|hepatitis.*b|vaccination.*offer/.test(hay))
    return {
      title: "Bloodborne Pathogens — Offer HBV Vaccination",
      description: "HBV vaccination must be offered at no cost to all employees with occupational exposure within 10 working days of assignment per 29 CFR 1910.1030(f)(2).",
      severity: "high", daysToResolve: 14,
      root_cause: "Onboarding process does not include automatic HBV vaccination referral to occupational health.",
      verification_method: "Vaccination records or signed declination forms on file for 100% of employees with occupational exposure.",
    };
  if (/post.exposure|exposure.*evaluation/.test(hay))
    return {
      title: "Bloodborne Pathogens — Document Post-Exposure Procedure",
      description: "Written post-exposure evaluation and follow-up procedure is missing from the Exposure Control Plan per 29 CFR 1910.1030(f)(3).",
      severity: "high", daysToResolve: 21,
      root_cause: "Exposure Control Plan not fully developed to include post-exposure medical management protocols.",
      verification_method: "ECP updated with post-exposure procedures; occupational health provider agreement in place; employees informed.",
    };
  if (/chemical hygiene plan|chp.*review/.test(hay))
    return {
      title: "Chemical Hygiene Plan — Update and Re-Review",
      description: "The CHP has not been reviewed within the past 12 months or lacks required content. Annual review by the CHO is required per 29 CFR 1910.1450(e)(3)(ii).",
      severity: "high", daysToResolve: 30,
      root_cause: "Annual CHP review not scheduled as a recurring task; CHO responsibilities not formally communicated.",
      verification_method: "CHP revision date updated; CHO signature on record; revision distributed to all lab personnel.",
    };
  if (/osha 300|300 log|300a|annual summary/.test(hay))
    return {
      title: "OSHA Recordkeeping — Correct 300 Log Deficiency",
      description: "OSHA 300 Log deficiency identified. Log must be current, accurate, accessible, and meet privacy case requirements per 29 CFR 1904. Records are subject to OSHA inspection.",
      severity: "high", daysToResolve: 14,
      root_cause: "Recordkeeping responsibility not clearly assigned; no verification process for timely and accurate injury entry.",
      verification_method: "Log reviewed against incident records; all recordable cases entered; accuracy certified by company executive.",
    };
  if (/hazardous waste.*label|container.*label.*hazardous|label.*accumulation/.test(hay))
    return {
      title: "RCRA — Correct Hazardous Waste Container Labeling",
      description: "Waste containers lack 'Hazardous Waste' label, contents description, or accumulation start date per 40 CFR 262. Correct all containers immediately.",
      severity: "high", daysToResolve: 7,
      root_cause: "No standardized labeling procedure or pre-printed labels at satellite accumulation areas.",
      verification_method: "All containers inspected and confirmed fully labeled; pre-printed label system implemented.",
    };

  // ── Medium ────────────────────────────────────────────────────────────────
  if (/training.*record|record.*training|training.*document|annual.*training/.test(hay))
    return {
      title: `${item.section} — Document Required Training`,
      description: `Training records are missing, outdated, or incomplete for ${item.section}. Training must be conducted and documented with names, dates, topics, and trainer signature.`,
      severity: "medium", daysToResolve: 45,
      root_cause: "No centralized training tracking system; training due dates not monitored or communicated to supervisors.",
      verification_method: "Training records updated in LMS or manual log; all affected employees confirmed complete.",
    };
  if (/hazard assessment|ppe.*assessment|assessment.*ppe/.test(hay))
    return {
      title: "PPE — Complete Written Hazard Assessment",
      description: "Written PPE hazard assessment not completed or certified. Assessment must identify all hazards and be signed/dated by an authorized person per 29 CFR 1910.132(d)(2).",
      severity: "medium", daysToResolve: 30,
      root_cause: "PPE program not formally established; written assessment never initiated or not updated after process changes.",
      verification_method: "Written hazard assessment completed, signed, and dated; PPE selection documented per assessment findings.",
    };
  if (/emergency action plan|eap|evacuation.*plan/.test(hay))
    return {
      title: "Emergency Action Plan — Review and Update EAP",
      description: "EAP is missing, outdated, or not reviewed with employees per 29 CFR 1910.38. EAP must be current and all employees informed of roles and procedures.",
      severity: "medium", daysToResolve: 30,
      root_cause: "EAP review not in annual EHS calendar; responsibilities not communicated during onboarding.",
      verification_method: "EAP reviewed, signed by management, distributed; employees acknowledge receipt; drill conducted and documented.",
    };
  if (/secondary containment/.test(hay))
    return {
      title: "Hazardous Waste — Install Secondary Containment",
      description: "Secondary containment is absent or inadequate for liquid hazardous waste storage. Must hold 110% of the largest container or 10% of total stored volume.",
      severity: "medium", daysToResolve: 45,
      root_cause: "Facility design did not include secondary containment; modification not prioritized.",
      verification_method: "Secondary containment installed; capacity verified; inspected by EHS manager and documented.",
    };
  if (/inspection.*document|weekly.*inspection/.test(hay))
    return {
      title: "Waste Storage — Restore Weekly Inspection Documentation",
      description: "Weekly hazardous waste storage area inspection records are missing or not current. RCRA requires documented weekly inspections per 40 CFR 262.",
      severity: "medium", daysToResolve: 14,
      root_cause: "Inspection responsibility not assigned; no standardized form or reminder system in place.",
      verification_method: "Completed inspection forms on file; inspection schedule assigned to named individual.",
    };
  if (/medical.*surveil|surveil.*medical/.test(hay))
    return {
      title: "Medical Surveillance — Enroll Exposed Employees",
      description: "Medical surveillance program is missing or exposed employees have not been enrolled. Exams and records must be provided and maintained per applicable OSHA standards.",
      severity: "medium", daysToResolve: 45,
      root_cause: "Medical surveillance obligations not identified during regulatory gap analysis; occupational health provider not contracted.",
      verification_method: "Occupational health provider engaged; affected employees scheduled for exams; records initiated.",
    };
  if (/evacuation.*route|route.*evacuation|exit sign/.test(hay))
    return {
      title: "Emergency Preparedness — Update Evacuation Route Postings",
      description: "Evacuation routes are not posted, inaccurate, or exit signage is missing. Routes must be clearly marked per 29 CFR 1910.37 and the EAP.",
      severity: "medium", daysToResolve: 14,
      root_cause: "Facility changes not reflected in posted evacuation maps; no periodic signage review.",
      verification_method: "Updated maps posted at all locations; all exit signs confirmed illuminated and visible.",
    };
  if (/label|labeling/.test(hay))
    return {
      title: "HazCom — Correct Container Labeling Deficiency",
      description: `Chemical containers are missing required GHS label elements in ${item.section}. Labels must include pictogram, signal word, hazard statements, precautionary statements, and supplier info per 29 CFR 1910.1200(f).`,
      severity: "medium", daysToResolve: 21,
      root_cause: "GHS labeling requirements not integrated into chemical receipt and storage procedures.",
      verification_method: "All containers verified to have complete GHS labels; labeling procedure added to chemical SOP.",
    };

  // ── Low ───────────────────────────────────────────────────────────────────
  if (/aisle|egress|obstruct/.test(hay))
    return {
      title: "Housekeeping — Clear Aisle and Egress Obstructions",
      description: "Aisles or egress routes are obstructed below the required 36-inch minimum clearance. All obstructions must be removed immediately.",
      severity: "low", daysToResolve: 7,
      root_cause: "Insufficient storage causing temporary aisle placement; housekeeping schedule not enforced.",
      verification_method: "Walk-through confirms all aisles clear; minimum width measured and documented; added to monthly inspection.",
    };
  if (/inventory/.test(hay))
    return {
      title: "HazCom — Update Chemical Inventory",
      description: "Chemical inventory is not current or does not include all chemicals on site. A complete inventory is the foundation of the HazCom program per 29 CFR 1910.1200(e).",
      severity: "low", daysToResolve: 30,
      root_cause: "No process for adding chemicals to inventory at receipt; no periodic verification scheduled.",
      verification_method: "Physical inventory walk-through completed; updated and cross-referenced to SDS binder; dated and signed.",
    };

  // ── Generic fallback ──────────────────────────────────────────────────────
  return {
    title: `${item.section} — Corrective Action Required`,
    description: `Audit finding: "${item.text.slice(0, 120)}" — corrective action required to achieve compliance. Implement controls, update procedures, and train affected employees.`,
    severity: "medium", daysToResolve: 45,
    root_cause: "Compliance gap identified during scheduled audit; root cause to be determined through investigation.",
    verification_method: `Re-inspect ${item.section} within 30 days to confirm corrective action is implemented and effective.`,
  };
}

function detectTemplate(audit: Audit): string {
  const haystack = `${audit.title} ${audit.scope ?? ""}`.toLowerCase();
  if (/biosafety|bsl|biological safety|lab safety|containment/.test(haystack)) return "biosafety";
  if (/chemical hygiene|hazcom|formaldehyde|fume hood/.test(haystack)) return "chemical";
  if (/waste|rcra|disposal|satellite accumulation/.test(haystack)) return "waste";
  if (/training|competency|certification/.test(haystack)) return "training";
  return audit.type in TEMPLATES ? audit.type : "internal";
}

function buildItems(audit: Audit): Item[] {
  const template = TEMPLATES[detectTemplate(audit)] ?? TEMPLATES.internal;
  return template.flatMap((section, si) =>
    section.items.map((itm, ii) => ({
      id: `${si}-${ii}`,
      section: section.title,
      text: itm.text,
      result: null as ItemResult,
      notes: "",
      photos: [] as string[],
      requiresEvidence: itm.requiresEvidence ?? false,
    })),
  );
}

// Build the blank checklist for a given OSHA standard (or fall back to the
// audit's default template when no/unknown standard is selected).
function buildItemsFor(audit: Audit, oshaCode: string): Item[] {
  if (oshaCode) {
    const checklist = OSHA_CHECKLISTS.find((c) => c.code === oshaCode);
    if (checklist) {
      return checklist.sections.flatMap((section, si) =>
        section.items.map((itm, ii) => ({
          id: `osha-${si}-${ii}`,
          section: section.title,
          text: itm.text,
          result: null as ItemResult,
          notes: "",
          photos: [] as string[],
          requiresEvidence: itm.requiresEvidence ?? false,
        })),
      );
    }
  }
  return buildItems(audit);
}

interface SavedItem {
  id: string;
  section: string;
  text: string;
  result: ItemResult;
  notes: string;
  photos?: string[];
  photoCount?: number;
}

interface SavedAudit {
  conductedBy?: string;
  conductedDate?: string;
  score?: number;
  overallNotes?: string;
  items?: SavedItem[];
  oshaStandard?: { code: string; title: string; cfr: string } | null;
}

// The submit action stores the full conduct snapshot in `audit.notes` as JSON.
// `items` was persisted either as a bare array OR nested as
// { oshaStandard, items: [...] } — normalize both so callers always get a
// flat SavedItem[] and a top-level oshaStandard.
function parseSavedAudit(audit: Audit): SavedAudit {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON.parse returns an untyped blob of persisted audit notes; typed as any and narrowed field-by-field below
    const p: any = JSON.parse(audit.notes ?? "{}");
    if (!p || typeof p !== "object") return {};
    let items: SavedItem[] | undefined;
    let osha = p.oshaStandard ?? null;
    if (Array.isArray(p.items)) {
      items = p.items;
    } else if (p.items && Array.isArray(p.items.items)) {
      items = p.items.items;
      osha = osha ?? p.items.oshaStandard ?? null;
    }
    return {
      conductedBy: p.conductedBy,
      conductedDate: p.conductedDate,
      score: p.score,
      overallNotes: p.overallNotes,
      items,
      oshaStandard: osha,
    };
  } catch {
    return {};
  }
}

// Rebuild the checklist items for a completed audit by overlaying the saved
// results/notes/photos onto the blank template. Falls back to a pure
// reconstruction from the saved snapshot when the template ids no longer line up.
function hydrateItems(audit: Audit, saved: SavedAudit, oshaCode: string): Item[] {
  const base = buildItemsFor(audit, oshaCode);
  const savedItems = saved.items;
  if (!savedItems || savedItems.length === 0) return base;

  const byId = new Map(savedItems.map((s) => [s.id, s]));
  const merged = base.map((it) => {
    const s = byId.get(it.id);
    return s
      ? { ...it, result: s.result ?? null, notes: s.notes ?? "", photos: s.photos ?? it.photos }
      : it;
  });

  const matched = merged.filter((it) => byId.has(it.id)).length;
  if (matched === 0) {
    // Template changed since this audit was recorded — reconstruct from snapshot.
    return savedItems.map((s) => ({
      id: s.id,
      section: s.section,
      text: s.text,
      result: s.result ?? null,
      notes: s.notes ?? "",
      photos: s.photos ?? [],
      requiresEvidence: false,
    }));
  }
  return merged;
}

const RESULT_VIEW: Record<string, { label: string; cls: string }> = {
  pass:    { label: "✓ Pass",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  partial: { label: "~ Partial", cls: "bg-amber-100 text-amber-700 border-amber-200"       },
  fail:    { label: "✗ Fail",    cls: "bg-red-100 text-red-700 border-red-200"             },
  na:      { label: "N/A",       cls: "bg-slate-100 text-slate-500 border-slate-200"       },
};

// Downscale a captured photo so evidence images can be stored inline in the
// audit snapshot (`audit.notes`) without bloating the row. Caps the longest
// edge and re-encodes as JPEG; falls back to the original on any failure.
function downscaleImage(file: File, maxEdge = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(src);
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(src); return; }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 85) return { text: "text-emerald-700", bar: "bg-emerald-500", ring: "border-emerald-400" };
  if (s >= 70) return { text: "text-amber-700",   bar: "bg-amber-400",   ring: "border-amber-400"   };
  return           { text: "text-red-700",        bar: "bg-red-500",     ring: "border-red-400"     };
}

function resultStyle(r: ItemResult, val: ItemResult) {
  const active = r === val;
  const styles: Record<string, string> = {
    pass:    active ? "bg-emerald-100 border-emerald-500 text-emerald-800 font-bold" : "border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50",
    partial: active ? "bg-amber-100 border-amber-500 text-amber-800 font-bold"       : "border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50",
    fail:    active ? "bg-red-100 border-red-500 text-red-800 font-bold"             : "border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50",
    na:      active ? "bg-slate-200 border-slate-400 text-slate-700 font-bold"       : "border-slate-200 text-slate-400 hover:border-slate-400 hover:bg-slate-50",
  };
  return `rounded-lg border px-2.5 py-1 text-xs transition ${styles[val!]}`;
}

// ── Print blank form ──────────────────────────────────────────────────────────

function printBlank(audit: Audit, sections: { title: string; items: Item[] }[], companyName: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  const scheduledFmt = audit.scheduled_date
    ? new Date(audit.scheduled_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const typeFmt = audit.type.charAt(0).toUpperCase() + audit.type.slice(1);
  win.document.write(`<!DOCTYPE html><html><head><title>Audit Checklist — ${audit.title}</title><style>
    @page{size:letter;margin:.75in}
    body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111;margin:0}
    h1{font-size:14pt;margin:0 0 2px}
    .subtitle{font-size:9pt;color:#555;margin-bottom:10px}
    .header{border-bottom:2pt solid #000;padding-bottom:10px;margin-bottom:14px}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
    .meta-item .label{font-size:8pt;font-weight:bold;text-transform:uppercase;color:#666;margin-bottom:2px}
    .meta-item .field{border-bottom:1pt solid #333;min-height:18px;margin-bottom:4px}
    h2{font-size:11pt;background:#e8e8e8;padding:3px 8px;margin:18px 0 6px;break-after:avoid;page-break-after:avoid}
    .item{margin:0 0 8px;padding:4px 0 6px;border-bottom:1px dotted #ccc;break-inside:avoid;page-break-inside:avoid}
    .item-row{display:flex;gap:12px;align-items:flex-start}
    .item-num{font-size:9pt;color:#666;min-width:18px;padding-top:1px}
    .item-text{flex:1;font-size:10pt}
    .req-badge{display:inline-block;font-size:8pt;color:#cc0000;font-weight:bold;margin-left:6px}
    .result-boxes{display:flex;gap:14px;margin:5px 0 5px 28px;font-size:9pt}
    .result-box{display:inline-flex;align-items:center;gap:4px}
    .cb{width:12px;height:12px;border:1pt solid #333;display:inline-block;flex-shrink:0}
    .notes-row{margin:0 0 0 28px}
    .notes-label{font-size:8pt;color:#666}
    .notes-line{border-bottom:1pt solid #bbb;height:14px;margin-bottom:3px}
    .photo-section{margin:4px 0 0 28px}
    .photo-label{font-size:8pt;color:#555;margin-bottom:3px}
    .photo-boxes{display:flex;gap:8px}
    .photo-box{width:72px;height:54px;border:1pt dashed #999;border-radius:2px}
    .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px}
    .sig-field{border-bottom:1.5pt solid #333;height:28px;margin-bottom:4px}
    .sig-label{font-size:8pt;text-transform:uppercase;color:#666}
    .score-box{border:2pt solid #000;padding:8px 14px;display:inline-block;margin-top:12px}
    .score-box .score-label{font-size:8pt;text-transform:uppercase;font-weight:bold;color:#555}
    .score-box .score-field{border-bottom:1pt solid #333;height:22px;width:100px;margin-top:4px}
    @media print{body{margin:0}button,a{display:none}}
  </style></head><body>
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>${audit.title}</h1>
        <div class="subtitle">${companyName} &middot; SafetyIQ EHS Platform &middot; ${typeFmt} Audit</div>
      </div>
      <div style="text-align:right;font-size:9pt">
        <div>Scheduled: ${scheduledFmt}</div>
        <div style="margin-top:4px">Scope: ${audit.scope ?? "—"}</div>
      </div>
    </div>
    <div class="meta-grid">
      <div class="meta-item"><div class="label">Conducted By</div><div class="field"></div></div>
      <div class="meta-item"><div class="label">Date Conducted</div><div class="field"></div></div>
      <div class="meta-item"><div class="label">Location / Department</div><div class="field"></div></div>
      <div class="meta-item"><div class="label">Accompanying Personnel</div><div class="field"></div></div>
    </div>
  </div>
  ${sections.map((sec) => `
    <h2>${sec.title}</h2>
    ${sec.items.map((item, i) => `
      <div class="item">
        <div class="item-row">
          <span class="item-num">${i + 1}.</span>
          <span class="item-text">${item.text}${item.requiresEvidence ? '<span class="req-badge">[Photo Required]</span>' : ""}</span>
        </div>
        <div class="result-boxes">
          <span class="result-box"><span class="cb"></span> Pass</span>
          <span class="result-box"><span class="cb"></span> Partial</span>
          <span class="result-box"><span class="cb"></span> Fail</span>
          <span class="result-box"><span class="cb"></span> N/A</span>
        </div>
        <div class="notes-row">
          <div class="notes-label">Notes / Observations:</div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
        </div>
        ${item.requiresEvidence ? `
          <div class="photo-section">
            <div class="photo-label">&#128247; Photo Evidence (attach or draw reference):</div>
            <div class="photo-boxes">
              <div class="photo-box"></div>
              <div class="photo-box"></div>
              <div class="photo-box"></div>
            </div>
          </div>
        ` : ""}
      </div>
    `).join("")}
  `).join("")}
  <div style="margin-top:20px;padding-top:12px;border-top:1pt solid #999">
    <div style="font-size:10pt;font-weight:bold;margin-bottom:8px">Overall Observations &amp; Findings Summary</div>
    <div class="notes-line" style="margin-bottom:6px"></div>
    <div class="notes-line" style="margin-bottom:6px"></div>
    <div class="notes-line"></div>
  </div>
  <div class="sig-grid">
    <div><div class="sig-field"></div><div class="sig-label">Lead Auditor Signature</div></div>
    <div><div class="sig-field"></div><div class="sig-label">Date</div></div>
    <div><div class="sig-field"></div><div class="sig-label">Management Representative</div></div>
    <div><div class="sig-field"></div><div class="sig-label">Date</div></div>
  </div>
  <div style="margin-top:16px">
    <div class="score-box">
      <div class="score-label">Overall Audit Score</div>
      <div class="score-field"></div>
    </div>
  </div>
  </body></html>`);
  win.document.close();
  win.print();
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AuditConductForm({ audit, profiles }: { audit: Audit; profiles: Profile[] }) {
  const router = useRouter();
  const { user } = useDemoUser();

  // Saved snapshot of a previously-completed audit (empty for a fresh conduct).
  const saved = useMemo(() => parseSavedAudit(audit), [audit]);
  const savedConductor = saved.conductedBy ?? "";
  const savedKnownProfile = profiles.some((p) => p.display_name === savedConductor);
  const savedPhotoCounts = useMemo(() => {
    const m: Record<string, number> = {};
    (saved.items ?? []).forEach((s) => {
      const n = s.photos?.length ?? s.photoCount ?? 0;
      if (n) m[s.id] = n;
    });
    return m;
  }, [saved]);

  const [oshaCode, setOshaCode]         = useState(saved.oshaStandard?.code ?? "");
  const [items, setItems]               = useState<Item[]>(() => hydrateItems(audit, saved, saved.oshaStandard?.code ?? ""));
  const [capaQueue, setCapaQueue]       = useState<Record<string, CapaQueueEntry>>({});
  const [creatingCapas, setCreatingCapas] = useState(false);
  const [capaResults, setCapaResults]   = useState<{ created: number } | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const [auditorSelect, setAuditorSelect] = useState(
    savedConductor ? (savedKnownProfile ? savedConductor : "__custom__") : "",
  );
  const [customAuditor, setCustomAuditor] = useState(
    savedConductor && !savedKnownProfile ? savedConductor : "",
  );
  const conductorName = auditorSelect === "__custom__" ? customAuditor : auditorSelect;
  const [nameError, setNameError] = useState(false);
  const [conductDate, setDate]          = useState(saved.conductedDate || new Date().toISOString().slice(0, 10));
  const [overallNotes, setNotes]      = useState(saved.overallNotes ?? "");
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(audit.status === "completed");
  const [showCompletedDetail, setShowCompletedDetail] = useState(false);
  const [paperFile, setPaperFile]     = useState<File | null>(null);
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({});

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const paperInputRef  = useRef<HTMLInputElement>(null);
  const uploadingFor   = useRef<string | null>(null);

  // Group items into sections
  const sections = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    }
    return Array.from(map.entries()).map(([title, its]) => ({ title, items: its }));
  }, [items]);

  // Score calculation
  const { score, answered, total, breakdown } = useMemo(() => {
    const applicable = items.filter((i) => i.result !== null && i.result !== "na");
    const pass    = applicable.filter((i) => i.result === "pass").length;
    const partial = applicable.filter((i) => i.result === "partial").length;
    const fail    = applicable.filter((i) => i.result === "fail").length;
    const na      = items.filter((i) => i.result === "na").length;
    const pts     = pass * 1 + partial * 0.5;
    const score   = applicable.length > 0 ? Math.round((pts / applicable.length) * 100) : null;
    return { score, answered: items.filter((i) => i.result !== null).length, total: items.length, breakdown: { pass, partial, fail, na } };
  }, [items]);

  const colors = score != null ? scoreColor(score) : null;

  const setResult = useCallback((id: string, result: ItemResult) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, result } : it));
    if (result === "fail") {
      setCapaQueue((prev) => {
        if (prev[id]) return prev;
        return { ...prev, [id]: { status: "loading", suggestion: null, accepted: false, editedTitle: "" } };
      });
      setTimeout(() => {
        const item = itemsRef.current.find((it) => it.id === id);
        if (!item) return;
        const suggestion = generateCapaSuggestion(item);
        setCapaQueue((prev) => ({
          ...prev,
          [id]: { status: "ready", suggestion, accepted: false, editedTitle: suggestion.title },
        }));
      }, 1100);
    } else {
      setCapaQueue((prev) => {
        if (!prev[id] || prev[id].accepted) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const setItemNotes = useCallback((id: string, notes: string) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, notes } : it));
  }, []);

  const removePhoto = useCallback((id: string, idx: number) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, photos: it.photos.filter((_, i) => i !== idx) } : it));
  }, []);

  const acceptCapa = useCallback((id: string) => {
    setCapaQueue((prev) => prev[id] ? { ...prev, [id]: { ...prev[id], accepted: true } } : prev);
  }, []);

  const dismissCapa = useCallback((id: string) => {
    setCapaQueue((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const unacceptCapa = useCallback((id: string) => {
    setCapaQueue((prev) => prev[id] ? { ...prev, [id]: { ...prev[id], accepted: false } } : prev);
  }, []);

  function handlePhotoClick(itemId: string) {
    uploadingFor.current = itemId;
    fileInputRef.current!.value = "";
    fileInputRef.current!.click();
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const forId = uploadingFor.current;
    if (!forId || !e.target.files?.length) return;
    Array.from(e.target.files).slice(0, 3).forEach(async (file) => {
      const dataUrl = await downscaleImage(file);
      if (!dataUrl) return;
      setItems((prev) =>
        prev.map((it) =>
          it.id === forId && it.photos.length < 4
            ? { ...it, photos: [...it.photos, dataUrl] }
            : it,
        ),
      );
    });
  }

  function handlePaperUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) setPaperFile(e.target.files[0]);
  }

  function handleOshaChange(code: string) {
    const alreadyAnswered = items.filter((i) => i.result !== null).length;
    if (alreadyAnswered > 0) {
      if (!window.confirm("Changing the OSHA standard will reset all checklist responses. Continue?")) return;
    }
    setOshaCode(code);
    if (!code) {
      setItems(buildItems(audit));
      setCollapsed({});
      return;
    }
    const checklist = OSHA_CHECKLISTS.find((c) => c.code === code);
    if (!checklist) return;
    const newItems: Item[] = checklist.sections.flatMap((section, si) =>
      section.items.map((itm, ii) => ({
        id: `osha-${si}-${ii}`,
        section: section.title,
        text: itm.text,
        result: null as ItemResult,
        notes: "",
        photos: [] as string[],
        requiresEvidence: itm.requiresEvidence ?? false,
      }))
    );
    setItems(newItems);
    setCollapsed({});
  }

  async function handleSubmit() {
    if (!conductorName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setSubmitting(true);
    const selectedOsha = oshaCode ? OSHA_CHECKLISTS.find((c) => c.code === oshaCode) : null;
    const itemSummary = JSON.stringify({
      oshaStandard: selectedOsha ? { code: selectedOsha.code, title: selectedOsha.title, cfr: selectedOsha.cfr } : null,
      items: items.map((i) => ({ id: i.id, section: i.section, text: i.text, result: i.result, notes: i.notes, photos: i.photos, photoCount: i.photos.length })),
    });
    const res = await submitAuditConduct(audit.id, {
      conductorName: conductorName.trim(),
      conductDate,
      score,
      notes: overallNotes,
      itemSummary,
    });
    if (res.ok) {
      setSubmitted(true);

      const accepted = Object.entries(capaQueue).filter(([, e]) => e.accepted && e.suggestion);
      if (accepted.length > 0) {
        setCreatingCapas(true);
        for (const [, entry] of accepted) {
          const s = entry.suggestion!;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + s.daysToResolve);
          const fd = new FormData();
          fd.set("title",               entry.editedTitle || s.title);
          fd.set("description",         s.description);
          fd.set("severity",            s.severity);
          fd.set("root_cause",          s.root_cause);
          fd.set("verification_method", s.verification_method);
          fd.set("source_id",           audit.id);
          fd.set("due_date",            dueDate.toISOString().slice(0, 10));
          await addCapaFromFinding(s.title, s.description, fd);
        }
        setCreatingCapas(false);
        setCapaResults({ created: accepted.length });
      }

      router.refresh();
    }
    setSubmitting(false);
  }

  // ── Completed view ─────────────────────────────────────────────────────────

  if (submitted && audit.status === "completed") {
    const s = saved.score ?? score;
    const c = s != null ? scoreColor(s) : null;
    return (
      <div className="space-y-5">
        <div className={`rounded-2xl border-2 p-5 ${c ? c.ring : "border-emerald-400"} bg-white shadow-sm`}>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <div className="text-base font-bold text-slate-800">Audit Completed</div>
              <div className="text-xs text-slate-500">
                Conducted by {saved.conductedBy ?? (conductorName || "—")} · {saved.conductedDate ?? audit.completed_date ?? "—"}
                {saved.oshaStandard && (
                  <span className="ml-2 text-slate-400">· {saved.oshaStandard.cfr}</span>
                )}
              </div>
            </div>
            {s != null && (
              <div className={`ml-auto text-4xl font-black ${c?.text}`}>{s}%</div>
            )}
          </div>
          {saved.overallNotes && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Overall Notes: </span>
              {saved.overallNotes}
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Pass",    value: breakdown.pass,    color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
            { label: "Partial", value: breakdown.partial, color: "text-amber-700 bg-amber-50 border-amber-100"       },
            { label: "Fail",    value: breakdown.fail,    color: "text-red-700 bg-red-50 border-red-100"             },
            { label: "N/A",     value: breakdown.na,      color: "text-slate-600 bg-slate-50 border-slate-100"       },
          ].map((b) => (
            <div key={b.label} className={`rounded-xl border p-3 ${b.color}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide opacity-60">{b.label}</div>
              <div className="text-2xl font-black mt-0.5">{b.value}</div>
            </div>
          ))}
        </div>

        {/* Read-only recorded responses */}
        <button
          type="button"
          onClick={() => setShowCompletedDetail((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-slate-50 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ClipboardCheck className="h-4 w-4 text-slate-500" />
            Completed Checklist
            <span className="text-xs font-normal text-slate-400">{answered} of {total} items recorded</span>
          </span>
          {showCompletedDetail
            ? <ChevronDown className="h-4 w-4 text-slate-400" />
            : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </button>

        {showCompletedDetail && (
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.title} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800">
                  {section.title}
                </div>
                <div className="divide-y divide-slate-50">
                  {section.items.map((item) => {
                    const view = item.result ? RESULT_VIEW[item.result] : null;
                    const photoCount = savedPhotoCounts[item.id] ?? 0;
                    return (
                      <div key={item.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 text-sm text-slate-700 leading-snug">{item.text}</div>
                          <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-xs font-semibold ${view ? view.cls : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                            {view ? view.label : "Not recorded"}
                          </span>
                        </div>
                        {item.notes && (
                          <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                            <span className="font-semibold text-slate-400">Notes: </span>{item.notes}
                          </div>
                        )}
                        {item.photos.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {item.photos.map((src, pi) => (
                              // eslint-disable-next-line @next/next/no-img-element -- evidence src values are runtime blob/object/data URLs from in-session uploads that next/image cannot optimise; a plain <img> renders them directly
                              <img
                                key={pi}
                                src={src}
                                alt={`Evidence ${pi + 1}`}
                                className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                              />
                            ))}
                          </div>
                        ) : photoCount > 0 ? (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                            <Camera className="h-3 w-3" /> {photoCount} photo{photoCount > 1 ? "s" : ""} attached
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setSubmitted(false)}
          className="text-sm text-blue-600 underline underline-offset-2"
        >
          Re-conduct audit
        </button>
      </div>
    );
  }

  // ── Conduct form ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
      <input ref={paperInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handlePaperUpload} />

      {/* Auditor info */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Auditor Information</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Conducted By <span className="text-red-500">*</span></label>
            <select
              value={auditorSelect}
              onChange={(e) => { setAuditorSelect(e.target.value); setNameError(false); }}
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 ${nameError && !conductorName.trim() ? "border-red-400 focus:border-red-400" : "border-slate-200 focus:border-blue-400"}`}
            >
              <option value="">Select auditor…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.display_name}>{p.display_name} — {p.job_title}</option>
              ))}
              <option value="__custom__">Other / External Auditor…</option>
            </select>
            {auditorSelect === "__custom__" && (
              <input
                autoFocus
                value={customAuditor}
                placeholder="Enter auditor name"
                className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 ${nameError && !customAuditor.trim() ? "border-red-400 focus:border-red-400" : "border-blue-300"}`}
                onChange={(e) => { setCustomAuditor(e.target.value); setNameError(false); }}
              />
            )}
            {nameError && !conductorName.trim() && (
              <p className="mt-1 text-xs text-red-600 font-medium">Auditor name is required before submitting.</p>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Date Conducted</label>
            <input
              type="date"
              value={conductDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* OSHA Required Audit Standard */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="text-xs font-bold uppercase tracking-wide text-blue-700">OSHA Required Audit Standard</div>
          <span className="ml-auto rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">
            Regulatory Requirement
          </span>
        </div>
        <p className="mb-3 text-[11px] text-blue-600 leading-relaxed">
          Select an OSHA standard applicable to {user.company}&apos;s pharma/biotech operations.
          Selecting a standard will load its specific audit checklist items.
        </p>
        <select
          value={oshaCode}
          onChange={(e) => handleOshaChange(e.target.value)}
          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">— Use default checklist template —</option>
          {OSHA_CHECKLISTS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.cfr} — {c.title}
            </option>
          ))}
        </select>
        {oshaCode && (() => {
          const sel = OSHA_CHECKLISTS.find((c) => c.code === oshaCode);
          return sel ? (
            <div className="mt-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold text-blue-700">{sel.cfr}:</span>{" "}
              {sel.description}
              <span className="ml-2 text-[10px] text-slate-400">
                · {sel.sections.length} sections · {sel.sections.reduce((n, s) => n + s.items.length, 0)} items
              </span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Live score banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Live Score</div>
          <div className="text-xs text-slate-400">{answered} of {total} items answered</div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-black w-20 shrink-0 ${colors?.text ?? "text-slate-300"}`}>
            {score != null ? `${score}%` : "—"}
          </div>
          <div className="flex-1">
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${colors?.bar ?? "bg-slate-200"}`}
                style={{ width: score != null ? `${score}%` : "0%" }}
              />
            </div>
            <div className="mt-2 flex gap-3 text-xs">
              <span className="text-emerald-600 font-semibold">✓ {breakdown.pass} pass</span>
              <span className="text-amber-600 font-semibold">~ {breakdown.partial} partial</span>
              <span className="text-red-600 font-semibold">✗ {breakdown.fail} fail</span>
              <span className="text-slate-400">— {breakdown.na} n/a</span>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist sections */}
      {sections.map((section) => {
        const isCollapsed = collapsed[section.title];
        const sectionAnswered = section.items.filter((i) => i.result !== null).length;
        const allAnswered = sectionAnswered === section.items.length;
        return (
          <div key={section.title} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [section.title]: !prev[section.title] }))}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2.5">
                {allAnswered
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  : <ClipboardCheck className="h-4 w-4 text-slate-300 shrink-0" />}
                <span className="text-sm font-semibold text-slate-800">{section.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${allAnswered ? "text-emerald-600" : "text-slate-400"}`}>
                  {sectionAnswered}/{section.items.length}
                </span>
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-slate-50 border-t border-slate-100">
                {section.items.map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 text-sm text-slate-700 leading-snug">{item.text}</div>
                      {item.requiresEvidence && (
                        <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 uppercase tracking-wide">
                          Photo Req.
                        </span>
                      )}
                    </div>

                    {/* Result buttons */}
                    <div className="flex items-center gap-1.5 mb-2">
                      {(["pass", "partial", "fail", "na"] as const).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setResult(item.id, item.result === val ? null : val)}
                          className={resultStyle(item.result, val)}
                        >
                          {val === "pass" ? "✓ Pass" : val === "partial" ? "~ Partial" : val === "fail" ? "✗ Fail" : "N/A"}
                        </button>
                      ))}
                    </div>

                    {/* AI CAPA suggestion — shows when item is failed */}
                    {item.result === "fail" && capaQueue[item.id] && (() => {
                      const entry = capaQueue[item.id];
                      if (entry.status === "loading") return (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-600">
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
                          SafetyIQ AI analyzing finding…
                        </div>
                      );
                      if (entry.status === "ready" && entry.accepted) return (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-emerald-800">{entry.editedTitle}</span>
                          <span className={`ml-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${SEV_BADGE[entry.suggestion!.severity]}`}>
                            {entry.suggestion!.severity}
                          </span>
                          <span className="ml-auto text-emerald-600">CAPA queued</span>
                          <button type="button" onClick={() => unacceptCapa(item.id)} className="text-slate-400 hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                      if (entry.status === "ready" && !entry.accepted && entry.suggestion) return (
                        <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                          <div className="mb-2 flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700">AI CAPA Triggered</span>
                            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${SEV_BADGE[entry.suggestion.severity]}`}>
                              {entry.suggestion.severity}
                            </span>
                            <span className="ml-auto text-[10px] text-violet-500">Due in {entry.suggestion.daysToResolve} days</span>
                          </div>
                          <input
                            value={entry.editedTitle}
                            onChange={(e) => setCapaQueue((prev) => ({ ...prev, [item.id]: { ...prev[item.id], editedTitle: e.target.value } }))}
                            className="mb-1.5 w-full rounded border border-violet-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-400"
                          />
                          <p className="mb-2 text-[11px] leading-relaxed text-slate-600">
                            <span className="font-medium text-slate-700">Root cause: </span>{entry.suggestion.root_cause}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => acceptCapa(item.id)}
                              className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-violet-700 transition"
                            >
                              <Check className="h-3 w-3" /> Accept CAPA
                            </button>
                            <button
                              type="button"
                              onClick={() => dismissCapa(item.id)}
                              className="text-[11px] text-slate-400 hover:text-slate-600 transition"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      );
                      return null;
                    })()}

                    {/* Notes + photo — show when result selected, or always for required */}
                    {(item.result !== null || item.requiresEvidence) && (
                      <div className="mt-1.5 space-y-2">
                        <input
                          value={item.notes}
                          onChange={(e) => setItemNotes(item.id, e.target.value)}
                          placeholder="Notes or observations…"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />

                        {/* Photo upload — show for requiresEvidence items, or fail/partial */}
                        {(item.requiresEvidence || item.result === "fail" || item.result === "partial") && (
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              {item.photos.map((src, pi) => (
                                <div key={pi} className="relative">
                                  <img src={src} alt={`Photo ${pi + 1}`} className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto(item.id, pi)}
                                    className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              ))}
                              {item.photos.length < 4 && (
                                <button
                                  type="button"
                                  onClick={() => handlePhotoClick(item.id)}
                                  className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 transition"
                                >
                                  <Camera className="h-5 w-5 mb-0.5" />
                                  <span className="text-[9px] font-medium">Add Photo</span>
                                </button>
                              )}
                              {item.requiresEvidence && item.photos.length === 0 && (
                                <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Evidence required
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Overall notes */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
          Overall Observations & Summary Notes
        </label>
        <textarea
          value={overallNotes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Summarise key observations, significant findings, or recommended follow-up actions…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>

      {/* Paper copy upload */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Paper Copy Upload</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => paperInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition"
          >
            <Upload className="h-4 w-4" /> Upload Scanned Form
          </button>
          {paperFile ? (
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-slate-700 font-medium">{paperFile.name}</span>
              <button type="button" onClick={() => setPaperFile(null)} className="text-slate-400 hover:text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Accepts images or PDF — max 20 MB</span>
          )}
        </div>
      </div>

      {/* AI CAPA queue summary */}
      {Object.values(capaQueue).some((e) => e.accepted) && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-600 shrink-0" />
            <div className="text-xs font-bold uppercase tracking-wide text-violet-700">
              AI-Triggered CAPAs — {Object.values(capaQueue).filter((e) => e.accepted).length} will be created on submit
            </div>
          </div>
          <div className="space-y-1.5">
            {Object.entries(capaQueue).filter(([, e]) => e.accepted && e.suggestion).map(([id, entry]) => (
              <div key={id} className="flex items-center gap-2 text-xs">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="font-medium text-slate-800">{entry.editedTitle}</span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${SEV_BADGE[entry.suggestion!.severity]}`}>
                  {entry.suggestion!.severity}
                </span>
                <span className="text-slate-400">· Due in {entry.suggestion!.daysToResolve}d</span>
                <button type="button" onClick={() => unacceptCapa(id)} className="ml-auto text-slate-300 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-violet-500">
            CAPAs are created automatically when you submit the audit and linked to this audit as the source.
          </p>
        </div>
      )}

      {capaResults && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span><strong>{capaResults.created}</strong> CAPA action{capaResults.created > 1 ? "s" : ""} created successfully and linked to this audit.</span>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => printBlank(audit, sections, user.company)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          <Printer className="h-4 w-4" /> Print Blank Form
        </button>

        <div className="flex items-center gap-3">
          {answered < total && (
            <span className="text-xs text-slate-400">{total - answered} items unanswered</span>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || creatingCapas || !conductorName.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <ClipboardCheck className="h-4 w-4" />
            {creatingCapas ? "Creating CAPAs…" : submitting ? "Submitting…" : "Submit Audit"}
          </button>
        </div>
      </div>
    </div>
  );
}

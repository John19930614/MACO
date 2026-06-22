import type { SectionTemplate } from "./AuditConductForm";

export interface OshaChecklist {
  code: string;
  title: string;
  cfr: string;
  description: string;
  sectors: string[];
  sections: SectionTemplate[];
}

export const OSHA_CHECKLISTS: OshaChecklist[] = [
  // ── 29 CFR 1910.1200 — Hazard Communication ────────────────────────────────
  {
    code: "1910.1200",
    title: "Hazard Communication (HazCom / GHS)",
    cfr: "29 CFR 1910.1200",
    description: "GHS labeling, SDS availability, written program, and employee training requirements.",
    sectors: ["pharma", "biotech", "chemical", "research", "manufacturing", "healthcare"],
    sections: [
      {
        title: "Written HazCom Program",
        items: [
          { text: "Written HazCom Program in place, accessible to all employees during each shift" },
          { text: "Chemical inventory list maintained and updated when new chemicals arrive" },
          { text: "Program includes methods for informing contractor employees of hazardous chemicals" },
          { text: "Procedures for detecting hazardous chemical presence or release documented" },
          { text: "Program reviewed after any process or chemical change" },
        ],
      },
      {
        title: "Safety Data Sheets (SDS)",
        items: [
          { text: "SDS available for every hazardous chemical in the workplace", requiresEvidence: true },
          { text: "SDS accessible in each work area where chemicals are used (binder and/or digital)", requiresEvidence: true },
          { text: "SDS accessible to employees during every shift — not locked away" },
          { text: "Procedure in place to obtain SDS before any new chemical is introduced" },
          { text: "All 16 GHS SDS sections present and legible on randomly selected SDS" },
        ],
      },
      {
        title: "Container Labeling (GHS)",
        items: [
          { text: "All chemical containers display product identifier matching SDS" },
          { text: "GHS pictogram(s) present on all primary container labels", requiresEvidence: true },
          { text: "Signal word (Danger / Warning) present on all hazardous chemical labels" },
          { text: "Hazard statements and precautionary statements present on labels" },
          { text: "Supplier name and emergency contact information on labels" },
          { text: "Pipes and process lines labeled or color-coded for chemical content" },
          { text: "Immediate-use container exemption documented if applicable" },
        ],
      },
      {
        title: "Employee Training",
        items: [
          { text: "Initial HazCom training provided before employees work with hazardous chemicals" },
          { text: "Training covers physical and health hazards of chemicals present in work area" },
          { text: "Training covers how to read and use SDS and labels" },
          { text: "Training covers measures employees can take to protect themselves" },
          { text: "Training provided when new hazards are introduced" },
          { text: "Training records document date, topics covered, and attendees", requiresEvidence: true },
        ],
      },
    ],
  },

  // ── 29 CFR 1910.1450 — Laboratory Safety Standard ──────────────────────────
  {
    code: "1910.1450",
    title: "Laboratory Safety Standard (Chemical Hygiene)",
    cfr: "29 CFR 1910.1450",
    description: "Chemical Hygiene Plan, engineering controls, medical surveillance, and training for laboratory settings.",
    sectors: ["pharma", "biotech", "research", "healthcare"],
    sections: [
      {
        title: "Chemical Hygiene Plan",
        items: [
          { text: "Written Chemical Hygiene Plan (CHP) in place and accessible to all lab personnel", requiresEvidence: true },
          { text: "CHP reviewed and updated at least annually — revision date visible on document" },
          { text: "Chemical Hygiene Officer (CHO) formally designated in writing with contact information posted" },
          { text: "SOPs for hazardous procedures included or referenced in CHP" },
          { text: "CHP includes provisions for Particularly Hazardous Substances (PHS)" },
        ],
      },
      {
        title: "Particularly Hazardous Substances (PHS)",
        items: [
          { text: "PHS identified in chemical inventory (carcinogens, reproductive toxins, acutely toxic)" },
          { text: "Prior-approval procedure required for any work involving PHS" },
          { text: "Designated areas established for PHS work where feasible" },
          { text: "Containment devices (fume hoods, glove boxes) specified for PHS operations" },
          { text: "Decontamination procedures for PHS equipment documented" },
        ],
      },
      {
        title: "Engineering Controls & Ventilation",
        items: [
          { text: "Chemical fume hoods certified by accredited firm within past 12 months", requiresEvidence: true },
          { text: "Fume hood face velocity at or above 60 fpm at working sash height" },
          { text: "Fume hood sash height marked at safe working level" },
          { text: "Volatile chemicals handled exclusively inside fume hoods or LEV enclosures" },
          { text: "BSC certification current (NSF 49) where biological work is performed", requiresEvidence: true },
          { text: "Room ventilation rate adequate for chemical usage (no accumulation of vapors)" },
        ],
      },
      {
        title: "Medical Surveillance",
        items: [
          { text: "Medical surveillance program established where chemical exposures may exceed PEL/TLV" },
          { text: "Medical examinations offered before assignment and following overexposure incidents" },
          { text: "Physician's written opinion on file for each medical examination" },
          { text: "Medical records maintained for duration of employment + 30 years" },
          { text: "Employees informed of their right to access medical records" },
        ],
      },
      {
        title: "Training & Exposure Records",
        items: [
          { text: "Lab-specific EHS training documented for all personnel before beginning lab work" },
          { text: "Training covers CHP content, chemical hazards, and emergency response" },
          { text: "Exposure monitoring records maintained where monitoring was conducted" },
          { text: "Employees informed of monitoring results within 15 working days" },
          { text: "SDS accessible at all points of chemical use throughout the laboratory" },
        ],
      },
    ],
  },

  // ── 29 CFR 1910.1030 — Bloodborne Pathogens ────────────────────────────────
  {
    code: "1910.1030",
    title: "Bloodborne Pathogens",
    cfr: "29 CFR 1910.1030",
    description: "Exposure Control Plan, engineering controls, PPE, vaccination, post-exposure, and training requirements.",
    sectors: ["pharma", "biotech", "research", "healthcare"],
    sections: [
      {
        title: "Exposure Control Plan",
        items: [
          { text: "Written Exposure Control Plan (ECP) in place and reviewed/updated annually", requiresEvidence: true },
          { text: "ECP identifies all job classifications with occupational exposure" },
          { text: "ECP includes schedule and methods for implementing each section of the standard" },
          { text: "ECP accessible to all employees with occupational exposure" },
          { text: "ECP updated when new tasks/procedures create additional occupational exposure" },
        ],
      },
      {
        title: "Engineering & Work Practice Controls",
        items: [
          { text: "Safety-engineered sharps (needles, lancets) used where feasible", requiresEvidence: true },
          { text: "Sharps containers in place — puncture-resistant, labeled, leak-proof" },
          { text: "Sharps containers not overfilled (≤¾ full) and promptly replaced when full" },
          { text: "No two-handed recapping of contaminated needles" },
          { text: "Handwashing stations available and used after removal of gloves" },
          { text: "No eating, drinking, smoking, or mouth pipetting in work areas" },
          { text: "BSCs used for procedures that may generate droplets or splatter" },
        ],
      },
      {
        title: "Personal Protective Equipment",
        items: [
          { text: "Appropriate gloves provided and worn when contact with blood/OPIM is anticipated" },
          { text: "Gowns, lab coats, or aprons worn where blood/OPIM splatter is possible" },
          { text: "Eye and face protection worn when splashing or spraying is likely" },
          { text: "PPE removed before leaving the work area and placed in designated receptacle" },
          { text: "Employer launders or disposes of contaminated PPE at no cost to employee" },
        ],
      },
      {
        title: "Hepatitis B Vaccination",
        items: [
          { text: "HBV vaccination offered at no cost to all employees with occupational exposure" },
          { text: "Vaccination offered within 10 working days of initial assignment" },
          { text: "Signed declination form on file for any employee who declined vaccination" },
          { text: "Post-exposure vaccination offer made promptly following any exposure incident" },
        ],
      },
      {
        title: "Post-Exposure Evaluation & Labels",
        items: [
          { text: "Post-exposure evaluation and follow-up procedure documented in ECP" },
          { text: "Exposed employees directed to healthcare professional immediately after incident" },
          { text: "Confidential medical evaluation provided at no cost following exposure" },
          { text: "Biohazard labels on containers of regulated waste, refrigerators, and freezers", requiresEvidence: true },
          { text: "Annual training documented — covers all ECP requirements and employee rights", requiresEvidence: true },
          { text: "Training and medical records retained for 3 and 30+ years respectively" },
        ],
      },
    ],
  },

  // ── 29 CFR 1910.1048 — Formaldehyde ────────────────────────────────────────
  {
    code: "1910.1048",
    title: "Formaldehyde Standard",
    cfr: "29 CFR 1910.1048",
    description: "Exposure monitoring, medical surveillance, hazard communication, and controls for formaldehyde-containing operations.",
    sectors: ["pharma", "biotech", "research", "healthcare"],
    sections: [
      {
        title: "Exposure Monitoring",
        items: [
          { text: "Initial monitoring completed to characterize all employee formaldehyde exposures" },
          { text: "Monitoring records show 8-hr TWA and STEL results with date and method" },
          { text: "Periodic monitoring conducted where exposures may exceed action level (0.5 ppm)" },
          { text: "Additional monitoring triggered after changes in production, control measures, or personnel" },
          { text: "Employees notified of monitoring results within 15 working days", requiresEvidence: true },
        ],
      },
      {
        title: "Medical Surveillance",
        items: [
          { text: "Medical questionnaire administered to employees with exposures at or above AL or STEL" },
          { text: "Medical examination offered where questionnaire indicates potential formaldehyde-related health effects" },
          { text: "Physician's written opinion on file for each medical evaluation" },
          { text: "Biological monitoring conducted where required by physician" },
          { text: "Medical records maintained for duration of employment + 30 years" },
        ],
      },
      {
        title: "Hazard Communication & Regulated Areas",
        items: [
          { text: "Regulated areas posted with warning signs where formaldehyde exceeds PEL or STEL", requiresEvidence: true },
          { text: "Warning sign wording meets OSHA specification: 'DANGER — FORMALDEHYDE — IRRITANT AND POTENTIAL CANCER HAZARD'" },
          { text: "SDS for all formaldehyde-containing products current and accessible", requiresEvidence: true },
          { text: "Labels on all formaldehyde containers state health hazards and safe handling" },
          { text: "Access to regulated areas restricted to authorized personnel" },
        ],
      },
      {
        title: "Emergency Procedures & Spill Response",
        items: [
          { text: "Emergency written procedures posted in all formaldehyde use areas" },
          { text: "Emergency eyewash and shower within 10 seconds travel distance", requiresEvidence: true },
          { text: "Chemical spill kit stocked with appropriate neutralizer and absorbents" },
          { text: "Employees trained on immediate response to large spills and overexposure" },
          { text: "Emergency contact numbers posted (poison control, EHS, emergency services)" },
        ],
      },
      {
        title: "Engineering Controls, PPE & Training",
        items: [
          { text: "Local exhaust ventilation controls exposures below PEL without respiratory protection" },
          { text: "Chemical-resistant gloves (nitrile or PVC) worn during formaldehyde handling" },
          { text: "Chemical-resistant apron and eye/face protection used when splashing possible" },
          { text: "Annual training for all employees with formaldehyde exposure documented", requiresEvidence: true },
          { text: "Training covers health hazards, exposure routes, protective measures, and emergency procedures" },
        ],
      },
    ],
  },

  // ── 29 CFR 1910.134 — Respiratory Protection ───────────────────────────────
  {
    code: "1910.134",
    title: "Respiratory Protection",
    cfr: "29 CFR 1910.134",
    description: "Written program, medical evaluation, fit testing, respirator use and maintenance requirements.",
    sectors: ["pharma", "biotech", "chemical", "research", "manufacturing", "healthcare"],
    sections: [
      {
        title: "Written Respiratory Protection Program",
        items: [
          { text: "Written Respiratory Protection Program in place and current", requiresEvidence: true },
          { text: "Program administrator (suitably trained person) designated" },
          { text: "Program covers respirator selection, use, cleaning, storage, inspection, and repair" },
          { text: "Program includes procedures for fit testing, training, and medical evaluation" },
          { text: "Program evaluated at least annually for effectiveness" },
        ],
      },
      {
        title: "Medical Evaluation",
        items: [
          { text: "OSHA Medical Evaluation Questionnaire (App C) administered before fit testing" },
          { text: "PLHCP (licensed healthcare professional) reviews questionnaire and renders written opinion" },
          { text: "Additional medical exam provided if questionnaire responses warrant it" },
          { text: "Medical records on file for all current respirator users" },
          { text: "Employee informed of PLHCP findings relevant to respirator use" },
        ],
      },
      {
        title: "Fit Testing",
        items: [
          { text: "Fit testing completed before initial use of any tight-fitting facepiece respirator" },
          { text: "Annual fit testing documented for all tight-fitting respirator users", requiresEvidence: true },
          { text: "Fit test protocol matches respirator type (QLFT for APF ≤50; QNFT where required)" },
          { text: "Fit test records include employee name, date, respirator make/model/size, and result" },
          { text: "Additional fit test conducted after significant facial changes (weight loss, surgery, scar)" },
        ],
      },
      {
        title: "Respirator Use & Atmosphere",
        items: [
          { text: "NIOSH-approved respirators selected for identified atmospheric hazard" },
          { text: "Supplied-air or SCBA used in IDLH (immediately dangerous to life or health) atmospheres" },
          { text: "Users instructed not to wear respirators when medical conditions contraindicate use" },
          { text: "No facial hair in the seal area of tight-fitting respirators" },
        ],
      },
      {
        title: "Cleaning, Maintenance, Storage & Training",
        items: [
          { text: "Respirators cleaned and disinfected per Appendix B-2 after each use (shared) or periodically (assigned)" },
          { text: "Respirators inspected before each use and during cleaning" },
          { text: "Defective parts replaced; damaged respirators removed from service", requiresEvidence: true },
          { text: "Respirators stored to protect from contamination, dust, sunlight, and deformation" },
          { text: "Training conducted before initial use and annually; documented with dates and attendees", requiresEvidence: true },
        ],
      },
    ],
  },

  // ── 29 CFR 1910.132 — Personal Protective Equipment ────────────────────────
  {
    code: "1910.132",
    title: "Personal Protective Equipment (PPE)",
    cfr: "29 CFR 1910.132",
    description: "Hazard assessment, PPE selection, provision, training, and maintenance requirements.",
    sectors: ["pharma", "biotech", "chemical", "research", "manufacturing", "healthcare"],
    sections: [
      {
        title: "Hazard Assessment",
        items: [
          { text: "Written PPE hazard assessment completed for all work areas and job tasks", requiresEvidence: true },
          { text: "Assessment certified by authorized person with signature and date" },
          { text: "Assessment identifies eye, face, head, hand, foot, hearing, and body hazards" },
          { text: "Assessment reviewed after significant process or personnel changes" },
        ],
      },
      {
        title: "PPE Selection & Provision",
        items: [
          { text: "PPE selected based on hazard assessment findings" },
          { text: "PPE provided at employer's expense (except safety-toe footwear and prescription eyewear)" },
          { text: "PPE meets applicable ANSI, NIOSH, or industry standards for each type" },
          { text: "Multiple sizes available to ensure proper fit for all employees" },
          { text: "Defective or damaged PPE removed from service and replaced immediately" },
        ],
      },
      {
        title: "Training & Use",
        items: [
          { text: "Training provided before initial PPE use; employees demonstrate understanding" },
          { text: "Training covers when PPE is required, what type to use, how to don/doff/adjust/wear" },
          { text: "Training covers care, maintenance, and useful life of PPE" },
          { text: "Retraining provided when deficiencies in knowledge or proficiency are identified" },
          { text: "Training records document date, employees trained, and content covered", requiresEvidence: true },
        ],
      },
    ],
  },

  // ── 29 CFR 1910.38 — Emergency Action Plan ─────────────────────────────────
  {
    code: "1910.38",
    title: "Emergency Action Plan",
    cfr: "29 CFR 1910.38",
    description: "Procedures for reporting emergencies, evacuation, and accounting for personnel.",
    sectors: ["pharma", "biotech", "chemical", "research", "manufacturing", "healthcare"],
    sections: [
      {
        title: "Written Emergency Action Plan",
        items: [
          { text: "Written Emergency Action Plan (EAP) in place and accessible", requiresEvidence: true },
          { text: "EAP includes procedures for reporting fires and other emergencies" },
          { text: "EAP designates employees responsible for medical/rescue duties" },
          { text: "EAP reviewed with employees at assignment, when updated, or when responsibilities change" },
          { text: "EAP covers all facility locations and shift schedules" },
        ],
      },
      {
        title: "Evacuation Routes & Procedures",
        items: [
          { text: "Evacuation routes posted throughout facility in visible locations", requiresEvidence: true },
          { text: "Alternate evacuation routes identified for each primary exit" },
          { text: "Procedures for employees who remain to operate critical processes" },
          { text: "Designated assembly areas known to all employees" },
          { text: "All exits unobstructed, properly illuminated, and marked with exit signage" },
        ],
      },
      {
        title: "Emergency Contacts & Alarm System",
        items: [
          { text: "Emergency contact list current and posted at workstations and entry points" },
          { text: "Alarm system functional and tested at required intervals", requiresEvidence: true },
          { text: "Alarm system audible/visible in all areas including high-noise locations" },
          { text: "Backup communication method available if primary alarm system fails" },
          { text: "911 and facility emergency contacts dialed in all facility phones" },
        ],
      },
      {
        title: "Drills & Accounting",
        items: [
          { text: "Evacuation drills conducted and frequency documented" },
          { text: "Drill records include date, type, participation count, and duration", requiresEvidence: true },
          { text: "Procedure for accounting for all employees after evacuation implemented" },
          { text: "Visitors and contractors accounted for in evacuation procedure" },
          { text: "After-action review findings incorporated into EAP updates" },
        ],
      },
    ],
  },

  // ── 29 CFR 1904 — OSHA Recordkeeping ───────────────────────────────────────
  {
    code: "1904",
    title: "OSHA Recordkeeping & Reporting",
    cfr: "29 CFR 1904",
    description: "OSHA 300 Log, 300A Annual Summary, 301 Incident Reports, and mandatory reporting requirements.",
    sectors: ["pharma", "biotech", "chemical", "research", "manufacturing", "healthcare"],
    sections: [
      {
        title: "OSHA 300 Log",
        items: [
          { text: "OSHA 300 Log maintained for current year and accessible to authorized persons", requiresEvidence: true },
          { text: "All recordable work-related injuries and illnesses entered within 7 calendar days" },
          { text: "Privacy case protections applied — employee names omitted for sensitive cases" },
          { text: "Log accurate — no recordable cases omitted; no non-recordable cases included" },
          { text: "300 Log retained for 5 years past the end of the calendar year it covers" },
        ],
      },
      {
        title: "OSHA 300A Annual Summary",
        items: [
          { text: "300A Annual Summary completed at end of each calendar year", requiresEvidence: true },
          { text: "Company executive (VP, GM, or owner) has certified the 300A for accuracy" },
          { text: "300A posted Feb 1 through Apr 30 in a conspicuous location visible to employees" },
          { text: "300A retained for 5 years past the end of the calendar year it covers" },
          { text: "Average employment and total hours worked calculated accurately on 300A" },
        ],
      },
      {
        title: "OSHA 301 Incident Report",
        items: [
          { text: "OSHA 301 Incident Report (or equivalent) completed for each recordable case" },
          { text: "301 completed within 7 calendar days of learning of recordable injury/illness" },
          { text: "301 forms retained for 5 years past calendar year of the case" },
          { text: "Employees and former employees can obtain copies of their 301 within 7 days of request" },
          { text: "Authorized OSHA representative can access all records within 4 hours" },
        ],
      },
      {
        title: "Mandatory Reporting to OSHA",
        items: [
          { text: "Fatalities reported to OSHA within 8 hours of occurrence" },
          { text: "In-patient hospitalizations, amputations, and eye losses reported within 24 hours" },
          { text: "Procedure in place to contact OSHA after serious incidents (local office or 1-800-321-OSHA)" },
          { text: "Reporting requirements communicated to all supervisors and managers" },
          { text: "Records available to employees, former employees, and authorized representatives" },
        ],
      },
    ],
  },

  // ── 40 CFR 262 — RCRA Hazardous Waste ──────────────────────────────────────
  {
    code: "40CFR262",
    title: "Hazardous Waste Generator Requirements (RCRA)",
    cfr: "40 CFR 262",
    description: "EPA/RCRA generator status, accumulation, labeling, manifesting, training, and emergency planning requirements.",
    sectors: ["pharma", "biotech", "chemical", "research", "manufacturing"],
    sections: [
      {
        title: "Generator Status & Registration",
        items: [
          { text: "Generator category (VSQG, SQG, or LQG) formally determined and documented" },
          { text: "EPA ID Number obtained and current (required for SQG and LQG)", requiresEvidence: true },
          { text: "State hazardous waste registration current where required" },
          { text: "Generator category re-evaluated quarterly as on-site quantities change" },
        ],
      },
      {
        title: "Satellite Accumulation Areas (SAA)",
        items: [
          { text: "SAA located at or near the point of generation under control of generating employee" },
          { text: "SAA containers closed when not actively adding waste", requiresEvidence: true },
          { text: "SAA quantity does not exceed 55 gallons (1 quart for acute hazardous waste)" },
          { text: "Containers in good condition — no leaks, bulging, or corrosion" },
        ],
      },
      {
        title: "Main Storage Area Compliance",
        items: [
          { text: "All containers labeled 'Hazardous Waste' with contents and hazard characteristics", requiresEvidence: true },
          { text: "Accumulation start date on each container label" },
          { text: "SQG 270-day / LQG 90-day accumulation time limits not exceeded" },
          { text: "Weekly inspections of all hazardous waste accumulation areas documented" },
          { text: "Adequate aisle space maintained for emergency response and inspection" },
        ],
      },
      {
        title: "Containers, Compatibility & Secondary Containment",
        items: [
          { text: "Compatible containers used for each waste type (no reactive combinations)" },
          { text: "Containers in good condition — no visible damage, leaks, or corrosion" },
          { text: "Secondary containment in place for liquid hazardous waste storage areas" },
          { text: "Incompatible waste streams properly segregated" },
        ],
      },
      {
        title: "Manifests, Records & Disposal",
        items: [
          { text: "Uniform Hazardous Waste Manifest completed for all off-site shipments" },
          { text: "Only EPA-permitted TSDFs (Treatment, Storage, Disposal Facilities) used", requiresEvidence: true },
          { text: "Land Disposal Restriction (LDR) notifications on file for each waste code" },
          { text: "Manifest copies retained for 3 years" },
          { text: "Exception reports filed when signed manifest not received within 35/45 days (SQG/LQG)" },
        ],
      },
      {
        title: "Emergency Planning & Training",
        items: [
          { text: "Emergency coordinator designated; contact info posted in waste storage area" },
          { text: "Emergency plan (or contingency plan for LQG) in place and current" },
          { text: "All hazardous waste handlers trained within 6 months of hire" },
          { text: "Annual refresher training documented for all waste handlers", requiresEvidence: true },
          { text: "Local emergency responders notified of waste types and hazards (LQG requirement)" },
        ],
      },
    ],
  },

  // ── 29 CFR 1910.95 — Occupational Noise ────────────────────────────────────
  {
    code: "1910.95",
    title: "Occupational Noise Exposure",
    cfr: "29 CFR 1910.95",
    description: "Noise monitoring, hearing conservation program, audiometric testing, and hearing protection requirements.",
    sectors: ["pharma", "biotech", "chemical", "research", "manufacturing"],
    sections: [
      {
        title: "Noise Monitoring",
        items: [
          { text: "Noise monitoring conducted where employees may be exposed at or above 85 dBA TWA" },
          { text: "Sound level or dosimetry measurements documented with date and location" },
          { text: "Employees notified of monitoring results" },
          { text: "Monitoring repeated when changes in production, process, or controls may increase noise" },
        ],
      },
      {
        title: "Hearing Conservation Program",
        items: [
          { text: "Written Hearing Conservation Program in place where exposures ≥85 dBA TWA" },
          { text: "Program covers monitoring, audiometric testing, HPD, training, and recordkeeping" },
          { text: "Engineering and administrative controls implemented to reduce exposure where feasible" },
          { text: "Hearing protection devices (HPD) provided at no cost to all exposed employees" },
        ],
      },
      {
        title: "Audiometric Testing",
        items: [
          { text: "Baseline audiogram obtained within 6 months of employee's first exposure at/above 85 dBA" },
          { text: "Annual audiograms compared to baseline to detect standard threshold shifts (STS)" },
          { text: "Follow-up medical evaluation offered following identification of STS" },
          { text: "Audiometric testing records retained for duration of employment" },
        ],
      },
      {
        title: "Hearing Protection Devices (HPD)",
        items: [
          { text: "Variety of HPD types offered to employees (earplugs and earmuffs)" },
          { text: "HPDs with adequate NRR (Noise Reduction Rating) selected for noise levels present" },
          { text: "Employees trained on proper insertion/fit and care of HPDs" },
          { text: "HPD use mandatory where engineering/admin controls are insufficient", requiresEvidence: true },
          { text: "Annual training on noise hazards and HCP documented", requiresEvidence: true },
        ],
      },
    ],
  },

  // ── 29 CFR 1910.147 — LOTO (Control of Hazardous Energy) ───────────────────
  {
    code: "1910.147",
    title: "Lockout / Tagout (Control of Hazardous Energy)",
    cfr: "29 CFR 1910.147",
    description: "Energy control program, machine-specific procedures, authorized employee training, and periodic inspections.",
    sectors: ["pharma", "biotech", "chemical", "research", "manufacturing"],
    sections: [
      {
        title: "Energy Control Program",
        items: [
          { text: "Written Energy Control Program (ECP) in place covering all energy sources" },
          { text: "ECP identifies authorized and affected employees" },
          { text: "ECP covers procedures for applying, transferring, and removing energy isolating devices" },
          { text: "Sequence of lockout steps (shutdown, isolation, application, release of stored energy, verification) documented" },
        ],
      },
      {
        title: "Energy Control Procedures",
        items: [
          { text: "Machine-specific LOTO procedures developed for each piece of equipment with unexpected energization risk", requiresEvidence: true },
          { text: "Procedures identify all energy sources (electrical, pneumatic, hydraulic, chemical, thermal, gravitational)" },
          { text: "Type and magnitude of energy and control method specified in each procedure" },
          { text: "Procedures accessible to all employees who perform or are affected by LOTO" },
        ],
      },
      {
        title: "Hardware & Devices",
        items: [
          { text: "Lockout devices (padlocks, hasps, blocks) provided and individually keyed to each authorized employee" },
          { text: "LOTO devices labeled or marked to identify controlling employee" },
          { text: "Lockout devices durable, standardized (color/shape), and used only for energy control" },
          { text: "Group lockout box or multiple-hasp used for group lockout operations" },
        ],
      },
      {
        title: "Training & Periodic Inspection",
        items: [
          { text: "Authorized employees trained in energy control procedures before performing LOTO", requiresEvidence: true },
          { text: "Affected employees trained to recognize and respond to application of energy control" },
          { text: "Annual inspection of energy control procedures conducted by authorized person" },
          { text: "Annual inspection certifies: date of inspection, equipment inspected, employees involved, inspector name" },
          { text: "Retraining provided when procedure change, inadequacy identified, or reason to believe deficiency" },
        ],
      },
    ],
  },

  // ── Ergonomics — General Industry / OSHA MSD Prevention Guidelines ──────────
  {
    code: "ERGO-GEN",
    title: "Ergonomics & MSD Prevention Program",
    cfr: "OSHA General Duty Clause / NIOSH Guidelines",
    description: "Workstation assessments, job hazard analyses, engineering and administrative controls for musculoskeletal disorder (MSD) prevention.",
    sectors: ["pharma", "biotech", "research", "manufacturing", "healthcare", "laboratory", "office"],
    sections: [
      {
        title: "Written Ergonomics Program",
        items: [
          { text: "Written ergonomics program or MSD prevention policy exists and is accessible to all employees" },
          { text: "Program designates a responsible person or team for ergonomics management" },
          { text: "Program reviewed and updated at least annually or after significant process changes" },
          { text: "Employees and supervisors informed of the ergonomics program and their responsibilities" },
          { text: "Early reporting system for MSD symptoms (fatigue, discomfort, pain) is in place and promoted" },
        ],
      },
      {
        title: "Workstation Assessment",
        items: [
          { text: "All workstations with ergonomics risk factors have been formally assessed", requiresEvidence: true },
          { text: "Assessment uses a recognized method (RULA, REBA, NIOSH lifting equation, or equivalent)" },
          { text: "Assessment records document risk score, hazard type, and recommended controls", requiresEvidence: true },
          { text: "High- and critical-risk workstations have documented corrective action plans" },
          { text: "Reassessment scheduled at regular intervals (≤12 months) or after workstation changes" },
          { text: "Workers at assessed workstations were consulted during the assessment process" },
        ],
      },
      {
        title: "Engineering Controls",
        items: [
          { text: "Adjustable-height work surfaces or sit-stand desks provided where applicable", requiresEvidence: true },
          { text: "Anti-fatigue matting installed at standing workstations" },
          { text: "Mechanical lifting aids (trolleys, hoists, lifts) available for tasks >25 lbs (11 kg)" },
          { text: "Ergonomic tools (low-force, vibration-dampened, padded grips) issued for repetitive tasks", requiresEvidence: true },
          { text: "Monitor arms or document holders used to maintain neutral neck posture at computer workstations" },
          { text: "Conveyor heights, bench heights, and reach distances designed to minimize awkward posture" },
        ],
      },
      {
        title: "Manual Material Handling",
        items: [
          { text: "NIOSH Recommended Weight Limit (RWL) evaluated for all manual lifting tasks" },
          { text: "Lifting tasks exceeding RWL have engineered controls or administrative controls in place" },
          { text: "Push/pull forces measured and compared against accepted limits (<20 lbs for sustained, <50 lbs initial)" },
          { text: "Heavy items stored at waist height where possible (between knuckle and shoulder height)" },
          { text: "Team-lift protocols posted and enforced for loads requiring two or more workers" },
          { text: "Carrying distances minimized; load transport equipment provided for distances >10 m" },
        ],
      },
      {
        title: "Computer / VDT Workstations",
        items: [
          { text: "Monitor top at or slightly below eye level; screen distance 50–70 cm from eyes" },
          { text: "Chair height adjusted so feet flat on floor or footrest; thighs parallel to floor" },
          { text: "Keyboard and mouse at elbow height; wrists neutral (not extended or flexed during typing)" },
          { text: "Mouse positioned immediately beside keyboard — not extended to the side" },
          { text: "Document holders used by employees who frequently reference paper while typing" },
          { text: "Micro-break or stretch reminder program implemented for workers >4 hrs of continuous computer use" },
        ],
      },
      {
        title: "Administrative Controls",
        items: [
          { text: "Job rotation schedules in place for repetitive-motion tasks to limit cumulative exposure" },
          { text: "Rest / micro-break schedules posted and followed for high-repetition or static-load tasks" },
          { text: "Pacing policies prevent worker exposure to extreme sustained force or repetition" },
          { text: "Early-return-to-work and modified duty programs available for MSD cases" },
          { text: "Ergonomics checklist completed for new hires assigned to high-risk workstations" },
        ],
      },
      {
        title: "Training & Awareness",
        items: [
          { text: "Ergonomics / MSD awareness training provided to all employees before assignment to assessed tasks", requiresEvidence: true },
          { text: "Training covers recognition of MSD risk factors and early symptom reporting" },
          { text: "Training covers proper use of mechanical aids and ergonomic equipment" },
          { text: "Supervisors trained to respond promptly to MSD symptom reports" },
          { text: "Training records document date, topics covered, and attendees", requiresEvidence: true },
          { text: "Refresher training provided when new equipment, processes, or risk factors are introduced" },
        ],
      },
      {
        title: "Recordkeeping & Metrics",
        items: [
          { text: "MSD-related OSHA 300 log entries (strain, sprain, repetitive motion) reviewed quarterly" },
          { text: "Days away, restricted, or transferred (DART) rate tracked for MSD cases" },
          { text: "MSD symptom survey conducted at least annually for workers in high-risk jobs", requiresEvidence: true },
          { text: "Corrective actions from assessments tracked to closure with documented verification" },
          { text: "Ergonomics program effectiveness reviewed annually using injury trends and worker feedback" },
        ],
      },
    ],
  },
];

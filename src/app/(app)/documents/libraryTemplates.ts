export type DocCategory = "sop" | "policy" | "procedure" | "form" | "permit" | "msds" | "plan" | "guideline";
export type DocPriority = "required" | "recommended" | "optional";

export interface DocumentSection {
  heading: string;
  body: string;
}

export interface LibraryDocument {
  id: string;
  title: string;
  category: DocCategory;
  group: string;
  description: string;
  regulatoryBasis: string;
  reviewMonths: number;
  acknowledgmentRequired: boolean;
  priority: DocPriority;
  sections: DocumentSection[];
}

export const LIBRARY_GROUPS = [
  "EHS Programs",
  "Emergency Plans",
  "Biosafety",
  "Waste Management",
  "Lab SOPs",
  "Regulatory & Recordkeeping",
  "Forms & Checklists",
] as const;

export const DOCUMENT_LIBRARY: LibraryDocument[] = [

  // ── EHS Programs ────────────────────────────────────────────────────────────

  {
    id: "lib-001",
    title: "Chemical Hygiene Plan",
    category: "procedure",
    group: "EHS Programs",
    description: "Required written program covering chemical hazards, exposure limits, protective equipment, and laboratory hygiene practices for employees who work with hazardous chemicals.",
    regulatoryBasis: "29 CFR 1910.1450",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Purpose and Regulatory Basis",
        body: "[COMPANY NAME] has prepared this Chemical Hygiene Plan (CHP) in accordance with OSHA's Occupational Exposure to Hazardous Chemicals in Laboratories standard (29 CFR 1910.1450). The purpose of this plan is to protect all laboratory employees from health hazards associated with the use of hazardous chemicals and to ensure operations are conducted in compliance with the standard.\n\nThis CHP applies to all laboratory workplaces at [SITE ADDRESS] where employees use hazardous chemicals in a non-production context. Laboratory workers who may be exposed to hazardous chemicals are covered by this plan. It does not apply to industrial-scale chemical manufacturing or laboratory use of chemicals that results in no potential for employee exposure."
      },
      {
        heading: "2. Chemical Hygiene Officer",
        body: "The Chemical Hygiene Officer (CHO) for [COMPANY NAME] is [CHO NAME], [TITLE]. The CHO is responsible for: (a) working with management and employees to develop and implement the CHP; (b) ensuring that chemical procurement, distribution, and disposal comply with the plan; (c) ensuring that appropriate training is provided; (d) providing technical guidance on procurement of appropriate protective equipment; and (e) conducting an annual review of the CHP and updating it as necessary.\n\nThe CHO may be contacted at [PHONE/EMAIL]. Employees with questions or concerns about chemical safety should contact the CHO before beginning any new procedure involving hazardous chemicals."
      },
      {
        heading: "3. Standard Operating Procedures for Hazardous Chemicals",
        body: "The following SOPs must be followed when working with hazardous chemicals:\n\n• Review the Safety Data Sheet (SDS) for every chemical before use. SDSs are maintained in the Chemical Inventory Management System and in each laboratory.\n• Wear the minimum PPE required: safety glasses with side shields, nitrile gloves, and a lab coat at all times in the laboratory.\n• Use the chemical fume hood for any operation involving volatile chemicals, chemicals with occupational exposure limits, or chemicals with warning odors.\n• Never work alone when using particularly hazardous substances (carcinogens, reproductive toxins, or acute toxins as defined in Section 5).\n• Confine long hair, avoid loose clothing, and wear closed-toe shoes. No food, drink, or cosmetics in the laboratory.\n• Decontaminate work surfaces after each use and when chemical spills occur.\n• All waste generated from chemical use must be disposed of through the Hazardous Waste Management Program."
      },
      {
        heading: "4. Particularly Hazardous Substances (PHS)",
        body: "Particularly Hazardous Substances (PHS) include: (a) select carcinogens as defined in 29 CFR 1910.1450; (b) reproductive toxins; and (c) substances with high acute toxicity. The following chemicals used at [COMPANY NAME] are designated as PHS and require enhanced controls:\n\n[LIST PHS CHEMICALS — e.g., Formaldehyde, Ethidium bromide, Chloroform, Methanol]\n\nAdditional requirements for PHS use: (1) Prior approval from the CHO or laboratory supervisor is required before any new PHS procedure is started. (2) PHS work must be conducted in a designated area clearly posted with the applicable hazard warning. (3) Employees must be specifically trained on PHS hazards before first use. (4) Decontamination procedures must be established and followed before removal of materials from the designated area. (5) Medical surveillance may be required as specified in Section 6."
      },
      {
        heading: "5. Exposure Monitoring and Medical Consultations",
        body: "[COMPANY NAME] will conduct initial monitoring when there is reason to believe that exposure levels for any OSHA regulated substance routinely exceed the action level (or PEL if there is no action level). Monitoring will be conducted by a certified industrial hygienist in accordance with OSHA method requirements. Employees will be notified of monitoring results within 15 working days of receipt.\n\nMedical consultations and examinations will be provided at no cost and during working hours to employees who: (a) develop signs or symptoms consistent with chemical exposure during laboratory work; (b) are exposed to a chemical in a spill, leak, explosion, or other event above the IDLH concentration; or (c) work with a regulated substance requiring periodic medical surveillance under the applicable OSHA substance-specific standard. Medical records will be maintained in accordance with 29 CFR 1910.1020."
      },
      {
        heading: "6. Training and Annual Review",
        body: "All covered laboratory employees must receive training at the time of initial assignment and whenever a new chemical hazard is introduced. Training must include: (a) the contents and location of this CHP; (b) the permissible exposure limits for OSHA regulated substances and published exposure limits for other hazardous chemicals; (c) methods for detecting the presence or release of chemicals; (d) physical and health hazards of chemicals in the work area; (e) the location of the SDS library; and (f) measures employees can take to protect themselves, including PPE and emergency procedures.\n\nThis CHP will be reviewed annually by the CHO and updated to reflect new chemicals, procedures, regulatory changes, and lessons learned from incidents. The review date and CHO signature will be documented on the cover page. Date of last review: [DATE]. Date of next required review: [DATE + 12 MONTHS]."
      },
    ],
  },

  {
    id: "lib-002",
    title: "Hazard Communication Program",
    category: "policy",
    group: "EHS Programs",
    description: "Written program documenting container labeling, safety data sheets, and employee training to ensure workers know the hazards of chemicals in the workplace.",
    regulatoryBasis: "29 CFR 1910.1200",
    reviewMonths: 24,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Purpose and Scope",
        body: "This Hazard Communication Program (HazCom Program) establishes [COMPANY NAME]'s written program in compliance with OSHA's Hazard Communication Standard (29 CFR 1910.1200, HCS 2012 / GHS-aligned). The purpose is to ensure that information about the hazards of all chemicals used at [COMPANY NAME] is communicated to all affected employees.\n\nThis program applies to all work areas at [SITE ADDRESS] where employees may be exposed to hazardous chemicals under normal working conditions or during foreseeable emergencies. The program covers chemical inventory management, SDS access, container labeling, and employee training. [RESPONSIBLE COORDINATOR NAME] is designated as the HazCom Coordinator and is responsible for maintaining this program."
      },
      {
        heading: "2. Chemical Inventory and SDS Library",
        body: "[COMPANY NAME] maintains a chemical inventory for all hazardous chemicals used on-site. The inventory is housed in the SafetyIQ Chemical Management module and is updated whenever new chemicals are received or existing chemicals are disposed of. The chemical inventory lists each chemical, its location, approximate quantity, and SDS reference.\n\nSafety Data Sheets (SDSs) must be obtained for each hazardous chemical before it is received and used. SDSs must comply with the GHS 16-section format. SDSs are accessible through the SafetyIQ platform at all times during each work shift. Employees must be able to access SDSs immediately without barriers. If electronic access is unavailable, printed SDSs are maintained in [LOCATION — e.g., binders at each lab entrance]. The HazCom Coordinator audits SDS currency annually and requests updated SDSs from manufacturers when revisions occur."
      },
      {
        heading: "3. Container Labeling Requirements",
        body: "All containers of hazardous chemicals must be properly labeled. Primary container labels (original manufacturer labels) must include: (a) product identifier; (b) signal word; (c) hazard statement(s); (d) precautionary statement(s); (e) pictogram(s); and (f) supplier identification. Labels must not be removed or defaced.\n\nSecondary containers — containers into which hazardous chemicals have been transferred from primary containers — must be labeled with at minimum the product identifier and appropriate hazard warnings. Portable containers used for immediate use by the employee who performs the transfer do not require labeling. [COMPANY NAME] uses [GHS-compliant label system, e.g., GHS labels from the SDS system / handwritten secondary labels] for secondary containers. Unlabeled containers found during inspections must be immediately identified or disposed of."
      },
      {
        heading: "4. Employee Training",
        body: "All employees who may be exposed to hazardous chemicals must receive HazCom training at the time of initial assignment and whenever a new hazard is introduced. Training must cover: (a) the requirements of 29 CFR 1910.1200 and this written program; (b) the chemical and physical properties of the chemicals in their work area; (c) how to interpret SDS information including the 16 GHS sections; (d) how to interpret GHS labels including signal words, pictograms, and hazard statements; (e) appropriate personal protective equipment; and (f) emergency procedures including spill response and exposure first aid.\n\nTraining completion is documented in the SafetyIQ Training module and employee training records are retained for the duration of employment plus 30 years. Refresher training is required whenever a new hazard is introduced or when observed behaviors suggest a knowledge gap."
      },
      {
        heading: "5. Non-Routine Tasks and Contractors",
        body: "Supervisors must ensure that employees are informed of chemical hazards associated with non-routine tasks before those tasks are performed. This includes cleaning tasks, maintenance on piping systems, and confined space entry. A pre-task hazard review must be completed and documented.\n\n[COMPANY NAME] informs on-site contractors and their employers of any hazardous chemicals to which contractor employees may be exposed during their work on-site. This is accomplished through site-specific orientation and by providing relevant SDSs. Contractors are required to inform [COMPANY NAME] of any hazardous chemicals they bring on-site, and to provide SDSs for those chemicals prior to performing work. Contractor SDS submissions are tracked by the HazCom Coordinator."
      },
    ],
  },

  {
    id: "lib-003",
    title: "Exposure Control Plan — Bloodborne Pathogens",
    category: "plan",
    group: "EHS Programs",
    description: "Written plan identifying job classifications with occupational exposure, outlining methods of compliance including universal precautions, PPE use, housekeeping, and HBV vaccination.",
    regulatoryBasis: "29 CFR 1910.1030",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Exposure Determination",
        body: "This Exposure Control Plan (ECP) has been prepared by [COMPANY NAME] in compliance with OSHA's Bloodborne Pathogens standard (29 CFR 1910.1030). The following job classifications have been identified as having occupational exposure to blood or other potentially infectious materials (OPIM) in the performance of their duties:\n\nJOB CLASSIFICATIONS WITH FULL EXPOSURE: [e.g., Research Associate (BSL-2 lab), Laboratory Technician (cell culture), Biosafety Officer]\n\nJOB CLASSIFICATIONS WITH POTENTIAL EXPOSURE: [e.g., EHS Manager (incident response), Maintenance staff (equipment repair in labs)]\n\nSpecific tasks that may result in exposure include: handling human cell lines, working with human blood specimens, performing recombinant DNA work involving human-derived materials, responding to injury incidents, and servicing laboratory equipment that contacts biological materials."
      },
      {
        heading: "2. Implementation — Controls and PPE",
        body: "Universal precautions will be observed at [COMPANY NAME] to prevent contact with blood or OPIM. Engineering controls in use include: sharps containers at each bench, biological safety cabinets (Class II Type A2) for work with infectious materials, and needleless systems for fluid transfers where feasible.\n\nWork practice controls: (a) Wash hands immediately after removing gloves and after any skin contact with blood or OPIM; (b) Do not eat, drink, smoke, apply cosmetics, or handle contact lenses in areas of occupational exposure; (c) Prohibit mouth pipetting; (d) Minimize splashing and spraying of blood or OPIM; (e) Decontaminate equipment before servicing or shipping.\n\nPersonal Protective Equipment (PPE) will be provided at no cost to employees. The required PPE for tasks involving blood or OPIM includes nitrile examination gloves, fluid-resistant lab coat or gown, eye protection (goggles or face shield), and closed-toe shoes. PPE must be removed before leaving the work area and disposed of as biohazardous waste."
      },
      {
        heading: "3. Hepatitis B Vaccination",
        body: "The hepatitis B vaccination series will be made available after training and within 10 working days of initial assignment to all employees with occupational exposure. The vaccination is offered at no cost and at a reasonable time and place. Employees who decline the vaccination must sign a declination statement in the format required by 29 CFR 1910.1030(f)(2). If an employee initially declines but later decides to accept the vaccination, it will be provided at that time.\n\nEmployees who have previously received the complete hepatitis B vaccination series, whose antibody testing reveals sufficient immunity, or for whom the vaccine is contraindicated for medical reasons are exempt from the vaccination requirement. Documentation of vaccination or declination is maintained in the employee's confidential medical record."
      },
      {
        heading: "4. Post-Exposure Evaluation and Follow-Up",
        body: "After a report of an exposure incident, [COMPANY NAME] will make available immediately a confidential medical evaluation and follow-up to the exposed employee. The following information will be provided to the healthcare professional: a copy of 29 CFR 1910.1030, a description of the exposed employee's duties as they relate to the exposure incident, documentation of the route of exposure, and circumstances under which the exposure occurred. If possible, the source individual will be identified and, subject to consent, their blood will be tested to determine HBV and HIV infectivity.\n\nExposure incidents must be reported immediately to [SUPERVISOR/EHS MANAGER NAME] using the Bloodborne Pathogen Exposure Incident Report (see Forms & Checklists). The report is used for workers' compensation purposes and to evaluate the circumstances of the incident to prevent recurrence. Exposure incidents are recorded on the OSHA 300 Log if they result in a medical referral or diagnosis."
      },
      {
        heading: "5. Training and Recordkeeping",
        body: "Training on the BBP standard and this ECP is provided at the time of initial assignment to tasks with occupational exposure, and at least annually thereafter. Training must include all elements specified in 29 CFR 1910.1030(g)(2)(vii)(A)-(N). Training records must document the date, content, name and credentials of the trainer, and names of employees trained. Training records are retained for 3 years.\n\nMedical records for each employee with occupational exposure, including vaccination records and post-exposure follow-up documentation, are kept confidential and retained for the duration of employment plus 30 years. This ECP is reviewed and updated at least annually and whenever a change in procedures or technology creates new or modified tasks with potential for occupational exposure. The Plan is available to employees, their representatives, and OSHA upon request."
      },
    ],
  },

  {
    id: "lib-004",
    title: "Formaldehyde Exposure Control Plan",
    category: "plan",
    group: "EHS Programs",
    description: "Written program to comply with OSHA formaldehyde standard including exposure monitoring, engineering controls, PPE selection, medical surveillance, and hazard communication.",
    regulatoryBasis: "29 CFR 1910.1048",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Program Purpose and Regulatory Limits",
        body: "This Formaldehyde Exposure Control Plan is prepared by [COMPANY NAME] to comply with OSHA's Formaldehyde standard (29 CFR 1910.1048). Formaldehyde is used at [COMPANY NAME] for [LIST PRIMARY USES — e.g., tissue fixation, histology processing, research applications]. The OSHA permissible exposure limit (PEL) for formaldehyde is 0.75 ppm as an 8-hour time-weighted average. The OSHA short-term exposure limit (STEL) is 2 ppm measured over any 15-minute period. The OSHA action level is 0.5 ppm as an 8-hour TWA, at which additional requirements including exposure monitoring and medical surveillance are triggered."
      },
      {
        heading: "2. Exposure Monitoring",
        body: "Initial monitoring will be conducted to determine the 8-hour TWA and STEL for each job classification where formaldehyde exposure may occur. Monitoring will be performed using NIOSH-approved sampling methods. Employees will be notified of monitoring results within 15 working days. If initial monitoring indicates exposures at or above the action level or STEL, periodic monitoring will be performed at the frequency specified in 29 CFR 1910.1048(d).\n\nIf exposure levels change due to new procedures, increased quantities, or facility modifications, additional monitoring will be conducted. Monitoring results are maintained in the SafetyIQ platform and are available to employees and their designated representatives. Current monitoring results: [INSERT MOST RECENT MONITORING DATA OR 'Pending initial monitoring as of DATE']."
      },
      {
        heading: "3. Engineering Controls and Work Practices",
        body: "The primary method of controlling formaldehyde exposure at [COMPANY NAME] is through the use of engineering controls. All work with liquid formaldehyde or formalin solutions must be conducted in a chemical fume hood with a minimum face velocity of 100 fpm. Formaldehyde stock solutions must be stored in a vented storage cabinet. Containers must remain capped when not in active use.\n\nWork practice controls: Minimize the use of formaldehyde by substituting less hazardous fixatives where scientifically acceptable. Use the lowest concentration necessary for the intended application. Avoid generating aerosols of formaldehyde-containing solutions. Wash hands thoroughly after any contact. Do not use formaldehyde in unventilated spaces. Tissue samples fixed in formaldehyde must remain in capped, labeled containers and be handled in the fume hood until formalin has been fully absorbed."
      },
      {
        heading: "4. PPE and Medical Surveillance",
        body: "When engineering and work practice controls cannot maintain exposure below the OSHA limits, or when handling high concentrations, respiratory protection will be used. A full-face supplied-air respirator or a half-face air-purifying respirator with organic vapor cartridges and P100 filters is required for emergency use or during operations that exceed the PEL. Respirator use is governed by the Respiratory Protection Program.\n\nSkin and eye protection: Chemical goggles and a butyl rubber or neoprene apron must be worn when handling formaldehyde solutions of 1% or greater. Nitrile gloves provide inadequate protection for formaldehyde — butyl rubber or neoprene gloves must be used. Formaldehyde can cause sensitization; employees who develop symptoms of asthma, dermatitis, or allergic contact should report to [MEDICAL CONTACT] immediately.\n\nMedical surveillance is required for employees exposed at or above the action level or STEL, and for employees with signs and symptoms of formaldehyde exposure. Medical exams must include a medical and occupational history, pulmonary function testing, and any other tests deemed appropriate by the examining physician."
      },
      {
        heading: "5. Emergency Procedures",
        body: "SPILL RESPONSE: For spills of formaldehyde solutions greater than 1 liter, or any spill where ventilation cannot be maintained: evacuate the area, notify supervisors and EHS, keep ignition sources away, use the Chemical Spill Response Plan and emergency spill kit. First responders must wear the appropriate respiratory protection and chemical-resistant PPE.\n\nEXPOSURE FIRST AID: Skin contact — remove contaminated clothing, flush skin with soap and water for at least 15 minutes. Eye contact — flush with water for at least 15 minutes at the emergency eyewash; get medical attention. Inhalation — move the person to fresh air; if breathing is difficult, administer oxygen and get medical attention immediately. Call 911 for severe exposures.\n\nAll formaldehyde exposure incidents must be reported to [EHS MANAGER] and documented using the exposure incident reporting process within 24 hours."
      },
    ],
  },

  {
    id: "lib-005",
    title: "Respiratory Protection Program",
    category: "policy",
    group: "EHS Programs",
    description: "Written program specifying respirator selection, medical evaluation, fit testing, training, and maintenance procedures for employees required to wear respiratory protection.",
    regulatoryBasis: "29 CFR 1910.134",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Program Scope and Program Administrator",
        body: "This Respiratory Protection Program (RPP) has been established by [COMPANY NAME] to protect employees from respiratory hazards. This program applies whenever respiratory protection is required because feasible engineering controls and work practices do not reduce airborne contaminants below the applicable OSHA PEL, or when respiratory protection is required as an additional measure of protection for certain tasks.\n\nThe Respiratory Protection Program Administrator is [ADMINISTRATOR NAME], [TITLE]. The Administrator is responsible for: selecting appropriate respirators; ensuring medical evaluations, fit tests, and training are completed; maintaining records; and conducting an annual program evaluation. Employees with questions about respirator use should contact the Program Administrator before beginning tasks requiring respiratory protection."
      },
      {
        heading: "2. Respirator Selection",
        body: "Respirators will be selected based on the respiratory hazard(s) to which employees may be exposed and on workplace and user factors. The following respirators are currently approved for use at [COMPANY NAME]:\n\n• N95 filtering facepiece respirators: approved for tasks with airborne particulates below IDLH (e.g., nuisance dust, non-oil-based aerosols below the PEL)\n• Half-face APR with OV/P100 cartridges: approved for organic vapor hazards below IDLH (e.g., formaldehyde work, solvent use)\n• Full-face APR with OV/P100 cartridges: approved for eye/respiratory hazard combination below IDLH\n• SCBA or supplied-air respirator: required for IDLH atmospheres, confined space entry, and emergency response\n\nNo employees are permitted to use a respirator not on the approved list without prior approval from the Program Administrator and completion of the required medical evaluation and fit test for the new respirator."
      },
      {
        heading: "3. Medical Evaluation and Fit Testing",
        body: "Before being permitted to use any respirator in the workplace, employees must receive a medical evaluation from a physician or other licensed healthcare professional (PLHCP). The medical evaluation questionnaire (Appendix C of 29 CFR 1910.134) will be provided and the PLHCP will determine whether the employee is physically able to wear the selected respirator. Medical evaluations are provided at no cost to employees and will not be used to discriminate against any employee.\n\nQuantitative or qualitative fit testing is required for all employees who use tight-fitting respirators (half-face or full-face APR, N95). Fit testing must be completed before first use, whenever a different facepiece is used, when the employee reports a change that could affect fit (facial scarring, dental changes, cosmetic surgery, significant change in body weight), and annually thereafter. Fit testing is conducted by [PERSON/VENDOR]. Records of fit test results are maintained in the SafetyIQ platform."
      },
      {
        heading: "4. Use, Maintenance, and Storage",
        body: "Respirators must be inspected before each use and during cleaning. Inspection must include checking the facepiece, head straps, valves, connecting tube (if applicable), and cartridges for wear, cracks, distortion, or contamination. Defective respirators must be removed from service immediately.\n\nReusable respirators must be cleaned after each use or as frequently as necessary to maintain in a sanitary condition. Respirators used by more than one employee must be cleaned and disinfected before being worn by a different person. Cartridges for chemical APRs must be replaced on the schedule established in the cartridge change-out schedule, which is based on the end-of-service life as calculated from industrial hygiene data and NIOSH guidelines. Cartridges must never be used beyond their end-of-service life. Respirators must be stored in a clean, dry location protected from dust, sunlight, extreme temperatures, and damaging chemicals."
      },
      {
        heading: "5. Training and Program Evaluation",
        body: "Employees required to use respirators must receive training before initial use and annually thereafter. Training must cover: why the respirator is necessary; the limitations and capabilities of the respirator; how to use the respirator effectively in emergency situations; how to inspect, put on, remove, and check the fit of the respirator; maintenance and storage procedures; and medical signs and symptoms that may limit or prevent effective respirator use.\n\nThe Program Administrator will conduct an annual evaluation of the program's effectiveness, which includes consulting with employees required to use respirators, reviewing recordkeeping, inspecting a sample of respirators in use, and reviewing the continuing appropriateness of respirator selection. The evaluation findings will be documented and any deficiencies corrected. Date of last annual evaluation: [DATE]."
      },
    ],
  },

  {
    id: "lib-006",
    title: "PPE Hazard Assessment & Program",
    category: "procedure",
    group: "EHS Programs",
    description: "Documented workplace hazard assessment certifying the need for personal protective equipment including eye, face, head, hand, and foot protection by work area.",
    regulatoryBasis: "29 CFR 1910.132",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Hazard Assessment Purpose and Certification",
        body: "In accordance with 29 CFR 1910.132(d), [COMPANY NAME] has conducted a workplace hazard assessment to determine the need for personal protective equipment. This document certifies that the assessment was performed and identifies the PPE required for each work area.\n\nAssessment conducted by: [NAME, TITLE]\nDate of assessment: [DATE]\nDate of last review: [DATE]\n\nThe assessment evaluated the following hazard categories: impact, penetration, compression, chemical, heat/cold, harmful dust, light radiation (optical hazards), and biological hazards."
      },
      {
        heading: "2. Work Area PPE Requirements",
        body: "LABORATORY AREAS (Labs A, B, C, Cell Culture Room, Autoclave Room):\n• Eye protection: Safety glasses with side shields (minimum); chemical splash goggles required when using corrosives, solvents, or biohazardous materials\n• Hand protection: Nitrile examination gloves (minimum); butyl rubber or neoprene gloves for formaldehyde or strong acids/bases\n• Body protection: Lab coat (cotton or flame-resistant for specific tasks); fluid-resistant gown for BSL-2 work\n• Foot protection: Closed-toe, closed-heel shoes; no sandals or open-toe footwear in any laboratory area\n\nCHEMICAL STORAGE AREAS:\n• Eye protection: Chemical splash goggles required\n• Hand protection: Chemical-resistant gloves appropriate to the chemicals being handled\n• Body protection: Chemical-resistant apron\n\nWASTE MANAGEMENT / LOADING DOCK:\n• Eye protection: Safety glasses with side shields\n• Hand protection: Puncture-resistant gloves for handling sharps containers; nitrile for chemical waste\n• Foot protection: Safety-toed footwear recommended"
      },
      {
        heading: "3. PPE Selection, Training, and Maintenance",
        body: "PPE is selected based on the hazard assessment and must meet the applicable ANSI standard. Eye and face protection must meet ANSI/ISEA Z87.1. Hand protection selection is based on chemical compatibility data and must account for permeation rates. Respiratory protection selection is governed by the Respiratory Protection Program (separate document).\n\nEmployees must be trained before being required to wear PPE. Training covers: when PPE is necessary; what PPE is necessary; how to properly put on, take off, adjust, and wear PPE; the limitations of the PPE; and the proper care, maintenance, and disposal of PPE. Retraining is required when the employee has not retained the understanding or skill demonstrated during previous training, or when new PPE is introduced.\n\nPPE will be inspected before each use. PPE that is defective or damaged must be removed from service and replaced. PPE is provided at no cost to employees. Employees must not be charged for PPE required to meet OSHA standards."
      },
    ],
  },

  {
    id: "lib-007",
    title: "Hearing Conservation Program",
    category: "policy",
    group: "EHS Programs",
    description: "Written program for employees exposed at or above the 85 dB action level covering noise monitoring, audiometric testing, hearing protectors, training, and recordkeeping.",
    regulatoryBasis: "29 CFR 1910.95",
    reviewMonths: 24,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Program Scope and Noise Monitoring",
        body: "This Hearing Conservation Program (HCP) applies to all [COMPANY NAME] employees who are or may be exposed to noise at or above the action level of 85 dBA as an 8-hour TWA. Noise monitoring will be conducted when there is reason to believe exposures may equal or exceed the action level. Monitoring will use sound level meters or dosimeters calibrated and operated in accordance with ANSI S1.25. All employees in areas where noise exposures may be at or above the action level are included in monitoring, regardless of whether they wear hearing protectors.\n\nCurrent noise exposure assessment results: [ATTACH MONITORING RESULTS or 'Baseline monitoring to be completed by DATE']. Areas/operations identified with potential noise exposures at or above the action level: [LIST — e.g., autoclave operations, centrifuge rooms, equipment rooms]. Employees will be notified of monitoring results within 15 working days."
      },
      {
        heading: "2. Audiometric Testing",
        body: "Audiometric testing will be provided at no cost to all employees exposed at or above the action level. A baseline audiogram must be obtained within 6 months of first assignment to work at or above the action level. Annual audiograms are required for the duration of exposure at or above the action level.\n\nAudiograms will be administered by a licensed or certified audiologist, otolaryngologist, physician, or a technician who is certified by the Council for Accreditation in Occupational Hearing Conservation (CAOHC). The audiometric testing room must meet ambient noise level requirements of ANSI S3.1. Annual audiograms will be compared to baseline to identify standard threshold shifts (STS), defined as a change in hearing threshold of 10 dB or more, averaged at 2000, 3000, and 4000 Hz in either ear. Employees with confirmed STS will be retested within 30 days, counseled, and referred for medical evaluation as necessary."
      },
      {
        heading: "3. Hearing Protectors and Training",
        body: "Hearing protectors (disposable foam earplugs, reusable earplugs, and/or earmuffs) are provided at no cost to employees exposed at or above the action level. When exposure is at or above 90 dBA TWA (OSHA PEL), hearing protectors are mandatory. Employees exposed at the action level will have their choice among at least one variety of foam earplugs and one earmuff. Hearing protectors are kept stocked in [LOCATION]. Adequacy of hearing protection is verified using the manufacturer's noise reduction rating (NRR) in accordance with 29 CFR 1910.95 Appendix B.\n\nTraining is provided to each employee included in the HCP at the time of initial enrollment and annually thereafter. Training includes: the effects of noise on hearing; the purpose of audiometric testing; the purpose, advantages, disadvantages, and attenuation of various types of hearing protectors; and instructions on selection, fitting, use, and care. Training records are maintained in the SafetyIQ Training module."
      },
    ],
  },

  {
    id: "lib-008",
    title: "Lockout/Tagout Energy Control Program",
    category: "procedure",
    group: "EHS Programs",
    description: "Written energy control program documenting procedures to de-energize equipment during servicing and maintenance to protect workers from unexpected machine startup or energy release.",
    regulatoryBasis: "29 CFR 1910.147",
    reviewMonths: 24,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Purpose, Scope, and Definitions",
        body: "This Energy Control Program (Lockout/Tagout Program) has been prepared by [COMPANY NAME] in compliance with OSHA's Control of Hazardous Energy standard (29 CFR 1910.147) to prevent unexpected energization, startup, or release of stored energy during servicing and maintenance of machines and equipment.\n\nThis program applies to all servicing and maintenance activities where the unexpected energization, startup, or release of stored energy could cause injury. Energy types covered include electrical, mechanical, hydraulic, pneumatic, chemical, thermal, and gravitational energy. EXCEPTIONS: Minor tool changes and adjustments made during normal production operations are exempt if the work is routine, repetitive, and integral to the production process, provided adequate alternative protection is in place. Hot-tap operations are covered by a separate procedure."
      },
      {
        heading: "2. Roles and Responsibilities",
        body: "AUTHORIZED EMPLOYEES are those who lock out or tag out machines or equipment in order to perform servicing or maintenance. Authorized employees must be trained to recognize applicable hazardous energy sources, the type and magnitude of energy available, and the methods and means necessary for energy isolation and control. A current list of authorized employees is maintained by [EHS MANAGER] in the SafetyIQ system.\n\nAFFECTED EMPLOYEES are those who operate or use a machine or equipment on which servicing or maintenance is being performed under lockout/tagout. Affected employees must be informed of the purpose and use of the energy control procedure and must not attempt to restart or re-energize locked or tagged out equipment.\n\nPROGRAM COORDINATOR: [NAME, TITLE] is responsible for maintaining this program, coordinating training, and conducting the annual periodic inspection."
      },
      {
        heading: "3. Lockout/Tagout Procedure — General Steps",
        body: "BEFORE any servicing or maintenance that requires removing guards or placing any body part in the point of operation:\n\n1. NOTIFY affected employees that servicing/maintenance will be performed and that LO/TO will be applied.\n2. IDENTIFY all energy sources for the equipment (electrical disconnects, pneumatic shutoffs, hydraulic valves, gravity isolation points). Refer to the machine-specific LO/TO procedure.\n3. SHUT DOWN the equipment using the normal stopping procedure.\n4. ISOLATE all energy sources using the isolation points identified in the machine-specific procedure.\n5. APPLY lockout devices to each isolation point. Each authorized employee applies their own personal lock. Apply tagout devices with the name of the authorized employee if lockout is not feasible.\n6. RELEASE or restrain all stored or residual energy (discharge capacitors, bleed pneumatic lines, block elevated machine components, release spring tension).\n7. VERIFY isolation by attempting to restart the equipment or by testing with an appropriate meter.\n\nMachine-specific lockout procedures are maintained by [MAINTENANCE/FACILITIES MANAGER] and are posted at each piece of equipment requiring LO/TO."
      },
      {
        heading: "4. Restoration and Annual Inspection",
        body: "RESTORING EQUIPMENT TO SERVICE: Before removing lockout or tagout devices, verify that work is complete and all employees are safely positioned away from the machine. Remove all tools, materials, and restraints. Notify affected employees. Remove lockout/tagout devices in reverse order — only the employee who applied a device may remove it (except for emergency procedures with supervisory override as documented separately). Replace all guards that were removed during servicing.\n\nANNUAL INSPECTION: A periodic inspection of this energy control program must be conducted at least annually by an authorized employee other than the one(s) using the energy control procedure. The inspection must: review the energy control procedure with each authorized employee covered by the procedure; certify that the inspection was performed; and identify the machine or equipment on which the energy control procedure was used. Inspection records are maintained in SafetyIQ. Date of last inspection: [DATE]."
      },
    ],
  },

  {
    id: "lib-009",
    title: "Compressed Gas Safety Program",
    category: "sop",
    group: "EHS Programs",
    description: "Procedures for safe storage, handling, use, and transport of compressed gas cylinders including securing, labeling, regulator use, and emergency procedures.",
    regulatoryBasis: "29 CFR 1910.101 / CGA Guidelines",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "1. Scope and Cylinder Identification",
        body: "This SOP applies to all compressed gas cylinders used at [COMPANY NAME] including inert gases (nitrogen, helium, argon), flammable gases (hydrogen, natural gas), oxidizers (oxygen), toxic gases (carbon monoxide), and cryogenic liquids stored in pressurized dewars. Cylinders must always be clearly identified by the gas label on the cylinder — never rely on cylinder color alone as color coding is not standardized across all manufacturers. Do not use a cylinder that cannot be clearly identified. The cylinder contents label must be legible at all times."
      },
      {
        heading: "2. Storage Requirements",
        body: "SECURING: All compressed gas cylinders must be secured in an upright position using a chain, strap, or bracket to prevent tipping. Cylinders must be chained to a wall, cylinder cart, or bench — not to movable furniture or electrical conduit. Use two-point restraint (top and bottom) for cylinders taller than 4 feet.\n\nSEGREGATION: Flammable gas cylinders must be stored at least 20 feet from oxidizer cylinders, or separated by a minimum 30-minute fire-resistant barrier. Toxic gas cylinders must be stored in a separately ventilated area. Empty cylinders must be segregated from full cylinders and clearly marked 'EMPTY'.\n\nCYLINDER CAP: Valve protection caps must be in place whenever a cylinder is not connected to a regulator. Cylinders must never be stored or transported without the valve protection cap secured."
      },
      {
        heading: "3. Handling, Transport, and Use",
        body: "TRANSPORT: Cylinders must be moved using a hand truck or cylinder cart specifically designed for cylinder transport. Never roll cylinders on their bottom edge or drag them. Never lift cylinders by the valve. Cylinder caps must be in place during transport. Cylinders must not be transported in closed vehicles (car trunks, enclosed vans) unless the vehicle is specifically ventilated for this purpose.\n\nREGULATOR USE: Use only regulators and fittings designed for the specific gas and rated for the cylinder pressure. Oxygen regulators must never be used on any other gas cylinder — contamination with combustibles can cause fire or explosion. Connections must not be forced; if the regulator does not fit, it is the wrong regulator. Open cylinder valves slowly and stand to the side of the regulator. When work is complete, close the cylinder valve and release pressure from the regulator before disconnecting."
      },
      {
        heading: "4. Emergency Procedures",
        body: "GAS LEAK: If a cylinder is leaking and the leak cannot be immediately controlled by closing the cylinder valve, evacuate the area, eliminate ignition sources for flammable gases, call [EMERGENCY NUMBER], and contact the gas supplier. Do not attempt to repair a leaking cylinder. Move a leaking cylinder outdoors only if it can be done without risk to personnel and if the gas will not accumulate near building air intakes.\n\nCYLINDER FIRE: If a cylinder valve is on fire and cannot be closed safely, evacuate the area and call 911. Do not attempt to extinguish a fire where a cylinder valve is involved — allow the fire department to handle it. Cool adjacent cylinders with water spray from a safe distance if possible.\n\nEmergency contacts: [GAS SUPPLIER EMERGENCY LINE], [FACILITY EMERGENCY NUMBER]"
      },
    ],
  },

  {
    id: "lib-010",
    title: "Ergonomics Program",
    category: "guideline",
    group: "EHS Programs",
    description: "Guidelines for identifying and controlling ergonomic risk factors in laboratory and office environments including workstation evaluation, lifting practices, and MSD prevention.",
    regulatoryBasis: "OSHA Ergonomics Guidelines",
    reviewMonths: 36,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "1. Program Purpose and Risk Identification",
        body: "This Ergonomics Program provides guidelines for identifying and controlling ergonomic risk factors that may lead to work-related musculoskeletal disorders (MSDs) at [COMPANY NAME]. Ergonomic risk factors include: forceful exertions, repetitive motions, awkward or static postures, contact stress, vibration, and extreme temperatures. Tasks at elevated MSD risk at [COMPANY NAME] include: repetitive pipetting, microscopy work, prolonged standing, manual handling of equipment, and computer workstation use.\n\nEmployees who develop symptoms of MSDs (pain, numbness, tingling, stiffness) in the neck, shoulders, elbows, wrists, hands, or back should report these symptoms early to [SUPERVISOR/EHS MANAGER] — early intervention is critical for successful treatment and return to normal activities."
      },
      {
        heading: "2. Workstation Evaluation and Controls",
        body: "LABORATORY BENCH WORK: Bench height should allow work to be performed with shoulders relaxed, elbows close to the body, and wrists in a neutral (straight) position. Use anti-fatigue mats on hard flooring for tasks requiring prolonged standing. When pipetting, use low-force pipettes, electronic pipettes where feasible, and minimize repetitive motion through task rotation and short breaks. For microscopy, adjust the eyepiece and stage height so that the neck is in a neutral position and elbows are supported.\n\nCOMPUTER WORKSTATIONS: Monitor should be at arm's length and top of screen at or slightly below eye level. Keyboard and mouse at elbow height with shoulders relaxed. Wrists should remain neutral while typing. Use a document holder at screen height when transcribing. Take micro-breaks of 1–2 minutes every 20–30 minutes during intensive computer work. Ergonomic workstation evaluations are available upon request — contact [EHS CONTACT] to schedule."
      },
      {
        heading: "3. Manual Handling and Lifting",
        body: "The preferred approach to manual handling is elimination — use mechanical assists (carts, dollies, height-adjustable benches, lab lift tables) whenever possible. When manual lifting is required: keep loads close to the body, bend at the knees and hips rather than the back, avoid twisting while lifting, and get help for loads over 35 lbs or loads that are awkward, wet, or unstable.\n\nFor frequently repeated tasks involving lifting, carrying, pushing, or pulling: evaluate the task using the NIOSH Lifting Equation or the Liberty Mutual Psychophysical Tables. Engineering controls (adjustable height surfaces, vacuum lift assists, conveyor systems) are preferred over administrative controls (job rotation, rest breaks). All new equipment purchases with manual handling implications should be evaluated for ergonomics before procurement."
      },
    ],
  },

  // ── Emergency Plans ──────────────────────────────────────────────────────────

  {
    id: "lib-011",
    title: "Emergency Action Plan",
    category: "plan",
    group: "Emergency Plans",
    description: "Written plan with procedures for reporting fires and emergencies, evacuation routes, accounting for employees, medical and rescue duties, and emergency contact information.",
    regulatoryBasis: "29 CFR 1910.38",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Emergency Reporting Procedures",
        body: "This Emergency Action Plan (EAP) has been prepared by [COMPANY NAME] in compliance with 29 CFR 1910.38. It applies to all employees, contractors, and visitors at [SITE ADDRESS].\n\nAll emergencies: Call 911 immediately for life-threatening emergencies, fires, or medical emergencies requiring immediate professional response. After calling 911, call the facility emergency contact: [FACILITY EMERGENCY NUMBER]. All employees must be trained to recognize the emergency alarm signal: [DESCRIBE ALARM — e.g., continuous horn alarm, flashing lights, PA announcement]. Upon hearing the alarm, all employees must immediately follow evacuation procedures unless they are members of the designated Emergency Response Team."
      },
      {
        heading: "2. Evacuation Procedures and Assembly Points",
        body: "Upon activation of the evacuation alarm: (1) Stop work, secure chemicals, and close (but do not lock) laboratory doors. (2) Assist persons with mobility limitations to the nearest Area of Rescue Assistance (ARA) or, if safe, to the nearest exit. (3) Do not use elevators. (4) Proceed to the nearest exit using the posted evacuation routes. (5) Report to your designated assembly area and await instructions from EHS staff.\n\nDESIGNATED ASSEMBLY AREAS:\n• Building A / Labs 1-4: Assemble at [LOCATION, e.g., Parking Lot B, northwest corner]\n• Building B / Offices: Assemble at [LOCATION]\n• All other areas: Assemble at [LOCATION]\n\nDepartment supervisors and EHS staff will perform headcount at assembly points using employee roster. Supervisors must report missing employees to Incident Commander immediately. No employee may re-enter the facility until authorized by the Incident Commander."
      },
      {
        heading: "3. Emergency Roles and Responsibilities",
        body: "INCIDENT COMMANDER: [NAME or TITLE — typically EHS Manager or Facilities Manager] is responsible for coordinating the overall emergency response, communicating with emergency services, and making all re-entry decisions.\n\nFLOOR WARDENS are designated for each work area and are responsible for ensuring evacuation of their area, directing occupants to exits, checking restrooms and break rooms, and reporting their area status to the Incident Commander at the assembly point.\n\nCurrent Floor Wardens: [LIST BY AREA AND NAME]\n\nEMERGENCY CONTACTS:\n• 911 (Police/Fire/Medical)\n• Facility Emergency Line: [NUMBER]\n• EHS Manager: [NAME, NUMBER]\n• Facilities Manager: [NAME, NUMBER]\n• Building Security: [NUMBER]\n• Poison Control Center: 1-800-222-1222\n• Utility Emergency: [NUMBER]"
      },
      {
        heading: "4. Special Situations",
        body: "FIRE: Pull the nearest fire alarm pull station. Call 911. Evacuate using posted routes. Do not fight fires unless trained and only with a portable fire extinguisher for incipient-stage fires. Never allow a fire to be between you and your exit.\n\nMEDICAL EMERGENCY: Call 911. Do not move an injured person unless they are in immediate danger. Keep the area clear. Send someone to the facility entrance to direct emergency responders. First Aid kits are located at [LOCATIONS]. Trained first aiders: [LIST NAMES].\n\nCHEMICAL RELEASE: Evacuate the affected area. Do not enter an area where you can detect chemical odors without appropriate PPE. Call EHS Manager. Refer to the Chemical Spill Response Plan for release response procedures.\n\nACTIVE THREAT / SHELTER-IN-PLACE: Follow the Run-Hide-Fight protocol. Call 911 when safe to do so. Refer to the Severe Weather & Shelter-in-Place Plan for specific shelter procedures."
      },
      {
        heading: "5. Training and Plan Review",
        body: "This EAP must be reviewed with each employee covered by the plan at the time of initial assignment. The plan must also be reviewed with employees whenever the plan changes, and whenever employee responsibilities under the plan change. Evacuation drills will be conducted at least annually. Drill performance, including evacuation time and findings, will be documented and used to improve the plan.\n\nThis plan will be reviewed at least annually by the EHS Manager and updated whenever there are changes to the facility layout, personnel, or emergency procedures. The plan is posted at [LOCATION] and is available to all employees at any time. Date of last review: [DATE]. Reviewed by: [NAME, TITLE]."
      },
    ],
  },

  {
    id: "lib-012",
    title: "Fire Prevention Plan",
    category: "plan",
    group: "Emergency Plans",
    description: "Written plan listing major fire hazards, proper handling and storage of hazardous materials, ignition source controls, and fire protection equipment procedures.",
    regulatoryBasis: "29 CFR 1910.39",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Major Fire Hazards and Ignition Source Control",
        body: "This Fire Prevention Plan (FPP) is prepared in compliance with 29 CFR 1910.39 for [COMPANY NAME] at [SITE ADDRESS]. The following major fire hazards have been identified at this facility:\n\n• Flammable liquids (ethanol, isopropanol, methanol, acetone, xylene) — stored and used in laboratories\n• Flammable/combustible gases (hydrogen, natural gas) — used in laboratories and equipment\n• Dry laboratory waste (paper, cardboard) — accumulates in waste areas\n• Electrical equipment — autoclaves, ovens, refrigerators, centrifuges\n\nIgnition sources that must be controlled include: open flames (Bunsen burners, alcohol lamps), hot surfaces (ovens, heating mantles, hot plates), electrical arcs, and static discharge. Flammable solvents must not be used or stored within 25 feet of open flames or other ignition sources unless adequate physical separation or ventilation is in place."
      },
      {
        heading: "2. Handling and Storage of Flammable Materials",
        body: "Flammable liquids (flash point below 100°F) must be stored in listed, approved flammable storage cabinets. Quantities in the laboratory must be limited to the amount needed for one day's work. Maximum working quantities: [SPECIFY — e.g., no more than 10 gallons total flammable liquids per laboratory]. Refrigerators used for flammable solvent storage must be explosion-proof or flammable materials storage rated — standard household or laboratory refrigerators must NOT be used for flammable liquid storage.\n\nTransfer of flammable liquids from large containers to small ones must be done in a ventilated area away from ignition sources. Containers must be bonded and grounded during transfer of quantities greater than 5 gallons. Used solvent containers must be kept capped when not in active use and taken to the Hazardous Waste Satellite Accumulation Area at the end of each day."
      },
      {
        heading: "3. Fire Protection Equipment",
        body: "PORTABLE FIRE EXTINGUISHERS are located throughout the facility as shown on the posted floor plan. Laboratory areas are equipped with ABC dry chemical and/or CO2 extinguishers. Metal fire (Class D) extinguishers (dry sand or Met-L-X) are located in [LOCATION] for use near alkali metals. Fire extinguishers are inspected monthly (visual check) and annually (professional service). Employees are not required to fight fires but will be offered voluntary annual training on portable extinguisher use.\n\nSPRINKLER SYSTEM: The facility is protected by an automatic fire sprinkler system [DESCRIBE TYPE — e.g., wet pipe, pre-action]. The sprinkler system must not be obstructed — maintain at least 18 inches of clearance below all sprinkler heads. Do not hang items from sprinkler pipes.\n\nFIRE ALARM SYSTEM: Manual pull stations are located at all building exits. Smoke and heat detectors are installed per building code. The alarm system is monitored by [MONITORING COMPANY] 24 hours a day."
      },
    ],
  },

  {
    id: "lib-013",
    title: "Chemical Spill Response Plan",
    category: "procedure",
    group: "Emergency Plans",
    description: "Step-by-step procedures for responding to chemical spills including notification, evacuation criteria, spill kit use, decontamination, and incident documentation.",
    regulatoryBasis: "RCRA / 40 CFR 264.56 / OSHA 1910.38",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Spill Classification and Initial Response",
        body: "All chemical spills must be classified to determine the appropriate response:\n\nMINOR SPILL (incipient stage): A small spill of a non-volatile, non-flammable, non-toxic material that can be safely cleaned up by trained laboratory personnel using the available spill kit. Examples: small volumes of aqueous buffers, dilute acids or bases in small quantities, non-hazardous solvents.\n\nSIGNIFICANT SPILL: Any spill that: (a) cannot be contained using the available spill kit; (b) involves a volatile flammable solvent of any quantity; (c) involves a known carcinogen, reproductive toxin, or acutely toxic material; (d) involves a biohazardous material; (e) involves formaldehyde or other OSHA-regulated substance; or (f) creates detectable airborne vapors beyond the immediate spill area.\n\nFOR ANY SPILL: Immediately alert others in the area. Assess the situation from a safe distance. Do not rush into a spill area without appropriate PPE."
      },
      {
        heading: "2. Minor Spill Response Procedure",
        body: "If you determine the spill is minor and you are trained to respond:\n\n1. Alert nearby workers of the spill.\n2. Retrieve the spill kit from [LOCATION — posted in each laboratory].\n3. Don appropriate PPE: nitrile gloves, safety glasses or goggles, lab coat, and footwear cover if needed.\n4. For volatile spills: increase ventilation by opening fume hood sash. Work from upwind of the spill.\n5. For acid spills: apply sodium bicarbonate or commercial acid neutralizer. For base spills: apply citric acid powder or commercial base neutralizer.\n6. For solvent spills: apply absorbent material (vermiculite or commercial absorbent). Do not use paper towels for flammable solvents.\n7. Sweep absorbed material into a sealable waste container. Label with chemical waste label.\n8. Clean the spill area with water or appropriate solvent.\n9. Dispose of all spill waste as hazardous chemical waste.\n10. Complete the incident report form and notify EHS within 24 hours."
      },
      {
        heading: "3. Significant Spill Response",
        body: "If you determine the spill is significant:\n\n1. Warn all personnel in the area — evacuate immediately.\n2. Close doors to the spill area to confine vapors.\n3. Pull the fire alarm if a fire or explosion hazard exists.\n4. Call [FACILITY EMERGENCY NUMBER] and/or 911.\n5. Do not re-enter the spill area without proper respiratory protection and appropriate PPE.\n6. Meet emergency responders at the entrance and provide information on the chemical, quantity, and location.\n7. Only trained and equipped Emergency Response Team members may respond to significant spills.\n8. If a reportable quantity (RQ) of a CERCLA or RCRA hazardous substance has been released: notify [EHS MANAGER] immediately who will determine whether immediate notification to the National Response Center (1-800-424-8802) is required.\n\nSpill kits are located at: [LIST ALL LOCATIONS]. Spill kits are inspected quarterly by EHS and restocked after any use."
      },
      {
        heading: "4. Documentation and Incident Follow-Up",
        body: "All chemical spill incidents, including minor spills, must be documented. The Incident Report must include: date, time, and location; chemical involved and estimated quantity; how the spill occurred; personnel involved; PPE used; cleanup method; waste disposal; and whether any injuries or exposures occurred.\n\nFollowing any significant spill, [EHS MANAGER] will conduct an incident investigation to determine root cause and identify corrective actions to prevent recurrence. Corrective actions will be entered in the SafetyIQ CAPA module and tracked to completion. Spill response drills will be conducted annually to ensure personnel are prepared to respond effectively."
      },
    ],
  },

  {
    id: "lib-014",
    title: "Medical Emergency Response Procedure",
    category: "procedure",
    group: "Emergency Plans",
    description: "Procedures for responding to medical emergencies including eye and skin chemical exposures, needlestick injuries, burns, and respiratory distress, with first aid protocols.",
    regulatoryBasis: "29 CFR 1910.151",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. General Medical Emergency Response",
        body: "In any medical emergency at [COMPANY NAME], the priority is always: (1) Call for help first; (2) Provide first aid within your training; (3) Keep the patient calm and comfortable. CALL 911 immediately for: unconsciousness, cardiac arrest, severe difficulty breathing, suspected spinal injury, uncontrolled bleeding, suspected poisoning, or any life-threatening situation. After calling 911, call [FACILITY EMERGENCY NUMBER] so that security/facilities can direct emergency responders to the correct location.\n\nFirst Aid kits are maintained at [LOCATIONS — list all]. AEDs (Automated External Defibrillators) are located at [LOCATIONS]. Employees with first aid and CPR/AED training: [LIST NAMES AND CERTIFICATION EXPIRY DATES]. First aid and CPR training is provided annually by [TRAINING VENDOR]."
      },
      {
        heading: "2. Chemical Exposure — Eye and Skin",
        body: "EYE EXPOSURE: Immediately bring the person to the nearest emergency eyewash station. Flush the eye(s) continuously for a minimum of 15 minutes with water. Remove contact lenses during flushing if they can be removed without force. Hold the eyelid(s) open to ensure thorough flushing. After flushing, transport to emergency care immediately — always seek medical evaluation for chemical eye exposures, even if symptoms seem mild. Identify the chemical involved and provide the SDS to medical personnel.\n\nSKIN EXPOSURE: Remove contaminated clothing and jewelry immediately. Flush the affected skin area with large amounts of water for a minimum of 15 minutes using the emergency shower (for large body surface areas) or sink (for limited areas). For chemical burns from acids or bases, do not attempt to neutralize — flush with water only. Seek medical attention for all significant chemical skin exposures. Emergency eyewash stations are located at: [LIST ALL LOCATIONS]. Emergency showers are located at: [LIST ALL LOCATIONS]."
      },
      {
        heading: "3. Needlestick and Sharps Injuries",
        body: "IMMEDIATE ACTION for needlestick or sharps injury: (1) Do not panic — remove yourself from the work area. (2) Wash the wound thoroughly with soap and water for at least 5 minutes. For mucous membrane splashes, flush with water or saline. (3) Report immediately to your supervisor and EHS Manager. (4) Seek medical evaluation within 2 hours at [DESIGNATED MEDICAL FACILITY — NAME, ADDRESS, PHONE]. Timely medical evaluation is critical for post-exposure prophylaxis decisions.\n\nDocument the exposure using the Bloodborne Pathogen Exposure Incident Report form. If the needle or sharp was contaminated with human blood, cell lines, or OPIM, the incident may trigger the post-exposure evaluation protocol under the Bloodborne Pathogen Exposure Control Plan. Source patient testing may be initiated with consent. Retain the sharp item and its container (without recapping) for documentation purposes."
      },
      {
        heading: "4. Burns and Inhalation Emergencies",
        body: "THERMAL BURNS: Cool the burn immediately with cool (not cold or ice) running water for 10–20 minutes. Do not apply butter, oils, or ice. Cover loosely with a clean, non-fluffy material. Call 911 for burns larger than 3 inches in diameter, burns to the face, hands, feet, genitals, or major joints, or third-degree burns (appear white, brown, or charred).\n\nSTEAM/AUTOCLAVE BURNS: These are treated as thermal burns. The burn area may be larger than it appears — seek medical evaluation for all steam burns, particularly to the face and hands.\n\nINHALATION EXPOSURE: Move the person to fresh air immediately. Loosen tight clothing at the neck and waist. Call 911 for: labored breathing, cyanosis (blue lips/fingernails), loss of consciousness, or any symptoms that do not resolve within minutes of fresh air exposure. Even if symptoms resolve quickly, seek medical evaluation and document the incident."
      },
    ],
  },

  {
    id: "lib-015",
    title: "Severe Weather & Shelter-in-Place Plan",
    category: "plan",
    group: "Emergency Plans",
    description: "Procedures for sheltering in place during severe weather events, tornado warnings, or hazardous material releases, including designated shelter areas and communication protocols.",
    regulatoryBasis: "OSHA Best Practices / FEMA Guidelines",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "1. When to Shelter-in-Place",
        body: "Shelter-in-Place (SIP) directives will be issued by [EHS MANAGER / FACILITY MANAGER / BUILDING SECURITY] when evacuation would expose employees to greater risk than sheltering. Shelter-in-Place situations include:\n\n• SEVERE WEATHER: Tornado warning (sirens, NWS warning), severe lightning, or high winds that make outdoor movement dangerous\n• OUTDOOR CHEMICAL RELEASE: Plume from an external industrial or transportation incident that has been identified in the area\n• ACTIVE THREAT: Law enforcement-directed shelter for active shooter, civil unrest, or other threat to building occupants\n• SHELTER-IN-PLACE COMMAND: Notification via PA system, mass communication system, or Floor Warden instruction stating 'Shelter-in-Place — do not leave the building'"
      },
      {
        heading: "2. Shelter Locations and Procedures",
        body: "Upon receiving a Shelter-in-Place directive:\n\n1. Move inside immediately. If you are outside, go to the nearest building entrance.\n2. Proceed to the designated shelter area for your location:\n   • TORNADO/SEVERE WEATHER: Move to interior rooms on the lowest floor away from windows. Avoid stairwells and hallways with exterior windows. Designated tornado shelter areas: [ROOM NUMBERS]\n   • CHEMICAL RELEASE (outdoor): Move to an interior room on an upper floor with windows and HVAC access closed. Designated chemical shelter areas: [ROOM NUMBERS]\n3. Account for all personnel in your area.\n4. Do not leave until authorized by the all-clear signal or communication from management.\n5. Keep communication devices (phone) available for updates from management.\n6. All-clear signal: [DESCRIBE — e.g., PA announcement, text message, direct supervisor communication]"
      },
      {
        heading: "3. Communication During Shelter Events",
        body: "During a shelter-in-place event: (1) Monitor the emergency notification system — [COMPANY NAME] will send updates via [TEXT SYSTEM / EMAIL / PA]. (2) Check local emergency alerts via [ALERT SYSTEM, e.g., Wireless Emergency Alerts, NOAA Weather Radio]. (3) Supervisors will conduct headcount and report to the Incident Commander by phone.\n\nDo NOT call 911 unless there is an immediate life safety emergency within the facility. Keep phone lines clear for official emergency communications. If a person requires medical assistance during a shelter event, call [INTERNAL EMERGENCY NUMBER] first."
      },
    ],
  },

  // ── Biosafety ────────────────────────────────────────────────────────────────

  {
    id: "lib-016",
    title: "Biosafety Manual — BSL-2 Operations",
    category: "guideline",
    group: "Biosafety",
    description: "Comprehensive biosafety manual covering BSL-2 containment practices, primary containment equipment, facility requirements, training, and decontamination procedures for biological agents.",
    regulatoryBasis: "NIH/CDC BMBL 6th Ed. / 29 CFR 1910.1030",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. BSL-2 Requirements and Scope",
        body: "This Biosafety Manual establishes the procedures and requirements for all Biosafety Level 2 (BSL-2) laboratory operations at [COMPANY NAME], in accordance with the CDC/NIH Biosafety in Microbiological and Biomedical Laboratories (BMBL), 6th Edition. BSL-2 is appropriate for work involving agents associated with human disease but for which exposure risk is moderate and laboratory exposures rarely cause infection from incidental exposures.\n\nBiological agents handled at BSL-2 at [COMPANY NAME] include: [LIST SPECIFIC AGENTS — e.g., human cell lines, primary human tissues, Biosafety Level 2 select agents if applicable]. This manual applies to all personnel working in designated BSL-2 laboratories: [LAB ROOM NUMBERS]. The Institutional Biosafety Officer (IBO) is [NAME, CONTACT]. All BSL-2 protocols must be reviewed and approved by the Institutional Biosafety Committee (IBC) before work begins."
      },
      {
        heading: "2. BSL-2 Standard Practices",
        body: "The following standard practices are required in all BSL-2 laboratories:\n\n• Access is restricted to persons whose presence is required. Doors remain closed when work with BSL-2 agents is in progress.\n• Mouth pipetting is strictly prohibited. Mechanical pipetting devices must be used.\n• All procedures involving potential splash or aerosol generation must be performed in a Class II biological safety cabinet (BSC).\n• Work surfaces are decontaminated with an appropriate disinfectant (see Disinfection SOP) after each use and immediately after any spill of viable material.\n• All biological waste is decontaminated prior to disposal by autoclaving, chemical disinfection, or another validated inactivation method.\n• Personnel must wash hands after working with potentially hazardous materials and before leaving the laboratory.\n• PPE: lab coat (dedicated to the lab), gloves appropriate to the procedure, and eye/face protection when working with material that may splash."
      },
      {
        heading: "3. Biological Spill Response",
        body: "MINOR BIOLOGICAL SPILL (contained, in BSC): (1) Allow the BSC to continue operating. (2) Flood the spill with disinfectant solution (see Disinfection SOP for appropriate agent and contact time). (3) Allow a contact time of at least 20 minutes. (4) Wipe up the spill and clean the surface with fresh disinfectant. (5) Remove PPE (gloves first, then gown), wash hands, and notify the Biosafety Officer.\n\nSIGNIFICANT BIOLOGICAL SPILL (outside BSC, large volume, or involving BSL-2 agent on personnel): (1) Alert others to evacuate the area. (2) Remove contaminated clothing inside-out and place in a biohazardous waste bag. (3) Wash any exposed skin thoroughly with soap and water for 15 minutes. (4) Flush mucous membranes with water. (5) Call the Biosafety Officer immediately: [NUMBER]. (6) Post a contamination warning sign on the lab door. (7) Allow aerosols to settle (30 minutes minimum) before re-entering with appropriate PPE."
      },
      {
        heading: "4. Training and Protocol Approval",
        body: "All personnel working in BSL-2 designated laboratories must complete the following training before beginning work: (a) Institutional biosafety orientation; (b) Laboratory-specific biosafety training covering the agents and procedures used in their laboratory; (c) Bloodborne Pathogens training (if working with human blood, tissues, or cell lines); (d) BSC use and decontamination; and (e) Emergency response procedures.\n\nNew protocols involving biological agents must be submitted to the IBC for review. Protocol submissions must describe: the biological agents to be used and their risk group classification, the procedures to be performed, the BSL required, containment equipment and PPE, decontamination and waste disposal methods, and personnel training requirements. The IBC meets [FREQUENCY — e.g., quarterly] and all approvals must be obtained before work begins."
      },
    ],
  },

  {
    id: "lib-017",
    title: "Institutional Biosafety Committee (IBC) Charter",
    category: "policy",
    group: "Biosafety",
    description: "Governance document establishing IBC composition, authority, responsibilities, meeting frequency, and protocol review process for biological research oversight.",
    regulatoryBasis: "NIH Guidelines for Research Involving rDNA",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Purpose and Authority",
        body: "The Institutional Biosafety Committee (IBC) of [COMPANY NAME] is established in accordance with the NIH Guidelines for Research Involving Recombinant or Synthetic Nucleic Acid Molecules (NIH Guidelines) and applicable federal, state, and local regulations. The IBC has the authority and responsibility to: review and approve all research and laboratory activities involving recombinant and synthetic nucleic acid molecules; establish biosafety policies and procedures; investigate and report laboratory accidents involving biological agents; and oversee compliance with NIH Guidelines, CDC/NIH BMBL, and other applicable biosafety requirements.\n\nAll research activities at [COMPANY NAME] involving recombinant DNA, synthetic nucleic acids, biological agents at BSL-2 or higher, select agents, or biohazardous materials are subject to IBC review and approval. No such research may commence without prior IBC approval."
      },
      {
        heading: "2. IBC Membership and Structure",
        body: "The IBC shall consist of no fewer than [5] members with expertise in recombinant DNA technology, biological safety, and applicable federal regulations. Membership must include:\n\n• At least two members not affiliated with [COMPANY NAME] who represent community interests in biosafety (community representatives)\n• A Biological Safety Officer (BSO) when research at BSL-2, BSL-3, or involving Select Agents is conducted\n• At least one member with expertise in recombinant DNA research\n• Additional members with relevant expertise as determined by the nature of activities under review\n\nCurrent IBC Members: [LIST NAME, TITLE, AFFILIATION FOR EACH MEMBER]\nIBC Chairperson: [NAME]\nBiological Safety Officer: [NAME, CONTACT]\n\nMembers serve [2-year / 3-year] terms. Vacancies are filled by appointment of the [RESPONSIBLE EXECUTIVE]. Members may be reappointed."
      },
      {
        heading: "3. Responsibilities and Protocol Review",
        body: "The IBC meets at least [QUARTERLY / SEMI-ANNUALLY] and conducts reviews of all research protocols involving biological agents or rDNA. Protocol submissions must be made using the approved IBC protocol form, which captures: project title and PI, biological agents/rDNA involved and their risk group, proposed containment levels, personnel training status, safety measures, and decontamination/disposal plans.\n\nThe IBC reviews protocols for scientific accuracy of risk assessment, appropriateness of containment, adequacy of proposed safety measures, and compliance with applicable guidelines. Approvals are documented in IBC meeting minutes. Approved protocols are subject to continuing review — PIs must submit protocol amendments for any significant change in scope, agent, or personnel. All IBC records, including meeting minutes and protocol approvals, are maintained for at least [3 years] after project completion."
      },
    ],
  },

  {
    id: "lib-018",
    title: "Biological Safety Cabinet Operation & Decontamination SOP",
    category: "sop",
    group: "Biosafety",
    description: "Step-by-step procedures for proper BSC use, surface decontamination, HEPA filter replacement indicators, annual certification requirements, and UV lamp maintenance.",
    regulatoryBasis: "NSF/ANSI 49 / CDC BMBL",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Types of Cabinets and Location",
        body: "This SOP covers the proper operation and maintenance of Class II Type A2 Biological Safety Cabinets (BSCs) at [COMPANY NAME]. BSCs provide personnel, product, and environmental protection by maintaining unidirectional HEPA-filtered airflow. They must NOT be confused with chemical fume hoods, which do not protect the product or provide HEPA filtration.\n\nBSCs installed at [COMPANY NAME]: [LIST MODEL, SERIAL NUMBER, LOCATION FOR EACH CABINET — e.g., Cabinet 1: Labconco Purifier Delta, S/N XXXXX, Lab A Room 201; Cabinet 2: ...]\n\nDo NOT use a BSC for work involving volatile chemicals, toxic vapors, or flammable solvents unless the BSC is specifically rated for that use (Class II Type B2). All flammable or volatile chemical work must be done in the chemical fume hood."
      },
      {
        heading: "2. Pre-Use Check and Work Procedure",
        body: "BEFORE USE:\n1. Verify the BSC alarm light is off and airflow is operating normally.\n2. Verify the annual certification date sticker — do not use a BSC that is past its certification date (12 months from last certification).\n3. Turn on UV lamp and allow 5-10 minutes of UV irradiation if the cabinet was not used since last decontamination (this is supplemental — not a substitute for surface disinfection).\n4. Wipe down interior work surfaces with 70% ethanol or appropriate disinfectant. Allow contact time to elapse before placing materials inside.\n5. Arrange materials to ensure proper airflow — do not block the front or rear grilles.\n\nDURING USE:\n• Perform all work at least 4 inches from the front opening.\n• Minimize arm movements in and out of the cabinet — slow, sweeping side-to-side motions are preferred.\n• Use a sealable secondary container for any material that leaves the cabinet.\n• Never place large equipment that impedes airflow near the HEPA filter or grilles."
      },
      {
        heading: "3. Surface Decontamination Procedure",
        body: "AFTER EACH USE:\n1. Remove all materials, waste, and equipment from the cabinet interior.\n2. Spray or wipe all surfaces (work surface, side walls, interior of the glass sash) with 70% ethanol or [APPROVED DISINFECTANT PER DISINFECTION SOP]. Allow minimum contact time of 10 minutes.\n3. Wipe dry with sterile gauze or paper towels (dispose as biohazard waste).\n4. Do not spray liquid onto the rear HEPA filter area — wipe carefully near the filter.\n5. Turn off UV lamp after decontamination is complete. UV lamps are supplemental only; decontamination effectiveness depends on surface wipe procedures.\n\nAFTER SIGNIFICANT SPILL OR BIOHAZARD EXPOSURE: Disinfectant soak procedure — flood the cabinet work surface with disinfectant, allow 20-minute contact time, then wipe up. Report all significant spills to the Biosafety Officer and complete an incident report."
      },
      {
        heading: "4. Certification and Maintenance",
        body: "BSCs must be certified annually by a qualified certifier trained in accordance with NSF/ANSI 49. Certification must also be performed after relocation, after HEPA filter replacement, and after any repair affecting cabinet performance. The certifier will test: downflow velocity, inflow velocity, HEPA filter integrity (DOP or equivalent test), UV light intensity, and airflow smoke pattern.\n\nHEPA FILTER DECONTAMINATION AND REPLACEMENT: Before any service that requires access to the HEPA filter or blower, the BSC must be decontaminated by [CERTIFIED BSC TECHNICIAN] using formaldehyde fumigation or vaporized hydrogen peroxide. This work must be arranged through [BSO / FACILITIES CONTACT]. A decontamination certificate must be on file before filter replacement.\n\nUV LAMP INTENSITY: UV lamps decrease in output with use. UV lamp intensity must be verified annually with a UV meter. Replace UV lamps when output falls below [254 nm at 40 Î¼W/cm²] at the work surface or as recommended by the manufacturer."
      },
    ],
  },

  {
    id: "lib-019",
    title: "Autoclave Validation & Operation SOP",
    category: "sop",
    group: "Biosafety",
    description: "Procedures for gravity and pre-vacuum autoclave cycles, biological indicator validation, load configuration, cycle documentation, and maintenance records.",
    regulatoryBasis: "CDC BMBL / AAMI ST8",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Autoclave Types and Cycle Selection",
        body: "Autoclaves at [COMPANY NAME] are used for: (a) decontamination of biohazardous waste prior to disposal; and (b) sterilization of laboratory glassware, instruments, and media. Autoclaves in use: [LIST MODEL, LOCATION, CAPACITY FOR EACH]\n\nCYCLE SELECTION:\n• GRAVITY CYCLE (121°C / 15 min minimum): Appropriate for non-porous loads, liquid media, loose glassware, and biohazardous waste (liquid biohazard waste, soft waste in autoclavable bags).\n• PRE-VACUUM (PREVAC) CYCLE (121°C / 4 min minimum): Required for porous loads such as wrapped instruments, heavily packed waste bags, large dressings, and bulk biohazardous waste where steam penetration of the load is critical.\n• LIQUID CYCLE (121°C): For liquid media and solutions — uses a slower exhaust to prevent boiling over. Slow exhaust is mandatory for liquids.\n\nAlways consult the cycle validation data for your specific load type before selecting a cycle."
      },
      {
        heading: "2. Load Preparation and Operation",
        body: "LOAD PREPARATION:\n• Biohazardous waste bags must be autoclavable (red or orange, marked 'biohazardous' or 'autoclavable'). Do not use standard garbage bags.\n• Leave bags loosely tied — sealed bags may prevent steam penetration and can explode.\n• Do not overfill bags. Maximum fill: 2/3 of bag capacity.\n• Place bags in secondary containers (stainless steel or polypropylene trays) to contain potential liquid waste.\n• Sharps containers may only be autoclaved if they are specifically rated and labeled as autoclavable.\n\nOPERATION:\n1. Ensure drain screen is clean before loading.\n2. Load the autoclave — do not overpack. Ensure bags and containers allow steam circulation.\n3. Select the correct cycle for the load type.\n4. Start the cycle and verify that set temperature and time are correct.\n5. Never leave an autoclave running unattended if it is processing biohazardous waste.\n6. After completion, allow pressure to return to zero before opening the door — open the door slowly and stand to the side to release steam."
      },
      {
        heading: "3. Biological Indicator Validation",
        body: "Autoclave performance must be verified using biological indicators (BIs) containing Geobacillus stearothermophilus spore strips or self-contained BI vials. BIs must be run: (a) for each new cycle type during validation; (b) at least monthly during routine operation; and (c) after any major maintenance, repair, or relocation.\n\nBI TEST PROCEDURE:\n1. Place the BI at the coldest point in the load (typically the center of the most densely packed area).\n2. Run a full production cycle with a representative load.\n3. Incubate the BI and the control BI (unprocessed) at 56–60°C for 24–48 hours per manufacturer instructions.\n4. Negative (no growth) indicates successful sterilization. Positive result (color change/turbidity) requires: remove the autoclave from service, contact [BIOSAFETY OFFICER], and investigate the failure.\n\nRecords of all BI tests must be maintained in the Autoclave Log in SafetyIQ, including: date, cycle used, load description, BI result, and initials of the operator."
      },
    ],
  },

  {
    id: "lib-020",
    title: "Biohazardous Waste Management Procedure",
    category: "procedure",
    group: "Biosafety",
    description: "Procedures for segregating, packaging, labeling, treating, and disposing of biohazardous waste including cultures, sharps, animal carcasses, and contaminated PPE.",
    regulatoryBasis: "29 CFR 1910.1030 / State Biomedical Waste Regs",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Waste Categories and Segregation",
        body: "Biohazardous waste at [COMPANY NAME] is categorized as follows, and must be placed in the appropriate container at the point of generation:\n\n• SOFT/NON-SHARP BIOHAZARDOUS WASTE: Contaminated gloves, wipes, pipettes, tubes, plates — Red autoclave bags in red biohazard boxes\n• SHARPS: Needles, syringes, lancets, broken glass from biohazardous areas, scalpels — Approved sharps containers (yellow or red, UN-certified, not more than 3/4 full when closed)\n• LIQUID BIOHAZARDOUS WASTE: Culture supernatants, media, reagents — Sealed containers for autoclave decontamination or chemical disinfection\n• ANIMAL CARCASSES/TISSUES (if applicable): Placed in sealed biohazard bags, stored in freezer [LOCATION] for scheduled pickup by [VENDOR]\n\nNever mix sharps with soft waste. Never place glass (even non-biohazardous glass) in soft waste bags without sharps-resistant secondary packaging."
      },
      {
        heading: "2. Treatment and Disposal",
        body: "AUTOCLAVE DECONTAMINATION: Soft biohazardous waste must be autoclaved using the validated biohazardous waste decontamination cycle before disposal as non-hazardous waste (see Autoclave Validation & Operation SOP). After successful autoclave treatment (verified by BI or chemical indicator), bags are removed from the autoclave bag and placed in standard trash. The outer autoclave bag is marked with the autoclave date, operator initials, and 'DECONTAMINATED'.\n\nCHEMICAL DISINFECTION: Liquid biohazardous waste may be chemically disinfected using [APPROVED DISINFECTANT at CONCENTRATION] with a minimum contact time of [TIME] before disposal to the drain, subject to institutional policy and state/local regulations.\n\nCONTRACTOR DISPOSAL: Sharps containers and untreated biohazardous waste (when autoclave is unavailable) are collected by licensed medical waste contractor [CONTRACTOR NAME]. Containers are picked up [FREQUENCY] from [PICKUP LOCATION]. The generator must complete the waste manifest and retain copies for [3 years]."
      },
      {
        heading: "3. Spills and Emergency Procedures",
        body: "BIOHAZARDOUS WASTE SPILL: (1) Alert others to avoid the area. (2) Don appropriate PPE: gown, gloves, eye protection. (3) Apply disinfectant to the spill area and allow proper contact time (minimum 20 minutes). (4) Collect spill material using absorbent paper towels or spill kit. (5) Dispose of cleanup materials as biohazardous waste. (6) Clean the area with a second application of disinfectant. (7) Report the spill to the Biosafety Officer and document using the incident report form.\n\nSHARPS INJURY DURING WASTE HANDLING: Follow the Medical Emergency Response Procedure for needlestick/sharps injuries immediately. Report to supervisor and EHS. Complete an incident report."
      },
    ],
  },

  {
    id: "lib-021",
    title: "Sharps Handling & Disposal SOP",
    category: "sop",
    group: "Biosafety",
    description: "Safe practices for handling, using, and disposing of needles, syringes, lancets, scalpels, and broken glass, including sharps container management and needlestick response.",
    regulatoryBasis: "29 CFR 1910.1030 / Needlestick Safety Act",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Sharps Safety Engineering Controls",
        body: "In compliance with the Needlestick Safety and Prevention Act and 29 CFR 1910.1030(d)(2), [COMPANY NAME] evaluates and uses sharps with engineered sharps injury protections (SESIPs) where feasible. Engineering controls take priority over work practice controls and PPE. Currently approved SESIPs include: safety-engineered needles with retractable or shielded mechanisms for [APPLICATIONS], needleless systems for IV line connections, and safety scalpel systems for [PROCEDURES].\n\nSharps containers are provided at the point of use. Containers must be puncture-resistant, leak-proof on sides and bottom, labeled with the biohazard symbol, and not more than 3/4 full when sealed. Sharps containers are located at: [LIST ALL LOCATIONS]."
      },
      {
        heading: "2. Safe Work Practices",
        body: "• NEVER recap needles using both hands or any technique that involves directing the needle toward any part of the body. One-handed scoop method may be used only when absolutely required by the procedure.\n• Dispose of used needles immediately after use into the sharps container — do not set down on the bench.\n• Do not bend, break, or remove needles from syringes by hand.\n• Do not overfill sharps containers — seal when 3/4 full.\n• Broken glass must not be picked up by hand — use a brush and dustpan, forceps, or tongs. Broken glass from biohazardous areas goes to the sharps container; non-biohazardous broken glass goes to a puncture-resistant 'broken glass' container labeled as such.\n• Scalpels must be handled with forceps or a scalpel handle when removing blades — never by hand.\n• When working with sharps in BSL-2 areas: wear double gloves for procedures that present the highest risk of needlestick (retro-orbital injections, cardiac puncture)."
      },
      {
        heading: "3. Sharps Container Management and Disposal",
        body: "SEALING: When a sharps container is 3/4 full, seal it using the locking lid mechanism. Do not push material down into the container. Place the sealed container in a secondary biohazard box or place directly for medical waste pickup.\n\nDISPOSAL: Sealed sharps containers are disposed of through the licensed medical waste contractor [CONTRACTOR NAME]. Sealed containers are stored in [DESIGNATED STORAGE AREA] until pickup. Never place sharps containers in the regular trash or recycling. Sharps container pickup schedule: [FREQUENCY].\n\nNEEDLESTICK RESPONSE: See Medical Emergency Response Procedure for immediate actions. All needlestick injuries must be reported to the supervisor and EHS manager within 24 hours and documented using the Bloodborne Pathogen Exposure Incident Report form."
      },
    ],
  },

  {
    id: "lib-022",
    title: "Laboratory Decontamination & Disinfection SOP",
    category: "sop",
    group: "Biosafety",
    description: "Procedures for selecting disinfectants, decontaminating surfaces and equipment, managing chemical compatibility, and verifying decontamination effectiveness.",
    regulatoryBasis: "CDC BMBL / EPA Registered Disinfectants",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "1. Disinfectant Selection",
        body: "Not all disinfectants are effective against all biological agents. Select the appropriate disinfectant based on the organism class and the surface or material being decontaminated:\n\n• 70% ETHANOL: Effective against most vegetative bacteria, enveloped viruses (HIV, influenza), many fungi. Fast-acting, good for surface decontamination. NOT effective against bacterial spores, non-enveloped viruses, or mycobacteria at standard concentrations. Flammable — do not use near ignition sources.\n• 10% BLEACH (0.5% sodium hypochlorite): Broad-spectrum activity including bacteria, viruses, fungi, mycobacteria, and spores. Effective against most BSL-2 agents. Corrosive — inactivates in the presence of organic material; pre-clean surfaces before applying. Must be prepared fresh daily from 5.25% stock bleach.\n• QUATERNARY AMMONIUM COMPOUNDS (e.g., [PRODUCT NAME]): Effective against vegetative bacteria and enveloped viruses. Not sporicidal. Residue can build up on surfaces over time.\n\nFor BSL-2 organisms: 10% bleach or 70% ethanol with a 20-minute contact time is the standard recommendation."
      },
      {
        heading: "2. Surface Decontamination Procedure",
        body: "ROUTINE DAILY DECONTAMINATION (end of each work session):\n1. Remove all items from the work surface.\n2. Apply disinfectant by spray or pre-wetted wipe, ensuring all surfaces are visibly wet.\n3. Allow the contact time appropriate to the disinfectant: 10 minutes for 70% ethanol, 20 minutes for 10% bleach.\n4. Wipe surfaces dry with a clean paper towel or gauze. Dispose as biohazardous waste if the surface was contaminated with biohazardous materials.\n\nAFTER SPILL OF BIOHAZARDOUS MATERIAL:\n1. Flood the spill with 10% bleach solution.\n2. Allow 20-minute contact time — do not disturb.\n3. Wipe up using disposable paper towels or gauze, working from the outside of the spill toward the center.\n4. Apply a second application of disinfectant, allow contact time, and wipe dry.\n5. Dispose of all cleanup materials as biohazardous waste.\n6. Notify the Biosafety Officer of all significant spills."
      },
      {
        heading: "3. Equipment Decontamination",
        body: "CENTRIFUGES: Decontaminate rotor, buckets, and interior chamber with 10% bleach after any run involving biohazardous materials, and after any rotor failure or tube breakage. After bleach treatment (20 min contact), wipe dry and rinse with water to prevent corrosion. Remove bleach residue from metal components within 30 minutes of application.\n\nFRIDGES AND FREEZERS: Decontaminate with 70% ethanol after any spill. Before moving or decommissioning, the interior must be decontaminated and the Biosafety Officer must sign off.\n\nLABORATORY INSTRUMENTS (pH meters, balances, pipettes): Wipe down with 70% ethanol after use with any biohazardous material. For instruments that cannot tolerate alcohol or bleach, consult the Biosafety Officer for alternative decontamination methods."
      },
    ],
  },

  // ── Waste Management ─────────────────────────────────────────────────────────

  {
    id: "lib-023",
    title: "Hazardous Waste Management Plan",
    category: "plan",
    group: "Waste Management",
    description: "Written plan covering generator status determination, waste characterization, accumulation time limits, satellite accumulation areas, labeling, manifesting, and transporter selection.",
    regulatoryBasis: "40 CFR 262 (RCRA) / State Hazardous Waste Regs",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Generator Status and EPA ID",
        body: "[COMPANY NAME] is classified as a [LARGE QUANTITY GENERATOR / SMALL QUANTITY GENERATOR / VERY SMALL QUANTITY GENERATOR] of hazardous waste under RCRA (40 CFR 262) based on the quantity of hazardous waste generated per calendar month. EPA ID Number: [EPA ID]. State Hazardous Waste Permit/Registration: [STATE PERMIT NUMBER].\n\nGenerator status is reassessed [ANNUALLY / QUARTERLY] or whenever changes in operations could alter waste generation quantities. If monthly generation exceeds [SQG/LQG threshold], management must be notified immediately so that storage, accumulation, and training requirements can be updated accordingly. The person responsible for maintaining compliance with this plan is [EHS MANAGER NAME, TITLE, CONTACT]."
      },
      {
        heading: "2. Waste Characterization and Satellite Accumulation",
        body: "All hazardous waste must be properly characterized before accumulation. Waste is characterized as RCRA hazardous if it appears on the RCRA listed wastes (F, K, P, or U lists) or if it exhibits a characteristic of ignitability, corrosivity, reactivity, or toxicity. Waste streams generated at [COMPANY NAME] and their RCRA characterization: [INSERT WASTE STREAM TABLE — chemical name, EPA waste code, physical state, primary hazard]\n\nSATELLITE ACCUMULATION: Hazardous waste may be accumulated at or near the point of generation (satellite accumulation area, SAA) by employees who generate the waste, subject to: (a) maximum quantity of 55 gallons of non-acute hazardous waste (or 1 quart of acute hazardous waste); (b) containers must be in good condition, compatible with the waste, kept closed except during waste addition, and labeled 'Hazardous Waste'; (c) SAAs are designated at: [LIST SAA LOCATIONS]."
      },
      {
        heading: "3. Accumulation Time Limits and Manifesting",
        body: "Hazardous waste must be moved from satellite accumulation areas to the Central Accumulation Area (CAA) at [LOCATION] when the SAA quantity limit is reached. From the CAA, waste must be shipped off-site within [90 days for LQG / 270 days for SQG] of the accumulation start date. The accumulation start date is marked on the container when it arrives at the CAA.\n\nMANIFESTING: All off-site shipments of RCRA hazardous waste must be accompanied by a properly completed Uniform Hazardous Waste Manifest (EPA Form 8700-22). The manifest must be completed by [EHS MANAGER] and must include: generator identification, waste description and EPA waste codes, quantity, container type, and transporter information. Signed copies of manifests must be retained for 3 years. If a signed copy of the manifest is not received from the disposal facility within 45 days, [EHS MANAGER] must file an Exception Report with the Regional EPA Administrator."
      },
      {
        heading: "4. Emergency Procedures and Recordkeeping",
        body: "EMERGENCY COORDINATOR: [NAME, PHONE] is designated as the Emergency Coordinator and is available 24 hours per day. In the event of a fire, explosion, or release of hazardous waste that could threaten human health or the environment, the Emergency Coordinator will: notify facility personnel, call 911 if necessary, assess the release and contain it if possible, and notify the National Response Center (1-800-424-8802) if a reportable quantity has been released.\n\nRECORDKEEPING: The following records must be maintained at the facility for the specified periods: Manifests and Land Disposal Restriction forms — 3 years; Waste analysis data — 3 years; Training records — 3 years from when training was last completed; Annual/biennial waste reports — 3 years; Exception reports — 3 years. All records are maintained in SafetyIQ and in [PHYSICAL LOCATION] and are available for inspection by regulatory authorities."
      },
    ],
  },

  {
    id: "lib-024",
    title: "Chemical Waste Disposal SOP",
    category: "sop",
    group: "Waste Management",
    description: "Step-by-step procedures for characterizing, containerizing, labeling, and preparing chemical waste for pickup by a licensed hazardous waste disposal contractor.",
    regulatoryBasis: "40 CFR 262 / EPA / State Regs",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Chemical Waste Identification and Segregation",
        body: "Chemical waste must be identified and segregated at the point of generation to ensure compatibility, safety, and regulatory compliance. NEVER mix chemicals that are reactive with each other. The following segregation rules must be followed:\n\n• Acids must be kept separate from bases and cyanides\n• Oxidizers must be kept separate from flammables and organics\n• Halogenated solvents (chloroform, methylene chloride, carbon tetrachloride) must be kept separate from non-halogenated solvents (acetone, ethanol, toluene) — they have different disposal costs and methods\n• Aqueous waste must be kept separate from organic waste\n• Reactive materials (peroxides, water-reactive metals, pyrophorics) require special handling — contact EHS before disposing of reactive waste\n\nDo NOT pour chemical waste down the drain unless it has been explicitly approved by the EHS Manager and is compliant with local wastewater treatment standards."
      },
      {
        heading: "2. Container Requirements and Labeling",
        body: "Chemical waste containers must be: (a) compatible with the waste — use the same material as the original container when possible; (b) in good condition — no rust, swelling, or damage; (c) securely sealed when not adding waste; and (d) labeled as 'Hazardous Waste' from the time waste is first added.\n\nHAZARDOUS WASTE LABELS must include: (a) the words 'Hazardous Waste'; (b) the composition and physical state of the waste (e.g., 'Halogenated Solvent Waste — Chloroform/Methanol'); (c) the generator's name, address, and EPA ID; and (d) the accumulation start date when the container is moved to the Central Accumulation Area. Use the [COMPANY NAME] standard Hazardous Waste label, available from [EHS / SAFETY SUPPLY ROOM]. Do NOT use standard Biohazard labels on chemical waste or vice versa."
      },
      {
        heading: "3. Pickup Scheduling and Container Preparation",
        body: "SCHEDULING PICKUP: Contact the hazardous waste coordinator [NAME, PHONE/EMAIL] to schedule a pickup when: (a) a satellite accumulation container is 3/4 full; (b) the type of waste change or a new waste stream is generated; or (c) the scheduled pickup frequency is reached. Pickup is scheduled through licensed hazardous waste transporter [CONTRACTOR NAME, CONTACT].\n\nCONTAINER PREPARATION: Before pickup, verify: (a) all containers are properly closed and sealed; (b) all labels are complete and legible; (c) containers are not leaking or damaged; (d) waste characterization data is available for the manifest; and (e) incompatible waste streams are segregated and not stored in the same secondary containment tray. Prepare the hazardous waste manifest with [EHS MANAGER]. Weigh and record the weight of each container in the Waste Disposal Log in SafetyIQ."
      },
    ],
  },

  {
    id: "lib-025",
    title: "Universal Waste Program",
    category: "procedure",
    group: "Waste Management",
    description: "Procedures for managing batteries, lamps, pesticides, and mercury-containing equipment under the Universal Waste Rule including labeling, accumulation limits, and employee training.",
    regulatoryBasis: "40 CFR 273 / EPA Universal Waste Rule",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Universal Waste Types and Storage",
        body: "The EPA Universal Waste Rule (40 CFR 273) establishes streamlined management requirements for certain widely generated hazardous wastes: batteries, pesticides, mercury-containing equipment, and lamps (including fluorescent, HID, and LED lamps containing mercury). At [COMPANY NAME], the primary universal wastes generated include:\n\n• LAMPS: Fluorescent tubes, CFLs, UV-B lamps, HID bulbs from laboratory equipment\n• BATTERIES: Rechargeable nickel-cadmium and lithium batteries, lead-acid batteries from UPS units\n• MERCURY-CONTAINING EQUIPMENT: Thermometers, barometers, switches\n\nUniversal wastes must be stored in a designated container or area, in good condition, and clearly labeled 'Universal Waste — [type]' and the accumulation start date. Maximum accumulation quantity for a Small Quantity Handler: 5,000 kg total of all universal wastes at one time."
      },
      {
        heading: "2. Collection Points and Disposal",
        body: "LAMP COLLECTION: Spent fluorescent and UV lamps must be placed in the original box or a cardboard box with padding to prevent breakage. Do not break lamps — broken lamps must be managed as RCRA hazardous waste (mercury D009), not universal waste. Lamp collection containers are located at [LOCATIONS]. Containers are sent to [RECYCLER NAME] for recycling.\n\nBATTERY COLLECTION: Rechargeable batteries (NiCd, Li-ion) must be taped at the terminals before collection to prevent short circuits. Battery collection containers are at [LOCATIONS]. Lead-acid batteries (from UPS) are returned to the vendor for recycling.\n\nMERCURY EQUIPMENT: Mercury thermometers, manometers, and switches must be placed in a sealed container with enough absorbent material to contain the mercury if breakage occurs. Label 'Universal Waste — Mercury-containing equipment'. Contact EHS to arrange disposal with [VENDOR]."
      },
      {
        heading: "3. Broken Lamp and Mercury Spill Response",
        body: "BROKEN FLUORESCENT LAMP: Ventilate the area (open windows, leave for 15 minutes). Do not use a vacuum cleaner — this disperses mercury vapor. Collect glass fragments with stiff cardboard or sticky tape. Place all materials in a sealed plastic bag. Label as 'Hazardous Waste — Mercury' and notify EHS for proper disposal.\n\nMERCURY SPILL: Evacuate the area. Call EHS: [PHONE]. Do not walk through mercury or use a vacuum. Mercury spills require specialized cleanup by [EHS / CONTRACTED MERCURY REMEDIATION VENDOR]. Keep the area closed and ventilated until cleanup is complete."
      },
    ],
  },

  {
    id: "lib-026",
    title: "Pharmaceutical Waste Disposal Procedure",
    category: "procedure",
    group: "Waste Management",
    description: "Procedures for identifying and disposing of non-hazardous and hazardous pharmaceutical waste (P-listed, U-listed drugs) in compliance with EPA and DEA regulations.",
    regulatoryBasis: "40 CFR 266.500 / DEA 21 CFR 1317",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "1. Pharmaceutical Waste Classification",
        body: "Pharmaceutical waste generated at [COMPANY NAME] must be evaluated for regulatory status before disposal. Classifications include:\n\n• NON-RCRA HAZARDOUS PHARMACEUTICAL WASTE: Pharmaceuticals not meeting RCRA hazardous criteria. May be disposed of through a licensed pharmaceutical waste contractor or, in some cases, via approved wastewater or solid waste pathways — consult EHS and state regulations.\n• RCRA HAZARDOUS PHARMACEUTICAL WASTE (U-Listed): Commercial chemical products that are discarded and appear on the U list (e.g., U-listed chemotherapy drugs, certain solvents). Must be managed as RCRA hazardous waste.\n• RCRA ACUTELY HAZARDOUS PHARMACEUTICAL WASTE (P-Listed): Discarded commercial chemical products on the P list (e.g., certain chemotherapy drugs, some controlled substances). Acutely hazardous — subject to 1-quart/1-kg SAA limits and heightened management.\n• DEA-CONTROLLED SUBSTANCES: Must be surrendered to an authorized DEA-registered collector or reverse distributor. Contact [DEA COORDINATOR / PHARMACY / EHS] for controlled substance disposal procedures."
      },
      {
        heading: "2. Collection, Labeling, and Disposal",
        body: "Pharmaceutical waste must be collected in blue-lidded pharmaceutical waste containers (non-hazardous) or properly labeled RCRA hazardous waste containers (for P-listed and U-listed pharmaceuticals). Pharmaceutical waste must NOT be mixed with regular trash, biohazardous waste, or general chemical waste unless specifically approved by EHS.\n\nLABELING: Containers must be labeled 'Pharmaceutical Waste' at minimum. For RCRA hazardous pharmaceutical waste: apply a Hazardous Waste label with waste description (e.g., 'U-Listed Pharmaceutical Waste — Cyclophosphamide') and accumulation start date. Disposal is arranged through [PHARMACEUTICAL WASTE CONTRACTOR NAME, CONTACT]. Schedule pickup when containers are 3/4 full."
      },
    ],
  },

  // ── Lab SOPs ─────────────────────────────────────────────────────────────────

  {
    id: "lib-027",
    title: "Chemical Fume Hood Operation & Inspection SOP",
    category: "sop",
    group: "Lab SOPs",
    description: "Proper procedures for working in chemical fume hoods including face velocity verification, sash position, work practice requirements, and annual certification documentation.",
    regulatoryBasis: "29 CFR 1910.1450 / ANSI/AIHA Z9.5",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Fume Hood Purpose and Approved Uses",
        body: "Chemical fume hoods are local exhaust ventilation devices that protect workers from inhalation exposure to hazardous chemical vapors, gases, mists, and aerosols. They exhaust air to the outdoors through the building HVAC system. Chemical fume hoods must be used for: all work involving volatile chemicals with OELs; all work with chemicals that have strong odors; all work with toxic, corrosive, or reactive chemicals that could produce hazardous vapors; and all chemical heating or evaporation procedures.\n\nChemical fume hoods must NOT be used as: biological safety cabinets (they provide no protection against biological aerosols); storage cabinets for chemicals (unless temporary — excess chemical in the hood blocks airflow); or as substitutes for enclosures designed to contain explosions."
      },
      {
        heading: "2. Pre-Use Inspection and Proper Use",
        body: "BEFORE USE:\n• Verify the hood monitor alarm is functioning and not in alarm. If the alarm is activated, do not use the hood — report immediately to Facilities.\n• Check the certification sticker — fume hoods must be certified annually. Do not use an uncertified hood.\n• Turn on the hood blower if not already operating (many hoods run continuously — verify locally).\n• Position the sash at or below the working height mark indicated on the sash rail. The recommended work sash height is [SPECIFY — typically 18 inches] for maximum face velocity.\n\nDURING USE:\n• Keep all materials at least 6 inches inside the sash opening.\n• Do not block the rear baffle openings with equipment or materials.\n• Work slowly — rapid arm movements in and out of the hood disrupt airflow and can pull contaminants into the breathing zone.\n• Keep the sash at or below the certified work height at all times during chemical use.\n• Do not put your head inside the hood."
      },
      {
        heading: "3. Annual Certification and Daily Inspection Log",
        body: "ANNUAL CERTIFICATION: Each chemical fume hood must be certified annually by a qualified industrial hygienist or certified hood contractor. Certification includes: (a) face velocity measurement (ANSI/AIHA Z9.5 standard: 80-120 fpm at the working sash height); (b) airflow visualization test (smoke pencil); (c) alarm and sash function test. A certification sticker must be affixed to the hood showing the certified date, measured face velocity, and certifier name.\n\nDAILY INSPECTION: Users must perform a brief daily inspection before each use, verifying that: the alarm is not activated; the sash moves freely and closes to the sash stop; no obvious blockages exist at the face or rear baffle. The Fume Hood Daily Inspection Log (posted at each hood) must be initialed by the user each day the hood is used. Completed logs are turned in to EHS monthly."
      },
    ],
  },

  {
    id: "lib-028",
    title: "Chemical Storage & Segregation SOP",
    category: "sop",
    group: "Lab SOPs",
    description: "Procedures for segregating incompatible chemicals, secondary containment requirements, quantity limits, labeling standards, and periodic inventory reconciliation.",
    regulatoryBasis: "29 CFR 1910.1200 / NFPA 45 / IFC",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Chemical Compatibility and Segregation Rules",
        body: "Chemicals that could react dangerously if mixed must be physically separated. Do not store incompatible chemicals in the same cabinet, secondary containment tray, or refrigerator. Key segregation requirements:\n\n• FLAMMABLES (Class IB and IC solvents): Store in approved flammable storage cabinets or flammable-rated refrigerators. Separate from oxidizers by at least 20 feet or a 30-minute fire wall.\n• CORROSIVES (acids and bases): Acids and bases must be stored in separate cabinets or separate secondary containment trays — do not mix. Strong oxidizing acids (nitric acid, perchloric acid) must be stored separately from organic acids and flammable materials.\n• OXIDIZERS: Store in a dry location away from flammables, organics, and reducing agents.\n• TOXICS AND CARCINOGENS: Store in a locked cabinet with secondary containment. Access limited to trained personnel.\n• CRYOGENICS: Store in insulated dewars in well-ventilated areas. Dewars must be vented — never seal a cryogen dewar."
      },
      {
        heading: "2. Quantity Limits and Container Labeling",
        body: "QUANTITY LIMITS: Laboratory working quantities of flammable and combustible liquids are limited per NFPA 45 and the International Fire Code. Maximum quantities per 100 square feet of laboratory space: [INSERT NFPA 45 TABLE OR FACILITY-SPECIFIC LIMITS]. Quantities exceeding working limits must be stored in the approved flammable storage room [LOCATION].\n\nCONTAINER LABELING: All chemical containers must be labeled with at minimum: chemical name, hazard warning(s) or GHS pictogram(s), and owner/lab identification. Secondary containers (aliquots, working solutions) must be labeled with chemical name and concentration. Labels must be legible and resistant to the working conditions. Never relabel a container with a different chemical — use a new, clean container.\n\nSECONDARY CONTAINMENT: All liquid chemicals stored in cabinets or on benches must be in secondary containment (trays, bins) capable of holding the volume of the largest container plus 10%."
      },
      {
        heading: "3. Inventory Reconciliation and Expired Chemicals",
        body: "A complete physical inventory of all chemicals in [COMPANY NAME]'s laboratories must be conducted [ANNUALLY / SEMI-ANNUALLY] and compared to the SafetyIQ Chemical Management module. Discrepancies must be investigated and resolved. New chemicals must be entered into the Chemical Management system before they are received into the laboratory.\n\nEXPIRED AND UNWANTED CHEMICALS: Chemicals that are expired, contaminated, or no longer needed must be identified during inventory review and submitted for disposal as hazardous waste within 60 days of identification. Peroxide-forming chemicals (ethers, THF, dioxane) must be checked for peroxide content at the intervals specified on their labels and disposed of if the peroxide level exceeds the manufacturer's recommendation or if the container is more than 12 months past the opening date, whichever comes first."
      },
    ],
  },

  {
    id: "lib-029",
    title: "Chemical Inventory Management Procedure",
    category: "procedure",
    group: "Lab SOPs",
    description: "Procedures for maintaining an accurate chemical inventory including new chemical approval, SDS management, annual physical inventory, and disposal of expired or unwanted chemicals.",
    regulatoryBasis: "29 CFR 1910.1200 / EPCRA Section 312",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. New Chemical Procurement Approval",
        body: "No new chemical substance may be introduced into [COMPANY NAME] facilities without prior authorization. The procedure for new chemical approval is:\n\n1. Researcher submits a New Chemical Approval Request to [EHS MANAGER / CHEMICAL HYGIENE OFFICER] using the form in SafetyIQ.\n2. The request must include: chemical name, CAS number, supplier, intended use, quantity, hazard information, and proposed storage location.\n3. The CHO/EHS Manager reviews the request for: (a) whether a less hazardous substitute is available; (b) appropriate hazard controls; (c) whether the chemical is a Particularly Hazardous Substance requiring enhanced controls; (d) storage compatibility with chemicals already in the proposed location.\n4. Approval or denial is communicated within [5 business days]. Conditionally approved chemicals may require a site-specific SOP before use.\n5. Upon approval, the chemical is entered into the SafetyIQ Chemical Management module and an SDS is obtained before the chemical is received."
      },
      {
        heading: "2. SDS Management and Reporting",
        body: "An SDS must be on file in SafetyIQ for every hazardous chemical in use at [COMPANY NAME]. SDSs must comply with the GHS 16-section format (OSHA 29 CFR 1910.1200 Appendix D). When an updated SDS is received from a supplier, the new version must be uploaded to SafetyIQ and the previous version archived (not deleted) with a notation of the supersession date.\n\nEPCRA SECTION 312 REPORTING: If on-site quantities of any hazardous chemical or Extremely Hazardous Substance (EHS) exceed the applicable reporting threshold at any time during the calendar year, [COMPANY NAME] must file a Tier II chemical inventory report with the State Emergency Response Commission (SERC), Local Emergency Planning Committee (LEPC), and local fire department by March 1 of the following year. This reporting obligation is evaluated annually by [EHS MANAGER] using the chemical inventory data in SafetyIQ."
      },
      {
        heading: "3. Annual Physical Inventory",
        body: "A complete physical inventory of all chemicals in each laboratory and storage area must be conducted annually, typically in [MONTH]. The physical inventory is conducted by laboratory personnel and verified by EHS. Procedure:\n\n1. Print the current chemical inventory for each location from SafetyIQ.\n2. Physically locate each chemical on the inventory list and verify: container condition, label legibility, presence of secondary containment, quantity, and expiration date.\n3. Add chemicals found that are not in the system. Mark chemicals on the inventory that cannot be located.\n4. Flag expired chemicals, peroxide-formers past their opening dates, and chemicals in damaged containers for disposal.\n5. Submit the completed inventory reconciliation to EHS within [10 business days] of the physical count.\n6. Discrepancies that cannot be resolved (e.g., missing scheduled substances) must be escalated to [EHS MANAGER / SECURITY] immediately."
      },
    ],
  },

  {
    id: "lib-030",
    title: "PPE Selection Guide",
    category: "guideline",
    group: "Lab SOPs",
    description: "Reference guide for selecting appropriate gloves, eye protection, lab coats, and respiratory protection based on chemical hazard class, task, and exposure route.",
    regulatoryBasis: "29 CFR 1910.132-138",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Glove Selection by Chemical Class",
        body: "Glove selection must be based on the specific chemical(s) being handled, task duration, and expected contact level. Permeation rate and breakthrough time data from glove manufacturer testing guides must be used for all non-routine applications. General guidance:\n\n• NITRILE (disposable, 4-6 mil): Good protection for aqueous solutions, dilute acids and bases, non-chlorinated solvents; standard laboratory glove. Poor protection for chloroform, methylene chloride, MEK — check permeation data.\n• LATEX (disposable): Similar to nitrile; allergy risk makes nitrile preferred. Avoid where latex sensitivity is present.\n• NEOPRENE: Good for oils, greases, moderate acids and bases; common for wet chemical work.\n• BUTYL RUBBER: Best resistance to ketones, esters, alcohols, and certain acids (including perchloric and nitric acid). Required for formaldehyde handling.\n• SILVER SHIELD / BARRIER LAMINATE: Broad spectrum protection, including many chemicals nitrile does not protect against. Use when chemical identity is uncertain.\n\nDouble-gloving (two pairs of disposable nitrile) is recommended for biohazardous materials, highly toxic chemicals, and prolonged contact with concentrated chemicals."
      },
      {
        heading: "2. Eye and Face Protection",
        body: "Selection of eye protection depends on the hazard type and the task:\n\n• SAFETY GLASSES with side shields (ANSI Z87.1): Minimum requirement for all personnel in laboratory areas. Protects against impact and incidental splashes from above. Not adequate for chemical splash hazards.\n• CHEMICAL SPLASH GOGGLES (indirect-vent): Required when working with liquids that could splash — corrosives, solvents, biohazardous liquids. Must seal against the face without gaps. Required when pouring, transferring, mixing, or heating chemicals.\n• FACE SHIELD (ANSI Z87.1): Used over safety glasses or goggles when large splash, spray, or projectile risk exists — distillation, autoclave opening, emergency shower administration. A face shield alone does not meet the eye protection requirement for chemical hazards.\n• LASER SAFETY EYEWEAR: Wavelength-specific protection is required for each laser type. Consult the Laser Safety Program for specific requirements."
      },
      {
        heading: "3. Lab Coat and Respiratory Protection",
        body: "LAB COAT SELECTION: Lab coats protect clothing and provide some skin protection. Selection considerations:\n• Cotton or cotton-poly blend: Standard for most chemical lab work. Provides no flame resistance — do not use with pyrophorics or when working near open flames without additional protection.\n• Flame-resistant (FR): Required when working with flammable solvents at elevated temperatures, open flames, or pyrophorics.\n• Fluid-resistant/disposable Tyvek: For BSL-2 work, handling biohazardous materials, or procedures with high splash potential.\n\nLab coats must be removed before leaving the laboratory and must not be worn in non-laboratory areas (cafeteria, offices). Lab coats used in biohazardous work must be decontaminated before laundering.\n\nRESPIRATORY PROTECTION: Selection of respiratory protection requires a hazard assessment and must be conducted under the Respiratory Protection Program. Voluntary use of dust masks requires a physician determination that use will not harm health, and the employee must be provided with Appendix D of 29 CFR 1910.134. Do not wear a respirator without training and fit testing except for N95 voluntary use per the above provisions."
      },
    ],
  },

  {
    id: "lib-031",
    title: "Centrifuge Safety SOP",
    category: "sop",
    group: "Lab SOPs",
    description: "Safe operation procedures for laboratory centrifuges including rotor inspection, balance requirements, containment for biohazardous samples, and emergency rotor failure response.",
    regulatoryBasis: "OSHA Best Practices / Manufacturer Guidelines",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "1. Pre-Use Inspection and Rotor Requirements",
        body: "Before each use: (1) Inspect the rotor for cracks, corrosion, pitting, or damage — do not use a damaged rotor; report to [LAB MANAGER/EHS]. (2) Check that the rotor O-ring (if applicable) is in place and properly seated. (3) Verify that the correct rotor and tubes are being used for the centrifuge model and intended speed — consult the manufacturer's rotor/tube compatibility chart. (4) Never exceed the manufacturer's maximum speed specification for any rotor. (5) Allow the rotor to cool to room temperature before switching to a different application if it has been run at maximum speed — metal fatigue accumulates at elevated temperatures.\n\nROTOR RETIREMENT: All rotors must be retired at the manufacturer's recommended use cycle or after any incident of overload, overspeed, impact, or corrosion exposure. The rotor retirement date and maintenance log are maintained in SafetyIQ."
      },
      {
        heading: "2. Balancing, Loading, and Operation",
        body: "BALANCING: All loads must be balanced to within the tolerance specified by the manufacturer (typically ±0.1 g for microcentrifuges, ±1 g for larger rotors). Use a balance to ensure opposing tubes are matched in weight. Never run a centrifuge with an odd number of tubes without a blank balance tube of matching weight and geometry.\n\nBIOHAZARDOUS SAMPLES: For biohazardous or potentially infectious samples, use sealed rotor caps or safety buckets with O-ring sealed lids. Check the O-ring condition before every run. After centrifugation of biohazardous material, do not open buckets outside of the BSC. If a tube breaks inside a sealed rotor during a biohazardous run, follow the biological spill procedures for BSC.\n\nOPERATION: Start at low speed and increase gradually if the centrifuge exhibits unusual vibration or noise. The centrifuge must not be left unattended during the initial minutes of a high-speed run with a new load configuration."
      },
    ],
  },

  {
    id: "lib-032",
    title: "Laboratory Equipment Calibration & Maintenance SOP",
    category: "sop",
    group: "Lab SOPs",
    description: "Procedures for scheduling, performing, and documenting calibration of laboratory instruments including balances, pH meters, pipettes, and temperature-controlled equipment.",
    regulatoryBasis: "ISO 9001 / GLP Best Practices",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "1. Calibration Schedule and Master Equipment List",
        body: "All laboratory instruments used for measurements that affect product quality, safety determinations, or regulatory compliance must be included in the Calibration Program. The Master Equipment List (MEL) is maintained in SafetyIQ and includes for each instrument: equipment ID, description, model, serial number, location, calibration frequency, calibration method, last calibration date, and next due date.\n\nAny instrument found to be out of calibration or producing suspect results must be immediately taken out of service and labeled 'OUT OF SERVICE — DO NOT USE' until recalibrated or repaired. Results generated by out-of-calibration equipment must be assessed for impact on any data used for regulatory, safety, or product quality decisions."
      },
      {
        heading: "2. Calibration Procedures by Instrument Type",
        body: "ANALYTICAL BALANCES: Calibrate using NIST-traceable Class F (or better) calibration weights. Verify daily with a check weight. External calibration using calibration weights at the points of use must be performed [monthly/quarterly] or per manufacturer recommendation. Record: date, technician, standard ID, as-found and as-left values, pass/fail.\n\npH METERS: Calibrate with at least two pH buffer standards bracketing the expected sample pH range before each day of use (2-point calibration). Verify calibration with a third-point buffer. Record calibration slope — if slope is less than 95% or greater than 105% of theoretical, replace the electrode.\n\nPIPETTES: All pipettes used in critical measurements must be gravimetrically verified at [FREQUENCY — e.g., semi-annually]. Use calibrated analytical balance and deionized water. Test at minimum at 10%, 50%, and 100% of nominal volume. Pipettes with >1% bias at any test volume must be removed from service and repaired or replaced.\n\nTEMPERATURE-CONTROLLED EQUIPMENT (incubators, freezers, refrigerators): Verify temperature using a calibrated, independent thermometer weekly for equipment critical to biological sample integrity. Record temperature and calibrated thermometer ID. Calibration of temperature probes every [12 months]."
      },
    ],
  },

  // ── Regulatory & Recordkeeping ───────────────────────────────────────────────

  {
    id: "lib-033",
    title: "OSHA Injury & Illness Recordkeeping Program",
    category: "procedure",
    group: "Regulatory & Recordkeeping",
    description: "Written program documenting criteria for recording work-related injuries and illnesses on OSHA 300 Log, completing 301 Incident Reports, and posting the 300A Summary.",
    regulatoryBasis: "29 CFR 1904",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. Recording Criteria and Recordable Cases",
        body: "All work-related injuries and illnesses that result in any of the following must be recorded on the OSHA 300 Log: (1) days away from work; (2) restricted work or job transfer; (3) loss of consciousness; (4) medical treatment beyond first aid; (5) diagnosis by a physician as a significant injury or illness; (6) work-related hearing loss (confirmed standard threshold shift); (7) work-related tuberculosis; (8) needlestick with blood or OPIM.\n\nInjuries and illnesses that involve only first aid treatment (as defined in 29 CFR 1904.7(a)) are NOT recorded. A 'work-related' injury or illness is one where the work environment caused or contributed to the condition, or significantly aggravated a pre-existing condition. Completion of the OSHA 300 and 301 is the responsibility of [EHS MANAGER NAME]. Supervisors must report all work-related injuries and illnesses to [EHS MANAGER] within 24 hours."
      },
      {
        heading: "2. OSHA 300 Log, 300A Summary, and 301 Incident Report",
        body: "OSHA 300 LOG: Must be updated within 7 calendar days of receiving information that a recordable injury or illness has occurred. The 300 Log is maintained in the SafetyIQ OSHA Logs module for the current calendar year. Privacy cases (certain sensitive injuries) must be recorded without the employee's name — enter 'Privacy case' in the name field. The 300 Log must be retained for 5 years following the end of the calendar year it covers.\n\nOSHA 301 INCIDENT REPORT: A separate Form 301 must be completed for each recordable case within 7 calendar days of the injury or illness. The Form 301 captures detailed information including: employee information, incident description, how the injury occurred, what object or substance caused the harm, and medical treatment information. Forms 301 are retained for 5 years.\n\nOSHA 300A ANNUAL SUMMARY: The 300A must be completed by February 1 each year, covering the prior calendar year. It must be certified by a company executive (owner, officer, principal) and posted in the workplace from February 1 through April 30. Establishments covered by OSHA's Electronic Recordkeeping Rule (29 CFR 1904.41) must submit the 300A electronically to OSHA by March 2."
      },
      {
        heading: "3. Fatality and Severe Injury Reporting",
        body: "In addition to recordkeeping, certain injuries require immediate notification to OSHA:\n\n• FATALITY: Report all work-related fatalities to OSHA within 8 hours. This reporting requirement applies to all employers.\n• INPATIENT HOSPITALIZATION (of 1 or more employees): Report within 24 hours.\n• AMPUTATION: Report within 24 hours.\n• LOSS OF AN EYE: Report within 24 hours.\n\nReport by calling OSHA at 1-800-321-OSHA (6742), or online at osha.gov. You may also report to the nearest OSHA area office during business hours. The report must include: name of the establishment, location, time of the incident, number of employees affected, contact person, brief description of the incident.\n\nTime limits apply from the time the employer knows of the event — the clock starts when management is notified, not necessarily when the event occurred. Consult the OSHA Logs module in SafetyIQ for current reporting thresholds and contact information."
      },
    ],
  },

  {
    id: "lib-034",
    title: "Employee Right-to-Know Training Program",
    category: "policy",
    group: "Regulatory & Recordkeeping",
    description: "Documented training program ensuring employees can access and understand safety data sheets, recognize chemical hazards, and understand label information and workplace controls.",
    regulatoryBasis: "29 CFR 1910.1200(h)",
    reviewMonths: 12,
    acknowledgmentRequired: true,
    priority: "required",
    sections: [
      {
        heading: "1. Training Requirements and Content",
        body: "The OSHA Hazard Communication Standard (29 CFR 1910.1200) requires employers to provide information and training to employees about the hazardous chemicals in their work area at the time of initial assignment and whenever a new chemical hazard is introduced. [COMPANY NAME]'s Right-to-Know training program must cover:\n\n(a) Requirements of the OSHA Hazard Communication Standard\n(b) Any operations in the work area where hazardous chemicals are present\n(c) Location and availability of the Written Hazard Communication Program, chemical inventory, and SDSs\n(d) Methods and observations employees can use to detect the presence of chemical hazards (visual, odor, alarms)\n(e) Physical and health hazards of chemicals in the work area\n(f) Measures employees can take to protect themselves including PPE, engineering controls, and work practices\n(g) How to read and interpret GHS labels including signal words, pictograms, hazard statements, and precautionary statements\n(h) How to locate and use SDS information including all 16 sections"
      },
      {
        heading: "2. Training Delivery and Documentation",
        body: "Right-to-Know training is delivered through [DESCRIBE METHOD — e.g., classroom instruction + online module, vendor-provided training, internal EHS presentation]. Training includes both the general HazCom overview and laboratory- or work area-specific training on the particular chemicals present in the employee's work area.\n\nTraining must be documented in the SafetyIQ Training module with: employee name, date of training, training content/course name, and trainer name and credentials. Employees must sign an acknowledgment form confirming they received and understood the training. Training records are retained for the duration of employment plus 30 years.\n\nRefresher training is provided annually and whenever a new significant hazard is introduced. Supervisors are responsible for ensuring new employees complete Right-to-Know training before they begin work in any area where hazardous chemicals are present."
      },
    ],
  },

  {
    id: "lib-035",
    title: "Medical Surveillance Program",
    category: "policy",
    group: "Regulatory & Recordkeeping",
    description: "Program documenting medical examinations and consultations for employees exposed to specific chemical or biological hazards requiring baseline, periodic, and termination medical evaluations.",
    regulatoryBasis: "29 CFR 1910.1020 / Substance-Specific Standards",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "1. When Medical Surveillance is Required",
        body: "Medical surveillance is required for employees with occupational exposure to substances regulated under OSHA substance-specific standards that mandate medical surveillance, and for employees who develop signs or symptoms consistent with occupational exposure. At [COMPANY NAME], the following regulated substances and their surveillance requirements apply:\n\n• FORMALDEHYDE (29 CFR 1910.1048): Medical surveillance required for employees exposed at or above the action level (0.5 ppm TWA) or STEL. Medical examination must include: medical and work history, pulmonary function tests, and any examination deemed appropriate by the physician.\n• BLOODBORNE PATHOGENS (29 CFR 1910.1030): Hepatitis B vaccination series offered to all employees with occupational exposure. Post-exposure medical evaluation as specified in the Exposure Control Plan.\n• HAZARDOUS CHEMICALS / CHP (29 CFR 1910.1450): Medical consultations required when employees develop signs/symptoms of chemical exposure, or when exposure monitoring indicates PEL exceedance.\n\nAdditional surveillance requirements may apply based on the specific chemicals in use at [COMPANY NAME]. The EHS Manager reviews substance-specific requirements annually."
      },
      {
        heading: "2. Medical Examination Process and Confidentiality",
        body: "Medical examinations under this program are provided by [OCCUPATIONAL HEALTH PHYSICIAN / CLINIC NAME, ADDRESS, PHONE] at no cost to the employee and at a reasonable time during working hours. Before each examination, the physician will be provided with: a description of the employee's duties, workplace conditions and chemical exposures including monitoring data, a description of the PPE used, information from previous medical examinations, and a copy of the relevant OSHA substance-specific standard.\n\nThe physician will provide [COMPANY NAME] with a written medical opinion that: confirms the employee was informed of the results of the examination; describes any occupational medical conditions requiring further examination or treatment; states any recommended limitations on the employee's use of PPE such as respirators; and states whether the employee should be removed from further exposure to a specific hazard. The written opinion will NOT include findings or diagnoses unrelated to occupational exposure. All medical records are kept confidential and are maintained separately from personnel files for the duration of employment plus 30 years."
      },
    ],
  },

  {
    id: "lib-036",
    title: "Contractor EHS Requirements & Site Orientation",
    category: "guideline",
    group: "Regulatory & Recordkeeping",
    description: "Requirements for contractors performing work on-site including site-specific hazard briefing, PPE requirements, emergency procedures, and EHS qualification verification.",
    regulatoryBasis: "OSHA Multi-Employer Citation Policy",
    reviewMonths: 24,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "1. Contractor Qualification and Pre-Work Requirements",
        body: "All contractors performing work at [COMPANY NAME] facilities must comply with this Contractor EHS Requirements document and applicable OSHA regulations. Before beginning work, contractors must provide to [EHS MANAGER / PROCUREMENT CONTACT]:\n\n(a) Evidence of applicable insurance coverage (general liability, workers' compensation)\n(b) OSHA 300 Log summary for the most recent three years (for contractors with 10 or more employees)\n(c) DART rate and TRIR calculation for the most recent year\n(d) Certificate(s) of training for tasks with specific training requirements (electrical safety, confined space, fall protection, LO/TO)\n(e) SDSs for any hazardous chemicals the contractor plans to bring on-site\n(f) Completed Contractor EHS Acknowledgment form\n\n[COMPANY NAME] reserves the right to require corrective action or remove a contractor from the site if EHS performance is unsatisfactory."
      },
      {
        heading: "2. Site Orientation and Safety Briefing",
        body: "All contractor personnel must receive a site-specific EHS orientation before beginning work. Orientation is provided by [EHS MANAGER / FACILITIES MANAGER] and must cover: (a) emergency procedures and evacuation routes; (b) the location of emergency equipment (eyewash, shower, fire extinguishers, AED); (c) chemical hazards in the work area; (d) PPE requirements; (e) the [COMPANY NAME] Incident Reporting Procedure; (f) site rules (no smoking, no food/drink in labs, visitor escort requirements).\n\nOrientation must be documented — contractors sign the Contractor Site Orientation Acknowledgment before beginning work. Contractors who will work in laboratory areas must receive laboratory-specific orientation covering the specific hazards of the area. Contractors must be escorted in all laboratory areas unless they have received laboratory-specific orientation and have written approval from the EHS Manager."
      },
    ],
  },

  // ── Forms & Checklists ───────────────────────────────────────────────────────

  {
    id: "lib-037",
    title: "Chemical Hygiene Plan Annual Review Checklist",
    category: "form",
    group: "Forms & Checklists",
    description: "Annual review checklist to assess CHP adequacy, update exposure limits, verify training records, confirm PHS designations, and sign off on annual review as required.",
    regulatoryBasis: "29 CFR 1910.1450(e)(3)(iv)",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "Annual CHP Review Checklist",
        body: "Facility: [COMPANY NAME — SITE]\nDate of Review: _______________\nReviewed by (Chemical Hygiene Officer): _______________\n\nINSTRUCTIONS: Review each item and mark Y (compliant / complete), N (non-compliant / incomplete), or N/A. Add notes as needed. The completed checklist must be attached to the CHP as evidence of annual review.\n\nSECTION A — PLAN COMPLETENESS\n☐ CHP contains all required elements per 29 CFR 1910.1450(e)\n☐ Exposure limits (PELs, TLVs) are current for all regulated substances in use\n☐ PPE requirements have been updated to reflect current chemical inventory\n☐ Particularly Hazardous Substances (PHS) list has been reviewed and updated\n☐ Emergency procedures are current and reflect current facility layout\n\nSECTION B — IMPLEMENTATION\n☐ Training records have been reviewed — all covered employees trained within the past year\n☐ Exposure monitoring data is current (within required monitoring frequency)\n☐ Medical surveillance records are complete for all required employees\n☐ SOP library has been reviewed — outdated SOPs have been revised or retired\n☐ Fume hood certification records are current (within 12 months)\n\nSECTION C — INCIDENT REVIEW\n☐ Chemical exposure incidents from the past year have been reviewed\n☐ Root causes have been identified and corrective actions completed\n☐ Corrective actions have been incorporated into the CHP or SOPs where applicable\n\nSECTION D — SIGN-OFF\nThe Chemical Hygiene Plan has been reviewed and is considered adequate to protect employees from health hazards associated with chemicals in the laboratory.\n\nCHO Signature: _______________ Date: _______________\nManagement Review: _______________ Date: _______________"
      },
    ],
  },

  {
    id: "lib-038",
    title: "Laboratory Safety Inspection Checklist",
    category: "form",
    group: "Forms & Checklists",
    description: "Periodic laboratory inspection form covering chemical storage, waste management, fire safety, emergency equipment, PPE availability, and general housekeeping compliance.",
    regulatoryBasis: "OSHA Best Practices / Laboratory Safety Standards",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "Laboratory Safety Inspection Form",
        body: "Laboratory/Area: _______________\nInspection Date: _______________\nInspector(s): _______________\nLab Supervisor / PI: _______________\n\nRATING SCALE: S = Satisfactory | U = Unsatisfactory (requires corrective action) | N/A = Not applicable\nFor each U rating, describe the finding and set a corrective action due date.\n\nCHEMICAL STORAGE AND INVENTORY\n☐ All chemicals are properly labeled (name, hazard, owner)\n☐ Incompatible chemicals are properly segregated (acids/bases, oxidizers/flammables)\n☐ Flammable solvents are stored in approved flammable storage cabinets; quantity within limits\n☐ No chemical containers are stored on the floor (except large carboys in secondary containment)\n☐ All peroxide-forming chemicals have been dated and checked per SOP\n☐ Chemical inventory matches SafetyIQ records\n\nEMERGENCY EQUIPMENT\n☐ Eyewash station accessible and unobstructed; last flushed within [PERIOD]\n☐ Emergency shower accessible and unobstructed; last tested within [PERIOD]\n☐ Fire extinguisher present, inspection tag current, pin and seal intact\n☐ Spill kit present and stocked (verify contents vs. posted inventory)\n\nWASTE MANAGEMENT\n☐ Hazardous waste containers properly labeled with contents and accumulation date\n☐ Satellite accumulation area within allowed quantity limits\n☐ Biohazardous waste bags/containers properly labeled; sharps containers not overfull\n☐ No unauthorized disposal of chemicals to drain or trash\n\nFUME HOOD AND BSC\n☐ Fume hood alarm functioning; certification sticker current\n☐ Fume hood sash at or below working height when not in use\n☐ BSC certification sticker current; UV lamp functioning\n\nGENERAL HOUSEKEEPING\n☐ Lab exits and aisles clear of obstruction (minimum 28-inch clear aisle)\n☐ No food or drink in the laboratory\n☐ PPE available and in serviceable condition\n☐ Electrical cords and equipment in good condition (no fraying, no daisy-chain extension cords)\n☐ Laboratory area clean and orderly; benches and floors free of chemical contamination\n\nFINDINGS SUMMARY:\n[List all U items with corrective actions and due dates]\n\nInspector Signature: _______________ Date: _______________\nSupervisor Acknowledgment: _______________ Date: _______________"
      },
    ],
  },

  {
    id: "lib-039",
    title: "Bloodborne Pathogen Exposure Incident Report",
    category: "form",
    group: "Forms & Checklists",
    description: "Documentation form for recording needlestick injuries, splashes, and other BBP exposure incidents including source patient information, post-exposure follow-up, and corrective actions.",
    regulatoryBasis: "29 CFR 1910.1030(f)(3)",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "BBP Exposure Incident Report Form",
        body: "INSTRUCTIONS: Complete this form for all needlestick injuries, sharps exposures, mucous membrane splashes, or skin contact with blood or OPIM. Submit to EHS within 24 hours of the incident. This form is CONFIDENTIAL MEDICAL INFORMATION.\n\nSECTION 1 — EMPLOYEE INFORMATION (CONFIDENTIAL)\nEmployee Name: _______________ Job Title: _______________\nDepartment: _______________ Date of Birth: _______________ Sex: ___\nDate of Incident: _______________ Time: _______________ Location: _______________\nLength of Employment: _______________ Date of HBV Vaccination (if known): _______________\n\nSECTION 2 — INCIDENT DESCRIPTION\nDescribe how the exposure occurred (please be specific):\n_______________\n\nType of exposure:\n☐ Needlestick/sharps puncture\n☐ Mucous membrane splash (eyes, nose, mouth)\n☐ Non-intact skin contact (cut, abrasion, rash)\n☐ Other (describe): _______________\n\nBody part(s) affected: _______________\nDepth of injury (for sharps): ☐ Superficial (scratch) ☐ Moderate (definite puncture) ☐ Deep (visible blood on device)\n\nMaterial involved: ☐ Blood ☐ Blood-contaminated fluid ☐ Other potentially infectious material (specify): _______________\n\nSource material (the device/material that caused the exposure): _______________\nWas the device involved: ☐ A safety-engineered device? ☐ A conventional device? ☐ Broken glass?\n\nSECTION 3 — SOURCE INDIVIDUAL\nWas the source individual identifiable? ☐ Yes ☐ No\nIf yes, has the source individual been informed? ☐ Yes ☐ No ☐ N/A\nSource individual consent for testing: ☐ Obtained ☐ Refused ☐ Not applicable\nKnown source HBV status: _______________ Known HIV status: _______________\n\nSECTION 4 — IMMEDIATE ACTIONS TAKEN\nFirst Aid: ☐ Wound washed with soap and water ☐ Mucous membrane flushed with water ☐ Other: _______________\nWas the employee referred for post-exposure medical evaluation? ☐ Yes ☐ No\nDate/Time of medical referral: _______________ Facility: _______________\n\nSECTION 5 — CORRECTIVE ACTION\nImmediate corrective actions taken to prevent recurrence:\n_______________\n\nLong-term corrective action (CAPA) required? ☐ Yes — CAPA # ________ ☐ No\n\nSupervisor Signature: _______________ Date: _______________\nEHS Review Signature: _______________ Date: _______________"
      },
    ],
  },

  {
    id: "lib-040",
    title: "New Employee EHS Orientation Checklist",
    category: "form",
    group: "Forms & Checklists",
    description: "Structured orientation checklist documenting that new employees have received required EHS training, toured emergency equipment locations, and acknowledged key safety policies.",
    regulatoryBasis: "29 CFR 1910 / Company Policy",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "required",
    sections: [
      {
        heading: "New Employee EHS Orientation Form",
        body: "Employee Name: _______________ Position Title: _______________\nDepartment / Lab: _______________ Start Date: _______________\nOrientation Conducted by: _______________ Date of Orientation: _______________\n\nINSTRUCTIONS: Check each item as it is completed. Both the new employee and the person conducting the orientation must initial/sign each section. This completed form is retained in the employee's training file.\n\nSECTION 1 — GENERAL EHS ORIENTATION (all employees)\n☐ Overview of [COMPANY NAME] EHS program and the SafetyIQ platform\n☐ How to report workplace injuries, illnesses, and near misses\n☐ How to access the Emergency Action Plan and evacuation routes\n☐ Location of emergency exits, assembly points, and shelter areas\n☐ How to report a fire or emergency (pull station, call 911, building number)\n☐ Location of nearest fire extinguisher to work area\n☐ Right-to-know rights: access to SDS, chemical inventory, and Written HazCom Program\n☐ Incident reporting requirements and non-retaliation policy\n\nSECTION 2 — LABORATORY SAFETY (laboratory employees only)\n☐ Chemical Hygiene Plan reviewed; location of the CHP and SDS library shown\n☐ Location and use of eyewash station and emergency shower demonstrated\n☐ Minimum PPE requirements for the laboratory reviewed\n☐ Chemical storage and waste disposal procedures reviewed\n☐ Fume hood proper use reviewed and demonstrated\n☐ Biohazardous waste handling and sharps disposal reviewed (if applicable)\n☐ Bloodborne Pathogen initial training completed (if applicable)\n☐ Autoclave or BSC training completed (if applicable)\n\nSECTION 3 — ACKNOWLEDGMENTS\n☐ Employee acknowledges receipt and review of Emergency Action Plan\n☐ Employee acknowledges receipt and review of Chemical Hygiene Plan (if lab employee)\n☐ Employee acknowledges receipt and review of Bloodborne Pathogens ECP (if applicable)\n☐ Employee acknowledges understanding of incident reporting procedures\n\nEMPLOYEE SIGNATURE: _______________ DATE: _______________\n'I confirm that I have received the EHS orientation described above and understand my responsibilities.'\n\nORIENTATION PROVIDER SIGNATURE: _______________ DATE: _______________\n\nSUPERVISOR ACKNOWLEDGMENT: _______________ DATE: _______________"
      },
    ],
  },

  {
    id: "lib-041",
    title: "Fume Hood Certification Record",
    category: "form",
    group: "Forms & Checklists",
    description: "Annual fume hood certification log documenting face velocity measurements, alarm function test, sash seal inspection, and certification sticker placement for each hood.",
    regulatoryBasis: "29 CFR 1910.1450 / ANSI/AIHA Z9.5",
    reviewMonths: 12,
    acknowledgmentRequired: false,
    priority: "recommended",
    sections: [
      {
        heading: "Fume Hood Annual Certification Record",
        body: "SITE: [COMPANY NAME — SITE ADDRESS]\nDate of Certification: _______________\nCertification Performed by: _______________ Qualification/Certification Number: _______________\nTest Instrument Used: _______________ Instrument Calibration Date: _______________\n\nINSTRUCTIONS: Complete one entry per fume hood. Attach this completed record to the laboratory's EHS file. Affix certification sticker to the fume hood sash post-inspection.\n\nFUME HOOD CERTIFICATION LOG:\n\nHOOD ID: _________ | ROOM / LOCATION: _________\nHood Model/Manufacturer: _________\nNominal Sash Opening for Certification (in): _________\nFace Velocity Measurements (fpm):\n  Left: _____ Center: _____ Right: _____ Average: _____\nSatisfactory face velocity (80-120 fpm): ☐ Pass ☐ Fail\nAirflow Visualization Test (smoke pencil): ☐ Pass ☐ Fail\nAlarm Function Test: ☐ Pass ☐ Fail ☐ No alarm installed\nSash Seal/Movement Test: ☐ Pass ☐ Fail\nCertification Status: ☐ CERTIFIED ☐ REMOVED FROM SERVICE\nCertification Sticker Applied: ☐ Yes\nNext Certification Due: _________\nComments: _________\n\n---\n[REPEAT FOR EACH FUME HOOD]\n\nSUMMARY\nTotal hoods inspected: _____ | Certified: _____ | Removed from service: _____\n\nHoods removed from service (if any): [HOOD ID AND REASON]\n\nCertifier Signature: _______________ Date: _______________\nEHS Manager Review: _______________ Date: _______________"
      },
    ],
  },
];


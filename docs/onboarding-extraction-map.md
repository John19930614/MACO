# Onboarding Document → Module Extraction Map

This is the authoritative checklist the AI follows during onboarding
(`src/app/api/onboarding/process/route.ts`). Each wizard upload **category** is
read by a dedicated processor that runs an AI extraction with a strict JSON
schema and writes the results to a specific table / module.

**Reliability depends on two things:**
1. The user uploads each document into the **correct category** in the wizard.
2. The document contains **real, readable content** (text or text-based PDF).
   Empty/stub/scanned-image PDFs yield nothing — there is no OCR step.

| # | Wizard category (`docId`) | AI extracts | Lands in (table) | Module |
|---|---|---|---|---|
| 1 | Chemical Inventory List (`chemicals`) | name, CAS, formula, qty, unit, storage, supplier, GHS classes, H/P-statements, scheduled flag | `chemical_inventory` | Chemical Management |
| 2 | Hazardous Waste Records (`hazard_waste`) | waste name, code, classification, qty, unit, disposal method, contractor, manifest # | `waste_streams` | Waste Management |
| 3 | Employee Roster (`employees`) | name, email, job title, department | `tenants.onboarding_data.extracted_employees` | Team & Invites |
| 4 | Training Requirements (`training_req`) | title, description, type, duration, reg ref, validity, roles | `training_courses` | Training & Competency |
| 5 | Safety Data Sheets (`sds`) | one document record per SDS file | `documents` (category `msds`) | Documents & Programs |
| 6 | Safety Manual / IIPP (`safety_manual`) | regulations cited + training requirements + identified hazards | `legal_requirements` + `training_courses` + `risk_assessments` | Legal / Training / Risk |
| 7 | SOPs & Policies (`sop`) | each procedure as a document + regulatory refs | `documents` (sop) + `legal_requirements` | Documents / Legal |
| 8 | OSHA 300/300A/301 Logs (`osha_logs`) | each injury/illness case | `incidents` | Incidents / OSHA |
| 9 | Org Chart / EHS Responsibilities (`org_chart`) | name, title, dept, EHS responsibility | `tenants.onboarding_data.extracted_org_structure` | Team (reference) |
| 10 | Equipment & Calibration Register (`equipment_register`) | name, type, serial, location, cal/inspection dates | `equipment` | Monitoring & Equipment |
| 11 | Past Audit/Inspection Reports (`audit_reports`) | audit metadata + findings → auto-CAPA for open findings | `audits` + `audit_findings` + `capa_records` | Audits / CAPA |
| 12 | Risk Assessments / JSAs (`jsa`) | hazard, activity, controls, likelihood, consequence, level | `risk_assessments` | Risk Intelligence |
| 13 | Emergency Response Plan (`erp`) | each emergency procedure as a document + drills/training | `documents` (emergency_procedure) + `training_courses` | Documents / Training |
| 14 | Environmental Permits & Licences (`permits`) | permit/licence, number, jurisdiction, expiry | `legal_requirements` (with due dates) + `documents` (permit) | Legal / Documents |
| 15 | Biosafety Lab Inventory (`biosafety_inventory`) | labs (BSL level, personnel) + biohazard agents (risk group) | `biosafety_labs` + `biohazard_agents` | Biosafety & Lab Safety |
| 16 | Air / Noise / IH Monitoring (`ih_monitoring`) | exposure risks + monitoring report docs | `risk_assessments` + `documents` | Risk / Documents |
| 17 | Near-Miss / First-Aid Log (`near_miss_log`) | each near-miss/first-aid case | `incidents` | Incidents |

## ⚠️ Gaps — categories with NO importer (currently reference-only)
| Wizard category | Current behavior |
|---|---|
| Certificate of Insurance (`coi`) | Uploaded to storage; **not extracted or routed anywhere**. |
| EMR Letter from Carrier (`emr_letter`) | Uploaded to storage; **not extracted** (EMR value is captured separately on the company-info step). |

These two appear in the upload list but have no processor — they silently go
nowhere. Either add processors (store as reference `documents`, capture EMR
number) or remove them from the wizard so users aren't misled.

## How the AI is instructed (the per-document "checklist")
Every processor sends the model: (a) the file (PDF as a document block, or
CSV/text inline), (b) a **system prompt** defining the EHS specialist role, (c)
a **strict JSON tool schema** that forces the exact fields above, and (d) a
**user instruction** listing enum values and formats (e.g. GHS classes, ISO
dates, BSL levels, severity scales). The model can only return data matching the
schema, so extracted items map 1:1 to table columns.

## Requirements for extraction to succeed
- A real **Anthropic API key** must be set (`ANTHROPIC_API_KEY`) — without it the
  extractor returns nothing (`hasLiveAi()` is false).
- The **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) must be set — used to
  read files from storage and write rows past RLS.
- Documents must be **text-bearing** (digital PDF, DOCX, CSV, XLSX). Scanned
  images / empty stubs extract nothing (no OCR).

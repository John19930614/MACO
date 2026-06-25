/**
 * SafetyIQ AI Gateway — the staged validation pipeline every EHS record passes
 * through before it is trusted in the EHS Database.
 *
 *   Data sources → Gateway 1 (Schema & Format) → Gateway 2 (Business Rule)
 *                → Gateway 3 (Anomaly & Quality) → "Nothing Missed" 10-check
 *                → EHS Database.   Anything that fails a hard check is captured
 *                in the Reject Queue with a reason + category.
 *
 * evaluateGateways() is PURE and deterministic over a dataset — it runs
 * server-side for the /gateway health page AND can be exercised in tests with
 * crafted data. Checks are DATA-VALIDATION checks (is the record well-formed
 * and complete enough to enter the EHS Database?) — a recorded safety gap
 * (e.g. a missing control) is valid data, not a validation failure.
 */
import { MOCK_MODE } from "@/lib/env";
import {
  getIncidents, getCapaActions, getRiskAssessments, getAudits,
  getChemicals, getWasteStreams, getEquipment, getAiFindings,
} from "@/lib/data/ehsRepo";
import { getCells } from "@/lib/data/repo";
import {
  SEVERITIES, CAPA_STATUSES, AUDIT_STATUSES, INCIDENT_TYPES,
  EQUIPMENT_STATUSES, RISK_LEVELS, riskLevelFromScore,
} from "@/lib/constants";
import type { Incident, CapaAction, RiskAssessment, Audit, Chemical, WasteStream, Equipment, SafetyCell, AiFinding } from "@/lib/types";

export type CheckStatus = "pass" | "warn" | "fail";

export interface GatewayCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface GatewayResult {
  id: "g1" | "g2" | "g3";
  name: string;
  subtitle: string;
  status: CheckStatus;
  checks: GatewayCheck[];
}

export interface FinalCheck {
  n: number;
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
}

export interface RejectEntry {
  recordId: string;
  recordKind: string;
  category: string;
  reason: string;
  resolvable?: boolean;
}

export interface EhsDatabaseStats {
  incidents: number;
  openCapas: number;
  riskAssessments: number;
  activeAudits: number;
  chemicals: number;
  equipment: number;
  cells: number;
  platforms: number;
  riskObjects: number;
  bridges: number;
  inchpins: number;
}

export interface GatewayReport {
  generatedAt: string;
  mode: "mock" | "live";
  overall: CheckStatus;
  gateways: GatewayResult[];
  finalReview: FinalCheck[];
  finalStatus: CheckStatus;
  rejectQueue: RejectEntry[];
  humanReviewQueue: number;
  stats: EhsDatabaseStats;
  counts: { pass: number; warn: number; fail: number };
}

export interface EhsDataset {
  incidents: Incident[];
  capas: CapaAction[];
  risks: RiskAssessment[];
  audits: Audit[];
  chemicals: Chemical[];
  wasteStreams: WasteStream[];
  equipment: Equipment[];
  cells: SafetyCell[];
  aiFindings?: AiFinding[];
}

const worst = (statuses: CheckStatus[]): CheckStatus =>
  statuses.includes("fail") ? "fail" : statuses.includes("warn") ? "warn" : "pass";

const verdict = (
  bad: number,
  total: number,
  sev: CheckStatus,
  okMsg: string,
  badMsg: (n: number) => string,
): { status: CheckStatus; detail: string } =>
  bad === 0
    ? { status: "pass", detail: total ? okMsg : "no records to check" }
    : { status: sev, detail: badMsg(bad) };

export function evaluateGateways(d: EhsDataset, now: number): GatewayReport {
  const { incidents, capas, risks, audits, chemicals, wasteStreams, equipment, cells, aiFindings = [] } = d;
  const reject: RejectEntry[] = [];
  const rejected = new Set<string>();
  const block = (id: string, kind: string, category: string, reason: string, resolvable = false) => {
    if (rejected.has(id)) return;
    rejected.add(id);
    reject.push({ recordId: id, recordKind: kind, category, reason, resolvable });
  };

  // ── Gateway 1 — Schema & Format Validation ─────────────────────────────────
  const incRequiredBad = incidents.filter((i) => !i.title || !i.incident_type || !i.severity || !i.status || !i.occurred_at || !i.location);
  for (const i of incRequiredBad) block(i.id, "Incident", "Gateway 1 · Required Fields", "Missing title, type, severity, status, date, or location");

  const capaRequiredBad = capas.filter((c) => !c.title || !c.kind || !c.severity || !c.status);
  for (const c of capaRequiredBad) block(c.id, "CAPA", "Gateway 1 · Required Fields", "Missing title, kind, severity, or status");

  const riskRequiredBad = risks.filter((r) => !r.title || !r.category || r.likelihood_score == null || r.consequence_score == null);
  for (const r of riskRequiredBad) block(r.id, "Risk Assessment", "Gateway 1 · Required Fields", "Missing title, category, or risk scores");

  const auditRequiredBad = audits.filter((a) => !a.title || !a.type || !a.scheduled_date || !a.status);
  for (const a of auditRequiredBad) block(a.id, "Audit", "Gateway 1 · Required Fields", "Missing title, type, scheduled date, or status");

  const chemRequiredBad = chemicals.filter((c) => !c.name || c.quantity == null || !c.unit || !c.storage_location);
  for (const c of chemRequiredBad) block(c.id, "Chemical", "Gateway 1 · Required Fields", "Missing name, quantity, unit, or storage location");

  const cellSchemaBad = cells.filter((c) => !c.title || !c.task || !c.hazard_genome.energySource || !c.hazard_genome.exposureType || !c.severity || !c.status);
  for (const c of cellSchemaBad) block(c.id, "Safety Cell", "Gateway 1 · Required Fields", "Missing title, task, hazard genome fields, severity, or status");

  const totalRecords = incidents.length + capas.length + risks.length + audits.length + chemicals.length + cells.length;
  const totalRequired = incRequiredBad.length + capaRequiredBad.length + riskRequiredBad.length + auditRequiredBad.length + chemRequiredBad.length + cellSchemaBad.length;

  const enumBadInc = incidents.filter((i) => !SEVERITIES.includes(i.severity) || !INCIDENT_TYPES.includes(i.incident_type));
  const enumBadCapa = capas.filter((c) => !SEVERITIES.includes(c.severity) || !CAPA_STATUSES.includes(c.status));
  const enumBadAudit = audits.filter((a) => !AUDIT_STATUSES.includes(a.status));
  const enumBadEquip = equipment.filter((e) => !EQUIPMENT_STATUSES.includes(e.status));
  const totalEnumBad = enumBadInc.length + enumBadCapa.length + enumBadAudit.length + enumBadEquip.length;
  for (const i of enumBadInc) block(i.id, "Incident", "Gateway 1 · Enum", "Invalid severity or incident_type value");
  for (const c of enumBadCapa) block(c.id, "CAPA", "Gateway 1 · Enum", "Invalid severity or status value");
  for (const a of enumBadAudit) block(a.id, "Audit", "Gateway 1 · Enum", "Invalid audit status value");
  for (const e of enumBadEquip) block(e.id, "Equipment", "Gateway 1 · Enum", "Invalid equipment status value");

  // Reference integrity — a CAPA's source_type/source_id must resolve to an
  // existing record. Only verify source types whose target set is loaded in the
  // dataset (incident, risk_assessment, safety_cell, chemical); other types
  // (audit_finding, legal_requirement, site, manual) live elsewhere and are
  // left to their own modules rather than flagged as false positives here.
  const refPools: Record<string, Set<string>> = {
    incident:        new Set(incidents.map((i) => i.id)),
    risk_assessment: new Set(risks.map((r) => r.id)),
    safety_cell:     new Set(cells.map((c) => c.id)),
    chemical:        new Set(chemicals.map((c) => c.id)),
  };
  const capaDanglingRef = capas.filter((c) => {
    const pool = c.source_id ? refPools[c.source_type] : undefined;
    return pool ? !pool.has(c.source_id!) : false;
  });
  for (const c of capaDanglingRef) block(c.id, "CAPA", "Gateway 1 · Reference", `Source ${c.source_type} "${c.source_id}" does not resolve to an existing record`);

  // Unit-of-measure validation — quantity-bearing records (chemicals, waste)
  // must carry a recognized unit and a finite, non-negative quantity. Quality
  // gate (warn), not a hard block.
  const RECOGNIZED_UOM = new Set(["mg", "g", "kg", "t", "mcg", "µg", "mL", "L", "kL", "gal", "ea", "unit", "units", "ppm", "ppb"]);
  const uomBad = [
    ...chemicals.map((c) => ({ unit: c.unit, qty: c.quantity })),
    ...wasteStreams.map((w) => ({ unit: w.unit, qty: w.quantity })),
  ].filter((r) => r.unit && (!RECOGNIZED_UOM.has(r.unit) || !Number.isFinite(r.qty) || r.qty < 0)).length;

  const g1: GatewayResult = {
    id: "g1",
    name: "Schema & Format Validation",
    subtitle: "Required fields, data types, enum values, reference integrity",
    checks: [
      { id: "g1_required",  label: "Required field validation", ...verdict(totalRequired, totalRecords, "fail", "all required fields present across all EHS modules", (n) => `${n} record(s) missing required fields`) },
      { id: "g1_enum",      label: "Enum value validation",     ...verdict(totalEnumBad, totalRecords, "fail", "all severity/status/type values are valid", (n) => `${n} record(s) with invalid enum values`) },
      { id: "g1_schema",    label: "Schema compliance",         status: totalRequired + totalEnumBad === 0 ? "pass" : "fail", detail: totalRequired + totalEnumBad === 0 ? "all records schema-compliant" : `${totalRequired + totalEnumBad} non-compliant record(s)` },
      { id: "g1_reference", label: "Reference data validation", ...verdict(capaDanglingRef.length, capas.length, "fail", "all CAPA source references resolve to an existing record", (n) => `${n} CAPA(s) reference a missing source record`) },
      { id: "g1_uom",       label: "Unit of measure validation", ...verdict(uomBad, chemicals.length + wasteStreams.length, "warn", "all chemical & waste quantities use a recognized unit", (n) => `${n} record(s) with an unrecognized unit or invalid quantity`) },
    ],
    status: "pass",
  };
  g1.status = worst(g1.checks.map((c) => c.status));

  // ── Gateway 2 — Business Rule Validation ───────────────────────────────────
  const cellRangeBad = cells.filter((c) => c.likelihood < 1 || c.likelihood > 5 || c.risk_score < 0 || c.risk_score > 100);

  const riskScoreBad = risks.filter((r) => Math.abs(r.risk_score - r.likelihood_score * r.consequence_score) > 1);
  for (const r of riskScoreBad) block(r.id, "Risk Assessment", "Gateway 2 · Score", `risk_score ${r.risk_score} ≠ ${r.likelihood_score}×${r.consequence_score}`);

  const riskLevelBad = risks.filter((r) => r.risk_level !== riskLevelFromScore(r.risk_score));
  for (const r of riskLevelBad) block(r.id, "Risk Assessment", "Gateway 2 · Level", `risk_level "${r.risk_level}" inconsistent with score ${r.risk_score}`);

  const capaOpenNoDue = capas.filter((c) => (c.status === "open" || c.status === "in_progress") && !c.due_date);

  const incTitleSeen = new Map<string, number>();
  for (const i of incidents) {
    const k = i.title.trim().toLowerCase();
    incTitleSeen.set(k, (incTitleSeen.get(k) ?? 0) + 1);
  }
  const nearDupeInc = [...incTitleSeen.values()].filter((n) => n > 1).reduce((a, b) => a + (b - 1), 0);
  const capaTitleSeen = new Map<string, number>();
  for (const c of capas) {
    const k = c.title.trim().toLowerCase();
    capaTitleSeen.set(k, (capaTitleSeen.get(k) ?? 0) + 1);
  }
  const nearDupeCapa = [...capaTitleSeen.values()].filter((n) => n > 1).reduce((a, b) => a + (b - 1), 0);
  const nearDupes = nearDupeInc + nearDupeCapa;

  const g2: GatewayResult = {
    id: "g2",
    name: "Business Rule Validation",
    subtitle: "Risk score math, CAPA rules, cross-field logic, near-duplicates",
    checks: [
      { id: "g2_riskscore", label: "Risk score consistency",    ...verdict(riskScoreBad.length, risks.length, "fail", "all risk scores match likelihood × consequence", (n) => `${n} assessment(s) with inconsistent risk score`) },
      { id: "g2_risklevel", label: "Risk level classification", ...verdict(riskLevelBad.length, risks.length, "warn", "risk levels match score ranges", (n) => `${n} assessment(s) with misclassified risk level`) },
      { id: "g2_capadue",   label: "CAPA due-date rule",        ...verdict(capaOpenNoDue.length, capas.length, "warn", "all open CAPAs have a due date", (n) => `${n} open CAPA(s) missing a due date`) },
      { id: "g2_duplicate", label: "Duplicate detection",       ...verdict(nearDupes, totalRecords, "warn", "no near-duplicate records found", (n) => `${n} near-duplicate record(s) flagged`) },
      { id: "g2_workflow",  label: "Workflow state & range validation", ...verdict(totalEnumBad + cellRangeBad.length, totalRecords, "fail", "all workflow states valid and cell ranges within bounds", (n) => `${n} record(s) with invalid workflow state or out-of-range values`) },
    ],
    status: "pass",
  };
  g2.status = worst(g2.checks.map((c) => c.status));

  // ── Gateway 3 — Anomaly & Quality Validation ───────────────────────────────
  const overdueCapas = capas.filter(
    (c) => (c.status === "open" || c.status === "in_progress") && c.due_date && new Date(c.due_date).getTime() < now,
  );
  for (const c of overdueCapas) block(c.id, "CAPA", "Gateway 3 · Overdue", `CAPA past due date ${c.due_date}`, true);

  const highRisks = risks.filter((r) => r.risk_level === "extreme" || r.risk_level === "high");
  const riskCapaIds = new Set(capas.filter((c) => c.source_type === "risk_assessment" && c.source_id).map((c) => c.source_id!));
  const highRiskNoAction = highRisks.filter((r) => !riskCapaIds.has(r.id));

  const equipOverdue = equipment.filter(
    (e) => e.status === "operational" && e.next_calibration_date && new Date(e.next_calibration_date).getTime() < now,
  );
  for (const e of equipOverdue) block(e.id, "Equipment", "Gateway 3 · Calibration", `Equipment past calibration due date ${e.next_calibration_date}`, true);

  const incWithCause = incidents.filter((i) => !!i.root_cause).length;
  const completeness = incidents.length ? Math.round((incWithCause / incidents.length) * 100) : 100;

  const hazChemNoSds = chemicals.filter((c) => (c.ghs_classes.length > 0 || c.is_scheduled) && !c.sds_url);

  const g3: GatewayResult = {
    id: "g3",
    name: "Anomaly & Quality Validation",
    subtitle: "Overdue items, risk coverage, calibration gaps, data completeness",
    checks: [
      { id: "g3_overduecapa", label: "Overdue CAPA detection",       ...verdict(overdueCapas.length, capas.length, "warn", "no CAPAs past their due date", (n) => `${n} CAPA(s) past due date`) },
      { id: "g3_riskaction",  label: "High-risk CAPA coverage",      ...verdict(highRiskNoAction.length, highRisks.length, "warn", "all high/extreme risks have a CAPA action", (n) => `${n} high/extreme risk(s) without a CAPA`) },
      { id: "g3_calibration", label: "Equipment calibration check",  ...verdict(equipOverdue.length, equipment.length, "warn", "all operational equipment within calibration schedule", (n) => `${n} equipment item(s) past calibration due date`) },
      { id: "g3_quality",     label: "Incident investigation quality", status: completeness >= 70 ? "pass" : "warn", detail: `${completeness}% of incidents have root cause documented` },
      { id: "g3_sds",         label: "Chemical SDS compliance",      ...verdict(hazChemNoSds.length, chemicals.length, "warn", "all hazardous chemicals have SDS on record", (n) => `${n} hazardous chemical(s) missing SDS reference`) },
    ],
    status: "pass",
  };
  g3.status = worst(g3.checks.map((c) => c.status));

  // ── "Nothing Missed" final review (10 checks) ──────────────────────────────
  const openCapas = capas.filter((c) => c.status === "open" || c.status === "in_progress");
  const openCapaNoOwner = openCapas.filter((c) => !c.owner_id);
  const scheduledAuditsNoAuditor = audits.filter((a) => a.status === "scheduled" && !a.lead_auditor_id);
  const wasteHazNoContractor = wasteStreams.filter(
    (w) => (w.classification === "hazardous" || w.classification === "clinical") && !w.disposal_contractor,
  );
  const openHighInc = incidents.filter((i) => (i.severity === "high" || i.severity === "critical") && i.status !== "closed");
  const incCapaIds = new Set(capas.filter((c) => c.source_type === "incident" && c.source_id).map((c) => c.source_id!));
  const highIncNoCapa = openHighInc.filter((i) => !incCapaIds.has(i.id));
  const pendingReview = aiFindings.filter((f) => f.review_status === "pending").length;

  const finalReview: FinalCheck[] = [
    { n: 1,  id: "f_incfields",    label: "Incident Field Check",            ...verdict(incRequiredBad.length, incidents.length, "fail", "all incidents have required fields", (n) => `${n} incident(s) missing required fields`) },
    { n: 2,  id: "f_capaowner",    label: "CAPA Owner Assignment",           ...verdict(openCapaNoOwner.length, openCapas.length, "warn", "all open CAPAs assigned to an owner", (n) => `${n} open CAPA(s) with no owner assigned`) },
    { n: 3,  id: "f_riskscores",   label: "Risk Score Integrity",            ...verdict(riskScoreBad.length, risks.length, "fail", "all risk scores are mathematically consistent", (n) => `${n} risk assessment(s) with inconsistent scores`) },
    { n: 4,  id: "f_auditauditor", label: "Audit Lead Auditor Check",        ...verdict(scheduledAuditsNoAuditor.length, audits.length, "warn", "all scheduled audits have a lead auditor assigned", (n) => `${n} scheduled audit(s) missing a lead auditor`) },
    { n: 5,  id: "f_chemicalsds",  label: "Chemical SDS Check",              ...verdict(hazChemNoSds.length, chemicals.length, "warn", "all hazardous chemicals have SDS on file", (n) => `${n} hazardous chemical(s) without SDS URL`) },
    { n: 6,  id: "f_overdues",     label: "Overdue CAPA Review",             ...verdict(overdueCapas.length, capas.length, "warn", "no CAPAs are past their due date", (n) => `${n} CAPA(s) overdue — immediate attention required`) },
    { n: 7,  id: "f_highriskcapa", label: "High-Risk CAPA Coverage",         ...verdict(highRiskNoAction.length, highRisks.length, "warn", "all high/extreme risks linked to at least one CAPA", (n) => `${n} high/extreme risk(s) without any CAPA action`) },
    { n: 8,  id: "f_calibration",  label: "Equipment Calibration Currency",  ...verdict(equipOverdue.length, equipment.length, "warn", "all operational equipment within calibration schedule", (n) => `${n} item(s) past calibration due date`) },
    { n: 9,  id: "f_highincident", label: "High-Severity Incident CAPA",    ...verdict(highIncNoCapa.length, openHighInc.length, "warn", "all high/critical open incidents have a CAPA", (n) => `${n} high/critical incident(s) without a CAPA action`) },
    { n: 10, id: "f_review",       label: "Human Review Queue",              status: "pass", detail: `${openCapas.length} open CAPA(s) · ${wasteHazNoContractor.length} hazardous waste streams needing contractor · ${pendingReview} AI items pending` },
  ];
  const finalStatus = worst(finalReview.map((c) => c.status));

  // ── EHS Database stats ─────────────────────────────────────────────────────
  const uniqueSiteIds = new Set(cells.map((c) => c.site_id));
  const stats: EhsDatabaseStats = {
    incidents: incidents.length,
    openCapas: openCapas.length,
    riskAssessments: risks.length,
    activeAudits: audits.filter((a) => a.status === "scheduled" || a.status === "in_progress").length,
    chemicals: chemicals.length,
    equipment: equipment.length,
    cells: cells.length,
    platforms: uniqueSiteIds.size,
    riskObjects: cells.filter((c) => c.severity === "high" || c.severity === "critical").length,
    bridges: 0,
    inchpins: 0,
  };

  const allChecks: CheckStatus[] = [...g1.checks, ...g2.checks, ...g3.checks, ...finalReview].map((c) => c.status);
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const s of allChecks) counts[s]++;
  const overall = worst([g1.status, g2.status, g3.status, finalStatus]);

  return {
    generatedAt: new Date(now).toISOString(),
    mode: MOCK_MODE ? "mock" : "live",
    overall,
    gateways: [g1, g2, g3],
    finalReview,
    finalStatus,
    rejectQueue: reject,
    humanReviewQueue: pendingReview,
    stats,
    counts,
  };
}

export async function loadEhsDataset(): Promise<Omit<EhsDataset, "cells">> {
  const [incidents, capas, risks, audits, chemicals, wasteStreams, equipment] = await Promise.all([
    getIncidents(),
    getCapaActions(),
    getRiskAssessments(),
    getAudits(),
    getChemicals(),
    getWasteStreams(),
    getEquipment(),
  ]);
  return { incidents, capas, risks, audits, chemicals, wasteStreams, equipment };
}

export async function loadGatewayDataset(): Promise<EhsDataset> {
  const [ehs, cells, aiFindings] = await Promise.all([loadEhsDataset(), getCells(), getAiFindings()]);
  return { ...ehs, cells, aiFindings };
}

export async function runGatewayPipeline(): Promise<GatewayReport> {
  const dataset = await loadGatewayDataset();
  return evaluateGateways(dataset, Date.now());
}

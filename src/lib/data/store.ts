/**
 * Mutable in-memory store for mock mode. Seeded once from the fixtures; API
 * routes mutate it so CAPA updates, AI review decisions, incident submissions,
 * etc. persist for the life of the dev server. Live mode never touches this file.
 */
import type {
  Tenant,
  Profile,
  Site,
  Chemical,
  LegalRequirement,
  Audit,
  AuditFinding,
  CapaAction,
  TrainingCourse,
  TrainingRecord,
  Document,
  DocumentAcknowledgment,
  WasteStream,
  Equipment,
  RiskAssessment,
  Incident,
  ComplianceScore,
  AiFinding,
  PredictabilityRun,
  AuditEntry,
  RelianceInsight,
} from "@/lib/types";

import {
  MOCK_TENANTS,
  MOCK_PROFILE_LIST,
  MOCK_SITES,
  MOCK_CHEMICALS,
  MOCK_LEGAL_REQUIREMENTS,
  MOCK_AUDITS,
  MOCK_AUDIT_FINDINGS,
  MOCK_CAPA_ACTIONS,
  MOCK_TRAINING_COURSES,
  MOCK_TRAINING_RECORDS,
  MOCK_DOCUMENTS,
  MOCK_DOC_ACKNOWLEDGMENTS,
  MOCK_WASTE_STREAMS,
  MOCK_EQUIPMENT,
  MOCK_RISK_ASSESSMENTS,
  MOCK_INCIDENTS,
  MOCK_COMPLIANCE_SCORES,
  MOCK_AI_FINDINGS,
  MOCK_PREDICTABILITY_RUNS,
  MOCK_AUDIT_LOG,
  MOCK_RELIANCE_INSIGHTS,
} from "@/lib/data/mock";

// ── Store shape ───────────────────────────────────────────────────────────────

interface SafetyIQStore {
  tenants: Tenant[];
  profiles: Profile[];
  sites: Site[];
  chemicals: Chemical[];
  legalRequirements: LegalRequirement[];
  audits: Audit[];
  auditFindings: AuditFinding[];
  capaActions: CapaAction[];
  trainingCourses: TrainingCourse[];
  trainingRecords: TrainingRecord[];
  documents: Document[];
  documentAcknowledgments: DocumentAcknowledgment[];
  wasteStreams: WasteStream[];
  equipment: Equipment[];
  riskAssessments: RiskAssessment[];
  incidents: Incident[];
  complianceScores: ComplianceScore[];
  aiFindings: AiFinding[];
  predictabilityRuns: PredictabilityRun[];
  auditLog: AuditEntry[];
  relianceInsights: RelianceInsight[];
}

// ── Singleton initialisation ──────────────────────────────────────────────────

declare const global: { __safetyiqStore?: SafetyIQStore };

function initStore(): SafetyIQStore {
  return {
    tenants:                 [...MOCK_TENANTS],
    profiles:                [...MOCK_PROFILE_LIST],
    sites:                   [...MOCK_SITES],
    chemicals:               [...MOCK_CHEMICALS],
    legalRequirements:       [...MOCK_LEGAL_REQUIREMENTS],
    audits:                  [...MOCK_AUDITS],
    auditFindings:           [...MOCK_AUDIT_FINDINGS],
    capaActions:             [...MOCK_CAPA_ACTIONS],
    trainingCourses:         [...MOCK_TRAINING_COURSES],
    trainingRecords:         [...MOCK_TRAINING_RECORDS],
    documents:               [...MOCK_DOCUMENTS],
    documentAcknowledgments: [...MOCK_DOC_ACKNOWLEDGMENTS],
    wasteStreams:             [...MOCK_WASTE_STREAMS],
    equipment:               [...MOCK_EQUIPMENT],
    riskAssessments:         [...MOCK_RISK_ASSESSMENTS],
    incidents:               [...MOCK_INCIDENTS],
    complianceScores:        [...MOCK_COMPLIANCE_SCORES],
    aiFindings:              [...MOCK_AI_FINDINGS],
    predictabilityRuns:      [...MOCK_PREDICTABILITY_RUNS],
    auditLog:                [...MOCK_AUDIT_LOG],
    relianceInsights:        [...MOCK_RELIANCE_INSIGHTS],
  };
}

export function getStore(): SafetyIQStore {
  if (!global.__safetyiqStore) global.__safetyiqStore = initStore();
  return global.__safetyiqStore;
}

/** Wipe and re-seed — useful in test teardown or /api/dev/reset. */
export function resetStore(): void {
  global.__safetyiqStore = initStore();
}

/** Generate a stable-prefixed sequential ID for new mock records. */
const _counters: Record<string, number> = {};
export function nextId(prefix: string): string {
  _counters[prefix] = (_counters[prefix] ?? 0) + 1;
  return `${prefix}-mock-${String(_counters[prefix]).padStart(3, "0")}`;
}

export type { SafetyIQStore };

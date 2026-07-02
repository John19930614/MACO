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
  WorkspaceTask,
  BiosafetyLab,
  BiohazardAgent,
  ErgonomicsWorkstation,
  ErgonomicsJobTask,
  OshaCase,
  // Arc domain
  SafetyCell,
  ControlProof,
  EvidenceFile,
  CausalEdge,
  SafetyAction,
  SafetyLocation,
  ExpCapture,
  HslReading,
  PclssRun,
  VelaInsight,
  Comment,
  EventCell,
  BehaviorCell,
  GatewayReject,
  StagedRecord,
} from "@/lib/types";
import type { EapRecord } from "@/lib/actions/eap";
import { EHS_MODULES } from "@/lib/constants";

export interface ModuleState {
  enabled: boolean;
  maintenanceNote: string;
  disabledAt: string | null;
  disabledBy: string;
}

import {
  MOCK_TENANTS_ALL as MOCK_TENANTS,
  MOCK_PROFILES_ALL as MOCK_PROFILE_LIST,
  MOCK_SITES_ALL as MOCK_SITES,
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
  MOCK_BIOSAFETY_LABS,
  MOCK_BIOHAZARD_AGENTS,
  MOCK_ERGONOMICS_WORKSTATIONS,
  MOCK_ERGONOMICS_JOB_TASKS,
  MOCK_WORKSPACE_TASKS,
  MOCK_OSHA_CASES,
  // Arc fixtures
  CELLS,
  PROOFS,
  EDGES,
  LOCATIONS,
  HSL_READINGS,
  VELA_INSIGHTS,
  FINDINGS,
  EVENT_CELLS,
  BEHAVIOR_CELLS,
  ACTIONS,
  MOCK_COMMENTS,
} from "@/lib/data/mock";

// ── Store shape ───────────────────────────────────────────────────────────────

interface SafetyIQStore {
  // EHS module collections
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
  workspaceTasks: WorkspaceTask[];
  biosafetyLabs: BiosafetyLab[];
  biohazardAgents: BiohazardAgent[];
  ergonomicsWorkstations: ErgonomicsWorkstation[];
  ergonomicsJobTasks: ErgonomicsJobTask[];
  oshaStore: OshaCase[];
  // Arc domain collections (used by repo.ts)
  cells: SafetyCell[];
  proofs: ControlProof[];
  edges: CausalEdge[];
  events: EventCell[];
  behaviors: BehaviorCell[];
  actions: SafetyAction[];
  evidence: EvidenceFile[];
  exp: ExpCapture[];
  hsl: HslReading[];
  pclss: PclssRun[];
  findings: AiFinding[];      // per-cell AI findings (repo.ts)
  comments: Comment[];
  audit: AuditEntry[];        // Arc audit log (repo.ts)
  rejects: GatewayReject[];
  staged: StagedRecord[];
  locations: SafetyLocation[];
  velaInsights: VelaInsight[];
  moduleStates: Record<string, ModuleState>;
  // Emergency Action Plan — null until first save; readers fall back to the
  // static fixture in actions/eap.ts.
  eap: EapRecord | null;
}

// ── Singleton initialisation ──────────────────────────────────────────────────

declare const global: { __safetyiqStore?: SafetyIQStore };

function initStore(): SafetyIQStore {
  return {
    // EHS module collections
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
    workspaceTasks:          [...MOCK_WORKSPACE_TASKS],
    biosafetyLabs:           [...MOCK_BIOSAFETY_LABS],
    biohazardAgents:         [...MOCK_BIOHAZARD_AGENTS],
    ergonomicsWorkstations:  [...MOCK_ERGONOMICS_WORKSTATIONS],
    ergonomicsJobTasks:      [...MOCK_ERGONOMICS_JOB_TASKS],
    oshaStore:               [...MOCK_OSHA_CASES],
    // Arc domain collections
    cells:        [...CELLS],
    proofs:       [...PROOFS],
    edges:        [...EDGES],
    events:       [...EVENT_CELLS],
    behaviors:    [...BEHAVIOR_CELLS],
    actions:      [...ACTIONS],
    evidence:     [],
    exp:          [],
    hsl:          [...HSL_READINGS],
    pclss:        [],
    findings:     [...FINDINGS],
    comments:     [...MOCK_COMMENTS],
    audit:        [],
    rejects:      [],
    staged:       [],
    locations:    [...LOCATIONS],
    velaInsights: [...VELA_INSIGHTS],
    eap:          null,
    moduleStates: Object.fromEntries(
      EHS_MODULES.map((m) => [m, { enabled: true, maintenanceNote: "", disabledAt: null, disabledBy: "" }])
    ),
  };
}

export function getStore(): SafetyIQStore {
  if (!global.__safetyiqStore) global.__safetyiqStore = initStore();
  // Backfill new fields after hot-reload without full store reset
  if (!global.__safetyiqStore.moduleStates) {
    global.__safetyiqStore.moduleStates = Object.fromEntries(
      EHS_MODULES.map((m) => [m, { enabled: true, maintenanceNote: "", disabledAt: null, disabledBy: "" }])
    ) as Record<string, ModuleState>;
  }
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

// ── Session user management (mock mode) ──────────────────────────────────────
// Default to the reliance admin (global operator) so tests start in a known state.
let _sessionUserId = "p-reliance-admin-001";

/** Switch the active mock session user (test helper / demo switcher). */
export function setSessionUser(id: string): void {
  _sessionUserId = id;
}

/** Return the ID of the current mock session user. */
export function getSessionUserId(): string {
  return _sessionUserId;
}

/**
 * A Proxy that delegates every property access/write to the singleton store.
 * repo.ts imports `store` directly and mutates it; this keeps mutation in sync
 * with `getStore()` without exposing a mutable module-level variable.
 */
export const store: SafetyIQStore = new Proxy(
  {} as SafetyIQStore,
  {
    get(_: SafetyIQStore, prop: string) {
      return (getStore() as unknown as Record<string, unknown>)[prop];
    },
    set(_: SafetyIQStore, prop: string, value: unknown) {
      (getStore() as unknown as Record<string, unknown>)[prop] = value;
      return true;
    },
  },
);

export type { SafetyIQStore };

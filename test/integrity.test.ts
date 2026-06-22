import { describe, it, expect } from "vitest";
import * as fx from "@/lib/data/mock";
import {
  ROLES,
  SEVERITIES,
  COMPLIANCE_STATUSES,
  CAPA_STATUSES,
  AUDIT_STATUSES,
  REVIEW_STATUSES,
  RISK_LEVELS,
} from "@/lib/constants";

// ── helpers ───────────────────────────────────────────────────────────────────

const tenantIds  = new Set(fx.MOCK_TENANTS.map(t => t.id));
const siteIds    = new Set(fx.MOCK_SITES.map(s => s.id));
const profileIds = new Set(fx.MOCK_PROFILE_LIST.map(p => p.id));
const chemIds   = new Set(fx.MOCK_CHEMICALS.map(c => c.id));
const auditIds  = new Set(fx.MOCK_AUDITS.map(a => a.id));
const findingIds = new Set(fx.MOCK_AUDIT_FINDINGS.map(f => f.id));
const capaIds   = new Set(fx.MOCK_CAPA_ACTIONS.map(c => c.id));
const courseIds = new Set(fx.MOCK_TRAINING_COURSES.map(c => c.id));
const docIds    = new Set(fx.MOCK_DOCUMENTS.map(d => d.id));
const legalIds  = new Set(fx.MOCK_LEGAL_REQUIREMENTS.map(l => l.id));

// ── Tenant ────────────────────────────────────────────────────────────────────

describe("Tenant fixtures", () => {
  it("BioStar demo tenant exists", () => {
    expect(fx.MOCK_TENANTS.some(t => t.id === fx.MOCK_TENANT_ID)).toBe(true);
  });

  it("demo tenant ID matches the exported constant", () => {
    expect(fx.MOCK_TENANTS.find(t => t.id === fx.MOCK_TENANT_ID)?.id).toBe(fx.MOCK_TENANT_ID);
  });

  it("demo tenant is active", () => {
    expect(fx.MOCK_TENANTS.find(t => t.id === fx.MOCK_TENANT_ID)?.active).toBe(true);
  });
});

// ── Profiles ──────────────────────────────────────────────────────────────────

describe("Profile fixtures", () => {
  it("has 5 BioStar profiles (4 tenant-scoped + 1 global operator)", () => {
    const biostarAndGlobal = fx.MOCK_PROFILE_LIST.filter(
      p => p.tenant_id === fx.MOCK_TENANT_ID || p.tenant_id === null,
    );
    expect(biostarAndGlobal).toHaveLength(5);
  });

  it("all profiles have valid roles", () => {
    for (const p of fx.MOCK_PROFILE_LIST) {
      expect(ROLES).toContain(p.role);
    }
  });

  it("exactly one global operator (tenant_id: null)", () => {
    const globals = fx.MOCK_PROFILE_LIST.filter(p => p.tenant_id === null);
    expect(globals).toHaveLength(1);
    expect(globals[0].id).toBe(fx.MOCK_PROFILES.reliance);
  });

  it("all tenant-scoped profiles reference a real tenant", () => {
    for (const p of fx.MOCK_PROFILE_LIST.filter(p => p.tenant_id !== null)) {
      expect(tenantIds.has(p.tenant_id!)).toBe(true);
    }
  });

  it("default_site_id references a real site when set", () => {
    for (const p of fx.MOCK_PROFILE_LIST) {
      if (p.default_site_id !== null) {
        expect(siteIds.has(p.default_site_id)).toBe(true);
      }
    }
  });
});

// ── Sites ─────────────────────────────────────────────────────────────────────

describe("Site fixtures", () => {
  it("has at least one site", () => {
    expect(fx.MOCK_SITES.length).toBeGreaterThan(0);
  });

  it("demo site ID matches the exported constant", () => {
    expect(siteIds.has(fx.MOCK_SITE_ID)).toBe(true);
  });

  it("all sites reference a real tenant", () => {
    for (const s of fx.MOCK_SITES) {
      expect(tenantIds.has(s.tenant_id)).toBe(true);
    }
  });
});

// ── Chemicals ─────────────────────────────────────────────────────────────────

describe("Chemical fixtures", () => {
  it("all chemicals reference a real tenant and a real site", () => {
    for (const c of fx.MOCK_CHEMICALS) {
      expect(tenantIds.has(c.tenant_id)).toBe(true);
      expect(siteIds.has(c.site_id)).toBe(true);
    }
  });

  it("all chemical statuses are valid", () => {
    const STATUSES = ["active", "disposed", "depleted"] as const;
    for (const c of fx.MOCK_CHEMICALS) {
      expect(STATUSES).toContain(c.status);
    }
  });

  it("scheduled chemicals have a schedule_ref", () => {
    for (const c of fx.MOCK_CHEMICALS.filter(c => c.is_scheduled)) {
      expect(c.schedule_ref).toBeTruthy();
    }
  });

  it("owner_id references a real profile when set", () => {
    for (const c of fx.MOCK_CHEMICALS) {
      if (c.owner_id !== null) {
        expect(profileIds.has(c.owner_id)).toBe(true);
      }
    }
  });

  it("created_by references a real profile", () => {
    for (const c of fx.MOCK_CHEMICALS) {
      expect(profileIds.has(c.created_by)).toBe(true);
    }
  });

  it("at least one chemical has carcinogen H350", () => {
    const h350 = fx.MOCK_CHEMICALS.filter(c => c.ghs_classes.includes("H350"));
    expect(h350.length).toBeGreaterThan(0);
  });
});

// ── Legal Requirements ────────────────────────────────────────────────────────

describe("Legal requirement fixtures", () => {
  it("all belong to a real tenant", () => {
    for (const lr of fx.MOCK_LEGAL_REQUIREMENTS) {
      expect(tenantIds.has(lr.tenant_id)).toBe(true);
    }
  });

  it("all have valid compliance statuses", () => {
    for (const lr of fx.MOCK_LEGAL_REQUIREMENTS) {
      expect(COMPLIANCE_STATUSES).toContain(lr.status);
    }
  });

  it("at least one is compliant and at least one is major_gap", () => {
    const statuses = fx.MOCK_LEGAL_REQUIREMENTS.map(lr => lr.status);
    expect(statuses).toContain("compliant");
    expect(statuses).toContain("major_gap");
  });

  it("owner_id references a real profile when set", () => {
    for (const lr of fx.MOCK_LEGAL_REQUIREMENTS) {
      if (lr.owner_id) expect(profileIds.has(lr.owner_id)).toBe(true);
    }
  });
});

// ── Audits ────────────────────────────────────────────────────────────────────

describe("Audit fixtures", () => {
  it("all belong to a real tenant and a real site", () => {
    for (const a of fx.MOCK_AUDITS) {
      expect(tenantIds.has(a.tenant_id)).toBe(true);
      expect(siteIds.has(a.site_id)).toBe(true);
    }
  });

  it("all have valid audit statuses", () => {
    for (const a of fx.MOCK_AUDITS) {
      expect(AUDIT_STATUSES).toContain(a.status);
    }
  });

  it("completed audits have a completed_date", () => {
    for (const a of fx.MOCK_AUDITS.filter(a => a.status === "completed")) {
      expect(a.completed_date).toBeTruthy();
    }
  });

  it("scheduled audits have no completed_date", () => {
    for (const a of fx.MOCK_AUDITS.filter(a => a.status === "scheduled")) {
      expect(a.completed_date).toBeNull();
    }
  });
});

// ── Audit Findings ────────────────────────────────────────────────────────────

describe("Audit finding fixtures", () => {
  it("all reference a real audit and a real site", () => {
    for (const f of fx.MOCK_AUDIT_FINDINGS) {
      expect(auditIds.has(f.audit_id)).toBe(true);
      expect(siteIds.has(f.site_id)).toBe(true);
    }
  });

  it("all have valid severity values", () => {
    for (const f of fx.MOCK_AUDIT_FINDINGS) {
      expect(SEVERITIES).toContain(f.severity);
    }
  });

  it("findings with capa_id reference a real CAPA", () => {
    for (const f of fx.MOCK_AUDIT_FINDINGS) {
      if (f.capa_id !== null) {
        expect(capaIds.has(f.capa_id)).toBe(true);
      }
    }
  });

  it("all findings belong to the demo tenant", () => {
    for (const f of fx.MOCK_AUDIT_FINDINGS) {
      expect(f.tenant_id).toBe(fx.MOCK_TENANT_ID);
    }
  });
});

// ── CAPA Actions ──────────────────────────────────────────────────────────────

describe("CAPA action fixtures", () => {
  it("all belong to a real tenant and a real site", () => {
    for (const c of fx.MOCK_CAPA_ACTIONS) {
      expect(tenantIds.has(c.tenant_id)).toBe(true);
      expect(siteIds.has(c.site_id)).toBe(true);
    }
  });

  it("all have valid CAPA statuses", () => {
    for (const c of fx.MOCK_CAPA_ACTIONS) {
      expect(CAPA_STATUSES).toContain(c.status);
    }
  });

  it("all have valid severity values", () => {
    for (const c of fx.MOCK_CAPA_ACTIONS) {
      expect(SEVERITIES).toContain(c.severity);
    }
  });

  it("closed CAPAs have a closed_at timestamp", () => {
    for (const c of fx.MOCK_CAPA_ACTIONS.filter(c => c.status === "closed")) {
      expect(c.closed_at).toBeTruthy();
    }
  });

  it("open/in_progress CAPAs have no closed_at", () => {
    const open = fx.MOCK_CAPA_ACTIONS.filter(c => c.status === "open" || c.status === "in_progress");
    for (const c of open) {
      expect(c.closed_at).toBeNull();
    }
  });

  it("audit_finding source_ids reference real findings", () => {
    for (const c of fx.MOCK_CAPA_ACTIONS.filter(c => c.source_type === "audit_finding")) {
      if (c.source_id) expect(findingIds.has(c.source_id)).toBe(true);
    }
  });

  it("legal_requirement source_ids reference real legal requirements", () => {
    for (const c of fx.MOCK_CAPA_ACTIONS.filter(c => c.source_type === "legal_requirement")) {
      if (c.source_id) expect(legalIds.has(c.source_id)).toBe(true);
    }
  });

  it("has at least one overdue CAPA", () => {
    expect(fx.MOCK_CAPA_ACTIONS.some(c => c.status === "overdue")).toBe(true);
  });
});

// ── Training ──────────────────────────────────────────────────────────────────

describe("Training course fixtures", () => {
  it("all belong to the demo tenant", () => {
    for (const c of fx.MOCK_TRAINING_COURSES) {
      expect(c.tenant_id).toBe(fx.MOCK_TENANT_ID);
    }
  });

  it("required_roles are all valid role values", () => {
    for (const c of fx.MOCK_TRAINING_COURSES) {
      for (const role of c.required_roles) {
        expect(ROLES).toContain(role);
      }
    }
  });
});

describe("Training record fixtures", () => {
  it("all reference a real profile, course, and site", () => {
    for (const r of fx.MOCK_TRAINING_RECORDS) {
      expect(profileIds.has(r.profile_id)).toBe(true);
      expect(courseIds.has(r.course_id)).toBe(true);
      expect(siteIds.has(r.site_id)).toBe(true);
    }
  });

  it("records with a non-null score obey pass_score for the course", () => {
    for (const r of fx.MOCK_TRAINING_RECORDS) {
      if (r.score !== null) {
        const course = fx.MOCK_TRAINING_COURSES.find(c => c.id === r.course_id)!;
        if (course.pass_score !== null && r.passed) {
          expect(r.score).toBeGreaterThanOrEqual(course.pass_score);
        }
      }
    }
  });

  it("at least two training records are expired", () => {
    const expired = fx.MOCK_TRAINING_RECORDS.filter(
      r => r.expiry_date !== null && r.expiry_date < "2026-06-17",
    );
    expect(expired.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Documents ─────────────────────────────────────────────────────────────────

describe("Document fixtures", () => {
  it("all belong to a real tenant", () => {
    for (const d of fx.MOCK_DOCUMENTS) {
      expect(tenantIds.has(d.tenant_id)).toBe(true);
    }
  });

  it("document acknowledgments reference real documents and profiles", () => {
    for (const ack of fx.MOCK_DOC_ACKNOWLEDGMENTS) {
      expect(docIds.has(ack.document_id)).toBe(true);
      expect(profileIds.has(ack.profile_id)).toBe(true);
    }
  });
});

// ── Waste Streams ─────────────────────────────────────────────────────────────

describe("Waste stream fixtures", () => {
  it("all reference a real tenant and a real site", () => {
    for (const w of fx.MOCK_WASTE_STREAMS) {
      expect(tenantIds.has(w.tenant_id)).toBe(true);
      expect(siteIds.has(w.site_id)).toBe(true);
    }
  });

  it("all have valid classification values", () => {
    const VALID = ["hazardous", "non_hazardous", "radioactive", "clinical", "scheduled", "recyclable", "general"] as const;
    for (const w of fx.MOCK_WASTE_STREAMS) {
      expect(VALID).toContain(w.classification);
    }
  });
});

// ── Equipment ─────────────────────────────────────────────────────────────────

describe("Equipment fixtures", () => {
  it("all reference a real tenant and a real site", () => {
    for (const e of fx.MOCK_EQUIPMENT) {
      expect(tenantIds.has(e.tenant_id)).toBe(true);
      expect(siteIds.has(e.site_id)).toBe(true);
    }
  });

  it("at least one item is calibration_due", () => {
    expect(fx.MOCK_EQUIPMENT.some(e => e.status === "calibration_due")).toBe(true);
  });

  it("at least one item is inspection_due", () => {
    expect(fx.MOCK_EQUIPMENT.some(e => e.status === "inspection_due")).toBe(true);
  });
});

// ── Risk Assessments ──────────────────────────────────────────────────────────

describe("Risk assessment fixtures", () => {
  it("all reference a real tenant and a real site", () => {
    for (const r of fx.MOCK_RISK_ASSESSMENTS) {
      expect(tenantIds.has(r.tenant_id)).toBe(true);
      expect(siteIds.has(r.site_id)).toBe(true);
    }
  });

  it("risk_score equals likelihood × consequence", () => {
    for (const r of fx.MOCK_RISK_ASSESSMENTS) {
      expect(r.risk_score).toBe(r.likelihood_score * r.consequence_score);
    }
  });

  it("all risk_level values are valid", () => {
    for (const r of fx.MOCK_RISK_ASSESSMENTS) {
      expect(RISK_LEVELS).toContain(r.risk_level);
    }
  });

  it("residual scores exist when additional controls are present", () => {
    for (const r of fx.MOCK_RISK_ASSESSMENTS.filter(r => r.additional_controls.length > 0)) {
      expect(r.residual_likelihood).not.toBeNull();
      expect(r.residual_consequence).not.toBeNull();
      expect(r.residual_risk_score).not.toBeNull();
    }
  });
});

// ── Incidents ─────────────────────────────────────────────────────────────────

describe("Incident fixtures", () => {
  it("all reference a real tenant and a real site", () => {
    for (const i of fx.MOCK_INCIDENTS) {
      expect(tenantIds.has(i.tenant_id)).toBe(true);
      expect(siteIds.has(i.site_id)).toBe(true);
    }
  });

  it("all have valid severity values", () => {
    for (const i of fx.MOCK_INCIDENTS) {
      expect(SEVERITIES).toContain(i.severity);
    }
  });

  it("reported_by references a real profile", () => {
    for (const i of fx.MOCK_INCIDENTS) {
      expect(profileIds.has(i.reported_by)).toBe(true);
    }
  });

  it("incidents requiring medical treatment have an injuries_description", () => {
    for (const i of fx.MOCK_INCIDENTS.filter(i => i.medical_treatment_required)) {
      expect(i.injuries_description).toBeTruthy();
    }
  });
});

// ── Compliance Scores ─────────────────────────────────────────────────────────

describe("Compliance score fixtures", () => {
  it("one score exists per EHS module", () => {
    const modules = fx.MOCK_COMPLIANCE_SCORES.map(s => s.module);
    const EHS_MODULES = ["chemical", "legal", "audits", "capa", "training", "documents", "waste", "equipment", "risk", "incidents"];
    for (const mod of EHS_MODULES) {
      expect(modules).toContain(mod);
    }
  });

  it("percentages are within 0–100", () => {
    for (const s of fx.MOCK_COMPLIANCE_SCORES) {
      expect(s.percentage).toBeGreaterThanOrEqual(0);
      expect(s.percentage).toBeLessThanOrEqual(100);
    }
  });

  it("all have valid compliance statuses", () => {
    for (const s of fx.MOCK_COMPLIANCE_SCORES) {
      expect(COMPLIANCE_STATUSES).toContain(s.status);
    }
  });
});

// ── AI Findings ───────────────────────────────────────────────────────────────

describe("AI finding fixtures", () => {
  it("all belong to the demo tenant", () => {
    for (const f of fx.MOCK_AI_FINDINGS) {
      expect(f.tenant_id).toBe(fx.MOCK_TENANT_ID);
    }
  });

  it("all have valid review statuses", () => {
    for (const f of fx.MOCK_AI_FINDINGS) {
      expect(REVIEW_STATUSES).toContain(f.review_status);
    }
  });

  it("confidence is within 0–1", () => {
    for (const f of fx.MOCK_AI_FINDINGS) {
      expect(f.confidence).toBeGreaterThanOrEqual(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("prompt_version matches the platform constant", () => {
    for (const f of fx.MOCK_AI_FINDINGS) {
      expect(f.prompt_version).toBe("safetyiq-ehs-2026-06-17");
    }
  });

  it("model is the heuristic mock for all fixture entries", () => {
    for (const f of fx.MOCK_AI_FINDINGS) {
      expect(f.model).toBe("safetyiq-heuristic-mock");
    }
  });
});

// ── Predictability Runs ───────────────────────────────────────────────────────

describe("Predictability run fixtures", () => {
  it("stages are drawn from valid vocabulary", () => {
    const VALID = ["scan", "detect", "forecast", "alert", "learn"] as const;
    for (const r of fx.MOCK_PREDICTABILITY_RUNS) {
      expect(VALID).toContain(r.stage);
    }
  });

  it("forecast stage has non-null forecast_data", () => {
    for (const r of fx.MOCK_PREDICTABILITY_RUNS.filter(r => r.stage === "forecast")) {
      expect(r.forecast_data).not.toBeNull();
    }
  });

  it("scan stage has null forecast_data", () => {
    for (const r of fx.MOCK_PREDICTABILITY_RUNS.filter(r => r.stage === "scan")) {
      expect(r.forecast_data).toBeNull();
    }
  });
});

// ── Reliance Insights ─────────────────────────────────────────────────────────

describe("Reliance insight fixtures", () => {
  it("no reliance insight has a tenant_id (cross-tenant by design)", () => {
    // RelianceInsight has no tenant_id field — verify the data objects don't carry one
    for (const ri of fx.MOCK_RELIANCE_INSIGHTS) {
      expect((ri as Record<string, unknown>)["tenant_id"]).toBeUndefined();
    }
  });

  it("confidence values are within 0–1", () => {
    for (const ri of fx.MOCK_RELIANCE_INSIGHTS) {
      expect(ri.confidence).toBeGreaterThan(0);
      expect(ri.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("each insight has at least one regulatory_ref", () => {
    for (const ri of fx.MOCK_RELIANCE_INSIGHTS) {
      expect(ri.regulatory_refs.length).toBeGreaterThan(0);
    }
  });
});

// ── Cross-fixture referential integrity ───────────────────────────────────────

describe("Cross-fixture referential integrity", () => {
  it("every audit finding audit_id maps to an existing audit", () => {
    for (const f of fx.MOCK_AUDIT_FINDINGS) {
      expect(auditIds.has(f.audit_id)).toBe(true);
    }
  });

  it("every CAPA with audit_finding source_type maps to an existing finding", () => {
    for (const c of fx.MOCK_CAPA_ACTIONS.filter(c => c.source_type === "audit_finding" && c.source_id)) {
      expect(findingIds.has(c.source_id!)).toBe(true);
    }
  });

  it("every CAPA owner_id maps to an existing profile", () => {
    for (const c of fx.MOCK_CAPA_ACTIONS) {
      if (c.owner_id) expect(profileIds.has(c.owner_id)).toBe(true);
    }
  });

  it("every AI finding chemical source maps to a real chemical", () => {
    for (const f of fx.MOCK_AI_FINDINGS.filter(f => f.source_type === "chemical" && f.source_id)) {
      expect(chemIds.has(f.source_id!)).toBe(true);
    }
  });

  it("every AI finding legal_requirement source maps to a real requirement", () => {
    for (const f of fx.MOCK_AI_FINDINGS.filter(f => f.source_type === "legal_requirement" && f.source_id)) {
      expect(legalIds.has(f.source_id!)).toBe(true);
    }
  });
});

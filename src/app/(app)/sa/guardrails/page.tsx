"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/primitives";
import {
  ShieldCheck, Zap, GitBranch, Building2, Lock, Unlock,
  AlertTriangle, CheckCircle2, Info, Save, RotateCcw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type GuardrailScope = "ai" | "risk" | "workflow" | "tenant";

interface GuardrailRule {
  id: string;
  label: string;
  description: string;
  scope: GuardrailScope;
  enabled: boolean;
  locked?: boolean; // platform-enforced, tenant cannot override
  threshold?: { value: number; unit: string; min: number; max: number; step: number };
  impact: "high" | "medium" | "low";
}

// ── Initial rule set ──────────────────────────────────────────────────────────

const INITIAL_RULES: GuardrailRule[] = [
  // AI Behavior
  {
    id: "ai_findings_auto_escalate",
    label: "Auto-escalate AI findings at critical severity",
    description: "Critical-severity AI findings are immediately assigned to the site EHS Manager and flagged for same-day review. Below critical, findings queue for standard triage.",
    scope: "ai", enabled: true, impact: "high",
  },
  {
    id: "ai_chemical_hazard_confidence",
    label: "Chemical hazard flag confidence threshold",
    description: "AI chemical hazard flags below this confidence are held as draft suggestions and not surfaced to customer-facing dashboards until a Reliance analyst promotes them.",
    scope: "ai", enabled: true, impact: "high",
    threshold: { value: 75, unit: "% confidence", min: 50, max: 99, step: 1 },
  },
  {
    id: "ai_capa_auto_queue",
    label: "AI CAPA recommendations auto-queue",
    description: "AI-generated CAPA recommendations from audit findings or risk assessments are automatically added to the CAPA queue as drafts. They require human owner assignment before becoming active.",
    scope: "ai", enabled: true, impact: "medium",
  },
  {
    id: "ai_risk_score_auto_update",
    label: "Predictive risk score auto-update",
    description: "Allows the predictive engine to recalculate and update EHS module risk scores after new incident, CAPA, or chemical inventory data is ingested, without a manual trigger.",
    scope: "ai", enabled: true, impact: "medium",
  },
  {
    id: "ai_training_gap_detection",
    label: "AI training gap detection",
    description: "AI continuously scans chemical inventory changes and legal register updates to identify training gaps. Detected gaps are surfaced as AI findings for EHS manager review.",
    scope: "ai", enabled: true, impact: "medium",
  },
  {
    id: "ai_gateway_min_confidence",
    label: "AI Gateway minimum confidence to pass Gate 7",
    description: "AI output with overall confidence below this value is routed to 'Needs Human Review' before entering any official EHS workflow. High-risk output is always routed regardless of confidence.",
    scope: "ai", enabled: true, impact: "high",
    threshold: { value: 70, unit: "% confidence", min: 50, max: 95, step: 1 },
  },
  // Risk Thresholds
  {
    id: "risk_score_escalation",
    label: "Risk score escalation trigger",
    description: "Risk assessments with a risk score at or above this value are automatically escalated to the EHS Manager and flagged as priority items in the risk register.",
    scope: "risk", enabled: true, impact: "high",
    threshold: { value: 15, unit: "/ 25", min: 8, max: 25, step: 1 },
  },
  {
    id: "risk_site_compliance_alert",
    label: "Site compliance score alert threshold",
    description: "When a module compliance score drops below this value, a platform alert is sent to the Reliance team and tenant admin. Triggers immediate review.",
    scope: "risk", enabled: true, impact: "high",
    threshold: { value: 60, unit: "% compliance", min: 30, max: 85, step: 5 },
  },
  {
    id: "risk_capa_overdue_escalation",
    label: "CAPA overdue escalation (days past due)",
    description: "Open CAPAs that remain unresolved beyond this number of days past their due date are automatically escalated to the EHS Manager and flagged in the dashboard.",
    scope: "risk", enabled: true, impact: "high",
    threshold: { value: 7, unit: "days overdue", min: 1, max: 30, step: 1 },
  },
  {
    id: "risk_sds_expiry_warning",
    label: "SDS expiry advance warning",
    description: "Chemical Safety Data Sheets approaching expiry within this window trigger an advance warning to the chemical manager. Expired SDS triggers an immediate compliance flag.",
    scope: "risk", enabled: true, impact: "medium",
    threshold: { value: 30, unit: "days before expiry", min: 7, max: 90, step: 7 },
  },
  {
    id: "risk_predictive_min_confidence",
    label: "Predictive engine minimum confidence to surface forecast",
    description: "Risk forecast entries below this confidence are hidden from customer dashboards and replaced with an 'Insufficient data — more records needed' indicator.",
    scope: "risk", enabled: true, impact: "medium",
    threshold: { value: 65, unit: "% confidence", min: 40, max: 90, step: 5 },
  },
  // Workflow Gates
  {
    id: "wf_capa_evidence",
    label: "CAPA: require evidence before closure",
    description: "A CAPA record cannot transition to 'closed' unless at least one evidence attachment or verified completion note is recorded. Platform-enforced; cannot be disabled.",
    scope: "workflow", enabled: true, locked: true, impact: "high",
  },
  {
    id: "wf_capa_require_owner",
    label: "CAPA: require assigned owner before activation",
    description: "A CAPA cannot move from 'draft' to 'open' status until a named owner is assigned. Prevents unowned corrective actions from entering the active queue.",
    scope: "workflow", enabled: true, locked: true, impact: "high",
  },
  {
    id: "wf_audit_findings_reviewed",
    label: "Audit: all findings reviewed before report publication",
    description: "Audit reports cannot be published or shared externally until every finding has been reviewed and assigned a disposition (accepted, rejected, or deferred).",
    scope: "workflow", enabled: true, locked: true, impact: "high",
  },
  {
    id: "wf_osha_recordability_human",
    label: "OSHA: recordability determination requires human review",
    description: "AI may suggest OSHA recordability classification, but the determination cannot be finalised without an authorized human reviewer confirming the decision.",
    scope: "workflow", enabled: true, locked: true, impact: "high",
  },
  {
    id: "wf_training_completion_verify",
    label: "Training: require verified completion before credit",
    description: "Training completions require confirmation from the instructor or system record before counting toward an employee's compliance status.",
    scope: "workflow", enabled: true, impact: "medium",
  },
  {
    id: "wf_high_risk_capa_manager_review",
    label: "High-risk CAPA: require manager sign-off before closure",
    description: "CAPAs linked to high or critical risk assessments require an EHS Manager or above to sign off on closure before the record is marked complete.",
    scope: "workflow", enabled: true, impact: "high",
  },
  // Tenant Permissions
  {
    id: "tenant_risk_thresholds",
    label: "Tenants may adjust risk score thresholds",
    description: "Allow tenant admins to raise or lower their own risk escalation thresholds within ±3 points of the platform defaults. Requires Reliance approval to activate.",
    scope: "tenant", enabled: false, locked: true, impact: "high",
  },
  {
    id: "tenant_suppress_ai_findings",
    label: "Tenants may suppress AI findings by module",
    description: "Tenant admins can temporarily suppress AI findings for a specific EHS module, typically during planned maintenance or a known anomalous data period.",
    scope: "tenant", enabled: true, impact: "medium",
  },
  {
    id: "tenant_export_raw_ehs_data",
    label: "Tenants may export raw EHS records",
    description: "Allows tenant admins with the EHS Manager role or above to export raw chemical inventory, CAPA, incident, and audit records as CSV or JSON.",
    scope: "tenant", enabled: true, impact: "low",
  },
  {
    id: "tenant_plan_overage",
    label: "Tenants may exceed user plan seat limits",
    description: "If disabled, any attempt to invite users beyond the subscribed plan seat count is blocked at the invitation step. If enabled, overages are billed at the per-seat rate.",
    scope: "tenant", enabled: false, locked: true, impact: "medium",
  },
  {
    id: "tenant_custom_legal_register",
    label: "Tenants may add custom legal register entries",
    description: "Allow tenant admins to add company-specific internal standards, client contractual requirements, or local jurisdiction rules to their legal register alongside the global library.",
    scope: "tenant", enabled: true, impact: "low",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCOPES: { id: GuardrailScope; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { id: "ai",       label: "AI Behavior",        icon: Zap,       color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  { id: "risk",     label: "Risk Thresholds",    icon: AlertTriangle, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  { id: "workflow", label: "Workflow Gates",      icon: GitBranch, color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  { id: "tenant",   label: "Tenant Permissions", icon: Building2, color: "text-slate-700",  bg: "bg-slate-50 border-slate-200" },
];

const IMPACT_COLORS = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-slate-100 text-slate-600",
};

function Toggle({ value, disabled, onChange }: { value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      } ${value ? "bg-blue-600" : "bg-slate-200"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
          value ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GuardrailsPage() {
  const [rules, setRules]     = useState<GuardrailRule[]>(INITIAL_RULES);
  const [dirty, setDirty]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [activeScope, setActiveScope] = useState<GuardrailScope | "all">("all");

  const setEnabled = useCallback((id: string, value: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: value } : r));
    setDirty(true); setSaved(false);
  }, []);

  const setThreshold = useCallback((id: string, value: number) => {
    setRules(prev => prev.map(r => r.id === id && r.threshold ? { ...r, threshold: { ...r.threshold, value } } : r));
    setDirty(true); setSaved(false);
  }, []);

  function handleSave() {
    setSaving(true);
    setTimeout(() => { setSaving(false); setDirty(false); setSaved(true); }, 700);
  }

  function handleReset() {
    setRules(INITIAL_RULES);
    setDirty(false); setSaved(false);
  }

  const visible = activeScope === "all" ? rules : rules.filter(r => r.scope === activeScope);
  const activeCount  = rules.filter(r => r.enabled).length;
  const lockedCount  = rules.filter(r => r.locked).length;
  const highCount    = rules.filter(r => r.impact === "high" && r.enabled).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Platform Guardrails"
        subtitle="Behavioural rules governing AI autonomy, risk escalation, workflow gates, and tenant permissions."
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <button onClick={handleReset} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                saved && !dirty
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : dirty
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <><Save className="h-3.5 w-3.5 animate-pulse" /> Saving…</>
              ) : saved && !dirty ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</>
              ) : (
                <><Save className="h-3.5 w-3.5" /> Save Changes</>
              )}
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="shrink-0 grid grid-cols-4 gap-4 border-b border-slate-100 bg-white px-6 py-4">
        {[
          { label: "Active rules",        value: activeCount,   total: rules.length,  color: "text-blue-600",    icon: ShieldCheck },
          { label: "Platform-locked",     value: lockedCount,   total: rules.length,  color: "text-slate-600",   icon: Lock        },
          { label: "High-impact active",  value: highCount,     total: activeCount,   color: "text-orange-600",  icon: AlertTriangle },
          { label: "AI autonomy rules",   value: rules.filter(r => r.scope === "ai" && r.enabled).length, total: rules.filter(r => r.scope === "ai").length, color: "text-violet-600", icon: Zap },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 ${s.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}<span className="text-sm font-normal text-slate-400"> / {s.total}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Scope sidebar */}
        <div className="w-52 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 space-y-1">
          <button
            onClick={() => setActiveScope("all")}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeScope === "all" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            All rules
            <span className="ml-auto text-[11px] text-slate-400">{rules.length}</span>
          </button>
          {SCOPES.map(s => {
            const Icon = s.icon;
            const count = rules.filter(r => r.scope === s.id).length;
            const active = rules.filter(r => r.scope === s.id && r.enabled).length;
            return (
              <button
                key={s.id}
                onClick={() => setActiveScope(s.id)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeScope === s.id ? `bg-blue-50 text-blue-700` : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {s.label}
                <span className="ml-auto text-[11px] text-slate-400">{active}/{count}</span>
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-100">
            <div className="px-3 py-2 text-[11px] text-slate-400 leading-relaxed">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lock className="h-3 w-3" /> Platform-locked rules cannot be changed by tenant admins.
              </div>
              <div className="flex items-center gap-1.5">
                <Unlock className="h-3 w-3" /> Unlocked rules can be adjusted by tenants within set bounds.
              </div>
            </div>
          </div>
        </div>

        {/* Rules list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {SCOPES.filter(s => activeScope === "all" || s.id === activeScope).map(scope => {
            const scopeRules = visible.filter(r => r.scope === scope.id);
            if (scopeRules.length === 0) return null;
            const Icon = scope.icon;
            return (
              <div key={scope.id}>
                <div className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${scope.bg}`}>
                  <Icon className={`h-4 w-4 ${scope.color}`} />
                  <span className={`text-sm font-semibold ${scope.color}`}>{scope.label}</span>
                  <span className="ml-auto text-xs text-slate-500">{scopeRules.filter(r => r.enabled).length} of {scopeRules.length} active</span>
                </div>
                <div className="space-y-2">
                  {scopeRules.map(rule => (
                    <div
                      key={rule.id}
                      className={`rounded-xl border bg-white p-4 transition ${
                        rule.enabled ? "border-slate-200" : "border-slate-100 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <Toggle
                          value={rule.enabled}
                          disabled={rule.locked}
                          onChange={v => setEnabled(rule.id, v)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900">{rule.label}</span>
                            {rule.locked && (
                              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                <Lock className="h-2.5 w-2.5" /> Platform-locked
                              </span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${IMPACT_COLORS[rule.impact]}`}>
                              {rule.impact} impact
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed">{rule.description}</p>

                          {rule.threshold && rule.enabled && (
                            <div className="mt-3 flex items-center gap-3">
                              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-28">Threshold</span>
                              <input
                                type="range"
                                min={rule.threshold.min}
                                max={rule.threshold.max}
                                step={rule.threshold.step}
                                value={rule.threshold.value}
                                disabled={rule.locked}
                                onChange={e => setThreshold(rule.id, Number(e.target.value))}
                                className="flex-1 accent-blue-600"
                              />
                              <span className="w-24 text-right text-sm font-bold text-slate-800">
                                {rule.threshold.value} <span className="text-[11px] font-normal text-slate-400">{rule.threshold.unit}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Info footer */}
          <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Changes to guardrails take effect immediately for new platform events. Existing queued items follow the rules that were active when they were created.
              Platform-locked rules are enforced at the engine level and cannot be overridden by tenant configuration or API calls.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

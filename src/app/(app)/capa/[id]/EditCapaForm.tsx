"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select } from "@/components/modals/Modal";
import { updateCapa } from "@/lib/actions/ehs";
import { useDemoUser } from "@/lib/context/demo-user";
import type { CapaAction, Profile } from "@/lib/types";
import { playCompleteSound, playAdvanceSound } from "@/lib/sounds";
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle, Link as LinkIcon, Zap, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle, Clock, ShieldCheck, Paperclip, UserCheck,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface RcaResult {
  type: string;
  whys: { q: string; a: string }[];
  fishbone: Record<string, string[]>;
  summary: string;
}

interface TriggeredAction {
  id: string;
  module: string;
  icon: string;
  color: string;
  text: string;
  badge: string;
  href: string;
  enabled: boolean;
  created: boolean;
}

// ── Status pipeline ───────────────────────────────────────────────────────────

const PIPELINE = [
  { status: "open",                 label: "Open",                icon: Clock,        color: "text-blue-600",   bg: "bg-blue-100" },
  { status: "in_progress",         label: "In Progress",         icon: RefreshCw,    color: "text-amber-600",  bg: "bg-amber-100" },
  { status: "pending_verification", label: "Pending Verification", icon: ShieldCheck, color: "text-violet-600", bg: "bg-violet-100" },
  { status: "closed",              label: "Closed",              icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
] as const;

const PIPELINE_STATUSES = PIPELINE.map((p) => p.status);

function StatusPipeline({ current }: { current: string }) {
  const idx = PIPELINE_STATUSES.indexOf(current as typeof PIPELINE_STATUSES[number]);
  const isSpecial = current === "overdue" || current === "rejected";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Workflow Progress</div>
      <div className="flex items-center gap-0">
        {PIPELINE.map((step, i) => {
          const StepIcon = step.icon;
          const isDone    = !isSpecial && i < idx;
          const isCurrent = !isSpecial && i === idx;
          const isFuture  = isSpecial || i > idx;
          return (
            <div key={step.status} className="flex items-center flex-1 min-w-0">
              <div className={`flex flex-col items-center flex-1 min-w-0 ${i === 0 ? "" : ""}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                  isDone    ? "border-emerald-500 bg-emerald-100"  :
                  isCurrent ? `border-current ${step.bg} ${step.color}` :
                              "border-slate-200 bg-slate-50"
                }`}>
                  {isDone
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    : <StepIcon className={`h-4 w-4 ${isCurrent ? step.color : "text-slate-300"}`} />}
                </div>
                <div className={`mt-1.5 text-center text-[10px] font-semibold leading-tight ${
                  isCurrent ? step.color : isDone ? "text-emerald-600" : "text-slate-300"
                }`}>
                  {step.label}
                </div>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 mt-[-12px] rounded ${isDone ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
      {isSpecial && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold text-center ${
          current === "overdue" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
        }`}>
          {current === "overdue" ? "⚠ Overdue — update status to continue" : "Rejected"}
        </div>
      )}
    </div>
  );
}

// ── RCA generation ────────────────────────────────────────────────────────────

function generateRca(title: string, desc: string, source: string): RcaResult {
  const text = (title + " " + desc + " " + source).toLowerCase();

  if (text.includes("sds") || text.includes("formaldehyde") || text.includes("chemical") || text.includes("hazcom")) {
    return {
      type: "chemical",
      whys: [
        { q: "Why did this issue occur?",             a: "The Safety Data Sheet was not updated when the supplier issued a revised formulation." },
        { q: "Why wasn't the SDS updated?",           a: "No automated notification system exists to alert staff when suppliers issue new SDS versions." },
        { q: "Why is there no notification system?",  a: "The chemical management procedure lacks a defined SDS lifecycle and version control workflow." },
        { q: "Why does the procedure lack this?",     a: "The procedure predates the 2012 HazCom GHS alignment and has not been reviewed since adoption." },
        { q: "Why hasn't it been reviewed?",          a: "No periodic review cycle is assigned to chemical management SOPs and no procedure owner is designated." },
      ],
      fishbone: {
        "Method":      ["No SDS review cadence documented in procedure", "No SDS expiry trigger in chemical workflow"],
        "People":      ["No assigned SDS owner for this chemical", "Staff unaware of supplier update obligations"],
        "Material":    ["Supplier issued revised SDS without proactive client notification"],
        "Machine":     ["Chemical inventory system lacks SDS version tracking capability"],
        "Environment": ["Multi-supplier procurement increases version drift risk"],
      },
      summary: "Absence of a defined SDS review cadence and an unassigned chemical owner role allowed an outdated SDS to persist undetected. The systemic cause is a chemical management procedure that lacks SDS lifecycle requirements and has not been reviewed since the 2012 HazCom GHS transition.",
    };
  }

  if (text.includes("training") || text.includes("competency") || text.includes("qualification")) {
    return {
      type: "training",
      whys: [
        { q: "Why did this issue occur?",               a: "The employee performed the task without completing the required prerequisite training." },
        { q: "Why was training not completed?",         a: "Training assignment was not triggered because the role mapping in the LMS is incomplete." },
        { q: "Why is the role mapping incomplete?",     a: "The job role matrix was not updated when this position was reclassified six months ago." },
        { q: "Why wasn't the matrix updated?",          a: "There is no change management process linking HR role changes to EHS training requirements." },
        { q: "Why is there no change management link?", a: "EHS and HR systems operate independently with no integration or notification workflow." },
      ],
      fishbone: {
        "Method":      ["No training assignment trigger on role change", "Manual LMS enrollment prone to omission"],
        "People":      ["Supervisor assumed training was complete", "No pre-task competency verification step"],
        "Machine":     ["LMS role matrix not synchronized with HR system"],
        "Measurement": ["No training compliance report reviewed before task assignment"],
        "Environment": ["High employee turnover increases training gap frequency"],
      },
      summary: "The training gap originated from an incomplete LMS role matrix that was not updated following a position reclassification. The systemic root cause is the absence of an integrated change management process that links HR role changes to EHS training assignment.",
    };
  }

  if (text.includes("audit") || text.includes("inspection") || text.includes("finding")) {
    return {
      type: "audit",
      whys: [
        { q: "Why was this finding identified?",       a: "The required control or documentation was not in place at the time of the audit." },
        { q: "Why wasn't the control in place?",       a: "The responsible team was unaware the control was due for review or renewal." },
        { q: "Why were they unaware?",                 a: "No automated reminder or compliance calendar entry existed for this control item." },
        { q: "Why is there no reminder system?",       a: "The compliance calendar was never populated when this regulatory requirement was added." },
        { q: "Why wasn't the calendar updated?",       a: "Responsibility for maintaining the compliance calendar is not assigned to a specific role." },
      ],
      fishbone: {
        "Method":      ["No compliance calendar for this control item", "Reactive rather than proactive compliance management"],
        "People":      ["Unassigned ownership of this regulatory control", "Audit finding not escalated after prior cycle"],
        "Measurement": ["No leading-indicator KPI for this control type"],
        "Machine":     ["Compliance tracking system lacks automated due-date alerts"],
        "Environment": ["Regulatory change increased control frequency without procedure update"],
      },
      summary: "The audit finding resulted from a compliance control whose renewal was not tracked, stemming from unassigned ownership and absence of a compliance calendar entry. The systemic root cause is reactive compliance management — controls are only addressed after findings rather than proactively tracked.",
    };
  }

  if (text.includes("waste") || text.includes("disposal") || text.includes("manifest") || text.includes("rcra")) {
    return {
      type: "waste",
      whys: [
        { q: "Why did this issue occur?",              a: "Waste was disposed of without a completed and verified manifest." },
        { q: "Why was the manifest incomplete?",       a: "The waste handler was unaware the waste stream required a manifest under current RCRA classification." },
        { q: "Why was the handler unaware?",           a: "Waste stream reclassification was not communicated to operations staff." },
        { q: "Why was it not communicated?",           a: "No change notification process exists between the EHS team and waste handling operations." },
        { q: "Why is there no notification process?",  a: "Waste management procedures do not include a change communication workflow for reclassifications." },
      ],
      fishbone: {
        "Method":      ["No reclassification communication workflow", "Manifest verification not a gating step before disposal"],
        "People":      ["Waste handler not retrained after reclassification", "EHS and operations not aligned on new classification"],
        "Material":    ["Waste stream reclassified due to inventory composition change"],
        "Machine":     ["Waste management system did not flag reclassification to operations"],
        "Measurement": ["No pre-disposal checklist with manifest verification step"],
      },
      summary: "The waste disposal non-conformance was caused by a failure to communicate a waste stream reclassification to operations staff, resulting in disposal without a required manifest. The systemic root cause is the absence of a reclassification change notification workflow between EHS and operations.",
    };
  }

  if (text.includes("incident") || text.includes("injury") || text.includes("near miss") || text.includes("spill")) {
    return {
      type: "incident",
      whys: [
        { q: "Why did the incident occur?",             a: "The hazard was present and the control measure in place was insufficient to prevent exposure." },
        { q: "Why was the control insufficient?",       a: "The risk assessment for this task had not been reviewed since the process was modified." },
        { q: "Why wasn't the risk assessment updated?", a: "No trigger exists to initiate a risk review when an operational process change occurs." },
        { q: "Why is there no trigger?",                a: "The Management of Change (MOC) procedure does not include an EHS risk review requirement." },
        { q: "Why does MOC exclude EHS review?",        a: "The MOC procedure was developed by operations and EHS was not a stakeholder in its design." },
      ],
      fishbone: {
        "Method":      ["Risk assessment not reviewed after process modification", "MOC procedure excludes EHS risk trigger"],
        "People":      ["Worker not briefed on modified hazard profile", "Supervisor approved task without updated JSA"],
        "Machine":     ["Engineering control designed for previous process conditions"],
        "Measurement": ["No near-miss reporting culture — previous signals missed"],
        "Environment": ["Modified workflow increased exposure frequency"],
      },
      summary: "The incident resulted from an inadequate control measure that was not re-evaluated after an operational process change. The systemic root cause is a MOC procedure that does not require EHS risk review, meaning hazard profiles are never reassessed when processes evolve.",
    };
  }

  return {
    type: "general",
    whys: [
      { q: "Why did this issue occur?",               a: "The required standard or control was not consistently applied at the point of activity." },
      { q: "Why wasn't the standard applied?",        a: "The responsible party was not aware of the specific requirement at time of execution." },
      { q: "Why were they unaware?",                  a: "Communication of this requirement was not part of routine briefings or role onboarding." },
      { q: "Why isn't it in briefings/onboarding?",   a: "The procedure owner has not reviewed or updated the standard operating procedure recently." },
      { q: "Why hasn't the procedure been reviewed?", a: "No periodic review cycle is assigned and there is no designated procedure owner for accountability." },
    ],
    fishbone: {
      "Method":      ["No documented procedure for this activity", "Standard not included in work instructions"],
      "People":      ["Responsible party not trained on this specific requirement", "No designated process owner"],
      "Machine":     ["System or tool did not prompt or enforce the required step"],
      "Measurement": ["No KPI or audit mechanism to detect early non-compliance"],
      "Environment": ["Competing priorities reduced attention to this control area"],
    },
    summary: "The non-conformance stemmed from a requirement not consistently communicated or enforced at the operational level. The systemic root cause is the absence of a designated procedure owner and periodic review cycle.",
  };
}

// ── Triggered actions generator ───────────────────────────────────────────────

function generateTriggeredActions(type: string, capaTitle: string): TriggeredAction[] {
  const base: Record<string, Omit<TriggeredAction, "id" | "enabled" | "created">[]> = {
    chemical: [
      { module: "Chemical Management", icon: "⚗",  color: "bg-red-100 text-red-700",         badge: "SDS Review",          href: "/chemicals", text: `Flag all inventory for SDS review — triggered by: ${capaTitle}` },
      { module: "Training",            icon: "🎓",  color: "bg-violet-100 text-violet-700",    badge: "Training Assignment", href: "/training",  text: "Assign Chemical Hygiene & SDS Management refresher to all lab staff" },
      { module: "Documents",           icon: "📄",  color: "bg-blue-100 text-blue-700",        badge: "Doc Review",          href: "/documents", text: "Open periodic review — Chemical Hygiene Plan (SDS lifecycle section)" },
      { module: "Corrective Actions",  icon: "⚙",  color: "bg-amber-100 text-amber-700",     badge: "Preventive CAPA",     href: "/capa",      text: "New preventive CAPA: Implement automated SDS version tracking system" },
      { module: "Legal Register",      icon: "⚖",  color: "bg-emerald-100 text-emerald-700", badge: "Compliance Check",    href: "/legal",     text: "Verify HazCom 29 CFR 1910.1200 SDS obligations for all current chemicals" },
    ],
    training: [
      { module: "Training",            icon: "🎓",  color: "bg-violet-100 text-violet-700",    badge: "Remediation",         href: "/training",  text: `Create remediation training assignment for all staff in affected role — triggered by: ${capaTitle}` },
      { module: "Documents",           icon: "📄",  color: "bg-blue-100 text-blue-700",        badge: "Doc Review",          href: "/documents", text: "Flag Training & Competency Procedure for immediate review and role matrix update" },
      { module: "Corrective Actions",  icon: "⚙",  color: "bg-amber-100 text-amber-700",     badge: "Preventive CAPA",     href: "/capa",      text: "New preventive CAPA: Synchronize LMS role matrix with HR system on role change" },
      { module: "Risk Intelligence",   icon: "▲",  color: "bg-orange-100 text-orange-700",   badge: "Risk Update",         href: "/risk",      text: "Update risk record: competency gap in affected role — assess residual risk" },
      { module: "Audits",              icon: "≡",  color: "bg-slate-100 text-slate-600",      badge: "Verification Audit",  href: "/audits",    text: "Schedule training compliance spot audit for affected department" },
    ],
    audit: [
      { module: "Legal Register",      icon: "⚖",  color: "bg-emerald-100 text-emerald-700", badge: "Compliance Entry",    href: "/legal",     text: `Assign owner and add due-date reminder for control that generated: ${capaTitle}` },
      { module: "Documents",           icon: "📄",  color: "bg-blue-100 text-blue-700",        badge: "Doc Review",          href: "/documents", text: "Open review cycle for procedure linked to this audit finding" },
      { module: "Audits",              icon: "≡",  color: "bg-slate-100 text-slate-600",      badge: "Follow-up Audit",     href: "/audits",    text: "Schedule 30-day verification audit to confirm corrective action effectiveness" },
      { module: "Corrective Actions",  icon: "⚙",  color: "bg-amber-100 text-amber-700",     badge: "Preventive CAPA",     href: "/capa",      text: "New preventive CAPA: Assign compliance calendar owners for all tracked controls" },
    ],
    waste: [
      { module: "Waste Management",    icon: "♻",  color: "bg-orange-100 text-orange-700",   badge: "Stream Review",       href: "/waste",     text: `Audit all waste stream classifications for reclassification drift — triggered by: ${capaTitle}` },
      { module: "Training",            icon: "🎓",  color: "bg-violet-100 text-violet-700",    badge: "Training Assignment", href: "/training",  text: "Assign waste handler refresher training: RCRA classification & manifest requirements" },
      { module: "Documents",           icon: "📄",  color: "bg-blue-100 text-blue-700",        badge: "Doc Review",          href: "/documents", text: "Update Waste Manifest Procedure to include reclassification change notification step" },
      { module: "Corrective Actions",  icon: "⚙",  color: "bg-amber-100 text-amber-700",     badge: "Preventive CAPA",     href: "/capa",      text: "New preventive CAPA: Implement waste stream reclassification communication workflow" },
      { module: "Legal Register",      icon: "⚖",  color: "bg-emerald-100 text-emerald-700", badge: "Compliance Check",    href: "/legal",     text: "Verify RCRA 40 CFR 262 compliance status for all active waste streams" },
    ],
    incident: [
      { module: "Risk Intelligence",   icon: "▲",  color: "bg-orange-100 text-orange-700",   badge: "Risk Assessment",     href: "/risk",      text: `Update risk assessment for area/task involved in: ${capaTitle}` },
      { module: "Documents",           icon: "📄",  color: "bg-blue-100 text-blue-700",        badge: "JSA Update",          href: "/documents", text: "Revise Job Safety Analysis for affected task — incorporate new hazard controls" },
      { module: "Training",            icon: "🎓",  color: "bg-violet-100 text-violet-700",    badge: "Safety Briefing",     href: "/training",  text: "Assign post-incident safety briefing to all affected team members" },
      { module: "Corrective Actions",  icon: "⚙",  color: "bg-amber-100 text-amber-700",     badge: "Preventive CAPA",     href: "/capa",      text: "New preventive CAPA: Add EHS risk review requirement to MOC procedure" },
      { module: "Audits",              icon: "≡",  color: "bg-slate-100 text-slate-600",      badge: "Targeted Inspection", href: "/audits",    text: "Schedule targeted inspection of the hazard area within 7 days" },
      { module: "OSHA Logs",           icon: "📋",  color: "bg-red-100 text-red-700",          badge: "OSHA Entry",          href: "/osha",      text: "Verify OSHA 300 recordability and log if required under 29 CFR 1904" },
    ],
    general: [
      { module: "Documents",           icon: "📄",  color: "bg-blue-100 text-blue-700",        badge: "Procedure Review",    href: "/documents", text: `Open procedure review for area affected by: ${capaTitle}` },
      { module: "Training",            icon: "🎓",  color: "bg-violet-100 text-violet-700",    badge: "Awareness Training",  href: "/training",  text: "Assign awareness training for affected role on this requirement" },
      { module: "Corrective Actions",  icon: "⚙",  color: "bg-amber-100 text-amber-700",     badge: "Preventive CAPA",     href: "/capa",      text: "New preventive CAPA: Assign procedure owner and establish periodic review cycle" },
      { module: "Risk Intelligence",   icon: "▲",  color: "bg-orange-100 text-orange-700",   badge: "Risk Review",         href: "/risk",      text: "Review risk register for items related to this process gap" },
    ],
  };

  return (base[type] ?? base.general).map((a, i) => ({
    ...a,
    id: `action-${i}`,
    enabled: true,
    created: false,
  }));
}

// ── AI RCA Panel ──────────────────────────────────────────────────────────────

function AiRcaPanel({
  title, description, source, onUse,
}: {
  title: string; description: string; source: string;
  onUse: (s: string) => void;
}) {
  const [state, setState]               = useState<"idle" | "loading" | "done">("idle");
  const [rca, setRca]                   = useState<RcaResult | null>(null);
  const [tab, setTab]                   = useState<"whys" | "fishbone" | "summary">("whys");
  const [expanded, setExpanded]         = useState<number | null>(0);
  const [applied, setApplied]           = useState(false);
  const [actions, setActions]           = useState<TriggeredAction[]>([]);
  const [creating, setCreating]         = useState(false);
  const [allCreated, setAllCreated]     = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  function runAnalysis() {
    setState("loading");
    setApplied(false);
    setAllCreated(false);
    setCreatedCount(0);
    setActions([]);
    setTimeout(() => {
      const result = generateRca(title, description, source);
      setRca(result);
      setActions(generateTriggeredActions(result.type, title));
      setState("done");
      setTab("whys");
      setExpanded(0);
    }, 1800);
  }

  function handleUse() {
    if (!rca) return;
    onUse(rca.summary);
    setApplied(true);
    setTab("summary");
  }

  function toggleAction(id: string) {
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  function createAllActions() {
    const enabled = actions.filter((a) => a.enabled);
    if (!enabled.length) return;
    setCreating(true);
    setCreatedCount(0);
    enabled.forEach((a, i) => {
      setTimeout(() => {
        setActions((prev) => prev.map((p) => p.id === a.id ? { ...p, created: true } : p));
        setCreatedCount(i + 1);
        if (i === enabled.length - 1) { setCreating(false); setAllCreated(true); }
      }, 400 * (i + 1));
    });
  }

  const enabledActions = actions.filter((a) => a.enabled);
  const createdActions = actions.filter((a) => a.created);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-600 shrink-0" />
          <span className="text-xs font-bold text-violet-800">SafetyIQ AI — Root Cause Analysis</span>
          {state === "done" && (
            <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-700">
              5 Whys · Fishbone · System Triggers
            </span>
          )}
        </div>
        {state === "idle" && (
          <button type="button" onClick={runAnalysis}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
            <Sparkles className="h-3 w-3" /> Analyze RCA
          </button>
        )}
        {state === "loading" && (
          <div className="flex items-center gap-1.5 text-xs text-violet-600">
            <RefreshCw className="h-3 w-3 animate-spin" /> Running RCA analysis…
          </div>
        )}
        {state === "done" && (
          <button type="button" onClick={runAnalysis}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-50">
            <RefreshCw className="h-3 w-3" /> Re-run
          </button>
        )}
      </div>

      {state === "done" && rca && (
        <div className="border-t border-violet-200">
          <div className="flex border-b border-violet-200 bg-white/50">
            {(["whys", "fishbone", "summary"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px capitalize ${
                  tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                {t === "whys" ? "5 Whys" : t === "fishbone" ? "Fishbone" : "Summary & Actions"}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            {tab === "whys" && (
              <div className="space-y-1.5">
                {rca.whys.map((w, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-violet-100 bg-white">
                    <button type="button" onClick={() => setExpanded(expanded === i ? null : i)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-extrabold text-violet-700">{i + 1}</span>
                      <span className="flex-1 text-xs font-semibold text-slate-700">{w.q}</span>
                      {expanded === i ? <ChevronUp className="h-3 w-3 text-slate-400 shrink-0" /> : <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />}
                    </button>
                    {expanded === i && (
                      <div className="border-t border-violet-100 bg-violet-50/40 px-3 py-2.5">
                        <p className="text-xs text-slate-700 leading-relaxed">{w.a}</p>
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-1">
                  <button type="button" onClick={() => setTab("summary")} className="text-xs text-violet-600 hover:underline font-medium">
                    View root cause summary & triggered actions →
                  </button>
                </div>
              </div>
            )}

            {tab === "fishbone" && (
              <div className="space-y-2">
                {Object.entries(rca.fishbone).map(([cat, factors]) => (
                  <div key={cat} className="rounded-lg border border-violet-100 bg-white px-3 py-2.5">
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-600">{cat}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {factors.map((f) => (
                        <span key={f} className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[11px] text-slate-700">{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="pt-1">
                  <button type="button" onClick={() => setTab("summary")} className="text-xs text-violet-600 hover:underline font-medium">
                    View root cause summary & triggered actions →
                  </button>
                </div>
              </div>
            )}

            {tab === "summary" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-violet-100 bg-white p-3">
                  <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-600">Recommended Root Cause Statement</div>
                  <p className="text-xs text-slate-700 leading-relaxed">{rca.summary}</p>
                </div>
                <button type="button" onClick={handleUse} disabled={applied}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-colors ${
                    applied ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-violet-600 text-white hover:bg-violet-700"
                  }`}>
                  {applied ? <><CheckCircle className="h-3.5 w-3.5" /> Applied to Root Cause field</> : <><Sparkles className="h-3.5 w-3.5" /> Use this Root Cause</>}
                </button>

                <div className="rounded-xl border border-amber-200 bg-amber-50/60">
                  <div className="flex items-center gap-2 border-b border-amber-200 px-3 py-2.5">
                    <Zap className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-800">
                      Triggered System Actions — {actions.length} actions across {new Set(actions.map((a) => a.module)).size} modules
                    </span>
                    {allCreated && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">All created ✓</span>}
                  </div>
                  <div className="divide-y divide-amber-100 px-0">
                    {actions.map((a) => (
                      <div key={a.id} className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${
                        a.created ? "bg-emerald-50/60" : a.enabled ? "bg-white/60" : "bg-slate-50/40 opacity-50"
                      }`}>
                        {!a.created && (
                          <button type="button" onClick={() => toggleAction(a.id)} className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600">
                            {a.enabled ? <ToggleRight className="h-4 w-4 text-violet-600" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                        )}
                        {a.created && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="text-[10px]">{a.icon}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.color}`}>{a.badge}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{a.module}</span>
                          </div>
                          <p className="text-[11px] text-slate-700 leading-relaxed">{a.text}</p>
                        </div>
                        <div className="shrink-0 ml-1">
                          {a.created ? (
                            <a href={a.href} className="text-[10px] font-semibold text-emerald-600 hover:underline flex items-center gap-0.5">
                              View <LinkIcon className="h-2.5 w-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-300">pending</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!allCreated && (
                    <div className="border-t border-amber-200 p-3">
                      <button type="button" onClick={createAllActions} disabled={creating || enabledActions.length === 0}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                        {creating
                          ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Creating actions… ({createdCount}/{enabledActions.length})</>
                          : <><Zap className="h-3.5 w-3.5" /> Create {enabledActions.length} Triggered Action{enabledActions.length !== 1 ? "s" : ""} Across System</>}
                      </button>
                      <p className="mt-1.5 text-center text-[10px] text-amber-600">Toggle actions off to skip — all others will be created automatically</p>
                    </div>
                  )}
                  {allCreated && (
                    <div className="border-t border-emerald-200 bg-emerald-50 px-3 py-2.5 rounded-b-xl">
                      <p className="text-center text-xs font-semibold text-emerald-700">
                        ✓ {createdActions.length} actions created across {new Set(createdActions.map((a) => a.module)).size} modules — this RCA is now tracked system-wide
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function EditCapaForm({ capa, profiles }: { capa: CapaAction; profiles: Profile[] }) {
  const { user } = useDemoUser();
  const canVerify = user.role === "ehs_manager" || user.role === "admin" || user.is_reliance;

  const [pending, setPending]         = useState(false);
  const [saved, setSaved]             = useState(false);
  const [rootCause, setRootCause]     = useState(capa.root_cause ?? "");
  const [status, setStatus]           = useState(capa.status);
  const [closureNote, setClosureNote] = useState(capa.closure_note ?? "");
  const [closedWithEvidence, setClosedWithEvidence] = useState(capa.closed_with_evidence);
  const [evidenceRef, setEvidenceRef] = useState("");
  const router = useRouter();

  const isClosed     = status === "closed";
  const showClosure  = status === "pending_verification" || status === "closed";
  const nextStatus   = status === "open" ? "in_progress"
                     : status === "in_progress" ? "pending_verification"
                     : status === "pending_verification" ? "closed"
                     : null;
  const nextLabel    = nextStatus === "in_progress"          ? "Start Work"
                     : nextStatus === "pending_verification" ? "Submit for Verification"
                     : nextStatus === "closed"               ? "Close CAPA"
                     : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    fd.set("root_cause", rootCause);
    fd.set("status", status);
    const parts = [closureNote.trim()];
    if (evidenceRef.trim()) parts.push(`Evidence Reference: ${evidenceRef.trim()}`);
    fd.set("closure_note", parts.filter(Boolean).join("\n\n"));
    fd.set("closed_with_evidence", String(closedWithEvidence));
    const res = await updateCapa(capa.id, fd);
    if (res.ok) {
      if (status === "closed") playCompleteSound();
      else playAdvanceSound();
      setSaved(true);
      router.refresh();
    }
    setPending(false);
  }

  async function advanceStatus() {
    if (!nextStatus) return;
    setStatus(nextStatus as typeof status);
    if (nextStatus === "closed" && !closureNote.trim()) {
      // scroll to closure section
      document.getElementById("closure-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
  }

  const dueDate = capa.due_date ? new Date(capa.due_date).toISOString().slice(0, 10) : "";
  const createdFmt = new Date(capa.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Status pipeline */}
      <StatusPipeline current={status} />

      {/* Quick advance button */}
      {nextLabel && !isClosed && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex-1 text-xs text-slate-500">
            {status === "open"         && "Ready to begin work on this CAPA? Advance the status to start tracking progress."}
            {status === "in_progress"  && "Corrective actions complete? Submit for verification to have a second set of eyes confirm effectiveness."}
            {status === "pending_verification" && "Review the closure section below, add a closure note, then mark this CAPA as closed."}
          </div>
          <button type="button" onClick={advanceStatus}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors ${
              nextStatus === "closed" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
            }`}>
            {nextStatus === "closed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {nextLabel}
          </button>
        </div>
      )}

      {isClosed && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-emerald-800">CAPA Closed</div>
            {capa.closed_at && (
              <div className="text-xs text-emerald-600 mt-0.5">
                Closed {new Date(capa.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {closedWithEvidence && " · Evidence on file"}
              </div>
            )}
          </div>
          <button type="button" onClick={() => setStatus("pending_verification")}
            className="ml-auto text-xs text-emerald-700 underline underline-offset-2 hover:text-emerald-900">
            Reopen
          </button>
        </div>
      )}

      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved successfully.
        </div>
      )}

      {/* ── DETAILS ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Details</div>

        <Field label="Title" required>
          <Input name="title" defaultValue={capa.title} required />
        </Field>

        <Field label="Description / Actions Being Taken">
          <textarea
            name="description"
            defaultValue={capa.description ?? ""}
            rows={3}
            placeholder="Describe what corrective actions are being or will be taken…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Kind">
            <Select name="kind" defaultValue={capa.kind}>
              <option value="corrective">Corrective</option>
              <option value="preventive">Preventive</option>
            </Select>
          </Field>
          <Field label="Severity">
            <Select name="severity" defaultValue={capa.severity}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Assigned Owner">
            <Select name="owner_id" defaultValue={capa.owner_id ?? ""}>
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name} — {p.job_title}</option>
              ))}
            </Select>
          </Field>
          <Field label="Due Date">
            <Input name="due_date" type="date" defaultValue={dueDate} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <Select name="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="closed">Closed</option>
              <option value="overdue">Overdue</option>
              <option value="rejected">Rejected</option>
            </Select>
          </Field>
          <div className="flex items-end pb-1">
            <span className="text-xs text-slate-400">Created {createdFmt} · Source: {capa.source_type.replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>

      {/* ── ROOT CAUSE ANALYSIS ───────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Root Cause Analysis</div>
        <AiRcaPanel
          title={capa.title}
          description={capa.description ?? ""}
          source={capa.source_type}
          onUse={setRootCause}
        />
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={4}
          placeholder="Describe the root cause — or use AI above to generate a 5 Whys analysis"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>

      {/* ── VERIFICATION ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Verification Method</div>
        <Input
          name="verification_method"
          defaultValue={capa.verification_method ?? ""}
          placeholder="How will completion be verified? (e.g. inspection, document review, test results)"
        />
      </div>

      {/* ── CLOSURE ─────────────────────────────────────────────── */}
      {showClosure && (
        <div id="closure-section" className={`rounded-xl border p-5 shadow-sm space-y-3 ${
          isClosed ? "border-emerald-200 bg-emerald-50/40" : "border-violet-200 bg-violet-50/30"
        }`}>
          <div className="flex items-center gap-2">
            {isClosed
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <ShieldCheck className="h-4 w-4 text-violet-600" />}
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {isClosed ? "Closure Record" : "Closure — Pending Verification"}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
              Closure Note <span className="text-red-500">*</span>
            </label>
            <textarea
              value={closureNote}
              onChange={(e) => setClosureNote(e.target.value)}
              rows={3}
              placeholder="Describe what was done to resolve the issue, what evidence was gathered, and confirmation of effectiveness…"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 resize-none ${
                isClosed
                  ? "border-emerald-200 bg-white focus:border-emerald-400 focus:ring-emerald-100"
                  : "border-violet-200 bg-white focus:border-violet-400 focus:ring-violet-100"
              }`}
            />
          </div>

          {/* Evidence reference */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
              <Paperclip className="inline h-3 w-3 mr-1" />
              Evidence Reference
            </label>
            <input
              type="text"
              value={evidenceRef}
              onChange={(e) => setEvidenceRef(e.target.value)}
              placeholder="Document name, file path, or reference number (e.g. SOP-CHEM-01-v2, Inspection-Photo-Jun19)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={closedWithEvidence}
              onChange={(e) => setClosedWithEvidence(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">Evidence attached / on file</span>
          </label>

          {/* Role-gated verification action */}
          {status === "pending_verification" && (
            canVerify ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2">
                  <UserCheck className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                  <span className="text-xs text-violet-800">
                    You are signing off on this CAPA as <strong>{user.display_name}</strong> ({user.job_title}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!closureNote.trim()) {
                      alert("Please add a closure note before closing.");
                      return;
                    }
                    setClosureNote((prev) => {
                      const base = prev.trim();
                      const stamp = `— Verified by ${user.display_name} · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
                      return base ? `${base}\n\n${stamp}` : stamp;
                    });
                    setStatus("closed");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" /> Verify &amp; Close CAPA
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <div>
                  <div className="text-sm font-semibold text-violet-900">Awaiting Manager Verification</div>
                  <p className="mt-0.5 text-xs text-violet-700">
                    This CAPA is ready for closure. An EHS Manager or administrator must review the closure note and verify effectiveness before it can be closed.
                  </p>
                  <div className="mt-1.5 text-[11px] text-violet-600">
                    Your role: <strong className="capitalize">{user.role.replace(/_/g, " ")}</strong> — verification requires EHS Manager or above.
                  </div>
                </div>
              </div>
            )
          )}

          {isClosed && (
            <div className="space-y-2">
              {(() => {
                const verifierMatch = closureNote.match(/— Verified by (.+?) · (.+?)$/m);
                return verifierMatch ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-emerald-800">
                      Verified by {verifierMatch[1]} on {verifierMatch[2]}
                    </span>
                  </div>
                ) : null;
              })()}
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                <XCircle className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">
                  This CAPA is closed. To reopen, change the status above and save.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SAVE ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end border-t border-slate-100 pt-2 pb-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

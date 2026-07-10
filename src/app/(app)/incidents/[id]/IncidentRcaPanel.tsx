"use client";

import { useState, useTransition } from "react";
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle, Link as LinkIcon, Zap, ToggleLeft, ToggleRight, CheckCircle2,
} from "lucide-react";
import { createTriggeredCapaActions } from "@/lib/actions/ehs";
import { saveIncidentRootCause } from "@/lib/actions/ai-rca";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RcaResult {
  type: string;
  whys: { q: string; a: string }[];
  fishbone: Record<string, string[]>;
  summary: string;
}

interface TriggeredAction {
  id: string; module: string; icon: string; color: string;
  text: string; badge: string; href: string; enabled: boolean; created: boolean;
}

// ── RCA generation ────────────────────────────────────────────────────────────

function generateRca(incidentType: string, title: string, description: string): RcaResult {
  const text = (incidentType + " " + title + " " + description).toLowerCase();

  if (text.includes("chemical") || text.includes("spill") || text.includes("release") || text.includes("sds") || text.includes("hazcom")) {
    return {
      type: "incident_chemical",
      whys: [
        { q: "Why did the chemical incident occur?",        a: "The hazardous material was handled without adequate controls or engineering safeguards in place." },
        { q: "Why were controls inadequate?",               a: "The risk assessment for this chemical handling task had not been updated after a process change." },
        { q: "Why wasn't the risk assessment updated?",     a: "No trigger exists to review chemical handling procedures when process changes occur." },
        { q: "Why is there no trigger?",                    a: "The Management of Change procedure does not include a chemical hazard re-evaluation step." },
        { q: "Why does MOC exclude chemical hazard review?",a: "EHS was not involved when the MOC procedure was designed by the operations team." },
      ],
      fishbone: {
        "Method":      ["No formal chemical handling SOP for this task", "MOC procedure lacks EHS chemical hazard review"],
        "People":      ["Worker not briefed on updated hazard profile", "Supervisor approved task without chemical risk check"],
        "Machine":     ["Engineering controls not designed for current chemical quantities"],
        "Measurement": ["No pre-task chemical safety check or sign-off process"],
        "Environment": ["Storage layout increased proximity to ignition/incompatible sources"],
      },
      summary: "The chemical incident resulted from inadequate controls that were not re-evaluated after a process change. The systemic root cause is a Management of Change procedure that excludes EHS chemical hazard review, leaving updated risks unaddressed.",
    };
  }

  if (text.includes("near miss") || text.includes("near_miss")) {
    return {
      type: "incident_nearmiss",
      whys: [
        { q: "Why did the near miss occur?",                a: "A hazardous condition was present in the work area and was not identified before work commenced." },
        { q: "Why wasn't the hazard identified?",           a: "The pre-task hazard assessment was not completed for this specific work area." },
        { q: "Why was the assessment skipped?",             a: "Workers perceived the task as routine and did not trigger the formal pre-task review process." },
        { q: "Why is routine work exempt from review?",     a: "The current JSA procedure only requires hazard assessment for new or modified tasks." },
        { q: "Why hasn't routine work been reassessed?",    a: "No periodic review cycle exists for tasks classified as routine — they are not monitored for risk drift." },
      ],
      fishbone: {
        "Method":      ["JSA only required for new/modified tasks", "No routine-task risk review cycle"],
        "People":      ["Overconfidence in routine task familiarity", "Crew did not raise hazard concern before starting"],
        "Machine":     ["Equipment condition not checked before task start"],
        "Measurement": ["No near-miss rate KPI for this work area", "Previous near-miss signals not escalated"],
        "Environment": ["Work area configuration had changed since last task performance"],
      },
      summary: "The near miss occurred because a routine task was performed without a pre-task hazard assessment, as current procedure only requires formal review for new or modified work. The systemic root cause is the absence of a periodic risk review cycle for tasks classified as routine.",
    };
  }

  if (text.includes("lost_time") || text.includes("lost time") || text.includes("injury") || text.includes("first_aid") || text.includes("medical")) {
    return {
      type: "incident_injury",
      whys: [
        { q: "Why did the injury occur?",                   a: "The worker was exposed to the hazard because the required physical control was absent or ineffective." },
        { q: "Why was the control absent?",                 a: "Maintenance of the engineering control was overdue and the deficiency was not escalated." },
        { q: "Why wasn't the deficiency escalated?",        a: "No formal deficiency reporting process exists for workers to flag control failures." },
        { q: "Why is there no reporting process?",          a: "The incident reporting system focuses on injuries, not near misses or control failures." },
        { q: "Why does reporting focus only on injuries?",  a: "A reactive safety culture means leading indicators of risk are not tracked or acted on." },
      ],
      fishbone: {
        "Method":      ["No pre-task control inspection step", "Deficiency reporting limited to injuries only"],
        "People":      ["Worker unaware control was degraded", "Supervisor did not verify control before task"],
        "Machine":     ["Engineering control in failed or degraded state", "Maintenance overdue on safety-critical equipment"],
        "Measurement": ["No leading-indicator KPI tracking control effectiveness"],
        "Environment": ["High task frequency increased exposure time to deficient control"],
      },
      summary: "The injury resulted from a degraded engineering control that was not identified or escalated before the task. The systemic root cause is a reactive safety culture where deficiency reporting is limited to injuries, leaving leading indicators of control failure undetected.",
    };
  }

  if (text.includes("environmental") || text.includes("spill") || text.includes("waste") || text.includes("disposal")) {
    return {
      type: "incident_environmental",
      whys: [
        { q: "Why did the environmental incident occur?",   a: "A release or improper disposal occurred outside of the approved environmental control boundaries." },
        { q: "Why were control boundaries exceeded?",       a: "Secondary containment was not in place or was insufficient for the volume released." },
        { q: "Why was containment insufficient?",           a: "Containment sizing was based on outdated inventory levels that did not reflect current operations." },
        { q: "Why wasn't containment updated?",             a: "No change management process links inventory changes to containment adequacy reviews." },
        { q: "Why is there no link in change management?",  a: "The MOC procedure was developed without input from the environmental compliance team." },
      ],
      fishbone: {
        "Method":      ["Secondary containment not sized for current inventory", "MOC excludes environmental containment review"],
        "People":      ["Environmental team not consulted on operational changes", "Emergency response not practiced for this scenario"],
        "Material":    ["Inventory volume exceeded containment design capacity"],
        "Machine":     ["Containment infrastructure not inspected on current schedule"],
        "Environment": ["Proximity to drain or waterway increased impact of release"],
      },
      summary: "The environmental incident resulted from secondary containment that was undersized for current inventory, stemming from a change management process that does not trigger environmental containment reviews when operations change.",
    };
  }

  // Default incident RCA
  return {
    type: "incident",
    whys: [
      { q: "Why did the incident occur?",              a: "The hazard was present and the control measure in place was insufficient to prevent exposure." },
      { q: "Why was the control insufficient?",        a: "The risk assessment for this task had not been reviewed since the process was modified." },
      { q: "Why wasn't the risk assessment updated?",  a: "No trigger exists to initiate a risk review when an operational process change occurs." },
      { q: "Why is there no trigger?",                 a: "The Management of Change (MOC) procedure does not include an EHS risk review requirement." },
      { q: "Why does MOC exclude EHS review?",         a: "The MOC procedure was developed by operations and EHS was not a stakeholder in its design." },
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

function generateTriggeredActions(type: string, incidentTitle: string): TriggeredAction[] {
  const base: Omit<TriggeredAction, "id" | "enabled" | "created">[] = [
    { module: "Risk Intelligence",  icon: "▲", color: "bg-orange-100 text-orange-700",  badge: "Risk Assessment",    href: "/risk",      text: `Update risk assessment for area/task involved in: ${incidentTitle}` },
    { module: "Documents",          icon: "📄", color: "bg-blue-100 text-blue-700",      badge: "JSA Update",         href: "/documents", text: "Revise Job Safety Analysis for affected task — incorporate new hazard controls" },
    { module: "Training",           icon: "🎓", color: "bg-violet-100 text-violet-700",  badge: "Safety Briefing",    href: "/training",  text: "Assign post-incident safety briefing to all affected team members" },
    { module: "Corrective Actions", icon: "⚙", color: "bg-amber-100 text-amber-700",  badge: "Preventive CAPA",    href: "/capa",      text: "New preventive CAPA: Add EHS risk review requirement to MOC procedure" },
    { module: "Audits",             icon: "≡", color: "bg-slate-100 text-slate-600",    badge: "Targeted Inspection",href: "/audits",    text: "Schedule targeted inspection of the hazard area within 7 days" },
    { module: "OSHA Logs",          icon: "📋", color: "bg-red-100 text-red-700",        badge: "OSHA Entry",         href: "/osha",      text: "Verify OSHA 300 recordability and log if required under 29 CFR 1904" },
  ];
  if (type === "incident_chemical") {
    base.unshift({ module: "Chemical Management", icon: "⚗", color: "bg-red-100 text-red-700", badge: "Hazard Review", href: "/chemicals", text: `Review chemical hazard controls for substances involved in: ${incidentTitle}` });
  }
  return base.map((a, i) => ({ ...a, id: `action-${i}`, enabled: true, created: false }));
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function IncidentRcaPanel({
  incidentId,
  incidentType,
  title,
  description,
  existingRootCause,
}: {
  incidentId: string;
  incidentType: string;
  title: string;
  description: string;
  existingRootCause: string | null;
}) {
  const router = useRouter();
  const [state, setState]               = useState<"idle" | "loading" | "done">("idle");
  const [rca, setRca]                   = useState<RcaResult | null>(null);
  const [tab, setTab]                   = useState<"whys" | "fishbone" | "summary">("whys");
  const [expanded, setExpanded]         = useState<number | null>(0);
  const [applied, setApplied]           = useState(false);
  const [savedMsg, setSavedMsg]         = useState<string | null>(null);
  const [actions, setActions]           = useState<TriggeredAction[]>([]);
  const [creating, setCreating]         = useState(false);
  const [allCreated, setAllCreated]     = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [createError, setCreateError]   = useState<string | null>(null);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [_saving, startSave]            = useTransition();
  // User-editable root-cause statement (seeded from the AI summary, or blank in
  // manual mode) and the input for adding their own corrective actions.
  const [editableSummary, setEditableSummary] = useState("");
  const [customText, setCustomText]           = useState("");

  function runAnalysis() {
    setState("loading");
    setApplied(false);
    setAllCreated(false);
    setCreatedCount(0);
    setCreateError(null);
    setSaveError(null);
    setSavedMsg(null);
    setActions([]);
    setTimeout(() => {
      const result = generateRca(incidentType, title, description);
      setRca(result);
      setEditableSummary(result.summary);
      setActions(generateTriggeredActions(result.type, title));
      setState("done");
      setTab("whys");
      setExpanded(0);
    }, 1800);
  }

  // Skip the AI and go straight to writing your own root cause + actions.
  function startManual() {
    setRca({ type: "incident_manual", whys: [], fishbone: {}, summary: "" });
    setEditableSummary(existingRootCause ?? "");
    setActions([]);
    setApplied(false);
    setSavedMsg(null);
    setSaveError(null);
    setAllCreated(false);
    setCreatedCount(0);
    setCreateError(null);
    setState("done");
    setTab("summary");
  }

  // Append a user-authored corrective action to the list; it is created through
  // the same batch as the AI-suggested ones.
  function addCustomAction() {
    const text = customText.trim();
    if (!text) return;
    setActions((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        module: "Corrective Actions",
        icon: "✎",
        color: "bg-slate-200 text-slate-700",
        badge: "Custom Action",
        href: "/capa",
        text,
        enabled: true,
        created: false,
      },
    ]);
    setCustomText("");
  }

  function handleSaveRootCause() {
    const text = editableSummary.trim();
    if (!text) { setSaveError("Enter a root cause statement first."); return; }
    startSave(async () => {
      const res = await saveIncidentRootCause(incidentId, text);
      if (!res.ok) { setSaveError(res.error ?? "Failed to save."); return; }
      setApplied(true);
      setSavedMsg("Root cause saved to incident record.");
      router.refresh();
    });
  }

  function toggleAction(id: string) {
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  async function createAllActions() {
    const enabled = actions.filter((a) => a.enabled && !a.created);
    if (!enabled.length) return;
    setCreating(true);
    setCreateError(null);
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const dueDate = due.toISOString().slice(0, 10);
    const payload = enabled.map((a) => ({
      title: `${a.module}: ${a.badge}`,
      description: a.text,
      kind: a.badge.toLowerCase().includes("preventive") ? "preventive" : "corrective",
      severity: a.module === "OSHA Logs" || a.module === "Risk Intelligence" ? "high" : "medium",
      due_date: dueDate,
    }));
    try {
      const fd = new FormData();
      fd.set("actions", JSON.stringify(payload));
      const res = await createTriggeredCapaActions(null, fd);
      if (res.ok) {
        const enabledIds = new Set(enabled.map((a) => a.id));
        setActions((prev) => prev.map((p) => enabledIds.has(p.id) ? { ...p, created: true } : p));
        setCreatedCount(res.created);
        setAllCreated(true);
        router.refresh();
      } else {
        setCreateError(res.error || "Failed to create actions.");
      }
    } catch {
      setCreateError("Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  const enabledActions  = actions.filter((a) => a.enabled);
  const createdActions  = actions.filter((a) => a.created);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60">
      {/* Header */}
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
          <div className="flex items-center gap-2">
            <button type="button" onClick={startManual}
              className="rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50">
              Write my own
            </button>
            <button type="button" onClick={runAnalysis}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
              <Sparkles className="h-3 w-3" /> Analyze RCA
            </button>
          </div>
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

      {/* Existing root cause notice */}
      {existingRootCause && state === "idle" && (
        <div className="border-t border-violet-100 bg-white/60 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Current Root Cause on Record</p>
          <p className="text-xs text-slate-700 leading-relaxed">{existingRootCause}</p>
        </div>
      )}

      {/* Results */}
      {state === "done" && rca && (
        <div className="border-t border-violet-200">
          {/* Tab bar */}
          <div className="flex border-b border-violet-200 bg-white/50">
            {(["whys", "fishbone", "summary"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                  tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                {t === "whys" ? "5 Whys" : t === "fishbone" ? "Fishbone" : "Summary & Actions"}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            {/* 5 Whys */}
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
                <button type="button" onClick={() => setTab("summary")} className="mt-1 text-xs text-violet-600 hover:underline font-medium">
                  View root cause summary & triggered actions →
                </button>
              </div>
            )}

            {/* Fishbone */}
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
                <button type="button" onClick={() => setTab("summary")} className="mt-1 text-xs text-violet-600 hover:underline font-medium">
                  View root cause summary & triggered actions →
                </button>
              </div>
            )}

            {/* Summary & Actions */}
            {tab === "summary" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-violet-100 bg-white p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-violet-600">Root Cause Statement</div>
                    <span className="text-[10px] font-medium text-slate-400">Edit or add your own notes</span>
                  </div>
                  <textarea
                    value={editableSummary}
                    onChange={(e) => { setEditableSummary(e.target.value); if (applied) setApplied(false); }}
                    rows={5}
                    placeholder="Write the root cause and any investigation notes…"
                    className="w-full resize-y rounded-md border border-violet-200 px-3 py-2 text-xs leading-relaxed text-slate-700 focus:border-violet-400 focus:outline-none"
                  />
                </div>

                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                {savedMsg && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {savedMsg}
                  </div>
                )}

                <button type="button" onClick={handleSaveRootCause} disabled={applied || !editableSummary.trim()}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    applied ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-violet-600 text-white hover:bg-violet-700"
                  }`}>
                  {applied
                    ? <><CheckCircle className="h-3.5 w-3.5" /> Saved to incident record</>
                    : <><Sparkles className="h-3.5 w-3.5" /> Save Root Cause to Incident</>}
                </button>

                {/* Triggered actions */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/60">
                  <div className="flex items-center gap-2 border-b border-amber-200 px-3 py-2.5">
                    <Zap className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-800">
                      {actions.length > 0
                        ? `Corrective Actions — ${actions.length} action${actions.length !== 1 ? "s" : ""} across ${new Set(actions.map((a) => a.module)).size} module${new Set(actions.map((a) => a.module)).size !== 1 ? "s" : ""}`
                        : "Corrective Actions — add your own below"}
                    </span>
                    {allCreated && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">All created ✓</span>}
                  </div>
                  <div className="divide-y divide-amber-100">
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
                          {a.created
                            ? <a href={a.href} className="text-[10px] font-semibold text-emerald-600 hover:underline flex items-center gap-0.5">View <LinkIcon className="h-2.5 w-2.5" /></a>
                            : <span className="text-[10px] text-slate-300">pending</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!allCreated && (
                    <div className="border-t border-amber-100 px-3 py-2.5">
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Add your own corrective action
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={customText}
                          onChange={(e) => setCustomText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAction(); } }}
                          placeholder="Describe a corrective action to add…"
                          className="flex-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-amber-400 focus:outline-none"
                        />
                        <button type="button" onClick={addCustomAction} disabled={!customText.trim()}
                          className="rounded-md bg-slate-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                  {!allCreated && enabledActions.length > 0 && (
                    <div className="border-t border-amber-200 p-3">
                      <button type="button" onClick={createAllActions} disabled={creating || enabledActions.length === 0}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                        {creating
                          ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Creating {enabledActions.length} action{enabledActions.length !== 1 ? "s" : ""}…</>
                          : <><Zap className="h-3.5 w-3.5" /> Create {enabledActions.length} Triggered Action{enabledActions.length !== 1 ? "s" : ""} Across System</>}
                      </button>
                      {createError
                        ? <p className="mt-1.5 text-center text-[10px] font-semibold text-red-600">{createError}</p>
                        : <p className="mt-1.5 text-center text-[10px] text-amber-600">Toggle actions off to skip — all others will be created automatically</p>}
                    </div>
                  )}
                  {allCreated && (
                    <div className="border-t border-emerald-200 bg-emerald-50 px-3 py-2.5 rounded-b-xl">
                      <p className="text-center text-xs font-semibold text-emerald-700">
                        ✓ {createdCount} action{createdCount !== 1 ? "s" : ""} created across {new Set(createdActions.map((a) => a.module)).size} modules — this RCA is now tracked system-wide
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

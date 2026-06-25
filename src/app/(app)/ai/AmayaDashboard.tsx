"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, RotateCcw, FlaskConical, GraduationCap, Shield, AlertTriangle,
  ChevronRight, Sparkles, Bot, BarChart3, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import type {
  Chemical, TrainingCourse, TrainingRecord, Profile, CapaAction,
  Incident, LegalRequirement, Audit, WasteStream, AiFinding, PredictabilityRun,
} from "@/lib/types";
import { Pill } from "@/components/ui/primitives";
import { RiskLevelBadge, ReviewStatusBadge } from "@/components/ui/badges";
import type { RiskLevel } from "@/lib/constants";
import type { AiAnalysisOutput } from "@/lib/types";
import { RunScanButton } from "./RunScanButton";
import { useDemoUser } from "@/lib/context/demo-user";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataRow { label: string; value: string; status?: "red" | "amber" | "green" | "blue" | "none" }
interface DataCard { title: string; rows: DataRow[]; href?: string }

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  cards?: DataCard[];
  followUps?: string[];
  timestamp: Date;
}

interface AiCtx {
  chemicals: Chemical[];
  courses: TrainingCourse[];
  records: TrainingRecord[];
  profiles: Profile[];
  capas: CapaAction[];
  incidents: Incident[];
  legal: LegalRequirement[];
  audits: Audit[];
  waste: WasteStream[];
  findings: AiFinding[];
  latestRun: PredictabilityRun | null;
  companyName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(s: string | null) {
  if (!s) return false;
  return new Date(s) < new Date();
}

function isExpiringSoon(s: string | null, days = 30) {
  if (!s) return false;
  const d = new Date(s);
  const now = new Date();
  return d > now && d.getTime() - now.getTime() < days * 24 * 60 * 60 * 1000;
}

function daysUntil(s: string | null): number {
  if (!s) return 999;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function chemRisk(c: Chemical): number {
  let score = c.ghs_classes.length;
  if (c.is_scheduled) score += 5;
  if (c.ghs_classes.some((g) => ["H350", "H351", "H340"].includes(g))) score += 4;
  if (c.ghs_classes.some((g) => ["H300", "H310", "H330"].includes(g))) score += 3;
  if (c.ghs_classes.some((g) => ["H225", "H226"].includes(g))) score += 1;
  return score;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Live EHS data → compact context string for the LLM ─────────────────────────
// Mirrors what buildAiResponse has access to: counts + the key facts the model
// needs to answer with real numbers. Kept compact to stay token-efficient.
function buildContextSummary(ctx: AiCtx): string {
  const activeChems = ctx.chemicals.filter((c) => c.status === "active");
  const scheduledChems = activeChems.filter((c) => c.is_scheduled);
  const topChems = [...activeChems]
    .sort((a, b) => chemRisk(b) - chemRisk(a))
    .slice(0, 5)
    .map((c) => `${c.name}${c.ghs_classes.length ? ` [${c.ghs_classes.slice(0, 4).join(",")}]` : ""}${c.is_scheduled ? " (scheduled)" : ""}`);
  const missingSds = activeChems.filter((c) => !c.sds_url).length;

  const expiredCerts = ctx.records.filter((r) => r.passed && isExpired(r.expiry_date)).length;
  const expiringCerts = ctx.records.filter((r) => r.passed && !isExpired(r.expiry_date) && isExpiringSoon(r.expiry_date, 30)).length;

  const openCapas = ctx.capas.filter((c) => c.status === "open").length;
  const overdueCapas = ctx.capas.filter((c) => c.status === "overdue").length;
  const pendingCapas = ctx.capas.filter((c) => c.status === "pending_verification").length;

  const openIncidents = ctx.incidents.filter((i) => i.status !== "closed").length;

  const compliant = ctx.legal.filter((l) => l.status === "compliant").length;
  const majorGap = ctx.legal.filter((l) => l.status === "major_gap").length;
  const nonComp = ctx.legal.filter((l) => l.status === "non_compliant").length;
  const minorGap = ctx.legal.filter((l) => l.status === "minor_gap").length;
  const compliancePct = ctx.legal.length ? Math.round((compliant / ctx.legal.length) * 100) : 0;
  const topGaps = ctx.legal
    .filter((l) => l.status !== "compliant")
    .slice(0, 5)
    .map((l) => `${l.regulation_ref}: ${l.title} (${l.status})`);

  const scheduledAudits = ctx.audits.filter((a) => a.status === "scheduled")
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
  const nextAudit = scheduledAudits[0];

  const hazWaste = ctx.waste.filter((w) => w.classification === "hazardous").length;
  const pendingWaste = ctx.waste.filter((w) => w.status === "pending_pickup" || w.status === "accumulating").length;

  const run = ctx.latestRun;

  const lines = [
    `Company: ${ctx.companyName}`,
    `Chemicals: ${activeChems.length} active, ${scheduledChems.length} OSHA-scheduled, ${missingSds} missing SDS. Highest-risk: ${topChems.join("; ") || "none"}.`,
    `Training: ${expiredCerts} expired certs, ${expiringCerts} expiring within 30 days. ${ctx.courses.length} courses, ${ctx.profiles.length} people.`,
    `CAPAs: ${overdueCapas} overdue, ${openCapas} open, ${pendingCapas} pending verification.`,
    `Incidents: ${ctx.incidents.length} total, ${openIncidents} open/under investigation.`,
    `Compliance: ${ctx.legal.length} legal requirements — ${compliant} compliant, ${minorGap} minor gap, ${majorGap} major gap, ${nonComp} non-compliant (${compliancePct}% compliant). Top gaps: ${topGaps.join("; ") || "none"}.`,
    `Audits: ${scheduledAudits.length} scheduled, ${ctx.audits.filter((a) => a.status === "completed").length} completed.${nextAudit ? ` Next: "${nextAudit.title}" on ${fmtDate(nextAudit.scheduled_date)} (${nextAudit.type}).` : ""}`,
    `Waste: ${ctx.waste.length} streams, ${hazWaste} hazardous, ${pendingWaste} pending pickup/accumulating.`,
    run
      ? `P-Engine last run ${fmtDate(run.created_at)}: ${run.items_scanned} scanned, ${run.signals_found} signals, 30-day forecast ${run.forecast_data?.predicted_compliance_score_30d ?? "—"}% (${run.forecast_data?.compliance_trend ?? "stable"}).`
      : "P-Engine: no run yet.",
    `AI findings: ${ctx.findings.length} total, ${ctx.findings.filter((f) => f.review_status === "pending").length} pending review.`,
  ];
  return lines.join("\n");
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const PROMPT_GROUPS = [
  {
    label: "Chemical Safety",
    icon: <FlaskConical className="h-3.5 w-3.5" />,
    color: "text-orange-600 bg-orange-50 border-orange-200",
    prompts: [
      "What are my highest-risk chemicals?",
      "Are any SDS documents expiring soon?",
      "Tell me about formaldehyde in my inventory",
    ],
  },
  {
    label: "Training & Certs",
    icon: <GraduationCap className="h-3.5 w-3.5" />,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    prompts: [
      "Which training certifications are expiring?",
      "Who has outstanding training gaps?",
      "What courses are required for lab staff?",
    ],
  },
  {
    label: "CAPA & Actions",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "text-red-600 bg-red-50 border-red-200",
    prompts: [
      "What are my overdue corrective actions?",
      "Summarise recent incidents",
      "Which CAPAs need verification?",
    ],
  },
  {
    label: "Compliance & Risk",
    icon: <Shield className="h-3.5 w-3.5" />,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    prompts: [
      "What is my overall compliance status?",
      "What are my biggest regulatory gaps?",
      "When is my next scheduled audit?",
    ],
  },
];

// ── AI Response Engine ────────────────────────────────────────────────────────

function buildAiResponse(
  msg: string,
  ctx: AiCtx,
): Omit<ChatMessage, "id" | "timestamp" | "role"> {
  const q = msg.toLowerCase();

  // ── Greeting / help ─────────────────────────────────────────────────────────
  if (/^(hi|hello|hey|help|what can you|what do you|capabilities|who are you)/i.test(q.trim())) {
    const activeChems = ctx.chemicals.filter((c) => c.status === "active").length;
    const openCapas  = ctx.capas.filter((c) => c.status === "open" || c.status === "overdue").length;
    return {
      text: `Hello! I'm SafetyIQ AI, your AI Safety Assistant for ${ctx.companyName} I have live access to your EHS data — ${activeChems} active chemicals, ${openCapas} open corrective actions, and all your training records, compliance requirements, and incidents.\n\nHere's what I can help with:\n\n• **Chemical safety** — inventory queries, GHS hazard classifications, SDS status, storage guidance\n• **Training & competency** — certification gaps, expiry tracking, role-based requirements\n• **Corrective actions** — open CAPAs, overdue items, verification status\n• **Compliance & regulatory** — OSHA, EPA, CDC requirements, gap analysis\n• **Risk intelligence** — compliance scores, predictive forecasts, high-risk priorities\n• **Platform navigation** — find any module or feature instantly\n\nWhat would you like to know?`,
      followUps: [
        "What are my highest-risk chemicals?",
        "What is my overall compliance status?",
        "Which training certifications are expiring?",
      ],
    };
  }

  // ── Highest-risk / most dangerous chemicals ──────────────────────────────────
  if (/highest.?risk|most dangerous|hazardous chem|chemical risk|dangerous chem/i.test(q)) {
    const actives = ctx.chemicals.filter((c) => c.status === "active");
    const sorted  = [...actives].sort((a, b) => chemRisk(b) - chemRisk(a)).slice(0, 4);
    const cards: DataCard[] = sorted.map((c) => ({
      title: c.name,
      rows: [
        { label: "GHS Classes", value: c.ghs_classes.slice(0, 4).join(", "), status: c.ghs_classes.length > 4 ? "red" : "amber" },
        { label: "Location", value: c.storage_location.split("—")[0].trim(), status: "none" },
        { label: "Quantity", value: `${c.quantity} ${c.unit}`, status: "none" },
        { label: "OSHA Scheduled", value: c.is_scheduled ? `Yes — ${c.schedule_ref ?? ""}` : "No", status: c.is_scheduled ? "red" : "green" },
      ],
      href: "/chemicals",
    }));
    const topChem = sorted[0];
    return {
      text: `Your highest-risk chemicals are ranked by hazard class count, acute toxicity, carcinogenicity, and OSHA schedule status. **${topChem?.name}** is your top-priority substance — it carries ${topChem?.ghs_classes.length} GHS hazard classifications${topChem?.is_scheduled ? ` and is listed under ${topChem.schedule_ref}` : ""}.\n\nHere are your top 4 highest-risk active chemicals:`,
      cards,
      followUps: [
        "Tell me about formaldehyde in my inventory",
        "What PPE is required for these chemicals?",
        "Are there training gaps for these substances?",
      ],
    };
  }

  // ── Formaldehyde specific ─────────────────────────────────────────────────────
  if (/formaldehyde|formalin|1910\.1048/i.test(q)) {
    const fChem = ctx.chemicals.find((c) => c.name.toLowerCase().includes("formaldehyde"));
    const fLegal = ctx.legal.find((l) => l.regulation_ref.includes("1910.1048"));
    const fCapa  = ctx.capas.filter((c) => c.source_id === "legal-003" || c.description.toLowerCase().includes("formaldehyde"));
    const cards: DataCard[] = [];
    if (fChem) {
      cards.push({
        title: "Inventory Record",
        rows: [
          { label: "Quantity", value: `${fChem.quantity} ${fChem.unit}`, status: "amber" },
          { label: "Location", value: fChem.storage_location, status: "none" },
          { label: "GHS Classes", value: fChem.ghs_classes.join(", "), status: "red" },
          { label: "SDS Expiry", value: fmtDate(fChem.sds_expiry), status: isExpiringSoon(fChem.sds_expiry, 90) ? "amber" : "green" },
        ],
        href: "/chemicals",
      });
    }
    if (fLegal) {
      cards.push({
        title: "Compliance Status — OSHA 1910.1048",
        rows: [
          { label: "Status", value: fLegal.status.replace(/_/g, " ").toUpperCase(), status: fLegal.status === "compliant" ? "green" : "red" },
          { label: "Next Review", value: fmtDate(fLegal.next_review_date), status: isExpiringSoon(fLegal.next_review_date, 60) ? "amber" : "none" },
          { label: "Compliance Notes", value: fLegal.compliance_notes?.slice(0, 80) ?? "—", status: "none" },
        ],
        href: "/legal",
      });
    }
    const capaCount = fCapa.length;
    return {
      text: `**Formaldehyde (CAS 50-00-0)** is your highest-priority regulated substance. It is classified as a Category 1A carcinogen (H350) and is subject to **OSHA 29 CFR 1910.1048** — the Formaldehyde Standard.\n\nKey requirements under 1910.1048:\n• Air monitoring to verify PEL compliance (0.75 ppm TWA, 2 ppm STEL)\n• Medical surveillance for potentially exposed employees\n• Written Exposure Control Plan with lab-specific engineering controls\n• Annual formaldehyde-specific training for all exposed workers\n• PPE: nitrile gloves, lab coat, splash goggles; respiratory protection if PEL exceeded\n\n${fLegal?.status === "major_gap" ? "⚠️ **Current compliance status is MAJOR GAP** — " + fLegal.compliance_notes : ""}${capaCount > 0 ? `\n\nThere are **${capaCount} open CAPA action(s)** linked to this requirement.` : ""}`,
      cards,
      followUps: [
        "What are my open CAPAs for formaldehyde?",
        "Who needs formaldehyde training?",
        "What monitoring is required under OSHA 1910.1048?",
      ],
    };
  }

  // ── Training gaps / expiring certs ───────────────────────────────────────────
  if (/training|certif|expir|gaps|who needs|overdue training/i.test(q)) {
    const profileMap = Object.fromEntries(ctx.profiles.map((p) => [p.id, p]));
    const courseMap  = Object.fromEntries(ctx.courses.map((c) => [c.id, c]));
    const expired_   = ctx.records.filter((r) => r.passed && isExpired(r.expiry_date));
    const expiring_  = ctx.records.filter((r) => r.passed && !isExpired(r.expiry_date) && isExpiringSoon(r.expiry_date, 30));

    const cards: DataCard[] = [];
    if (expired_.length > 0) {
      cards.push({
        title: `${expired_.length} Expired Certificate${expired_.length !== 1 ? "s" : ""} — Re-enrolment Required`,
        rows: expired_.slice(0, 4).map((r) => ({
          label: profileMap[r.profile_id]?.display_name ?? r.profile_id,
          value: courseMap[r.course_id]?.title ?? r.course_id,
          status: "red" as const,
        })),
        href: "/training",
      });
    }
    if (expiring_.length > 0) {
      cards.push({
        title: `${expiring_.length} Certificate${expiring_.length !== 1 ? "s" : ""} Expiring Within 30 Days`,
        rows: expiring_.slice(0, 4).map((r) => ({
          label: profileMap[r.profile_id]?.display_name ?? r.profile_id,
          value: `${courseMap[r.course_id]?.title ?? r.course_id} — ${daysUntil(r.expiry_date)}d left`,
          status: "amber" as const,
        })),
        href: "/training",
      });
    }

    const totalIssues = expired_.length + expiring_.length;
    if (totalIssues === 0) {
      return {
        text: "All training certifications are current. No expired or imminently-expiring records detected across your active employees.\n\nYou can view the full training matrix under the **Training & Competency** module, which shows each employee's completion status for all role-required courses.",
        followUps: ["What courses are required for lab staff?", "Show me the training matrix"],
      };
    }
    return {
      text: `I found **${expired_.length} expired** and **${expiring_.length} expiring within 30 days** across your training records. Expired certifications constitute a potential OSHA compliance gap and should be prioritised for re-enrolment.\n\nBelow are the items needing immediate attention:`,
      cards,
      followUps: [
        "Which chemicals require specific training?",
        "Who is responsible for scheduling renewals?",
        "Navigate me to Training & Competency",
      ],
    };
  }

  // ── Open CAPAs / corrective actions ─────────────────────────────────────────
  if (/capa|corrective|action|overdue action|fix|remediat/i.test(q)) {
    const open     = ctx.capas.filter((c) => c.status === "open");
    const overdue_ = ctx.capas.filter((c) => c.status === "overdue");
    const pending_ = ctx.capas.filter((c) => c.status === "pending_verification");
    const profileMap = Object.fromEntries(ctx.profiles.map((p) => [p.id, p]));

    const urgent = [...overdue_, ...open.filter((c) => c.severity === "critical")]
      .sort((a, b) => new Date(a.due_date ?? "9999").getTime() - new Date(b.due_date ?? "9999").getTime())
      .slice(0, 5);

    const cards: DataCard[] = urgent.length > 0 ? [{
      title: "Urgent Items Requiring Action",
      rows: urgent.map((c) => ({
        label: c.title.slice(0, 45),
        value: `${profileMap[c.owner_id ?? ""]?.display_name ?? "Unassigned"} · Due ${fmtDate(c.due_date)}`,
        status: c.status === "overdue" || c.severity === "critical" ? "red" : "amber",
      })),
      href: "/capa",
    }] : [];

    return {
      text: `Your CAPA register shows:\n• **${overdue_.length} overdue** actions past their due date\n• **${open.length} open** actions in progress\n• **${pending_.length} pending verification** — waiting on evidence submission\n\n${overdue_.length > 0 ? `The **${overdue_.length} overdue item(s)** are the most critical and may indicate a compliance breach if they relate to regulatory requirements.` : "No overdue actions — good standing on your CAPA deadlines."}\n\nOwners should be notified directly of any overdue items to avoid escalation.`,
      cards,
      followUps: [
        "Which CAPAs are linked to formaldehyde?",
        "How do I close a CAPA with evidence?",
        "Navigate me to Corrective Actions",
      ],
    };
  }

  // ── Incident summary ─────────────────────────────────────────────────────────
  if (/incident|near.?miss|injury|spill|accident|hurt/i.test(q)) {
    const open_   = ctx.incidents.filter((i) => i.status !== "closed");
    const reg_    = ctx.incidents.filter((i) => i.status !== "closed");
    const recent  = [...ctx.incidents]
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, 4);

    const cards: DataCard[] = recent.length > 0 ? [{
      title: "Recent Incidents",
      rows: recent.map((i) => ({
        label: i.title.slice(0, 40),
        value: `${fmtDate(i.occurred_at)} · ${i.severity}`,
        status: i.severity === "critical" ? "red" : i.severity === "high" ? "amber" : "none",
      })),
      href: "/incidents",
    }] : [];

    return {
      text: `Your incident log shows **${ctx.incidents.length} total incidents**, with **${open_.length} currently under investigation or open**.\n\nAll incidents should be reviewed for OSHA recordability — recordable injuries must be logged on the OSHA 300 Log within 7 days. Severe injuries (hospitalisation, amputation, loss of eye) and fatalities require notification to OSHA within 24 or 8 hours respectively.\n\nI recommend reviewing open incidents to ensure CAPA actions have been initiated for all medium-severity and above events.`,
      cards,
      followUps: [
        "How do I determine if an incident is OSHA recordable?",
        "Navigate me to OSHA Logs",
        "What CAPAs are linked to incidents?",
      ],
    };
  }

  // ── Compliance overview ──────────────────────────────────────────────────────
  if (/compliance|status|score|overview|summary|how am i doing|gaps|regulatory/i.test(q)) {
    const compliant   = ctx.legal.filter((l) => l.status === "compliant").length;
    const minorGap    = ctx.legal.filter((l) => l.status === "minor_gap").length;
    const majorGap    = ctx.legal.filter((l) => l.status === "major_gap").length;
    const nonComp     = ctx.legal.filter((l) => l.status === "non_compliant").length;
    const totalReqs   = ctx.legal.length;
    const pct         = totalReqs ? Math.round((compliant / totalReqs) * 100) : 0;
    const forecast    = ctx.latestRun?.forecast_data?.predicted_compliance_score_30d;

    const gaps = ctx.legal
      .filter((l) => l.status !== "compliant")
      .sort((a, b) => {
        const order = { non_compliant: 0, major_gap: 1, minor_gap: 2 };
        return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
      })
      .slice(0, 4);

    const cards: DataCard[] = gaps.length > 0 ? [{
      title: "Top Compliance Gaps",
      rows: gaps.map((l) => ({
        label: l.regulation_ref,
        value: l.title.slice(0, 45),
        status: l.status === "non_compliant" || l.status === "major_gap" ? "red" : "amber",
      })),
      href: "/legal",
    }] : [];

    return {
      text: `**${ctx.companyName} — Compliance Summary**\n\nOut of **${totalReqs} regulatory requirements**, you have:\n• ${compliant} compliant ✓\n• ${minorGap} minor gaps\n• ${majorGap} major gaps ⚠️\n• ${nonComp} non-compliant ✗\n\nOverall compliance rate: **${pct}%**${forecast ? `\nP-Engine 30-day forecast: **${forecast}%** (${ctx.latestRun?.forecast_data?.compliance_trend ?? "stable"} trend)` : ""}\n\n${majorGap + nonComp > 0 ? `Your **${majorGap + nonComp} major gap(s) / non-compliance item(s)** carry the highest regulatory risk and should be addressed through CAPA actions immediately.` : "No critical compliance failures detected."}`,
      cards,
      followUps: [
        "Which OSHA standard has the biggest gap?",
        "What corrective actions are open?",
        "Navigate me to the Legal Register",
      ],
    };
  }

  // ── Upcoming audits ──────────────────────────────────────────────────────────
  if (/audit|inspection|scheduled|upcoming audit|next audit/i.test(q)) {
    const scheduled = ctx.audits.filter((a) => a.status === "scheduled")
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
    const completed = ctx.audits.filter((a) => a.status === "completed");

    const cards: DataCard[] = scheduled.length > 0 ? [{
      title: "Scheduled Audits",
      rows: scheduled.map((a) => ({
        label: a.title.slice(0, 40),
        value: `${fmtDate(a.scheduled_date)} · ${a.type}`,
        status: daysUntil(a.scheduled_date) < 30 ? "amber" : "none",
      })),
      href: "/audits",
    }] : [];

    const nextAudit = scheduled[0];
    return {
      text: `You have **${scheduled.length} scheduled audit(s)** and **${completed.length} completed** in your register.\n\n${nextAudit ? `Your next audit is **"${nextAudit.title}"** scheduled for **${fmtDate(nextAudit.scheduled_date)}** (${daysUntil(nextAudit.scheduled_date)} days away). Type: ${nextAudit.type}. Scope: ${nextAudit.scope?.slice(0, 120) ?? "—"}.` : "No audits currently scheduled."}\n\n${daysUntil(nextAudit?.scheduled_date ?? null) < 60 ? "With under 60 days until the next audit, I recommend verifying that open CAPAs and compliance gaps are being actively closed." : ""}`,
      cards,
      followUps: [
        "What are the open findings from the last audit?",
        "Navigate me to Audits & Assessments",
        "What should I prepare for the next audit?",
      ],
    };
  }

  // ── SDS expiry ──────────────────────────────────────────────────────────────
  if (/sds|safety data sheet|missing sds|expir.*sds|sds.*expir/i.test(q)) {
    const missing_   = ctx.chemicals.filter((c) => c.status === "active" && !c.sds_url);
    const expiringSds = ctx.chemicals.filter((c) => c.status === "active" && c.sds_url && isExpiringSoon(c.sds_expiry, 90));

    const cards: DataCard[] = [];
    if (missing_.length > 0) {
      cards.push({
        title: `${missing_.length} Chemical${missing_.length !== 1 ? "s" : ""} with No SDS on File`,
        rows: missing_.map((c) => ({ label: c.name, value: c.storage_location.split("—")[0].trim(), status: "red" as const })),
        href: "/chemicals",
      });
    }
    if (expiringSds.length > 0) {
      cards.push({
        title: `${expiringSds.length} SDS Expiring Within 90 Days`,
        rows: expiringSds.map((c) => ({ label: c.name, value: fmtDate(c.sds_expiry), status: "amber" as const })),
        href: "/chemicals",
      });
    }
    if (missing_.length + expiringSds.length === 0) {
      return {
        text: "All active chemicals have SDS documents on file and none are expiring within 90 days. Your SDS library is in good standing.\n\nReminder: OSHA 1910.1200 (HazCom) requires SDS to be immediately accessible to employees during their work shifts for any hazardous chemical they may be exposed to.",
        followUps: ["What are my highest-risk chemicals?", "Navigate me to Chemical Management"],
      };
    }
    return {
      text: `Your SDS library has **${missing_.length} missing** and **${expiringSds.length} expiring within 90 days**. Under **OSHA 29 CFR 1910.1200**, current SDS must be readily accessible to all employees. Missing or outdated SDS is a commonly cited HazCom violation.\n\nPrioritise obtaining SDS for the missing chemicals from your suppliers immediately.`,
      cards,
      followUps: [
        "What are my HazCom compliance requirements?",
        "Navigate me to Chemical Management",
      ],
    };
  }

  // ── Waste management ─────────────────────────────────────────────────────────
  if (/waste|hazardous waste|disposal|pickup|manifest|rcra|satellite/i.test(q)) {
    const pending_ = ctx.waste.filter((w) => w.status === "pending_pickup" || w.status === "accumulating");
    const haz      = ctx.waste.filter((w) => w.classification === "hazardous");

    const cards: DataCard[] = pending_.length > 0 ? [{
      title: "Waste Streams Pending Action",
      rows: pending_.slice(0, 4).map((w) => ({
        label: w.waste_name,
        value: `${w.quantity} ${w.unit} · ${w.disposal_method ?? "—"}`,
        status: w.classification === "hazardous" ? "amber" : "none",
      })),
      href: "/waste",
    }] : [];

    return {
      text: `Your waste register has **${ctx.waste.length} waste streams**, of which **${haz.length} are classified as hazardous** and **${pending_.length} are pending pickup or approaching accumulation limits**.\n\nAs a **Small Quantity Generator** under EPA 40 CFR 262, ${ctx.companyName} must ensure:\n• Hazardous waste stored no longer than 180 days from accumulation start date\n• Proper labelling with "Hazardous Waste" and accumulation start date\n• Waste containers in good condition with compatible secondary containment\n• All disposals manifested by a licensed Treatment, Storage & Disposal Facility (TSDF)\n\n${pending_.length > 0 ? "Schedule a pickup for pending waste streams to avoid exceeding the 180-day storage limit." : "All waste streams are within acceptable storage timeframes."}`,
      cards,
      followUps: [
        "Navigate me to Waste Management",
        "Which chemicals are generating hazardous waste?",
        "What are my RCRA reporting requirements?",
      ],
    };
  }

  // ── Predictive forecast ──────────────────────────────────────────────────────
  if (/forecast|predict|trend|next month|future|p.engine|safetyiq engine/i.test(q)) {
    const run = ctx.latestRun;
    if (!run) {
      return {
        text: "No P-Engine forecast data is available yet. Run the Predictability Engine scan to generate a 30-day compliance forecast, trend analysis, and risk signal detection.\n\nThe P-Engine analyses chemical inventory, training records, CAPA status, incident patterns, and legal requirements to produce a forward-looking compliance score.",
        followUps: ["What does the P-Engine scan?", "Navigate me to AI Findings"],
      };
    }
    const forecast = run.forecast_data?.predicted_compliance_score_30d;
    const trend    = run.forecast_data?.compliance_trend;
    return {
      text: `**P-Engine Latest Forecast (${new Date(run.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})**\n\n• Stage: **${run.stage}**\n• Items scanned: **${run.items_scanned}** across all EHS modules\n• Signals detected: **${run.signals_found}** risk indicators\n• 30-day predicted compliance score: **${forecast ?? "—"}%**\n• Trend: **${trend ?? "—"}**\n\n${run.summary}\n\n${trend === "declining" ? "⚠️ A **declining trend** suggests that without corrective action, compliance scores will worsen over the next 30 days. Review open CAPAs and training gaps immediately." : trend === "improving" ? "✓ The improving trend reflects recent CAPA closures and training completions." : "The compliance trend is currently stable."}`,
      followUps: [
        "What is driving the compliance trend?",
        "Navigate me to AI Findings",
        "What are my biggest risks right now?",
      ],
    };
  }

  // ── PPE requirements ─────────────────────────────────────────────────────────
  if (/ppe|personal protective|glove|respirator|goggle|protective equipment/i.test(q)) {
    const actives = ctx.chemicals.filter((c) => c.status === "active");
    const needsResp = actives.filter((c) => c.ghs_classes.some((g) => ["H331", "H330", "H332"].includes(g)));
    const needsGloves = actives.filter((c) => c.ghs_classes.some((g) => ["H310", "H314", "H315", "H317"].includes(g)));

    return {
      text: `**PPE Requirements Based on Your Active Chemical Inventory**\n\nBased on the GHS classifications in your active chemical inventory, here are the minimum PPE requirements:\n\n• **Eye/face protection**: Safety goggles required for all chemicals with H314 (skin/eye corrosion) and H318/H319 classes. Full face shield for Hydrogen Peroxide 30% (H271 oxidiser).\n• **Hand protection**: Nitrile gloves for chemicals with H310/H314/H315/H317 — this applies to **${needsGloves.length} chemicals** including Formaldehyde, Chloroform, and Sodium Azide.\n• **Respiratory protection**: Required for **${needsResp.length} chemicals** with inhalation hazard (H330/H331/H332) including Formaldehyde, Acetonitrile, and Chloroform. For formaldehyde: half-face APR with organic vapour cartridge, or if PEL is exceeded, SCBA.\n• **Body protection**: Lab coat required at all times. Chemical-resistant apron for concentrated acid/base work.\n• **Cryogenics**: Cryogenic gloves + face shield for Liquid Nitrogen handling.\n\nAll PPE selection should be documented in chemical-specific SOPs aligned with each SDS Section 8.`,
      followUps: [
        "What does OSHA 1910.132 require for PPE?",
        "Navigate me to Chemical Management",
        "What are my highest-risk chemicals?",
      ],
    };
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  if (/navigate|how do i get to|where is|take me to|go to|find the|show me the|open the/i.test(q)) {
    const navMap: { pattern: RegExp; dest: string; href: string }[] = [
      { pattern: /chemical/,   dest: "Chemical Management",     href: "/chemicals" },
      { pattern: /training/,   dest: "Training & Competency",   href: "/training" },
      { pattern: /capa|corrective/, dest: "Corrective Actions", href: "/capa" },
      { pattern: /incident/,   dest: "Incident Reporting",      href: "/incidents" },
      { pattern: /audit/,      dest: "Audits & Assessments",    href: "/audits" },
      { pattern: /legal|register|regulation/, dest: "Legal Register", href: "/legal" },
      { pattern: /waste/,      dest: "Waste Management",        href: "/waste" },
      { pattern: /document/,   dest: "Documents & Programs",    href: "/documents" },
      { pattern: /biosafety|bsl/, dest: "Biosafety & Lab Safety", href: "/biosafety" },
      { pattern: /risk/,       dest: "Risk Intelligence",       href: "/risk" },
      { pattern: /osha|300 log/, dest: "OSHA Logs",             href: "/osha" },
      { pattern: /report/,     dest: "Reports & Analytics",     href: "/reports" },
      { pattern: /monitor|equipment/, dest: "Monitoring & Equipment", href: "/monitoring" },
      { pattern: /dashboard|command/, dest: "Command Center",   href: "/dashboard" },
      { pattern: /workspace/,  dest: "My Workspace",            href: "/workspace" },
      { pattern: /setting/,    dest: "Company Settings",        href: "/settings" },
    ];
    const match = navMap.find((n) => n.pattern.test(q));
    if (match) {
      return {
        text: `To navigate to **${match.dest}**, click the link in your left navigation sidebar under the appropriate section, or use the link below. You can also press **⌘K** (or **Ctrl+K**) to open the Command Palette and search for any module instantly.`,
        cards: [{ title: `Go to ${match.dest}`, rows: [{ label: "Module", value: match.dest, status: "blue" }], href: match.href }],
        followUps: [`What can I do in ${match.dest}?`],
      };
    }
    return {
      text: `I can help you navigate to any module. Use the left sidebar or press **⌘K** / **Ctrl+K** to open the Command Palette and search for any page instantly.\n\nModules available:\n• Chemical Management, Training & Competency, Waste Management\n• Audits & Assessments, CAPA, Legal Register, Risk Intelligence\n• Biosafety & Lab Safety, Monitoring & Equipment, Incidents\n• OSHA Logs, Documents & Programs, Reports & Analytics`,
      followUps: ["Navigate me to Chemical Management", "Navigate me to Training & Competency"],
    };
  }

  // ── OSHA requirements ─────────────────────────────────────────────────────────
  if (/osha|1910|regulation|require|standard|cfr/i.test(q)) {
    const openReqs = ctx.legal.filter((l) => l.status !== "compliant");
    const cards: DataCard[] = openReqs.length > 0 ? [{
      title: "Open Regulatory Requirements",
      rows: openReqs.slice(0, 4).map((l) => ({
        label: l.regulation_ref,
        value: l.title.slice(0, 50),
        status: l.status === "major_gap" || l.status === "non_compliant" ? "red" : "amber",
      })),
      href: "/legal",
    }] : [];

    return {
      text: `Your legal register tracks **${ctx.legal.length} regulatory requirements**. The most relevant OSHA standards for ${ctx.companyName} include:\n\n• **OSHA 29 CFR 1910.1200** — HazCom / GHS (chemical labelling & SDS)\n• **OSHA 29 CFR 1910.1450** — Laboratory Chemical Standard (Chemical Hygiene Plan)\n• **OSHA 29 CFR 1910.1048** — Formaldehyde Standard ⚠️ *Major Gap detected*\n• **OSHA 29 CFR 1910.1030** — Bloodborne Pathogens (for BSL-2 work)\n• **OSHA 29 CFR 1910.38** — Emergency Action Plan\n• **EPA 40 CFR 262** — RCRA Hazardous Waste Generator\n\n${openReqs.length > 0 ? `You currently have **${openReqs.length} requirements** with compliance gaps. These should be addressed through the CAPA programme.` : "All tracked regulatory requirements are currently compliant."}`,
      cards,
      followUps: [
        "What does OSHA 1910.1048 require for formaldehyde?",
        "Navigate me to the Legal Register",
        "What are my open CAPAs?",
      ],
    };
  }

  // ── Biosafety ─────────────────────────────────────────────────────────────────
  if (/biosafety|bsl|biological|bacteria|virus|bsc|cabinet|autoclave/i.test(q)) {
    return {
      text: `**BSL-2 Biosafety Summary — ${ctx.companyName}**\n\n${ctx.companyName} operates at Biosafety Level 2 (BSL-2), governed by the **CDC/NIH BMBL 6th Edition** and your Institutional Biosafety Committee (IBC) protocol.\n\n**Key BSL-2 requirements in your programme:**\n• All BSL-2 work must be performed in a certified Class II Biosafety Cabinet (BSC)\n• BSC certification: required annually by a certified field certifier (NSF 49)\n• Autoclave/decontamination: biological waste must be autoclaved prior to disposal; annual calibration with biological indicators required\n• PPE: lab coat, gloves, and eye protection at minimum; no eating/drinking/applying cosmetics in lab\n• Annual BSL-2 training required for all personnel working in BSL-2 areas\n• All work requires IBC approval; protocol amendments must be submitted before changes\n\nI recommend reviewing the **Biosafety & Lab Safety** module to verify all lab registrations, agent inventory, and calibration records are current.`,
      followUps: [
        "Navigate me to Biosafety & Lab Safety",
        "Is my BSL-2 training current?",
        "What is the status of my autoclave calibration?",
      ],
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────────
  return {
    text: `I'm not sure I fully understood that question. I'm trained on EHS topics — chemical safety, regulatory compliance, training, corrective actions, incidents, waste, and biosafety.\n\nHere are some things I can help with:\n• "What are my highest-risk chemicals?"\n• "Which training certifications are expiring?"\n• "What are my open CAPA actions?"\n• "What is my overall compliance status?"\n• "Navigate me to [any module]"\n\nFeel free to rephrase or try one of the suggested prompts below.`,
    followUps: [
      "What are my highest-risk chemicals?",
      "What is my overall compliance status?",
      "Which training certifications are expiring?",
    ],
  };
}

// ── Message text renderer ─────────────────────────────────────────────────────

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p === "\n") return <br key={i} />;
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const paragraphs = msg.text.split("\n\n");

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      <div className={`max-w-[75%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Main bubble */}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-tr-sm bg-blue-600 text-white"
            : "rounded-tl-sm border border-slate-100 bg-white text-slate-700 shadow-sm"
        }`}>
          {paragraphs.map((para, i) => {
            if (para.startsWith("•")) {
              const lines = para.split("\n").filter((l) => l.trim());
              return (
                <ul key={i} className="mt-1 space-y-0.5 pl-1">
                  {lines.map((line, j) => (
                    <li key={j} className="flex gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
                      <RichText text={line.replace(/^•\s*/, "")} />
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                <RichText text={para} />
              </p>
            );
          })}
        </div>

        {/* Data cards */}
        {msg.cards && msg.cards.length > 0 && (
          <div className="space-y-2 w-full">
            {msg.cards.map((card, ci) => (
              <div key={ci} className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-50 bg-slate-50 px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">{card.title}</span>
                  {card.href && (
                    <a href={card.href} className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5">
                      View <ChevronRight className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
                <div className="divide-y divide-slate-50">
                  {card.rows.map((row, ri) => (
                    <div key={ri} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="flex-1 text-xs font-medium text-slate-700 truncate">{row.label}</span>
                      <span className={`text-[11px] truncate max-w-[200px] ${
                        row.status === "red"   ? "text-red-600 font-medium" :
                        row.status === "amber" ? "text-amber-600 font-medium" :
                        row.status === "green" ? "text-emerald-600 font-medium" :
                        row.status === "blue"  ? "text-blue-600 font-medium" :
                        "text-slate-500"
                      }`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Follow-up prompts */}
        {msg.followUps && msg.followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {msg.followUps.map((fu, fi) => (
              <button
                key={fi}
                data-followup={fu}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
              >
                {fu}
              </button>
            ))}
          </div>
        )}

        <span className="text-[9px] text-slate-300 px-1">
          {msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ── P-Engine / Findings panel (replaces old page content) ────────────────────

const JOB_LABEL: Record<string, string> = {
  chemical_hazard_analysis:  "Chemical Hazard",
  compliance_gap_detection:  "Compliance Gap",
  training_gap_analysis:     "Training Gap",
  risk_score_prediction:     "Risk Score",
  incident_pattern_analysis: "Incident Pattern",
  waste_classification:      "Waste Classification",
};

const STAGE_STYLE: Record<string, string> = {
  scan:     "bg-slate-100 text-slate-600",
  detect:   "bg-blue-100 text-blue-700",
  forecast: "bg-violet-100 text-violet-700",
  alert:    "bg-red-100 text-red-700",
  learn:    "bg-emerald-100 text-emerald-700",
};

function FindingsPanel({ findings, runs, latestRun }: {
  findings: AiFinding[];
  runs: PredictabilityRun[];
  latestRun: PredictabilityRun | null;
}) {
  const pending  = findings.filter((f) => f.review_status === "pending").length;
  const accepted = findings.filter((f) => f.review_status === "accepted").length;
  const rejected = findings.filter((f) => f.review_status === "rejected").length;
  const sortedRuns = [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  function fmt(s: string) {
    return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Findings",  value: findings.length, hint: "All P-Engine output",    accent: "#3b82f6" },
          { label: "Pending Review",  value: pending,          hint: "Human review needed",   accent: "#7c3aed" },
          { label: "Accepted",        value: accepted,         hint: "Validated by team",     accent: "#10b981" },
          { label: "Rejected",        value: rejected,         hint: "Dismissed findings",    accent: "#94a3b8" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: s.accent }}>{s.value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Latest run */}
      {latestRun && (
        <div className="flex items-start gap-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-violet-900">P-Engine — Last Run</span>
              <Pill className={STAGE_STYLE[latestRun.stage] ?? "bg-slate-100 text-slate-600"}>{latestRun.stage}</Pill>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-violet-700 sm:grid-cols-4">
              <div><span className="font-medium">Scanned:</span> {latestRun.items_scanned}</div>
              <div><span className="font-medium">Signals:</span> {latestRun.signals_found}</div>
              {latestRun.forecast_data && (
                <>
                  <div><span className="font-medium">30-day:</span> {latestRun.forecast_data.predicted_compliance_score_30d}%</div>
                  <div><span className="font-medium">Trend:</span> {latestRun.forecast_data.compliance_trend}</div>
                </>
              )}
            </div>
            <div className="mt-1 text-xs text-violet-500">{latestRun.summary}</div>
          </div>
        </div>
      )}

      {/* Findings table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">AI Findings</span>
          <span className="text-xs text-slate-400">{findings.length} total · {pending} pending review</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 text-left">Finding</th>
                <th className="px-4 py-2.5 text-left">Job</th>
                <th className="px-4 py-2.5 text-left">Risk</th>
                <th className="px-4 py-2.5 text-left">Score</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {findings.map((f) => {
                const output = f.output as AiAnalysisOutput | null;
                return (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 max-w-64">
                      <div className="text-xs font-medium text-slate-800">{JOB_LABEL[f.job] ?? f.job}</div>
                      {output?.plain_language_summary && (
                        <div className="mt-0.5 text-[10px] text-slate-400 line-clamp-2">{output.plain_language_summary}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-violet-50 text-violet-700 text-[10px]">{JOB_LABEL[f.job] ?? f.job}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      {output?.risk_level ? <RiskLevelBadge level={output.risk_level as RiskLevel} /> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                      {output?.risk_score != null ? `${output.risk_score}/100` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(f.created_at)}</td>
                    <td className="px-4 py-3"><ReviewStatusBadge status={f.review_status} /></td>
                  </tr>
                );
              })}
              {findings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                    No AI findings. Run the P-Engine scan to generate findings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Run history */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <span className="text-sm font-semibold text-slate-800">P-Engine Run History</span>
          <span className="ml-2 text-xs text-slate-400">{runs.length} runs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 text-left">Run Date</th>
                <th className="px-4 py-2.5 text-left">Stage</th>
                <th className="px-4 py-2.5 text-center">Scanned</th>
                <th className="px-4 py-2.5 text-center">Signals</th>
                <th className="px-4 py-2.5 text-center">30d Forecast</th>
                <th className="px-4 py-2.5 text-left">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedRuns.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-xs tabular-nums text-slate-600">{fmt(r.created_at)}</td>
                  <td className="px-4 py-3"><Pill className={STAGE_STYLE[r.stage] ?? "bg-slate-100 text-slate-600"}>{r.stage}</Pill></td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{r.items_scanned}</td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{r.signals_found}</td>
                  <td className="px-4 py-3 text-center">
                    {r.forecast_data?.predicted_compliance_score_30d != null ? (
                      <span className={`text-sm font-bold ${(r.forecast_data.predicted_compliance_score_30d) < 70 ? "text-red-600" : (r.forecast_data.predicted_compliance_score_30d) < 85 ? "text-amber-600" : "text-emerald-600"}`}>
                        {r.forecast_data.predicted_compliance_score_30d}%
                      </span>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-56 line-clamp-1">{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main AmayaDashboard component ────────────────────────────────────────────

const TABS = [
  { id: "chat",     label: "Chat with SafetyIQ AI",    icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "findings", label: "AI Findings & P-Engine", icon: <BarChart3 className="h-3.5 w-3.5" /> },
] as const;

type TabId = "chat" | "findings";

export function AmayaDashboard({
  chemicals, courses, records, profiles, capas, incidents,
  legal, audits, waste, findings, runs, latestRun,
}: {
  chemicals: Chemical[];
  courses: TrainingCourse[];
  records: TrainingRecord[];
  profiles: Profile[];
  capas: CapaAction[];
  incidents: Incident[];
  legal: LegalRequirement[];
  audits: Audit[];
  waste: WasteStream[];
  findings: AiFinding[];
  runs: PredictabilityRun[];
  latestRun: PredictabilityRun | null;
}) {
  const { user } = useDemoUser();
  const [tab, setTab] = useState<TabId>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const ctx: AiCtx = { chemicals, courses, records, profiles, capas, incidents, legal, audits, waste, findings, latestRun, companyName: user.company };

  const pendingFindings = findings.filter((f) => f.review_status === "pending").length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", text: trimmed, timestamp: new Date() };
    // Snapshot the history (incl. this turn) so the LLM gets full conversation context.
    const history = [...messages, userMsg].map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // Local deterministic fallback — used when no AI key is configured or the
    // request fails, so the chat always works. Preserves the original cards /
    // follow-ups UX (the live LLM returns plain text only).
    const pushLocal = () => {
      const response = buildAiResponse(trimmed, ctx);
      setMessages((prev) => [...prev, { id: uid(), role: "ai", timestamp: new Date(), ...response }]);
      setTyping(false);
    };

    (async () => {
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, contextSummary: buildContextSummary(ctx) }),
        });
        if (!res.ok) { pushLocal(); return; }
        const data = (await res.json()) as { reply?: string | null };
        if (data && typeof data.reply === "string" && data.reply.trim()) {
          setMessages((prev) => [...prev, { id: uid(), role: "ai", text: data.reply!, timestamp: new Date() }]);
          setTyping(false);
        } else {
          // { reply: null } → no live AI; fall back to the local engine.
          pushLocal();
        }
      } catch {
        pushLocal();
      }
    })();
  }, [ctx, messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleFollowUp(e: React.MouseEvent) {
    const fu = (e.target as HTMLElement).closest("[data-followup]")?.getAttribute("data-followup");
    if (fu) sendMessage(fu);
  }

  return (
    <div className="space-y-4" onClick={handleFollowUp}>
      {/* Tab nav */}
      <div className="flex items-center gap-2">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const badge = t.id === "findings" && pendingFindings > 0 ? pendingFindings : null;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-blue-300 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {t.icon}
              {t.label}
              {badge && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700"}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Findings tab */}
      {tab === "findings" && (
        <FindingsPanel findings={findings} runs={runs} latestRun={latestRun} />
      )}

      {/* Chat tab */}
      {tab === "chat" && (
        <div className="flex gap-5" style={{ minHeight: "600px" }}>
          {/* Left sidebar */}
          <div className="hidden w-52 shrink-0 flex-col gap-3 lg:flex">
            {/* SafetyIQ AI identity card */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">SafetyIQ AI</div>
                  <div className="text-[10px] text-slate-400">AI Safety Assistant</div>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                I have live access to your entire EHS dataset. Ask me anything about chemicals, training, compliance, or incidents.
              </p>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-slate-50"
                >
                  <RotateCcw className="h-3 w-3" /> Clear chat
                </button>
              )}
            </div>

            {/* Suggested prompts */}
            {PROMPT_GROUPS.map((g) => (
              <div key={g.label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className={`mb-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${g.color}`}>
                  {g.icon} {g.label}
                </div>
                <div className="space-y-1">
                  {g.prompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="block w-full rounded-md px-2 py-1 text-left text-[11px] text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Chat area */}
          <div className="flex flex-1 flex-col rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
                    <Sparkles className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-slate-800">Ask SafetyIQ AI anything</h3>
                  <p className="mb-6 max-w-xs text-sm text-slate-500">
                    I have live access to your EHS data — chemicals, training, CAPAs, incidents, compliance, and more.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                    {[
                      "What are my highest-risk chemicals?",
                      "Which training certs are expiring?",
                      "What are my open CAPAs?",
                      "What's my compliance status?",
                    ].map((p) => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}

              {typing && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-slate-300"
                          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about chemicals, training, compliance, incidents…"
                  disabled={typing}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <p className="mt-1.5 text-center text-[10px] text-slate-400">
                SafetyIQ AI uses your live EHS data — always verify AI responses against source records.
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

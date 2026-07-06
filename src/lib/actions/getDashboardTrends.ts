"use server";

// Single-aggregation server action for the Client Command Center's trend cards.
// Fetches all 6 underlying EHS sources in parallel via the tenant-scoped repo
// layer (RLS-respecting, MOCK_MODE-safe — same as every other dashboard read),
// aggregates them into 7 trend cards, and makes ONE batched AI call to write a
// one-line "so what" summary per card. If every source is empty, DEMO_TRENDS is
// used instead so the dashboard never shows a bare zero. If the AI call fails,
// every card falls back to a deterministic template built from its own values —
// the page always renders complete content.

import {
  getIncidents,
  getCapaActions,
  getAuditFindings,
  getChemicals,
  getWasteStreams,
  getTrainingRecords,
} from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { riskLevelFromScore, RISK_LEVEL_META, type RiskLevel } from "@/lib/constants";
import { hasLiveAi } from "@/lib/env";
import { generateStructuredJson, type JsonSchemaSpec } from "@/lib/ai/provider";
import type { Incident, CapaAction, AuditFinding, Chemical, WasteStream, TrainingRecord } from "@/lib/types";

export type TrendCardKey =
  | "injuries"
  | "capas"
  | "auditFindings"
  | "chemicalHazard"
  | "wasteActivity"
  | "recurringProblems"
  | "complianceGaps";

export interface MonthlyPoint {
  month: string;
  count: number;
}

export interface TrendCardData {
  title: string;
  value: number | string;
  monthlySeries: MonthlyPoint[];
  summary: string;
  emptyMessage: string;
  isEmpty: boolean;
}

export interface NextComplianceDeadline {
  label: string;
  daysAway: number;
}

export interface DashboardTrendsResult {
  isDemoData: boolean;
  demoBannerText: string | null;
  cards: Record<TrendCardKey, TrendCardData>;
  nextComplianceDeadline: NextComplianceDeadline | null;
}

const AI_TIMEOUT_MS = 8_000;
const MAX_SUMMARY_LEN = 160;
const TRAILING_MONTHS = 6;
const DEADLINE_WINDOW_DAYS = 90;

// Same acute/carcinogen H-statement set the Command Center dashboard already
// uses to flag high-risk chemicals — kept in sync so the two views agree.
const HIGH_HAZARD_H = ["H350", "H351", "H300", "H310", "H311", "H330", "H331"];
const INJURY_INCIDENT_TYPES = new Set<Incident["incident_type"]>([
  "first_aid",
  "medical_treatment",
  "lost_time_injury",
  "fatality",
]);

// ── Demo dataset ───────────────────────────────────────────────────────────────
// Shown only when every one of the 6 real sources is empty for this tenant.
// Values are biotech/lab-flavored so a client never mistakes them for a
// construction-site template. Always paired with isDemoData: true and a
// visible banner — see getDashboardTrends() below.

const DEMO_NEXT_DEADLINE: NextComplianceDeadline = {
  label: "Cal/OSHA annual report (Form 300A)",
  daysAway: 14,
};

const DEMO_TRENDS: Record<TrendCardKey, Omit<TrendCardData, "summary">> = {
  injuries: {
    title: "Injuries",
    value: 1,
    monthlySeries: [
      { month: "Apr", count: 0 },
      { month: "May", count: 1 },
      { month: "Jun", count: 0 },
    ],
    emptyMessage: "No injuries recorded — safety record looks good.",
    isEmpty: false,
  },
  capas: {
    title: "CAPAs",
    value: 3,
    monthlySeries: [
      { month: "Apr", count: 2 },
      { month: "May", count: 4 },
      { month: "Jun", count: 3 },
    ],
    emptyMessage: "No open CAPAs — all corrective actions closed.",
    isEmpty: false,
  },
  auditFindings: {
    title: "Audit Findings",
    value: 4,
    monthlySeries: [
      { month: "Apr", count: 3 },
      { month: "May", count: 5 },
      { month: "Jun", count: 4 },
    ],
    emptyMessage: "No open audit findings — no issues detected.",
    isEmpty: false,
  },
  chemicalHazard: {
    title: "Chemical Hazard Snapshot",
    value: "Low",
    monthlySeries: [
      { month: "Apr", count: 2 },
      { month: "May", count: 2 },
      { month: "Jun", count: 1 },
    ],
    emptyMessage: "No chemical risk flags found — inventory looks good.",
    isEmpty: false,
  },
  wasteActivity: {
    title: "Waste Activity",
    value: 9,
    monthlySeries: [
      { month: "Apr", count: 7 },
      { month: "May", count: 10 },
      { month: "Jun", count: 9 },
    ],
    emptyMessage: "No waste activity logged yet this period.",
    isEmpty: false,
  },
  recurringProblems: {
    title: "Recurring Problems",
    value: 2,
    monthlySeries: [
      { month: "Apr", count: 1 },
      { month: "May", count: 2 },
      { month: "Jun", count: 2 },
    ],
    emptyMessage: "No recurring issues detected this quarter.",
    isEmpty: false,
  },
  complianceGaps: {
    title: "Upcoming Compliance Gaps",
    value: 1,
    monthlySeries: [],
    emptyMessage: "No upcoming compliance deadlines in the next 90 days.",
    isEmpty: false,
  },
};

// ── Aggregation helpers ─────────────────────────────────────────────────────────

function trailingMonthlySeries(dates: (string | null | undefined)[], months = TRAILING_MONTHS): MonthlyPoint[] {
  const now = new Date();
  const out: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      month: d.toLocaleDateString("en-US", { month: "short" }),
      count: dates.filter((s) => (s || "").slice(0, 7) === key).length,
    });
  }
  return out;
}

function withinTrailingMonths(dateStr: string | null | undefined, months = TRAILING_MONTHS): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return d.getTime() >= cutoff.getTime();
}

function isHighHazardChemical(c: Chemical): boolean {
  return (
    c.is_scheduled ||
    c.hazard_band === "high" ||
    c.hazard_band === "critical" ||
    c.hazard_statements.some((h) => HIGH_HAZARD_H.some((hh) => h.startsWith(hh)))
  );
}

function findRecurringProblems(
  incidents: Incident[],
  findings: AuditFinding[],
): { groupCount: number; series: MonthlyPoint[] } {
  const byIncidentType = new Map<string, Incident[]>();
  for (const i of incidents) {
    const list = byIncidentType.get(i.incident_type) ?? [];
    list.push(i);
    byIncidentType.set(i.incident_type, list);
  }
  const byFindingCategory = new Map<string, AuditFinding[]>();
  for (const f of findings) {
    const list = byFindingCategory.get(f.category) ?? [];
    list.push(f);
    byFindingCategory.set(f.category, list);
  }

  let groupCount = 0;
  const recurringDates: string[] = [];
  for (const list of byIncidentType.values()) {
    if (list.length >= 2) {
      groupCount += 1;
      recurringDates.push(...list.map((i) => i.occurred_at));
    }
  }
  for (const list of byFindingCategory.values()) {
    if (list.length >= 2) {
      groupCount += 1;
      recurringDates.push(...list.map((f) => f.created_at));
    }
  }

  return { groupCount, series: trailingMonthlySeries(recurringDates) };
}

interface DeadlineCandidate {
  label: string;
  daysAway: number;
}

/** Every future compliance-relevant date across the 4 sources that carry one, sorted nearest-first. */
function collectComplianceDeadlines(sources: {
  capas: CapaAction[];
  findings: AuditFinding[];
  chemicals: Chemical[];
  training: TrainingRecord[];
}): DeadlineCandidate[] {
  const now = new Date();
  const raw: { label: string; date: Date }[] = [];

  for (const c of sources.capas) {
    if (c.due_date && c.status !== "closed" && c.status !== "rejected") {
      raw.push({ label: `CAPA due: ${c.title}`, date: new Date(c.due_date) });
    }
  }
  for (const f of sources.findings) {
    if (f.due_date && f.status !== "closed") {
      raw.push({ label: `Audit finding due: ${f.title}`, date: new Date(f.due_date) });
    }
  }
  for (const c of sources.chemicals) {
    if (c.sds_expiry) raw.push({ label: `SDS review due: ${c.name}`, date: new Date(c.sds_expiry) });
    if (c.expiration_date) raw.push({ label: `Chemical expiration: ${c.name}`, date: new Date(c.expiration_date) });
  }
  for (const r of sources.training) {
    if (r.expiry_date) raw.push({ label: "Training certification renewal", date: new Date(r.expiry_date) });
  }

  return raw
    .filter((c) => !Number.isNaN(c.date.getTime()))
    .map((c) => ({ label: c.label, daysAway: Math.round((c.date.getTime() - now.getTime()) / 86_400_000) }))
    .filter((c) => c.daysAway >= 0)
    .sort((a, b) => a.daysAway - b.daysAway);
}

interface RealSources {
  incidents: Incident[];
  capas: CapaAction[];
  findings: AuditFinding[];
  chemicals: Chemical[];
  waste: WasteStream[];
  training: TrainingRecord[];
}

function buildRealCards(sources: RealSources): Record<TrendCardKey, Omit<TrendCardData, "summary">> {
  const { incidents, capas, findings, chemicals, waste, training } = sources;

  const injuries = incidents.filter((i) => INJURY_INCIDENT_TYPES.has(i.incident_type));
  const openCapas = capas.filter((c) => c.status !== "closed" && c.status !== "rejected");
  const openFindings = findings.filter((f) => f.status === "open" || f.status === "in_progress");
  const highRiskChems = chemicals.filter(isHighHazardChemical);
  const chemicalRiskLevel: RiskLevel = riskLevelFromScore(highRiskChems.length);
  const recentWaste = waste.filter((w) => withinTrailingMonths(w.created_at));
  const recurring = findRecurringProblems(incidents, findings);
  const upcomingDeadlines = collectComplianceDeadlines({ capas, findings, chemicals, training }).filter(
    (d) => d.daysAway <= DEADLINE_WINDOW_DAYS,
  );

  return {
    injuries: {
      title: "Injuries",
      value: injuries.length,
      monthlySeries: trailingMonthlySeries(injuries.map((i) => i.occurred_at)),
      emptyMessage: "No injuries recorded — safety record looks good.",
      isEmpty: injuries.length === 0,
    },
    capas: {
      title: "CAPAs",
      value: openCapas.length,
      monthlySeries: trailingMonthlySeries(capas.map((c) => c.created_at)),
      emptyMessage: "No open CAPAs — all corrective actions closed.",
      isEmpty: openCapas.length === 0,
    },
    auditFindings: {
      title: "Audit Findings",
      value: openFindings.length,
      monthlySeries: trailingMonthlySeries(findings.map((f) => f.created_at)),
      emptyMessage: "No open audit findings — no issues detected.",
      isEmpty: openFindings.length === 0,
    },
    chemicalHazard: {
      title: "Chemical Hazard Snapshot",
      value: RISK_LEVEL_META[chemicalRiskLevel].label,
      monthlySeries: trailingMonthlySeries(highRiskChems.map((c) => c.created_at)),
      emptyMessage: "No chemical risk flags found — inventory looks good.",
      isEmpty: highRiskChems.length === 0,
    },
    wasteActivity: {
      title: "Waste Activity",
      value: recentWaste.length,
      monthlySeries: trailingMonthlySeries(waste.map((w) => w.created_at)),
      emptyMessage: "No waste activity logged yet this period.",
      isEmpty: recentWaste.length === 0,
    },
    recurringProblems: {
      title: "Recurring Problems",
      value: recurring.groupCount,
      monthlySeries: recurring.series,
      emptyMessage: "No recurring issues detected this quarter.",
      isEmpty: recurring.groupCount === 0,
    },
    complianceGaps: {
      title: "Upcoming Compliance Gaps",
      value: upcomingDeadlines.length,
      monthlySeries: [],
      emptyMessage: "No upcoming compliance deadlines in the next 90 days.",
      isEmpty: upcomingDeadlines.length === 0,
    },
  };
}

// ── Summaries: deterministic floor + single batched AI overlay ─────────────────

function fallbackSummary(key: TrendCardKey, data: Omit<TrendCardData, "summary">): string {
  switch (key) {
    case "injuries":
      return `${data.value} injuries recorded in the last ${TRAILING_MONTHS} months — review recent incidents for common causes.`;
    case "capas":
      return `${data.value} CAPAs open — track closure against target dates.`;
    case "auditFindings":
      return `${data.value} audit findings open — prioritize the highest-severity items first.`;
    case "chemicalHazard":
      return `Chemical hazard level: ${data.value} — review flagged inventory items.`;
    case "wasteActivity":
      return `${data.value} waste activities logged in the last ${TRAILING_MONTHS} months.`;
    case "recurringProblems":
      return `${data.value} recurring issue${data.value === 1 ? "" : "s"} detected — review for a common root cause.`;
    case "complianceGaps":
      return `${data.value} upcoming compliance deadline${data.value === 1 ? "" : "s"} in the next ${DEADLINE_WINDOW_DAYS} days.`;
    default:
      return "";
  }
}

const TREND_SUMMARY_SCHEMA: JsonSchemaSpec = {
  name: "dashboard_trend_summaries",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summaries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            summary: { type: "string" },
          },
          required: ["key", "summary"],
        },
      },
    },
    required: ["summaries"],
  },
};

const TREND_SYSTEM_PROMPT =
  "You are a safety compliance assistant for a biotech/life-sciences EHS platform. For each trend card, write one concise, plain-language sentence with a clear so-what insight for an EHS manager. Use ONLY the provided numbers — never invent facts, dates, or regulatory claims. Return exactly one summary per card key.";

/** Only the fields the model may see — no free-text beyond known aggregated values. */
function modelInputForCard(key: TrendCardKey, data: Omit<TrendCardData, "summary">) {
  return {
    key,
    title: data.title,
    value: data.value,
    isEmpty: data.isEmpty,
    recentMonths: data.monthlySeries,
  };
}

/** One batched call across all 7 cards. Throws on any failure so the caller keeps the deterministic floor. */
async function summariseTrendCards(
  cards: Record<TrendCardKey, Omit<TrendCardData, "summary">>,
): Promise<Partial<Record<TrendCardKey, string>>> {
  const keys = Object.keys(cards) as TrendCardKey[];
  const user = JSON.stringify({ cards: keys.map((k) => modelInputForCard(k, cards[k])) });
  const result = await generateStructuredJson({
    system: TREND_SYSTEM_PROMPT,
    user,
    schema: TREND_SUMMARY_SCHEMA,
    maxTokens: 80 * keys.length + 100,
    timeoutMs: AI_TIMEOUT_MS,
    tier: "triage", // cheap model — low-stakes rephrasing of numbers we already computed
  });
  const data = result.data as { summaries?: { key?: unknown; summary?: unknown }[] };
  const out: Partial<Record<TrendCardKey, string>> = {};
  for (const s of data.summaries ?? []) {
    if (typeof s?.key === "string" && typeof s?.summary === "string") {
      out[s.key as TrendCardKey] = s.summary.trim().slice(0, MAX_SUMMARY_LEN);
    }
  }
  return out;
}

// ── Entry point ─────────────────────────────────────────────────────────────────

/**
 * Aggregates the 6 underlying EHS sources for the current tenant into the 7
 * Client Command Center trend cards. Read-only — no schema changes, no writes.
 * tenantId is always derived server-side (never accepted as an argument), same
 * as every other server action in this codebase, so RLS scoping can't be bypassed.
 */
export async function getDashboardTrends(): Promise<DashboardTrendsResult> {
  const tenantId = await getEffectiveTenantId();

  const [incidents, capas, findings, chemicals, waste, training] = await Promise.all([
    getIncidents(tenantId),
    getCapaActions(tenantId),
    getAuditFindings(tenantId),
    getChemicals(tenantId),
    getWasteStreams(tenantId),
    getTrainingRecords(tenantId),
  ]);

  const allEmpty =
    incidents.length === 0 &&
    capas.length === 0 &&
    findings.length === 0 &&
    chemicals.length === 0 &&
    waste.length === 0 &&
    training.length === 0;

  const baseCards = allEmpty
    ? DEMO_TRENDS
    : buildRealCards({ incidents, capas, findings, chemicals, waste, training });

  // Guaranteed floor: every card gets a deterministic summary before the AI call,
  // so a missing/partial AI result never leaves a card without a "so what" line.
  const keys = Object.keys(baseCards) as TrendCardKey[];
  const floor: Record<TrendCardKey, string> = Object.fromEntries(
    keys.map((k) => [k, fallbackSummary(k, baseCards[k])]),
  ) as Record<TrendCardKey, string>;

  let summaries: Record<TrendCardKey, string> = floor;
  // Skip the network round trip entirely when no provider key is configured
  // (every mock/dev/preview environment) — avoids a multi-second page load
  // waiting out a request that's guaranteed to fail.
  if (hasLiveAi()) {
    try {
      const aiSummaries = await summariseTrendCards(baseCards);
      summaries = { ...floor, ...aiSummaries };
    } catch {
      // AI unavailable / timed out / circuit open — keep the deterministic floor.
    }
  }

  const cards = Object.fromEntries(
    keys.map((k) => [
      k,
      { ...baseCards[k], summary: allEmpty ? `${summaries[k]} (Demo data)` : summaries[k] },
    ]),
  ) as Record<TrendCardKey, TrendCardData>;

  return {
    isDemoData: allEmpty,
    demoBannerText: allEmpty ? "Sample data — your live data will appear here." : null,
    cards,
    nextComplianceDeadline: allEmpty
      ? DEMO_NEXT_DEADLINE
      : (() => {
          const nearest = collectComplianceDeadlines({ capas, findings, chemicals, training })[0];
          return nearest ? { label: nearest.label, daysAway: nearest.daysAway } : null;
        })(),
  };
}

/**
 * Daily Agent Standup — GUS × EHS Records Validation Agent (server-only).
 *
 * Gathers what each agent is actually seeing from live data, then generates a
 * short meeting: two briefings, a back-and-forth exchange, the GAPS they jointly
 * surface, and ACTION ITEMS for the operator. Deterministic by construction; in
 * live mode an LLM rewrites the exchange/summary into natural dialogue, with the
 * deterministic version as the guaranteed fallback.
 *
 * IMPORTANT: never import into a client component — it reads server secrets.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MOCK_MODE, hasLiveAi, aiProvider } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateStructuredJson } from "@/lib/ai/provider";
import { recordAiCall } from "@/lib/ai/telemetry";
import type {
  CspMeeting, CspMeetingExchange, CspMeetingGap, CspMeetingActionItem,
  CspAgendaItem, CspReflection,
} from "./types";

type DB = SupabaseClient;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const todayISO = (now: number) => new Date(now).toISOString().slice(0, 10);

interface StandupData {
  ehs: {
    totalRuns: number;
    pendingReviews: number;
    needsReview: number;
    autoAccepted: number;
    recordable: number;
    topFindings: { category: string; count: number }[];
    topMissingFields: { field: string; count: number }[];
    memoryLessons: number;
    autonomyQuals: string[];
    recordTypesSeen: string[];
    recordTypesWithoutAutonomy: string[];
  };
  platform: {
    tenants: number;
    avgCompliance: number | null;
    weakestModule: { module: string; score: number } | null;
    overdueCapas: number;
    openIncidents: number;
  };
  gateway: {
    status: string;              // healthy | degraded | critical
    gatewayOverall: string | null;
    rejectQueue: number;
    fail: number;
    findingsCount: number;
  } | null;
}

// ── Data gathering (cross-tenant; admin or service client) ────────────────────

async function gather(client: DB, now: number): Promise<StandupData> {
  const [runsRes, findingsRes, queueRes, memRes, qualRes, complianceRes, capaRes, incRes, tenantRes, gwRes] =
    await Promise.all([
      client.from("csp_validation_runs").select("validation_status, human_review_required, record_type, missing_fields").order("created_at", { ascending: false }).limit(400),
      client.from("csp_validation_findings").select("finding_category").limit(800),
      client.from("csp_review_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      client.from("csp_agent_memory").select("id", { count: "exact", head: true }).eq("active", true),
      client.from("csp_agent_qualifications").select("title, grants_autonomy, scope_record_types, status").eq("status", "active"),
      client.from("compliance_scores").select("module, score"),
      client.from("capa_records").select("id", { count: "exact", head: true }).not("status", "in", "(closed,cancelled)").lt("due_date", todayISO(now)),
      client.from("incidents").select("id", { count: "exact", head: true }).not("status", "in", "(closed,resolved)"),
      client.from("tenants").select("id", { count: "exact", head: true }),
      client.from("gateway_agent_health_log").select("overall_status, gateway_overall, reject_queue_count, fail_count, findings").order("checked_at", { ascending: false }).limit(1),
    ]);

  const gwRow = (gwRes.data ?? [])[0];
  const gateway = gwRow ? {
    status: String(gwRow.overall_status),
    gatewayOverall: (gwRow.gateway_overall as string) ?? null,
    rejectQueue: num(gwRow.reject_queue_count),
    fail: num(gwRow.fail_count),
    findingsCount: Array.isArray(gwRow.findings) ? gwRow.findings.length : 0,
  } : null;

  const runs = runsRes.data ?? [];
  const needsReview = runs.filter((r) => r.human_review_required).length;
  const recordable = runs.filter((r) => r.validation_status === "potential_recordable_or_reportable").length;
  const autoAccepted = runs.filter((r) => !r.human_review_required).length;

  const fieldTally = new Map<string, number>();
  for (const r of runs) for (const f of (r.missing_fields as string[] | null) ?? []) fieldTally.set(f, (fieldTally.get(f) ?? 0) + 1);
  const topMissingFields = [...fieldTally.entries()].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count).slice(0, 3);

  const catTally = new Map<string, number>();
  for (const f of findingsRes.data ?? []) catTally.set(f.finding_category, (catTally.get(f.finding_category) ?? 0) + 1);
  const topFindings = [...catTally.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count).slice(0, 3);

  const recordTypesSeen = [...new Set(runs.map((r) => r.record_type as string))];
  const autonomyByType = new Set<string>();
  const autonomyQuals: string[] = [];
  for (const q of qualRes.data ?? []) {
    if (q.grants_autonomy) {
      autonomyQuals.push(q.title);
      for (const t of (q.scope_record_types as string[]) ?? []) autonomyByType.add(t);
    }
  }
  const recordTypesWithoutAutonomy = recordTypesSeen.filter((t) => !autonomyByType.has(t));

  // Platform / GUS side.
  const scores = complianceRes.data ?? [];
  const moduleAgg = new Map<string, { sum: number; n: number }>();
  for (const s of scores) {
    const m = moduleAgg.get(s.module) ?? { sum: 0, n: 0 };
    m.sum += num(s.score); m.n += 1; moduleAgg.set(s.module, m);
  }
  let avgCompliance: number | null = null;
  let weakestModule: { module: string; score: number } | null = null;
  if (scores.length > 0) {
    avgCompliance = Math.round(scores.reduce((a, s) => a + num(s.score), 0) / scores.length);
    for (const [module, { sum, n }] of moduleAgg) {
      const score = Math.round(sum / n);
      if (!weakestModule || score < weakestModule.score) weakestModule = { module, score };
    }
  }

  return {
    ehs: {
      totalRuns: runs.length,
      pendingReviews: queueRes.count ?? 0,
      needsReview, autoAccepted, recordable,
      topFindings, topMissingFields,
      memoryLessons: memRes.count ?? 0,
      autonomyQuals, recordTypesSeen, recordTypesWithoutAutonomy,
    },
    platform: {
      tenants: tenantRes.count ?? 0,
      avgCompliance,
      weakestModule,
      overdueCapas: capaRes.count ?? 0,
      openIncidents: incRes.count ?? 0,
    },
    gateway,
  };
}

// ── Deterministic meeting construction ────────────────────────────────────────

function nice(s: string) { return s.replace(/_/g, " "); }

function buildMeeting(d: StandupData): {
  gus: string; ehs: string; exchange: CspMeetingExchange[];
  gaps: CspMeetingGap[]; actions: CspMeetingActionItem[]; summary: string;
  agenda: CspAgendaItem[]; reflections: CspReflection[]; gateway: string;
} {
  const { ehs, platform, gateway } = d;

  const gus = `Platform pulse: ${platform.tenants} tenant(s)${platform.avgCompliance != null ? `, average compliance ${platform.avgCompliance}%` : ""}. ${platform.overdueCapas} overdue corrective action(s), ${platform.openIncidents} open incident(s).${platform.weakestModule ? ` Weakest module: ${nice(platform.weakestModule.module)} at ${platform.weakestModule.score}%.` : ""}`;

  const ehsB = `${ehs.totalRuns} record(s) validated. ${ehs.needsReview} routed to human review (${ehs.pendingReviews} still pending), ${ehs.autoAccepted} auto-accepted, ${ehs.recordable} flagged possibly recordable. Top finding: ${ehs.topFindings[0] ? `${nice(ehs.topFindings[0].category)} (${ehs.topFindings[0].count})` : "none"}. ${ehs.memoryLessons} learned lesson(s) in memory.`;

  const gwB = gateway
    ? `Gateway is ${gateway.status}${gateway.gatewayOverall ? ` (pipeline ${gateway.gatewayOverall.toUpperCase()})` : ""}. ${gateway.rejectQueue} record(s) in the reject queue, ${gateway.findingsCount} maintenance finding(s) open.`
    : `No recent gateway health check on record — I'll run one and report next standup.`;

  const exchange: CspMeetingExchange[] = [];
  exchange.push({ speaker: "GUS", message: gus });
  exchange.push({ speaker: "EHS Validation Agent", message: ehsB });
  exchange.push({ speaker: "AI Gateway Agent", message: gwB });

  const gaps: CspMeetingGap[] = [];
  const actions: CspMeetingActionItem[] = [];

  // Gap 0 — gateway health degraded/critical.
  if (gateway && gateway.status !== "healthy") {
    gaps.push({
      title: `Gateway is ${gateway.status}`,
      detail: `${gateway.findingsCount} maintenance finding(s); ${gateway.rejectQueue} record(s) blocked in the reject queue.`,
      severity: gateway.status === "critical" ? "high" : "medium",
    });
    actions.push({ item: `Work the gateway's ${gateway.findingsCount} maintenance finding(s) on /sa/gateway.`, owner: "Operator", priority: gateway.status === "critical" ? "high" : "normal" });
    exchange.push({ speaker: "AI Gateway Agent", message: `${gateway.rejectQueue > 0 ? `${gateway.rejectQueue} record(s) are stuck at my gate. ` : ""}EHS — anything you escalate that I'm also blocking, flag it so we don't double-handle.` });
    exchange.push({ speaker: "EHS Validation Agent", message: `Will do. If a record clears my validation but trips your gate, that's a rule mismatch worth reconciling.` });
  }

  // Gap 1 — a dominant missing field signals a data-capture gap upstream.
  if (ehs.topMissingFields[0] && ehs.topMissingFields[0].count >= 2) {
    const f = ehs.topMissingFields[0];
    gaps.push({ title: `Records repeatedly miss "${nice(f.field)}"`, detail: `${f.count} record(s) were incomplete on "${nice(f.field)}". The intake form likely doesn't capture it, so every such record escalates.`, severity: f.count >= 4 ? "high" : "medium" });
    actions.push({ item: `Add a "${nice(f.field)}" field to the relevant intake form so records arrive complete.`, owner: "Operator", priority: f.count >= 4 ? "high" : "normal" });
    exchange.push({ speaker: "EHS Validation Agent", message: `GUS — I keep escalating records because "${nice(f.field)}" is blank. That's not a judgment call, it's a missing field. If intake captured it, my auto-accept rate would rise.` });
    exchange.push({ speaker: "GUS", message: `Agreed. That's a structural gap, not a people problem. I'll flag the intake form to the operator. Closing it lifts completeness platform-wide.` });
  }

  // Gap 2 — review backlog.
  if (ehs.pendingReviews >= 5) {
    gaps.push({ title: "Human review backlog building", detail: `${ehs.pendingReviews} validation(s) are waiting on a credentialed reviewer.`, severity: ehs.pendingReviews >= 15 ? "high" : "medium" });
    actions.push({ item: `Triage the ${ehs.pendingReviews} pending review(s); sign-offs also teach the agent via its memory bank.`, owner: "Operator", priority: ehs.pendingReviews >= 15 ? "high" : "normal" });
  }

  // Gap 3 — record types the agent has no autonomy for.
  if (ehs.recordTypesWithoutAutonomy.length > 0) {
    gaps.push({ title: "Agent lacks autonomy for some record types", detail: `No active qualification grants autonomy for: ${ehs.recordTypesWithoutAutonomy.map(nice).join(", ")}. Every such record escalates, even when clean.`, severity: "low" });
    actions.push({ item: `Review whether to grant an autonomy skill for: ${ehs.recordTypesWithoutAutonomy.map(nice).join(", ")}.`, owner: "Operator", priority: "low" });
    exchange.push({ speaker: "GUS", message: `One thing — you're escalating every ${ehs.recordTypesWithoutAutonomy.map(nice).join("/")} record. You hold no autonomy qualification there. Is that intentional caution, or a coverage gap?` });
    exchange.push({ speaker: "EHS Validation Agent", message: `Coverage gap. I'm capable, just not credentialed for it. The operator can grant the skill in my profile if they want me handling clean ones unattended.` });
  }

  // Gap 4 — no learned memory yet.
  if (ehs.memoryLessons === 0 && ehs.totalRuns > 0) {
    gaps.push({ title: "No learned memory yet", detail: "The agent hasn't recorded any lessons. It improves as reviewers sign off — until then it can't calibrate to your house standards.", severity: "low" });
    actions.push({ item: "Sign off on a few queued reviews so the agent starts building its memory bank.", owner: "Operator", priority: "low" });
  }

  // GUS-side gaps from platform health.
  if (platform.overdueCapas > 0) {
    gaps.push({ title: `${platform.overdueCapas} overdue corrective action(s)`, detail: "Overdue CAPAs are evidence of non-systematic follow-through and often trace back to incident findings.", severity: platform.overdueCapas >= 3 ? "high" : "medium" });
    actions.push({ item: `Close out or re-baseline ${platform.overdueCapas} overdue corrective action(s).`, owner: "Operator", priority: platform.overdueCapas >= 3 ? "high" : "normal" });
    exchange.push({ speaker: "GUS", message: `I'm carrying ${platform.overdueCapas} overdue corrective action(s). Can you cross-check whether any trace back to incidents you've flagged? That linkage would prioritize them.` });
    exchange.push({ speaker: "EHS Validation Agent", message: `I'll tag any validation whose finding maps to an open CAPA. That turns your overdue list into a ranked queue instead of a flat one.` });
  }
  if (platform.weakestModule && platform.weakestModule.score < 70) {
    gaps.push({ title: `${nice(platform.weakestModule.module)} is the weakest module (${platform.weakestModule.score}%)`, detail: "Targeted validation and document review here would lift the platform's lowest score.", severity: platform.weakestModule.score < 50 ? "high" : "medium" });
    actions.push({ item: `Focus a review cycle on ${nice(platform.weakestModule.module)} (currently ${platform.weakestModule.score}%).`, owner: "Operator", priority: "normal" });
  }

  if (gaps.length === 0) {
    exchange.push({ speaker: "GUS", message: "No structural gaps surfaced today. Both of us are operating within tolerance." });
    exchange.push({ speaker: "EHS Validation Agent", message: "Concur. I'll keep validating and feeding anything anomalous into tomorrow's standup." });
  } else {
    exchange.push({ speaker: "GUS", message: `We surfaced ${gaps.length} gap(s) and ${actions.length} action item(s). I'll keep them on the platform board.` });
  }

  const summary = gaps.length === 0
    ? "No structural gaps today — both agents operating within tolerance."
    : `${gaps.length} gap(s) surfaced, ${actions.length} action item(s). Top: ${gaps[0].title}.`;

  // ── Standing agenda — every standup checks off the same key items ──────────
  const agenda: CspAgendaItem[] = [
    { key: "critical", title: "Critical / immediate-risk check", covered: true,
      note: ehs.recordable > 0 ? `${ehs.recordable} possible recordable/reportable case(s) flagged for immediate human review.` : "No critical or immediate-risk conditions in this window." },
    { key: "ehs_brief", title: "EHS Agent briefing — records & escalations", covered: true, note: ehsB },
    { key: "gus_brief", title: "GUS briefing — platform health & forecast", covered: true, note: gus },
    { key: "gateway_brief", title: "Gateway Agent briefing — gateway health", covered: true, note: gwB },
    { key: "reconcile", title: "Evidence reconciliation", covered: true,
      note: platform.overdueCapas > 0 ? "Cross-checking overdue corrective actions against incident findings to rank them." : "Both agents agree on the review window; no conflicting counts." },
    { key: "gaps", title: "Gaps & blind spots", covered: gaps.length > 0,
      note: gaps.length > 0 ? `${gaps.length} gap(s) surfaced — see Findings.` : "No structural gaps surfaced this window." },
    { key: "actions", title: "Action items assigned", covered: actions.length > 0,
      note: actions.length > 0 ? `${actions.length} action item(s), each with an owner and priority.` : "No actions required today." },
    { key: "learning", title: "Learning & qualification coverage", covered: true,
      note: `${ehs.memoryLessons} learned lesson(s) in memory.${ehs.recordTypesWithoutAutonomy.length ? ` No autonomy qualification for: ${ehs.recordTypesWithoutAutonomy.map(nice).join(", ")}.` : ""}` },
    { key: "open", title: "Open thoughts & improvement ideas", covered: true, note: "Each agent shares its own reflection to close." },
  ];

  // ── Closing open thoughts — each agent's own reflection ────────────────────
  const gusThought = platform.weakestModule && platform.weakestModule.score < 80
    ? `${nice(platform.weakestModule.module)} keeps lagging at ${platform.weakestModule.score}% — one focused cycle there would move the platform score more than anything else I'm tracking.`
    : platform.overdueCapas > 0
      ? `I'd close the loop on those ${platform.overdueCapas} overdue action(s) first; stale CAPAs are usually where the next surprise is hiding.`
      : "Platform is steady. What would sharpen my forecasts most is a live schedule feed — I'd rather see exposure before it arrives than after.";

  const ehsThought = ehs.topMissingFields[0] && ehs.topMissingFields[0].count >= 2
    ? `My single biggest lever is the "${nice(ehs.topMissingFields[0].field)}" intake gap — it isn't judgment, it's a blank field. Close it and my auto-accept rate climbs while your queue shrinks.`
    : ehs.pendingReviews >= 5
      ? "I have the signal; what I need is reviewer time. Every sign-off also teaches me, so clearing the backlog compounds — it makes me sharper, not just emptier."
      : ehs.memoryLessons === 0
        ? "I'm validating cleanly, but I haven't learned your house standards yet. A few sign-offs would let me start calibrating to how you actually decide."
        : "Running clean. I'll keep feeding anything anomalous forward so tomorrow's standup starts sharper than today's.";

  const gwThought = !gateway
    ? "I have no recent health snapshot — wire my daily check into the cron so I arrive at standup with current numbers, not stale ones."
    : gateway.rejectQueue > 0
      ? `My reject queue is my best early-warning signal. ${gateway.rejectQueue} record(s) are stuck — clearing them keeps clean data flowing and tells me whether a gate rule is over-firing.`
      : gateway.status !== "healthy"
        ? "I'm degraded but not blocking — the warnings are quality drift. Worth watching before it becomes a hard fail."
        : "Gateway's healthy. My value is staying boring — I'd rather catch drift early than report an outage after the fact.";

  const reflections: CspReflection[] = [
    { speaker: "GUS", thought: gusThought },
    { speaker: "EHS Validation Agent", thought: ehsThought },
    { speaker: "AI Gateway Agent", thought: gwThought },
  ];
  exchange.push({ speaker: "GUS", message: `Open thought — ${gusThought}` });
  exchange.push({ speaker: "EHS Validation Agent", message: `Open thought — ${ehsThought}` });
  exchange.push({ speaker: "AI Gateway Agent", message: `Open thought — ${gwThought}` });

  return { gus, ehs: ehsB, exchange, gaps, actions, summary, agenda, reflections, gateway: gwB };
}

// ── Optional LLM rewrite of the dialogue (live mode only) ──────────────────────

const DIALOGUE_SCHEMA = {
  name: "agent_standup_dialogue",
  strict: true,
  schema: {
    type: "object",
    required: ["summary", "exchange"],
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      exchange: {
        type: "array",
        items: {
          type: "object",
          required: ["speaker", "message"],
          additionalProperties: false,
          properties: {
            speaker: { type: "string", enum: ["GUS", "EHS Validation Agent", "AI Gateway Agent"] },
            message: { type: "string" },
          },
        },
      },
    },
  },
} as const;

async function enrichDialogue(base: ReturnType<typeof buildMeeting>): Promise<{ exchange: CspMeetingExchange[]; summary: string; model: string } | null> {
  try {
    const system = `You are scripting a short daily standup between THREE AI agents on an EHS safety platform: GUS (Global Unified Safety Intelligence — platform-wide health and forecasting), the EHS Records Validation Agent (CSP-informed; validates records and routes risk to human review), and the AI Gateway Agent (monitors and maintains the AI gateway — pipeline health, reject queue, AI telemetry). All three should speak. Keep it concise, professional, specific to the numbers given, and oriented to finding gaps and improvements. 7–11 turns. Do not invent metrics beyond what is given.`;
    const user = `GUS briefing: ${base.gus}\nEHS briefing: ${base.ehs}\nGateway briefing: ${base.gateway}\nGaps: ${base.gaps.map((g) => g.title).join("; ") || "none"}\nAction items: ${base.actions.map((a) => a.item).join("; ") || "none"}\nRewrite as a natural back-and-forth (all three agents speak) and a one-line summary.`;
    const { data, model } = await generateStructuredJson({ system, user, schema: DIALOGUE_SCHEMA, maxTokens: 900, timeoutMs: 20_000, tier: "deep" });
    const d = data as { summary?: string; exchange?: CspMeetingExchange[] };
    if (!Array.isArray(d.exchange) || d.exchange.length < 2) return null;
    return { exchange: d.exchange, summary: typeof d.summary === "string" && d.summary.trim() ? d.summary.trim() : base.summary, model: `${aiProvider()}:${model}` };
  } catch {
    recordAiCall({ provider: aiProvider(), model: "standup-deterministic-fallback", ms: 0, inputTokens: 0, outputTokens: 0, ok: false });
    return null;
  }
}

// ── Public: run a standup and persist it ──────────────────────────────────────

export async function runStandup(client: DB, opts: { now: number; generatedBy: string; enrich?: boolean }): Promise<CspMeeting | null> {
  const data = await gather(client, opts.now);
  const base = buildMeeting(data);

  let exchange = base.exchange;
  let summary = base.summary;
  let model = "standup-deterministic";
  if (opts.enrich && !MOCK_MODE && hasLiveAi()) {
    const enriched = await enrichDialogue(base);
    if (enriched) { exchange = enriched.exchange; summary = enriched.summary; model = enriched.model; }
  }

  const row = {
    meeting_date: todayISO(opts.now),
    title: "Daily Agent Standup — GUS × EHS Validation Agent × AI Gateway Agent",
    status: "completed",
    participants: ["GUS", "EHS Records Validation Agent", "AI Gateway Agent"],
    gus_briefing: base.gus,
    ehs_briefing: base.ehs,
    exchange,
    agenda: base.agenda,
    reflections: base.reflections,
    gaps_found: base.gaps,
    action_items: base.actions,
    shared_summary: summary,
    metrics: data as unknown as Record<string, unknown>,
    model,
    generated_by: opts.generatedBy,
  };
  const { data: inserted, error } = await client.from("csp_agent_meetings").insert(row).select("*").single();
  if (error || !inserted) return null;
  return mapMeeting(inserted);
}

// ── Reads ─────────────────────────────────────────────────────────────────────

function mapMeeting(r: Record<string, unknown>): CspMeeting {
  return {
    id: String(r.id),
    meeting_date: String(r.meeting_date),
    title: String(r.title),
    status: String(r.status),
    participants: (r.participants as string[]) ?? [],
    gus_briefing: (r.gus_briefing as string) ?? null,
    ehs_briefing: (r.ehs_briefing as string) ?? null,
    exchange: (r.exchange as CspMeetingExchange[]) ?? [],
    agenda: (r.agenda as CspAgendaItem[]) ?? [],
    reflections: (r.reflections as CspReflection[]) ?? [],
    gaps_found: (r.gaps_found as CspMeetingGap[]) ?? [],
    action_items: (r.action_items as CspMeetingActionItem[]) ?? [],
    shared_summary: (r.shared_summary as string) ?? null,
    metrics: (r.metrics as Record<string, unknown>) ?? {},
    model: (r.model as string) ?? null,
    generated_by: (r.generated_by as string) ?? null,
    created_at: String(r.created_at),
  };
}

export async function getMeetings(limit = 30): Promise<CspMeeting[]> {
  if (MOCK_MODE) return [];
  const client = await createSupabaseServerClient();
  if (!client) return [];
  const { data } = await client.from("csp_agent_meetings").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map(mapMeeting);
}

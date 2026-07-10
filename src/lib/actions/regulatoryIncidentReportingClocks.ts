"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getIncidentReportingAccess } from "@/lib/regulatory/access";
import { evaluateReportability, mapPlainLanguageAnswers } from "@/lib/regulatory/jurisdictionEngine";
import { statusForElapsed, hoursRemaining, buildEscalationMessage } from "@/lib/regulatory/notifications";

// Server actions for the incident regulatory reporting clocks. Role-gating is a
// server-side check (getIncidentReportingAccess mirrors the table RLS); there is
// no `requireRole` helper in this repo. Inputs validated with zod; actions return
// a discriminated result rather than throwing (repo convention).

// Clock statuses that still require action before an incident can close.
const OPEN_STATUSES = [
  "pending_start",
  "running",
  "escalated_amber",
  "escalated_red",
  "overdue",
] as const;

export type ClockActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string; issues?: unknown };

const PERM_ERR = "You don't have permission to manage regulatory reporting clocks.";
const AUTH_ERR = "Session expired — please reload.";

// ── Start clocks from decision-helper answers ────────────────────────────────────

const startSchema = z.object({
  incidentId: z.string().uuid(),
  // Plain yes/no answers keyed by DecisionQuestion.id. Confirmed reportability
  // only — the caller (decision helper) submits after the user answers.
  answers: z.record(z.boolean()),
});

export async function startReportingClocks(input: unknown): Promise<ClockActionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please review your answers.", issues: parsed.error.flatten() };
  }

  const access = await getIncidentReportingAccess();
  if (!access.authorized || !access.tenantId) return { ok: false, error: PERM_ERR };

  const now = new Date().toISOString();

  if (MOCK_MODE) {
    const { clocks } = evaluateReportability(mapPlainLanguageAnswers(parsed.data.answers, now));
    return { ok: true, data: { clocks } };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: AUTH_ERR };

  // Refuse to double-start: if this incident already has clocks, don't insert a
  // duplicate set (there is no unique constraint at the DB level).
  const { data: existing } = await supabase
    .from("incident_regulatory_clocks")
    .select("id")
    .eq("incident_id", parsed.data.incidentId)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: false, error: "Reporting clocks have already been started for this incident." };
  }

  // Anchor deadlines to when the incident actually occurred (not button-press
  // time) so a clock started late correctly shows as approaching/overdue.
  const { data: inc } = await supabase
    .from("incidents")
    .select("occurred_at")
    .eq("id", parsed.data.incidentId)
    .eq("tenant_id", access.tenantId)
    .maybeSingle();
  const referenceTime = inc?.occurred_at ?? now;

  const facts = mapPlainLanguageAnswers(parsed.data.answers, referenceTime);
  const { clocks } = evaluateReportability(facts);

  if (clocks.length === 0) {
    return { ok: true, data: { clocks: [], message: "No regulatory reports are required based on these answers." } };
  }

  // Resolve rule_ids for the applicable (jurisdiction, event_type) pairs.
  const { data: rules } = await supabase
    .from("regulatory_reporting_rules")
    .select("id, jurisdiction, event_type");
  const ruleId = (jurisdiction: string, eventType: string) =>
    rules?.find((r) => r.jurisdiction === jurisdiction && r.event_type === eventType)?.id ?? null;

  const rows = clocks.map((c) => ({
    tenant_id: access.tenantId,
    incident_id: parsed.data.incidentId,
    rule_id: ruleId(c.jurisdiction, c.eventType),
    jurisdiction: c.jurisdiction,
    event_type: c.eventType,
    description: c.description,
    deadline_hours: c.deadlineHours,
    status: "running" as const,
    started_at: referenceTime,
    deadline_at: c.deadlineAt,
  }));

  const { data: inserted, error } = await supabase
    .from("incident_regulatory_clocks")
    .insert(rows)
    .select("id");
  if (error) return { ok: false, error: error.message };

  // Audit trail: one 'started' event per clock.
  if (inserted?.length) {
    await supabase.from("incident_regulatory_clock_events").insert(
      inserted.map((row) => ({
        tenant_id: access.tenantId,
        clock_id: row.id,
        event_type: "started" as const,
        actor_id: access.profileId,
        notes: "Reporting clock started from decision helper.",
      })),
    );
  }

  // Denormalized closure-gate flag.
  await supabase
    .from("incidents")
    .update({ has_open_regulatory_clocks: true, updated_at: now })
    .eq("id", parsed.data.incidentId)
    .eq("tenant_id", access.tenantId);

  revalidatePath(`/incidents/${parsed.data.incidentId}`);
  return { ok: true, data: { started: inserted?.length ?? 0 } };
}

// ── Record a regulator confirmation number ───────────────────────────────────────

const confirmSchema = z.object({
  clockId: z.string().uuid(),
  confirmationNumber: z.string().min(1, "Enter the confirmation number the agency gave you."),
});

export async function recordConfirmationNumber(input: unknown): Promise<ClockActionResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "A confirmation number is required.", issues: parsed.error.flatten() };
  }

  const access = await getIncidentReportingAccess();
  if (!access.authorized || !access.tenantId) return { ok: false, error: PERM_ERR };

  if (MOCK_MODE) return { ok: true };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: AUTH_ERR };

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("incident_regulatory_clocks")
    .update({
      status: "reported",
      confirmation_number: parsed.data.confirmationNumber,
      confirmation_entered_by: access.profileId,
      confirmation_entered_at: now,
      reported_at: now,
      updated_at: now,
    })
    .eq("id", parsed.data.clockId)
    .eq("tenant_id", access.tenantId)
    .select("incident_id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase.from("incident_regulatory_clock_events").insert({
    tenant_id: access.tenantId,
    clock_id: parsed.data.clockId,
    event_type: "reported",
    actor_id: access.profileId,
    notes: `Confirmation number recorded: ${parsed.data.confirmationNumber}`,
  });

  if (updated?.incident_id) await recomputeIncidentClockFlag(supabase, access.tenantId, updated.incident_id);
  return { ok: true };
}

// ── Mark a clock as not reportable, with a justification ──────────────────────────

const justifySchema = z.object({
  clockId: z.string().uuid(),
  justification: z.string().min(10, "Please give a short explanation (at least 10 characters)."),
});

export async function markNotReportableWithJustification(input: unknown): Promise<ClockActionResult> {
  const parsed = justifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "A short explanation is required.", issues: parsed.error.flatten() };
  }

  const access = await getIncidentReportingAccess();
  if (!access.authorized || !access.tenantId) return { ok: false, error: PERM_ERR };

  if (MOCK_MODE) return { ok: true };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: AUTH_ERR };

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("incident_regulatory_clocks")
    .update({
      status: "closed_no_report_required",
      justification_text: parsed.data.justification,
      updated_at: now,
    })
    .eq("id", parsed.data.clockId)
    .eq("tenant_id", access.tenantId)
    .select("incident_id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase.from("incident_regulatory_clock_events").insert({
    tenant_id: access.tenantId,
    clock_id: parsed.data.clockId,
    event_type: "overridden",
    actor_id: access.profileId,
    notes: `Marked not reportable: ${parsed.data.justification}`,
  });

  if (updated?.incident_id) await recomputeIncidentClockFlag(supabase, access.tenantId, updated.incident_id);
  return { ok: true };
}

// ── Closure guard ────────────────────────────────────────────────────────────────

export type OutstandingClock = {
  id: string;
  jurisdiction: string;
  description: string;
  deadlineAt: string;
  status: string;
};

export async function canCloseIncident(
  incidentId: string,
): Promise<{ canClose: boolean; outstandingClocks: OutstandingClock[] }> {
  if (MOCK_MODE) return { canClose: true, outstandingClocks: [] };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { canClose: true, outstandingClocks: [] };

  const { data } = await supabase
    .from("incident_regulatory_clocks")
    .select("id, jurisdiction, description, deadline_at, status")
    .eq("incident_id", incidentId)
    .in("status", OPEN_STATUSES as unknown as string[]);

  const outstandingClocks: OutstandingClock[] = (data ?? []).map((c) => ({
    id: c.id,
    jurisdiction: c.jurisdiction,
    description: c.description,
    deadlineAt: c.deadline_at,
    status: c.status,
  }));

  return { canClose: outstandingClocks.length === 0, outstandingClocks };
}

// ── Escalation (cron-invoked; service-role, iterates all tenants) ─────────────────

/**
 * Advance every open clock to its threshold status (amber 75% / red 90% /
 * overdue 100%), log an 'escalated' audit event when the band changes, and return
 * the plain-language notification payloads. Invoked by the ops cron; also callable
 * on demand by a manager. Uses the service-role client (bypasses RLS).
 */
export async function escalateOverdueClocks(): Promise<{
  ok: boolean;
  escalated: number;
  notifications: string[];
  error?: string;
}> {
  if (MOCK_MODE) return { ok: false, escalated: 0, notifications: [], error: "Not available in demo mode." };

  // Role-gate: this uses the service-role client (bypasses RLS) and returns
  // cross-tenant clock text, so it must not be callable by an unauthorized user.
  // A future cron route should authenticate via CRON_SECRET instead of a session.
  const access = await getIncidentReportingAccess();
  if (!access.authorized) return { ok: false, escalated: 0, notifications: [], error: PERM_ERR };

  const db = createServiceRoleClient();
  if (!db) return { ok: false, escalated: 0, notifications: [], error: "Service role not configured." };

  const { data: open, error } = await db
    .from("incident_regulatory_clocks")
    .select("id, tenant_id, description, started_at, deadline_at, status")
    .in("status", ["running", "escalated_amber", "escalated_red"]);
  if (error) return { ok: false, escalated: 0, notifications: [], error: error.message };

  const now = new Date();
  const notifications: string[] = [];
  let escalated = 0;

  for (const c of open ?? []) {
    const next = statusForElapsed(c.started_at, c.deadline_at, now);
    if (next === c.status) continue; // band unchanged

    await db
      .from("incident_regulatory_clocks")
      .update({ status: next, updated_at: now.toISOString() })
      .eq("id", c.id);

    const hrs = hoursRemaining(c.deadline_at, now);
    const message = buildEscalationMessage({ description: c.description, hoursRemaining: hrs, status: next });
    notifications.push(message);

    await db.from("incident_regulatory_clock_events").insert({
      tenant_id: c.tenant_id,
      clock_id: c.id,
      event_type: next === "overdue" ? "escalated" : "notified",
      actor_id: null,
      notes: message,
    });
    escalated += 1;
  }

  return { ok: true, escalated, notifications };
}

// ── internal ─────────────────────────────────────────────────────────────────────

async function recomputeIncidentClockFlag(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  tenantId: string,
  incidentId: string,
): Promise<void> {
  const { count } = await supabase
    .from("incident_regulatory_clocks")
    .select("id", { count: "exact", head: true })
    .eq("incident_id", incidentId)
    .in("status", OPEN_STATUSES as unknown as string[]);
  await supabase
    .from("incidents")
    .update({ has_open_regulatory_clocks: (count ?? 0) > 0, updated_at: new Date().toISOString() })
    .eq("id", incidentId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/incidents/${incidentId}`);
}

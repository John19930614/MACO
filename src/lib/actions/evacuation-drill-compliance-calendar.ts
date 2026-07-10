"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverSecrets, MOCK_MODE } from "@/lib/env";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import { resolveCallerRole } from "@/lib/auth/resolve-role";
import { COORDINATOR_ROLES, MANAGER_ROLES } from "@/lib/constants";
import {
  DRILL_EVENT_TYPES,
  buildCalendarEvents,
  evaluateDrillRecord,
  type Shift,
} from "@/lib/drill-compliance/helpers";

const DRILL_PATH = "/emergency/drill-calendar";

// Service-role client for tenant-checked writes (mirrors waste-generator-category.ts).
// Every write is guarded by an explicit tenant match on the target site.
function svc() {
  const { serviceRoleKey } = serverSecrets();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Confirm a site belongs to the caller's tenant before any write touches it.
async function assertSite(db: ReturnType<typeof svc>, siteId: string, tenantId: string) {
  const { data } = await db
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("tenant_id", tenantId)
    .single();
  return !!data;
}

const eventTypeSchema = z.enum(
  DRILL_EVENT_TYPES as unknown as [string, ...string[]],
);

// ── Schemas ───────────────────────────────────────────────────────────────────

const facilityProfileSchema = z.object({
  siteId: z.string().uuid(),
  ahj: z.string().max(200).optional(),
  occupancyClassification: z.string().max(200).optional(),
  shifts: z
    .array(z.object({ id: z.string().min(1), name: z.string().min(1) }))
    .default([]),
  highHazardOps: z.boolean().default(false),
  hazmatInventory: z
    .array(z.object({ material: z.string().min(1), quantity: z.number().nonnegative() }))
    .default([]),
  generatorCategory: z.string().max(50).optional(),
  alarmSuppressionSystems: z.array(z.string().min(1)).default([]),
  notes: z.string().max(2000).optional(),
});

const frequencyRequirementSchema = z.object({
  siteId: z.string().uuid(),
  eventType: eventTypeSchema,
  requiredFrequency: z.string().min(1),
  legalSource: z.string().min(1),
  companyRequiredFrequency: z.string().min(1).optional(),
  perShift: z.boolean().default(false),
});

const drillRecordSchema = z.object({
  siteId: z.string().uuid(),
  calendarEventId: z.string().uuid().optional(),
  eventType: eventTypeSchema,
  drillDate: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  participants: z.array(z.string()).default([]),
  contractorsVisitorsPresent: z.array(z.string()).default([]),
  alarmMethod: z.string().min(1),
  evacuationTimeSeconds: z.number().int().nonnegative().optional(),
  assemblyTimeSeconds: z.number().int().nonnegative().optional(),
  accountabilityTimeSeconds: z.number().int().nonnegative().optional(),
  blockedRoutes: z.array(z.string()).default([]),
  equipmentPerformance: z
    .array(z.object({ item: z.string().min(1), status: z.string().min(1) }))
    .default([]),
  wardens: z.array(z.string()).default([]),
  observers: z.array(z.string()).default([]),
  problemsNoted: z.string().max(4000).optional(),
  evidenceUrls: z.array(z.string().url()).default([]),
  correctiveActions: z
    .array(
      z.object({
        description: z.string().min(1),
        owner: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .default([]),
  planRevisionDate: z.string().optional(),
  retrainingDate: z.string().optional(),
  result: z.enum(["passed", "failed", "incomplete"]),
  realEmergencyTriggered: z.boolean().default(false),
});

export type FacilityProfileInput = z.infer<typeof facilityProfileSchema>;
export type FrequencyRequirementInput = z.infer<typeof frequencyRequirementSchema>;
export type DrillRecordInput = z.infer<typeof drillRecordSchema>;

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

const MOCK_ERR = "Managing drill compliance requires a live database (not available in demo mode).";
const AUTH_ERR = "Not authenticated";
const FIELD_ERR = "Please check the highlighted fields.";
const PERM_ERR = "You don't have permission to manage drill compliance.";
const SITE_ERR = "Site not found for this tenant";

// ── Facility profile ──────────────────────────────────────────────────────────

export async function createOrUpdateFacilityProfile(
  input: FacilityProfileInput,
): Promise<Result<{ id: string }>> {
  if (MOCK_MODE) return { ok: false, error: MOCK_ERR };

  const role = await resolveCallerRole();
  if (!role || !MANAGER_ROLES.includes(role)) return { ok: false, error: PERM_ERR };

  const parsed = facilityProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERR };
  const data = parsed.data;

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: AUTH_ERR };
  const profileId = await getServerProfileId();

  const db = svc();
  if (!(await assertSite(db, data.siteId, tenantId))) return { ok: false, error: SITE_ERR };

  const nowIso = new Date().toISOString();
  const { data: row, error } = await db
    .from("facility_profiles")
    .upsert(
      {
        tenant_id: tenantId,
        site_id: data.siteId,
        ahj: data.ahj ?? null,
        occupancy_classification: data.occupancyClassification ?? null,
        shifts: data.shifts,
        high_hazard_ops: data.highHazardOps,
        hazmat_inventory: data.hazmatInventory,
        generator_category: data.generatorCategory ?? null,
        alarm_suppression_systems: data.alarmSuppressionSystems,
        notes: data.notes ?? null,
        created_by: profileId,
        updated_at: nowIso,
      },
      { onConflict: "site_id" },
    )
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? "Could not save the facility profile." };

  revalidatePath(DRILL_PATH);
  return { ok: true, id: row.id };
}

// ── Frequency requirement ─────────────────────────────────────────────────────

export async function setDrillFrequencyRequirement(
  input: FrequencyRequirementInput,
): Promise<Result<{ id: string }>> {
  if (MOCK_MODE) return { ok: false, error: MOCK_ERR };

  const role = await resolveCallerRole();
  if (!role || !MANAGER_ROLES.includes(role)) return { ok: false, error: PERM_ERR };

  const parsed = frequencyRequirementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERR };
  const data = parsed.data;

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: AUTH_ERR };
  const profileId = await getServerProfileId();

  const db = svc();
  if (!(await assertSite(db, data.siteId, tenantId))) return { ok: false, error: SITE_ERR };

  const { data: row, error } = await db
    .from("drill_frequency_requirements")
    .upsert(
      {
        tenant_id: tenantId,
        site_id: data.siteId,
        event_type: data.eventType,
        required_frequency: data.requiredFrequency,
        legal_source: data.legalSource,
        company_required_frequency: data.companyRequiredFrequency ?? null,
        per_shift: data.perShift,
        created_by: profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,event_type" },
    )
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? "Could not save the requirement." };

  revalidatePath(DRILL_PATH);
  return { ok: true, id: row.id };
}

// ── Calendar generation ───────────────────────────────────────────────────────

/**
 * Generate upcoming drill occurrences for a site from its frequency
 * requirements — per occupancy/jurisdiction cadence and, where per_shift is set,
 * one per shift. Never hard-codes an annual drill. Regenerates the site's
 * outstanding (scheduled) calendar, leaving completed/overdue history intact.
 */
export async function generateDrillCalendar(
  siteId: string,
): Promise<Result<{ count: number }>> {
  if (MOCK_MODE) return { ok: false, error: MOCK_ERR };

  const role = await resolveCallerRole();
  if (!role || !COORDINATOR_ROLES.includes(role)) return { ok: false, error: PERM_ERR };

  if (!z.string().uuid().safeParse(siteId).success) return { ok: false, error: FIELD_ERR };

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: AUTH_ERR };

  const db = svc();
  if (!(await assertSite(db, siteId, tenantId))) return { ok: false, error: SITE_ERR };

  const [{ data: reqs, error: reqErr }, { data: profile }] = await Promise.all([
    db
      .from("drill_frequency_requirements")
      .select("event_type, required_frequency, company_required_frequency, per_shift, active")
      .eq("tenant_id", tenantId)
      .eq("site_id", siteId),
    db
      .from("facility_profiles")
      .select("shifts")
      .eq("tenant_id", tenantId)
      .eq("site_id", siteId)
      .maybeSingle(),
  ]);
  if (reqErr) return { ok: false, error: reqErr.message };

  const shifts = (profile?.shifts as Shift[] | undefined) ?? [];
  const generated = buildCalendarEvents(reqs ?? [], shifts);

  if (generated.length === 0) {
    return { ok: false, error: "Add at least one drill frequency requirement before generating the calendar." };
  }

  // Clear outstanding scheduled events, then reinsert the fresh set.
  await db
    .from("drill_calendar_events")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("site_id", siteId)
    .eq("status", "scheduled");

  const rows = generated.map((e) => ({
    tenant_id: tenantId,
    site_id: siteId,
    event_type: e.event_type,
    shift_id: e.shift_id,
    shift_name: e.shift_name,
    scheduled_date: e.scheduled_date,
    due_date: e.due_date,
    effective_frequency: e.effective_frequency,
    status: "scheduled" as const,
  }));

  const { error } = await db.from("drill_calendar_events").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath(DRILL_PATH);
  return { ok: true, count: rows.length };
}

// ── Record a drill ────────────────────────────────────────────────────────────

export async function recordDrill(
  input: DrillRecordInput,
): Promise<
  Result<{ id: string; missingWardens: boolean; rosterMismatch: boolean; eapReviewRequired: boolean }>
> {
  if (MOCK_MODE) return { ok: false, error: MOCK_ERR };

  const role = await resolveCallerRole();
  if (!role || !COORDINATOR_ROLES.includes(role)) return { ok: false, error: PERM_ERR };

  const parsed = drillRecordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERR };
  const d = parsed.data;

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: AUTH_ERR };
  const profileId = await getServerProfileId();

  const db = svc();
  if (!(await assertSite(db, d.siteId, tenantId))) return { ok: false, error: SITE_ERR };

  const evalResult = evaluateDrillRecord({
    participants: d.participants,
    wardens: d.wardens,
    accountabilityTimeSeconds: d.accountabilityTimeSeconds,
    result: d.result,
    realEmergencyTriggered: d.realEmergencyTriggered,
  });

  const nowIso = new Date().toISOString();
  const { data: record, error } = await db
    .from("drill_records")
    .insert({
      tenant_id: tenantId,
      site_id: d.siteId,
      calendar_event_id: d.calendarEventId ?? null,
      event_type: d.eventType,
      drill_date: d.drillDate,
      start_time: d.startTime ?? null,
      end_time: d.endTime ?? null,
      participants: d.participants,
      contractors_visitors_present: d.contractorsVisitorsPresent,
      alarm_method: d.alarmMethod,
      evacuation_time_seconds: d.evacuationTimeSeconds ?? null,
      assembly_time_seconds: d.assemblyTimeSeconds ?? null,
      accountability_time_seconds: d.accountabilityTimeSeconds ?? null,
      blocked_routes: d.blockedRoutes,
      equipment_performance: d.equipmentPerformance,
      wardens: d.wardens,
      observers: d.observers,
      problems_noted: d.problemsNoted ?? null,
      evidence_urls: d.evidenceUrls,
      corrective_actions: d.correctiveActions,
      plan_revision_date: d.planRevisionDate ?? null,
      retraining_date: d.retrainingDate ?? null,
      result: d.result,
      real_emergency_triggered: d.realEmergencyTriggered,
      eap_review_required: evalResult.eapReviewRequired,
      created_by: profileId,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (error || !record) return { ok: false, error: error?.message ?? "Could not save the drill record." };

  const drillId = record.id as string;

  // Mark the originating calendar event completed.
  if (d.calendarEventId) {
    await db
      .from("drill_calendar_events")
      .update({ status: "completed", updated_at: nowIso })
      .eq("id", d.calendarEventId)
      .eq("tenant_id", tenantId);
  }

  // Raise alerts for missing warden / roster-accountability mismatch / failed drill.
  const actions: Array<{ action_type: string; severity: string; details: Record<string, unknown> }> = [];
  if (evalResult.missingWardens)
    actions.push({ action_type: "missing_warden", severity: "high", details: { eventType: d.eventType } });
  if (evalResult.rosterMismatch)
    actions.push({
      action_type: "roster_accountability_mismatch",
      severity: "high",
      details: { participants: d.participants.length },
    });
  if (d.result === "failed")
    actions.push({ action_type: "failed_drill", severity: "critical", details: { eventType: d.eventType } });

  if (actions.length > 0) {
    await db.from("drill_compliance_action").insert(
      actions.map((a) => ({
        tenant_id: tenantId,
        site_id: d.siteId,
        action_type: a.action_type,
        severity: a.severity,
        details: a.details,
        reference_id: drillId,
      })),
    );
  }

  // Corrective actions → CAPA records (public.capa_records, matching minor-injury-escalation.ts).
  let capaId: string | null = null;
  for (const action of d.correctiveActions) {
    const { data: capa } = await db
      .from("capa_records")
      .insert({
        tenant_id: tenantId,
        site_id: d.siteId,
        title: `Drill corrective action — ${d.eventType}`,
        description: action.description,
        kind: "corrective",
        source_type: "drill_record",
        source_id: drillId,
        severity: d.result === "failed" ? "high" : "medium",
        status: "open",
      })
      .select("id")
      .single();
    if (capa && !capaId) capaId = (capa as { id: string }).id;
  }
  if (capaId) {
    await db.from("drill_records").update({ capa_id: capaId }).eq("id", drillId).eq("tenant_id", tenantId);
  }

  // Failed drill or real emergency → raise an EAP review flag (does not touch the EAP module).
  if (evalResult.eapReviewRequired && evalResult.eapReviewReason) {
    await db.from("eap_review_flag").insert({
      tenant_id: tenantId,
      site_id: d.siteId,
      reason: evalResult.eapReviewReason,
      source_drill_id: drillId,
      status: "pending",
    });
    await db.from("drill_compliance_action").insert({
      tenant_id: tenantId,
      site_id: d.siteId,
      action_type: "eap_review_required",
      severity: "high",
      details: { reason: evalResult.eapReviewReason },
      reference_id: drillId,
    });
  }

  revalidatePath(DRILL_PATH);
  revalidatePath("/emergency");
  return {
    ok: true,
    id: drillId,
    missingWardens: evalResult.missingWardens,
    rosterMismatch: evalResult.rosterMismatch,
    eapReviewRequired: evalResult.eapReviewRequired,
  };
}

// ── Overdue escalation (cron-callable) ────────────────────────────────────────

/**
 * Flip past-due scheduled drills to 'overdue' and log a critical action for each.
 * Intended to be invoked by the ops cron as well as on-demand by managers.
 */
export async function escalateOverdueDrills(): Promise<Result<{ escalated: number }>> {
  if (MOCK_MODE) return { ok: false, error: MOCK_ERR };

  const role = await resolveCallerRole();
  if (!role || !COORDINATOR_ROLES.includes(role)) return { ok: false, error: PERM_ERR };

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: AUTH_ERR };

  const db = svc();
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdue, error } = await db
    .from("drill_calendar_events")
    .select("id, site_id")
    .eq("tenant_id", tenantId)
    .eq("status", "scheduled")
    .lt("due_date", today);
  if (error) return { ok: false, error: error.message };

  for (const ev of overdue ?? []) {
    await db
      .from("drill_calendar_events")
      .update({ status: "overdue", updated_at: new Date().toISOString() })
      .eq("id", ev.id)
      .eq("tenant_id", tenantId);
    await db.from("drill_compliance_action").insert({
      tenant_id: tenantId,
      site_id: ev.site_id,
      action_type: "overdue_drill",
      severity: "critical",
      details: {},
      reference_id: ev.id,
    });
  }

  revalidatePath(DRILL_PATH);
  return { ok: true, escalated: overdue?.length ?? 0 };
}

// ── Warden assignment ─────────────────────────────────────────────────────────

const assignWardenSchema = z.object({
  siteId: z.string().uuid(),
  profileId: z.string().uuid(),
  shiftId: z.string().min(1).nullable().optional(),
  role: z.string().min(1).default("warden"),
});

export async function assignWarden(
  input: z.infer<typeof assignWardenSchema>,
): Promise<Result<{ id: string }>> {
  if (MOCK_MODE) return { ok: false, error: MOCK_ERR };

  const role = await resolveCallerRole();
  if (!role || !COORDINATOR_ROLES.includes(role)) return { ok: false, error: PERM_ERR };

  const parsed = assignWardenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: FIELD_ERR };
  const data = parsed.data;

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: AUTH_ERR };
  const actorId = await getServerProfileId();

  const db = svc();
  if (!(await assertSite(db, data.siteId, tenantId))) return { ok: false, error: SITE_ERR };

  const { data: row, error } = await db
    .from("drill_wardens")
    .upsert(
      {
        tenant_id: tenantId,
        site_id: data.siteId,
        shift_id: data.shiftId ?? null,
        profile_id: data.profileId,
        role: data.role,
        active: true,
        created_by: actorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,shift_id,profile_id,role" },
    )
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? "Could not assign the warden." };

  revalidatePath(DRILL_PATH);
  return { ok: true, id: row.id };
}

export async function removeWarden(wardenId: string): Promise<VoidResult> {
  if (MOCK_MODE) return { ok: false, error: MOCK_ERR };

  const role = await resolveCallerRole();
  if (!role || !COORDINATOR_ROLES.includes(role)) return { ok: false, error: PERM_ERR };

  if (!z.string().uuid().safeParse(wardenId).success) return { ok: false, error: FIELD_ERR };

  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: AUTH_ERR };

  const db = svc();
  const { error } = await db
    .from("drill_wardens")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", wardenId)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(DRILL_PATH);
  return { ok: true };
}

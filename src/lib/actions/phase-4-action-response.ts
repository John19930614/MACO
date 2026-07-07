"use server";

// ============================================================
// Phase 4 — Action & Response for the Predictive Risk Engine.
//
// "Closes the loop" on Phase 1's site_risk_scores + Phase 3's read-only trigger
// logic — SAFELY and human-in-the-loop:
//
//   • evaluateRiskEscalation(siteRiskScoreId)
//       If the score is in the 'red' band, idempotently create ONE
//       risk_escalations row (status 'needs_review') + a DRAFT capa_records row
//       (source_type 'risk_score_escalation', source_id = the score id). Sends
//       NO notification. Below Red → a "no escalation needed" no-op.
//   • getEscalationQueue()
//       The manager-facing review queue: pending escalations joined with the
//       draft corrective task + site name, plus pending/confirmed/dismissed counts.
//   • confirmEscalation({ escalationId, recipients, description })
//       The EXPLICIT human action. Saves the manager's edited corrective-task
//       text, stamps reviewed_by/reviewed_at, and only THEN marks the in-app
//       notification sent (notification_sent_at + notified_recipient).
//   • dismissEscalation(escalationId)
//       Closes the escalation + its draft CAPA with NO notification.
//   • getEscalationNavSummary()
//       Non-throwing helper for the app shell: pending count (nav badge) +
//       confirmed escalations to surface as in-app notifications.
//
// SCOPE GUARDRAIL: real paging (SMS / phone / on-call) is OUT OF SCOPE and stays
// disabled — PAGING_ENABLED (src/lib/predictive-risk-engine/paging.ts) is false
// and there is no external dispatcher wired anywhere. confirmEscalation delivers
// an IN-APP notification only. Do not add an external send path here without
// Phase 5 validation + written EHS-lead sign-off.
//
// Role mapping (this codebase has no "ehs_lead"/"superadmin" role strings):
//   "EHS lead"   → canManage() (safety_manager | ehs_manager | admin)
//   "superadmin" → isSuperadmin() (Reliance user, tenant_id IS NULL)
// — the same tier Phase 1's go-live gate and Phase 3's AI agent use.
//
// Every DB path uses the service-role client and enforces tenant ownership in
// this layer (assertTenantOwnership), because service-role bypasses RLS. Under
// MOCK_MODE there is no Supabase, so DB-backed actions degrade gracefully.
// ============================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getServerUser,
  getServerProfileId,
  getEffectiveTenantId,
  isSuperadmin,
  assertTenantOwnership,
  TenantMismatchError,
  NIL_UUID,
} from "@/lib/auth/session";
import { canManage, type Role } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_PROFILES_ALL } from "@/lib/data/mock";
import { PAGING_ENABLED } from "@/lib/predictive-risk-engine/paging";
import type { EscalationStatus } from "@/lib/types";

// ── Auth helpers (mirror phase-3-ai-agent.ts) ───────────────────────────────
// getServerUser() returns null under MOCK_MODE, so gating on it alone would
// reject every demo caller — resolve the mock EHS-data identity instead.
async function resolveCallerRole(): Promise<Role | null> {
  if (MOCK_MODE) {
    const profileId = await getServerProfileId();
    return (MOCK_PROFILES_ALL.find((p) => p.id === profileId)?.role as Role) ?? null;
  }
  const user = await getServerUser();
  return (user?.role as Role) ?? null;
}

async function isManagerOrSuperadmin(): Promise<boolean> {
  if (await isSuperadmin()) return true;
  const role = await resolveCallerRole();
  return !!role && canManage(role);
}

// The read queue + confirm/dismiss actions are reachable from the UI, so they
// THROW on an unauthorized caller (the review page catches it and renders an
// access notice; the client card surfaces a friendly retry message).
async function requireManagerOrAdmin(): Promise<{ profileId: string }> {
  if (!(await isManagerOrSuperadmin())) {
    throw new Error("Not authorized — only an EHS manager, admin, or Reliance superadmin can review high-risk-site escalations.");
  }
  return { profileId: await getServerProfileId() };
}

// Non-superadmins may only touch their own tenant's rows. Returns true if the
// caller is allowed to act on `tenantId`.
async function ownsOrSuperadmin(tenantId: string): Promise<boolean> {
  if (await isSuperadmin()) return true;
  try {
    await assertTenantOwnership(tenantId);
    return true;
  } catch (e) {
    if (e instanceof TenantMismatchError) return false;
    throw e;
  }
}

// ── Plain-English copy (reused by docs/support/training) ────────────────────
const DEFAULT_RECIPIENT_LABEL = "Site EHS team";

function draftCorrectiveTaskText(siteName: string, reasonPlainText: string): string {
  return (
    `${siteName} has crossed into high-risk territory (Red). ${reasonPlainText}\n\n` +
    `Suggested next steps (edit before you confirm): review the site with the ` +
    `superintendent, close out the overdue items driving the score, and record ` +
    `what was done. This task was drafted automatically from a risk alert — an ` +
    `EHS manager should tailor it to the site before notifying the team.`
  );
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface EscalationQueueItem {
  id: string;
  siteName: string;
  reasonPlainText: string;
  draftCapaDescription: string;
  capaId: string | null;
  status: EscalationStatus;
  recipients: string[];
}
export interface EscalationQueueResult {
  items: EscalationQueueItem[]; // pending (needs_review) only
  counts: { pending: number; confirmed: number; dismissed: number };
}
export interface EscalationNavSummary {
  pending: number;
  confirmed: { id: string; siteName: string; notifiedAt: string }[];
}

// ── 1. Evaluate (idempotent; NEVER notifies) ────────────────────────────────
const scoreIdSchema = z.object({ siteRiskScoreId: z.string().uuid() });

export async function evaluateRiskEscalation(siteRiskScoreId: string) {
  const parsed = scoreIdSchema.safeParse({ siteRiskScoreId });
  if (!parsed.success) return { ok: false as const, error: "Please provide a valid risk score." };

  if (!(await isManagerOrSuperadmin())) {
    return { ok: false as const, error: "Only an EHS manager, admin, or Reliance superadmin can evaluate escalations." };
  }

  const client = createServiceRoleClient();
  // MOCK_MODE / no Supabase → nothing durable to read or write.
  if (!client) return { ok: true as const, created: false as const, reason: "mock" as const };

  const { data: score, error: scoreErr } = await client
    .from("site_risk_scores")
    .select("id, tenant_id, site_id, band_key, explanation_text")
    .eq("id", siteRiskScoreId)
    .maybeSingle();
  if (scoreErr) return { ok: false as const, error: "Couldn't load that risk score. Please try again." };
  if (!score) return { ok: false as const, error: "That risk score could not be found." };

  const row = score as {
    id: string; tenant_id: string; site_id: string; band_key: string; explanation_text: string;
  };

  if (!(await ownsOrSuperadmin(row.tenant_id))) {
    return { ok: false as const, error: "You can only evaluate sites in your own account." };
  }

  // Phase 3's Red threshold, read from the authoritative persisted band. Below
  // Red → no escalation needed (the plain-English no-op path).
  if (row.band_key !== "red") {
    return { ok: true as const, created: false as const, reason: "no_escalation_needed" as const };
  }

  // Idempotency: one escalation per triggering score row. Insert the escalation
  // FIRST so the unique index (site_risk_score_id) is the single source of truth
  // — this avoids racing two callers into two draft CAPAs.
  const { data: existing } = await client
    .from("risk_escalations")
    .select("id")
    .eq("site_risk_score_id", row.id)
    .maybeSingle();
  if (existing) {
    return { ok: true as const, created: false as const, reason: "already_exists" as const, escalationId: (existing as { id: string }).id };
  }

  const { data: site } = await client
    .from("sites")
    .select("name, safety_lead")
    .eq("id", row.site_id)
    .maybeSingle();
  const siteName = (site as { name?: string } | null)?.name ?? "This site";
  const safetyLead = (site as { safety_lead?: string | null } | null)?.safety_lead ?? null;
  const recipients = safetyLead ? [safetyLead] : [DEFAULT_RECIPIENT_LABEL];

  const { data: escInsert, error: escErr } = await client
    .from("risk_escalations")
    .insert({
      tenant_id: row.tenant_id,
      site_id: row.site_id,
      site_risk_score_id: row.id,
      status: "needs_review",
      reason_plain_text: row.explanation_text,
      recipients,
    })
    .select("id")
    .single();
  if (escErr || !escInsert) {
    // A concurrent caller may have won the unique index — treat as a no-op.
    return { ok: true as const, created: false as const, reason: "already_exists" as const };
  }
  const escalationId = (escInsert as { id: string }).id;

  // Draft corrective task (CAPA). status 'open' is the only in-scope lifecycle
  // value (there is no 'draft' CapaStatus); "needs review" is carried by the
  // escalation, not the CAPA. due_date is +7d so it does NOT show as overdue
  // (and therefore does NOT generate a notification before human confirmation).
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: capaInsert } = await client
    .from("capa_records")
    .insert({
      tenant_id: row.tenant_id,
      site_id: row.site_id,
      title: `Corrective task: reduce risk at ${siteName}`,
      description: draftCorrectiveTaskText(siteName, row.explanation_text),
      kind: "corrective",
      source_type: "risk_score_escalation",
      source_id: row.id,
      severity: "critical",
      status: "open",
      due_date: dueDate,
    })
    .select("id")
    .single();

  const capaId = (capaInsert as { id: string } | null)?.id ?? null;
  if (capaId) {
    await client.from("risk_escalations").update({ capa_record_id: capaId }).eq("id", escalationId);
  }

  return { ok: true as const, created: true as const, reason: "red" as const, escalationId, capaId };
}

// ── 2. Review queue (manager-gated; THROWS if unauthorized) ─────────────────
export async function getEscalationQueue(): Promise<EscalationQueueResult> {
  await requireManagerOrAdmin();

  const empty: EscalationQueueResult = { items: [], counts: { pending: 0, confirmed: 0, dismissed: 0 } };

  const client = createServiceRoleClient();
  if (!client) return empty; // MOCK_MODE / demo — queue is empty (no persisted scores)

  const superadmin = await isSuperadmin();
  const tenantId = await getEffectiveTenantId();
  if (!superadmin && tenantId === NIL_UUID) return empty;

  let query = client
    .from("risk_escalations")
    .select("id, status, reason_plain_text, recipients, capa_record_id, sites(name), capa_records(description)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!superadmin) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  if (error || !data) return empty;

  const rel = (v: unknown): string | undefined => {
    if (Array.isArray(v)) return (v[0] as { name?: string; description?: string })?.name ?? (v[0] as { description?: string })?.description;
    return (v as { name?: string; description?: string } | null)?.name ?? (v as { description?: string } | null)?.description;
  };

  const counts = { pending: 0, confirmed: 0, dismissed: 0 };
  const items: EscalationQueueItem[] = [];
  for (const r of data as Array<Record<string, unknown>>) {
    const status = r.status as EscalationStatus;
    if (status === "needs_review") counts.pending += 1;
    else if (status === "confirmed") counts.confirmed += 1;
    else if (status === "dismissed") counts.dismissed += 1;

    if (status !== "needs_review") continue;
    const draft = rel(r.capa_records) ?? (r.reason_plain_text as string);
    items.push({
      id: r.id as string,
      siteName: rel(r.sites) ?? "Unknown site",
      reasonPlainText: (r.reason_plain_text as string) ?? "",
      draftCapaDescription: draft,
      capaId: (r.capa_record_id as string | null) ?? null,
      status,
      recipients: Array.isArray(r.recipients) ? (r.recipients as string[]) : [],
    });
  }

  return { items, counts };
}

// ── 3. Confirm (EXPLICIT human action; in-app notification ONLY) ────────────
const confirmSchema = z.object({
  escalationId: z.string().uuid(),
  recipients: z.array(z.string()).min(1),
  description: z.string().min(1).optional(),
});
export type ConfirmEscalationInput = z.infer<typeof confirmSchema>;

export async function confirmEscalation(input: ConfirmEscalationInput) {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please check the recipients and try again." };
  const { profileId } = await requireManagerOrAdmin();

  const client = createServiceRoleClient();
  if (!client) {
    return { ok: false as const, error: "Sending notifications runs on a connected environment, not in demo mode." };
  }

  const { data: esc, error } = await client
    .from("risk_escalations")
    .select("id, tenant_id, status, capa_record_id")
    .eq("id", parsed.data.escalationId)
    .maybeSingle();
  if (error) return { ok: false as const, error: "Couldn't load this alert. Please try again." };
  if (!esc) return { ok: false as const, error: "That alert could not be found." };
  const row = esc as { id: string; tenant_id: string; status: EscalationStatus; capa_record_id: string | null };

  if (!(await ownsOrSuperadmin(row.tenant_id))) {
    return { ok: false as const, error: "You can only act on alerts in your own account." };
  }
  if (row.status !== "needs_review") {
    return { ok: false as const, error: "This alert has already been reviewed." };
  }

  // Save the manager's edited corrective-task text before notifying.
  if (parsed.data.description && row.capa_record_id) {
    await client
      .from("capa_records")
      .update({ description: parsed.data.description, updated_at: new Date().toISOString() })
      .eq("id", row.capa_record_id);
  }

  const nowIso = new Date().toISOString();
  const notifiedRecipient = parsed.data.recipients.join(", ");

  // IN-APP notification only. PAGING_ENABLED is false and there is no external
  // dispatcher — the recipients list is recorded for the audit trail and shown
  // in the app; no SMS/phone/on-call send occurs regardless of what's passed in.
  if (PAGING_ENABLED) {
    // Intentionally unreachable in Phase 4. A future phase would dispatch here
    // ONLY after Phase 5 validation + written EHS-lead sign-off.
  }

  const { error: updErr } = await client
    .from("risk_escalations")
    .update({
      status: "confirmed",
      reviewed_by: profileId,
      reviewed_at: nowIso,
      notification_sent_at: nowIso,
      notified_recipient: notifiedRecipient,
    })
    .eq("id", row.id);
  if (updErr) return { ok: false as const, error: "Something went wrong sending this alert. Please try again." };

  revalidatePath("/risk-escalations");
  return { ok: true as const, notifiedRecipient, notificationSentAt: nowIso };
}

// ── 4. Dismiss (no notification; audited via the escalation row) ────────────
const dismissSchema = z.object({ escalationId: z.string().uuid() });

export async function dismissEscalation(escalationId: string) {
  const parsed = dismissSchema.safeParse({ escalationId });
  if (!parsed.success) return { ok: false as const, error: "Please provide a valid alert." };
  const { profileId } = await requireManagerOrAdmin();

  const client = createServiceRoleClient();
  if (!client) {
    return { ok: false as const, error: "Dismissing alerts runs on a connected environment, not in demo mode." };
  }

  const { data: esc, error } = await client
    .from("risk_escalations")
    .select("id, tenant_id, status, capa_record_id")
    .eq("id", escalationId)
    .maybeSingle();
  if (error) return { ok: false as const, error: "Couldn't load this alert. Please try again." };
  if (!esc) return { ok: false as const, error: "That alert could not be found." };
  const row = esc as { id: string; tenant_id: string; status: EscalationStatus; capa_record_id: string | null };

  if (!(await ownsOrSuperadmin(row.tenant_id))) {
    return { ok: false as const, error: "You can only act on alerts in your own account." };
  }
  if (row.status !== "needs_review") {
    return { ok: false as const, error: "This alert has already been reviewed." };
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await client
    .from("risk_escalations")
    .update({ status: "dismissed", reviewed_by: profileId, reviewed_at: nowIso })
    .eq("id", row.id);
  if (updErr) return { ok: false as const, error: "Couldn't dismiss this alert. Please try again." };

  // Close the never-approved draft CAPA so it doesn't linger as an open task.
  if (row.capa_record_id) {
    await client
      .from("capa_records")
      .update({
        status: "closed",
        closure_note: "Dismissed — risk reviewed, no corrective action taken.",
        closed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", row.capa_record_id);
  }

  revalidatePath("/risk-escalations");
  return { ok: true as const };
}

// ── 5. App-shell summary (NON-throwing; safe for every user/role) ───────────
// Used by the (app) layout for the nav badge + in-app notification feed. Returns
// empty for non-managers / mock / superadmins-without-tenant rather than throwing,
// because the layout renders for every authenticated user.
export async function getEscalationNavSummary(): Promise<EscalationNavSummary> {
  const empty: EscalationNavSummary = { pending: 0, confirmed: [] };
  if (!(await isManagerOrSuperadmin())) return empty;

  const client = createServiceRoleClient();
  if (!client) return empty;

  const superadmin = await isSuperadmin();
  const tenantId = await getEffectiveTenantId();
  if (!superadmin && tenantId === NIL_UUID) return empty;

  let query = client
    .from("risk_escalations")
    .select("id, status, notification_sent_at, sites(name)")
    .order("notification_sent_at", { ascending: false })
    .limit(200);
  if (!superadmin) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  if (error || !data) return empty;

  const siteName = (v: unknown): string => {
    if (Array.isArray(v)) return (v[0] as { name?: string })?.name ?? "A site";
    return (v as { name?: string } | null)?.name ?? "A site";
  };

  let pending = 0;
  const confirmed: EscalationNavSummary["confirmed"] = [];
  for (const r of data as Array<Record<string, unknown>>) {
    if (r.status === "needs_review") pending += 1;
    else if (r.status === "confirmed" && r.notification_sent_at && confirmed.length < 5) {
      confirmed.push({ id: r.id as string, siteName: siteName(r.sites), notifiedAt: r.notification_sent_at as string });
    }
  }
  return { pending, confirmed };
}

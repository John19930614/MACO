import "server-only";
import { cache } from "react";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Subscription, SupportTicket, Guardrail, GlobalLegalItem, ImportJob,
  TenantSummary, TenantDetail, Profile, SaTemplate,
} from "@/lib/types";

// Platform-admin (Reliance superadmin) data layer for the SA console.
// All platform tables have RLS = is_reliance_admin() only, so these getters
// rely on RLS for gating: a non-superadmin's session returns zero rows.
// Every getter returns [] in MOCK_MODE or when the client is null.

async function sb() { return createSupabaseServerClient(); }

// ── Subscriptions / Billing ─────────────────────────────────────────────────────

export const getSubscriptions = cache(async (): Promise<Subscription[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    plan: r.plan,
    status: r.status,
    mrr: Number(r.mrr) || 0,
    seats: r.seats ?? 0,
    started_at: r.started_at ?? null,
    renews_at: r.renews_at ?? null,
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Support Tickets ─────────────────────────────────────────────────────────────

export const getSupportTickets = cache(async (): Promise<SupportTicket[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("sa_support_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    subject: r.subject,
    body: r.body,
    status: r.status,
    priority: r.priority,
    requester: r.requester ?? null,
    assignee: r.assignee ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});

// ── Guardrails ──────────────────────────────────────────────────────────────────

export const getGuardrails = cache(async (): Promise<Guardrail[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("sa_guardrails")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    enabled: r.enabled ?? false,
    threshold: r.threshold === null || r.threshold === undefined ? null : Number(r.threshold),
    notes: r.notes ?? null,
    updated_at: r.updated_at,
  }));
});

// ── Global Legal Library ────────────────────────────────────────────────────────

export const getGlobalLegal = cache(async (): Promise<GlobalLegalItem[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("sa_global_legal")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    regulation_ref: r.regulation_ref,
    title: r.title,
    jurisdiction: r.jurisdiction,
    category: r.category,
    description: r.description ?? null,
    applies_to: r.applies_to ?? [],
    created_at: r.created_at,
  }));
});

// ── Import Jobs ─────────────────────────────────────────────────────────────────

export const getImportJobs = cache(async (): Promise<ImportJob[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("sa_import_jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    kind: r.kind,
    filename: r.filename,
    row_count: r.row_count ?? 0,
    status: r.status,
    created_at: r.created_at,
  }));
});

// ── Templates (global template library) ─────────────────────────────────────────

export const getSaTemplates = cache(async (): Promise<SaTemplate[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("sa_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? "form",
    format: r.format ?? "PDF",
    version: r.version ?? "v1.0",
    status: r.status ?? "active",
    notes: r.notes ?? null,
    created_at: r.created_at,
  }));
});

// ── Tenants (companies list + impl kanban) ──────────────────────────────────────

function mapTenantSummary(r: Record<string, unknown>): TenantSummary {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    sector: (r.sector as string) ?? "",
    country: (r.country as string) ?? "",
    impl_status: (r.impl_status as string) ?? null,
    onboarding_completed_at: (r.onboarding_completed_at as string) ?? null,
    created_at: r.created_at as string,
  };
}

export const getAllTenants = cache(async (): Promise<TenantSummary[]> => {
  if (MOCK_MODE) return [];
  const client = await sb();
  if (!client) return [];
  const { data, error } = await client
    .from("tenants")
    .select("id, name, slug, sector, country, impl_status, onboarding_completed_at, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => mapTenantSummary(r as Record<string, unknown>));
});

// ── Tenant Detail (drill-down) ──────────────────────────────────────────────────

export const getTenantDetail = cache(async (id: string): Promise<TenantDetail | null> => {
  if (MOCK_MODE) return null;
  const client = await sb();
  if (!client) return null;

  const { data: tenantRow, error: tenantErr } = await client
    .from("tenants")
    .select("id, name, slug, sector, country, impl_status, onboarding_completed_at, created_at")
    .eq("id", id)
    .single();
  if (tenantErr || !tenantRow) return null;

  const { data: profileRows } = await client
    .from("profiles")
    .select("*")
    .eq("tenant_id", id);

  const profiles: Profile[] = (profileRows ?? []).map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    display_name: r.display_name,
    role: r.role as Profile["role"],
    default_site_id: r.default_site_id ?? null,
    job_title: r.job_title ?? null,
    department: r.department ?? null,
    active: r.active ?? true,
  }));

  const { data: subRows } = await client
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const sr = subRows?.[0];
  const subscription: Subscription | null = sr
    ? {
        id: sr.id,
        tenant_id: sr.tenant_id,
        plan: sr.plan,
        status: sr.status,
        mrr: Number(sr.mrr) || 0,
        seats: sr.seats ?? 0,
        started_at: sr.started_at ?? null,
        renews_at: sr.renews_at ?? null,
        notes: sr.notes ?? null,
        created_at: sr.created_at,
        updated_at: sr.updated_at,
      }
    : null;

  // Count key records scoped to this tenant via head/count queries.
  const countTables: Array<[string, string]> = [
    ["chemicals", "chemical_inventory"],
    ["incidents", "incidents"],
    ["capa_records", "capa_records"],
    ["audits", "audits"],
    ["training_records", "training_records"],
  ];
  const counts: Record<string, number> = {};
  await Promise.all(
    countTables.map(async ([key, table]) => {
      const { count } = await client
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", id);
      counts[key] = count ?? 0;
    }),
  );

  return {
    tenant: mapTenantSummary(tenantRow as Record<string, unknown>),
    profiles,
    subscription,
    counts,
  };
});

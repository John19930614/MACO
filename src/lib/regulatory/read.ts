import "server-only";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Raw clock row passed to the client Reporting Status panel. The client computes
// live color/countdown from started_at + deadline_at using
// @/lib/regulatory/notifications (a pure module).
export type ClockRow = {
  id: string;
  jurisdiction: string;
  event_type: string;
  description: string;
  status: string;
  started_at: string;
  deadline_at: string;
  confirmation_number: string | null;
  justification_text: string | null;
};

/** Fetch all regulatory reporting clocks for an incident (newest first). */
export async function getIncidentRegulatoryClocks(incidentId: string): Promise<ClockRow[]> {
  if (MOCK_MODE) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("incident_regulatory_clocks")
    .select("id, jurisdiction, event_type, description, status, started_at, deadline_at, confirmation_number, justification_text")
    .eq("incident_id", incidentId)
    .order("deadline_at", { ascending: true });
  return (data ?? []) as ClockRow[];
}

/**
 * Count of open regulatory clocks across the tenant, for the LeftNav badge.
 * Returns 0 in mock mode / when unauthenticated.
 */
export async function countOpenRegulatoryClocks(tenantId: string | null): Promise<number> {
  if (MOCK_MODE || !tenantId) return 0;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("incident_regulatory_clocks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    // Matches the OPEN_STATUSES used by the closure gate / canCloseIncident so the
    // badge, gate, and outstanding-list stay consistent.
    .in("status", ["pending_start", "running", "escalated_amber", "escalated_red", "overdue"]);
  return count ?? 0;
}

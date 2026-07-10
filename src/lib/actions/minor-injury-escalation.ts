"use server";

import { revalidatePath } from "next/cache";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerTenantId } from "@/lib/auth/session";

// Auto-escalation for injuries involving a minor. Adapted: incidents have no
// worker FK (injured_party is free text), so the migration adds
// incidents.young_worker_id — set it when reporting an incident for a young
// worker and this hook fires. There is no `createCapaFromIncident` service in
// this repo; CAPAs are inserted directly into capa_records (mirrors the Phase-4
// risk-escalation pattern in phase-4-action-response.ts).

export type EscalationResult = {
  ok: boolean;
  escalated: boolean;
  capaId?: string | null;
  error?: string;
};

export async function escalateMinorInjuryIfApplicable(
  incidentId: string,
): Promise<EscalationResult> {
  if (MOCK_MODE) return { ok: true, escalated: false };

  const supabase = await createSupabaseServerClient();
  const tenantId = await getServerTenantId();
  if (!supabase || !tenantId) return { ok: false, escalated: false, error: "no-session" };

  const { data: incident } = await supabase
    .from("incidents")
    .select("id, title, young_worker_id, site_id")
    .eq("id", incidentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const inc = incident as
    | { id: string; title: string; young_worker_id: string | null; site_id: string | null }
    | null;

  // Only escalate when the incident is tagged to a young worker.
  if (!inc?.young_worker_id) return { ok: true, escalated: false };

  await supabase.from("young_worker_alerts").insert({
    tenant_id: tenantId,
    young_worker_id: inc.young_worker_id,
    alert_type: "minor_injury_capa",
    details: { incidentId },
  });

  const { data: capa } = await supabase
    .from("capa_records")
    .insert({
      tenant_id: tenantId,
      site_id: inc.site_id ?? null,
      title: `Minor/young-worker injury — ${inc.title}`,
      description:
        "Auto-escalated per the Young Worker Task Gate policy: an incident was reported involving a worker under 18. Investigate root cause, verify age/permit/task compliance at the time of injury, and document corrective and preventive actions.",
      kind: "corrective",
      source_type: "young_worker_injury",
      source_id: incidentId,
      severity: "critical",
      status: "open",
    })
    .select("id")
    .single();

  const capaId = (capa as { id: string } | null)?.id ?? null;

  revalidatePath("/capa");
  revalidatePath("/team/young-workers");
  return { ok: true, escalated: true, capaId };
}

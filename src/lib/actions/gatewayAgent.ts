"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runGatewayHealthCheck } from "@/lib/gateway/agent";

/** Run the gateway health check and log a snapshot (superadmin, on demand). */
export async function runGatewayAgentCheck() {
  const snap = await runGatewayHealthCheck({ persist: true, generatedBy: "superadmin" });
  revalidatePath("/sa/gateway");
  return { ok: true, status: snap.overall_status, findings: snap.findings.length };
}

/** Update the monitoring thresholds. */
export async function updateGatewaySettings(_prev: unknown, formData: FormData) {
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const int = (k: string, d: number) => { const v = parseInt(String(formData.get(k) ?? ""), 10); return Number.isNaN(v) ? d : v; };

  const { data: existing } = await client.from("gateway_agent_settings").select("id").order("created_at").limit(1).maybeSingle();
  const patch = {
    enabled: formData.get("enabled") === "on",
    fallback_warn_pct: int("fallback_warn_pct", 25),
    fallback_critical_pct: int("fallback_critical_pct", 50),
    reject_queue_warn: int("reject_queue_warn", 10),
    review_backlog_warn: int("review_backlog_warn", 5),
    review_backlog_critical: int("review_backlog_critical", 15),
    updated_by: "Reliance Admin",
  };
  const { error } = existing
    ? await client.from("gateway_agent_settings").update(patch).eq("id", existing.id)
    : await client.from("gateway_agent_settings").insert(patch);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/gateway");
  return { ok: true };
}

/** Record a maintenance note (how a finding was resolved). */
export async function addGatewayNote(_prev: unknown, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, error: "Note is required." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, error: "Session expired — please reload." };
  const { error } = await client.from("gateway_agent_notes").insert({ note, author: "Reliance Admin" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sa/gateway");
  return { ok: true };
}

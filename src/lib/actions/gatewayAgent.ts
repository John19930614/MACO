"use server";

import { revalidatePath } from "next/cache";
import { runGatewayHealthCheck } from "@/lib/gateway/agent";

/** Run the gateway health check and log a snapshot (superadmin, on demand). */
export async function runGatewayAgentCheck() {
  const snap = await runGatewayHealthCheck({ persist: true, generatedBy: "superadmin" });
  revalidatePath("/sa/gateway");
  return { ok: true, status: snap.overall_status, findings: snap.findings.length };
}

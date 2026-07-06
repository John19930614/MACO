"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { MOCK_MODE } from "@/lib/env";

export interface DeployResult {
  ok: boolean;
  jobId?: string;
  error?: string;
}

export async function triggerVercelDeploy(taskId?: string): Promise<DeployResult> {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

  if (MOCK_MODE) {
    return { ok: true, jobId: "mock-deploy-123" };
  }

  if (!hookUrl) {
    return { ok: false, error: "Deploy hook not configured. Add VERCEL_DEPLOY_HOOK_URL to environment variables." };
  }

  try {
    const response = await fetch(hookUrl, { method: "POST" });
    if (!response.ok) {
      return { ok: false, error: `Vercel returned ${response.status} — try again.` };
    }

    const data = await response.json().catch(() => ({}));
    const jobId = (data as { job?: { id?: string } }).job?.id ?? undefined;

    // TENANT-INDEPENDENT WRITE: dev_audit_log and dev_tasks have no tenant_id
    // column (see supabase/migrations/20260627010000_dev_command_center.sql) —
    // both are Reliance-superadmin-only, RLS-gated by is_reliance_admin(), not
    // by tenant. The only caller of triggerVercelDeploy (DeployButton.tsx under
    // admin/dev-command) is itself reachable only by superadmins: middleware.ts
    // blocks all of /admin/* unless profiles.tenant_id IS NULL, and the route's
    // layout additionally calls requireDevCommandAccess(). There is no caller
    // tenant_id anywhere in this function to validate against. See
    // docs/security/deployToVercel-tenant-ownership.md for the reviewed
    // justification. No tenant check required.
    if (taskId) {
      const db = createServiceRoleClient();
      if (db) {
        try {
          await db.from("dev_audit_log").insert({
            task_id: taskId,
            actor: "system",
            action: "production_deploy_triggered",
            details: { job_id: jobId, hook_url_prefix: hookUrl.slice(0, 60) },
          });
        } catch { /* non-fatal */ }
      }
    }

    return { ok: true, jobId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Deploy request failed." };
  }
}

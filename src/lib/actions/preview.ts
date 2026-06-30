"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSuperadmin, getServerProfileId, PREVIEW_TENANT_COOKIE } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Start a READ-ONLY "preview as tenant" session for a Reliance superadmin.
 * Sets an httpOnly cookie that getPreviewTenantId() reads (superadmin-gated).
 * A non-superadmin caller is rejected, so this can never be used to escalate.
 */
export async function startTenantPreview(tenantId: string): Promise<{ ok: false; error: string } | void> {
  if (!(await isSuperadmin())) return { ok: false, error: "Superadmin only." };
  if (!tenantId) return { ok: false, error: "No tenant selected." };

  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });

  // Audit (best-effort — never block entering preview on a logging failure).
  try {
    const db = createServiceRoleClient();
    if (db) {
      await db.from("audit_log").insert({
        tenant_id: tenantId,
        actor_id: await getServerProfileId(),
        action: "tenant_preview_started",
        entity_type: "tenant",
        entity_id: tenantId,
      });
    }
  } catch { /* non-fatal */ }

  redirect("/dashboard");
}

/** Exit preview — clears the cookie and returns to the superadmin console. */
export async function stopTenantPreview(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PREVIEW_TENANT_COOKIE);
  redirect("/sa/companies");
}

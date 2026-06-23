"use server";

import { createClient } from "@supabase/supabase-js";
import { serverSecrets, APP_URL } from "@/lib/env";
import { getServerTenantId } from "@/lib/auth/session";

function serviceClient() {
  const { serviceRoleKey } = serverSecrets();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface EmployeeInvite {
  email: string;
  name: string;
  jobTitle?: string;
  department?: string;
}

export async function inviteTeamMembers(employees: EmployeeInvite[]) {
  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false as const, error: "No tenant", sent: 0 };

  // Invites require the service-role key. Without it, createClient() throws
  // "supabaseKey is required" — guard so the UI gets a clear message instead of a crash.
  if (!serverSecrets().serviceRoleKey) {
    return {
      ok: false as const,
      sent: 0,
      error: "Email invites aren't configured yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment to enable team invitations.",
    };
  }

  const svc = serviceClient();
  // Invited users land on the callback, which exchanges the magic-link code for a
  // session, provisions their profile, then forwards them to set a password.
  const redirectTo = `${APP_URL}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`;

  let sent = 0;
  const errors: string[] = [];

  for (const emp of employees) {
    const email = emp.email?.trim().toLowerCase();
    if (!email) continue;

    try {
      const { error } = await svc.auth.admin.inviteUserByEmail(email, {
        data: {
          display_name: emp.name,
          job_title:    emp.jobTitle ?? null,
          department:   emp.department ?? null,
          tenant_id:    tenantId,
        },
        redirectTo,
      });

      if (error && !error.message.toLowerCase().includes("already")) {
        errors.push(`${email}: ${error.message}`);
        continue;
      }
      sent++;
    } catch (err) {
      errors.push(`${email}: ${String(err)}`);
    }
  }

  // Record invited emails in onboarding_data so the banner knows they're done
  try {
    const { data: tenantRow } = await svc.from("tenants").select("onboarding_data").eq("id", tenantId).single();
    const existing = (tenantRow?.onboarding_data as Record<string, unknown>) ?? {};
    const alreadyInvited = (existing.invited_emails as string[]) ?? [];
    await svc.from("tenants").update({
      onboarding_data: {
        ...existing,
        invited_emails: [...new Set([...alreadyInvited, ...employees.map(e => e.email.toLowerCase())])],
      },
    }).eq("id", tenantId);
  } catch { /* non-fatal */ }

  return { ok: true as const, sent, errors };
}

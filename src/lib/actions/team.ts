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

export interface InviteLink {
  email: string;
  name: string;
  tempPassword: string;
  loginUrl: string;
}

export interface InviteResult {
  ok: true;
  sent: number;
  errors: string[];
  links: InviteLink[];
}

export interface InviteError {
  ok: false;
  error: string;
  sent: 0;
}

function makeTempPassword() {
  // Simple readable temp password: word-word-4digits
  const words = ["Maple","River","Stone","Tiger","Cloud","Eagle","Frost","Cedar"];
  const a = words[Math.floor(Math.random() * words.length)];
  const b = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${a}${b}${n}!`;
}

export async function inviteTeamMembers(
  employees: EmployeeInvite[],
): Promise<InviteResult | InviteError> {
  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "No tenant", sent: 0 };

  const { serviceRoleKey } = serverSecrets();
  if (!serviceRoleKey) {
    return { ok: false, sent: 0, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." };
  }

  const svc = serviceClient();
  let sent = 0;
  const errors: string[] = [];
  const links: InviteLink[] = [];

  for (const emp of employees) {
    const email = emp.email?.trim().toLowerCase();
    if (!email) continue;

    try {
      const tempPassword = makeTempPassword();

      // Try to create the user as confirmed with a temp password.
      const { data: created, error: createError } = await svc.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          display_name: emp.name,
          job_title:    emp.jobTitle ?? null,
          department:   emp.department ?? null,
          tenant_id:    tenantId,
        },
      });

      let userId: string | undefined = created?.user?.id;

      if (createError) {
        if (createError.message.toLowerCase().includes("already") ||
            createError.message.toLowerCase().includes("exists")) {
          // User already exists — look them up and reset their password.
          const { data: existing } = await svc.auth.admin.listUsers();
          const match = existing?.users?.find((u) => u.email === email);
          if (match) {
            userId = match.id;
            await svc.auth.admin.updateUserById(match.id, { password: tempPassword });
          } else {
            errors.push(`${email}: ${createError.message}`);
            continue;
          }
        } else {
          errors.push(`${email}: ${createError.message}`);
          continue;
        }
      }

      if (!userId) {
        errors.push(`${email}: Could not create or find user.`);
        continue;
      }

      // Provision profile if not already there.
      const { data: existingProfile } = await svc
        .from("profiles")
        .select("id, tenant_id")
        .eq("id", userId)
        .maybeSingle();

      if (!existingProfile) {
        await svc.from("profiles").insert({
          id:           userId,
          tenant_id:    tenantId,
          display_name: emp.name,
          job_title:    emp.jobTitle ?? null,
          department:   emp.department ?? null,
        });
      } else if (!existingProfile.tenant_id) {
        await svc.from("profiles").update({ tenant_id: tenantId }).eq("id", userId);
      }

      links.push({ email, name: emp.name, tempPassword, loginUrl: `${APP_URL}/login` });
      sent++;
    } catch (err) {
      errors.push(`${email}: ${String(err)}`);
    }
  }

  // Record invited emails in onboarding_data.
  try {
    const { data: tenantRow } = await svc.from("tenants").select("onboarding_data").eq("id", tenantId).single();
    const existing = (tenantRow?.onboarding_data as Record<string, unknown>) ?? {};
    const alreadyInvited = (existing.invited_emails as string[]) ?? [];
    await svc.from("tenants").update({
      onboarding_data: {
        ...existing,
        invited_emails: [
          ...new Set([...alreadyInvited, ...employees.map((e) => e.email.toLowerCase())]),
        ],
      },
    }).eq("id", tenantId);
  } catch { /* non-fatal */ }

  return { ok: true, sent, errors, links };
}

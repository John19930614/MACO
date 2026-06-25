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

export interface InviteResult {
  ok: true;
  sent: number;
  errors: string[];
  links: Array<{ email: string; name: string; link: string }>;
}

export interface InviteError {
  ok: false;
  error: string;
  sent: 0;
}

async function sendViaResend(to: string, name: string, inviteLink: string, apiKey: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SafetyIQ <onboarding@resend.dev>",
      to,
      subject: "You've been invited to SafetyIQ",
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#1e40af;margin-bottom:8px">You're invited to SafetyIQ</h2>
          <p style="color:#334155">Hi ${name},</p>
          <p style="color:#334155">You've been invited to join your team's SafetyIQ workspace — your EHS management platform.</p>
          <div style="margin:28px 0">
            <a href="${inviteLink}"
               style="background:#1e40af;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
              Accept Invitation
            </a>
          </div>
          <p style="color:#94a3b8;font-size:13px">This link expires in 24 hours. If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

export async function inviteTeamMembers(
  employees: EmployeeInvite[],
): Promise<InviteResult | InviteError> {
  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "No tenant", sent: 0 };

  const { serviceRoleKey, resendKey } = serverSecrets();

  if (!serviceRoleKey) {
    return { ok: false, sent: 0, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." };
  }

  const svc = serviceClient();
  const redirectTo = `${APP_URL}/auth/callback`;

  let sent = 0;
  const errors: string[] = [];
  const links: Array<{ email: string; name: string; link: string }> = [];

  for (const emp of employees) {
    const email = emp.email?.trim().toLowerCase();
    if (!email) continue;

    try {
      const { data, error } = await svc.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: {
            display_name: emp.name,
            job_title:    emp.jobTitle ?? null,
            department:   emp.department ?? null,
            tenant_id:    tenantId,
          },
          redirectTo,
        },
      });

      if (error && !error.message.toLowerCase().includes("already")) {
        errors.push(`${email}: ${error.message}`);
        continue;
      }

      const inviteLink = data?.properties?.action_link;
      if (!inviteLink) {
        errors.push(`${email}: Could not generate invite link.`);
        continue;
      }

      // Always provide the link in the response so the admin can share it manually.
      links.push({ email, name: emp.name, link: inviteLink });
      sent++;

      // Best-effort email send via Resend — may fail for non-owner emails on free plan.
      if (resendKey) {
        sendViaResend(email, emp.name, inviteLink, resendKey).catch(() => {
          // silent — link is already in the response
        });
      }
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

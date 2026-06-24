import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { EmailOtpType } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, MOCK_MODE, serverSecrets } from "@/lib/env";

// Handles Supabase auth redirects — primarily the employee-invite magic link
// (team.ts → inviteUserByEmail with redirectTo …/auth/callback). Exchanges the
// one-time code for a session, provisions the user's profile row with the
// tenant_id carried in the invite metadata, then forwards to `next`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code      = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type") as EmailOtpType | null;
  const next      = searchParams.get("next") ?? "/dashboard";

  // Only allow same-origin relative redirects to avoid open-redirect abuse.
  // Reject protocol-relative ("//evil.com") and absolute ("https://…") targets.
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("://") ? next : "/dashboard";

  if (MOCK_MODE || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const response = NextResponse.redirect(`${origin}${safeNext}`);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          response.cookies.set(name, value, options as any),
        );
      },
    },
  });

  // Establish the session from whichever flow the email used.
  let sessionError: { message: string } | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    sessionError = error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    sessionError = error;
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  if (sessionError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(sessionError.message)}`,
    );
  }

  // Provision the profile from invite metadata. Use the service role so this
  // works before any per-user RLS insert policy applies. Non-destructive: this
  // path also handles password-recovery sessions, so it must never overwrite an
  // already-provisioned profile (e.g. null out a real tenant_id).
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const md = (user.user_metadata ?? {}) as Record<string, unknown>;
    const mdTenantId = typeof md.tenant_id === "string" ? md.tenant_id : null;
    const { serviceRoleKey } = serverSecrets();
    if (serviceRoleKey) {
      const svc = createClient(SUPABASE_URL, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: existing } = await svc
        .from("profiles")
        .select("id, tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existing) {
        // First arrival (invite): create the profile from the invite metadata.
        await svc.from("profiles").insert({
          id:           user.id,
          tenant_id:    mdTenantId,
          display_name: (md.display_name as string) ?? user.email ?? "New User",
          job_title:    (md.job_title as string) ?? null,
          department:   (md.department as string) ?? null,
        });
      } else if (!existing.tenant_id && mdTenantId) {
        // Row exists (e.g. created by a signup trigger) but isn't linked to a
        // tenant yet — fill it in without touching any other field.
        await svc.from("profiles").update({ tenant_id: mdTenantId }).eq("id", user.id);
      }
      // Otherwise the profile is already complete (e.g. password recovery) — leave it.
    }
  }

  return response;
}

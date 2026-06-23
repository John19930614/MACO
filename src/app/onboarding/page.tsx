import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MOCK_MODE } from "@/lib/env";
import OnboardingWizard from "./OnboardingWizard";

export const metadata = { title: "Company Onboarding | SafetyIQ" };

export default async function OnboardingPage() {
  if (MOCK_MODE) {
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) redirect("/dashboard");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("onboarding_completed_at")
    .eq("id", profile.tenant_id)
    .single();

  if (tenant?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  return <OnboardingWizard tenantId={profile.tenant_id} />;
}

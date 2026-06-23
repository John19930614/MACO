import { getProfiles } from "@/lib/data/ehsRepo";
import { getEffectiveTenantId } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/primitives";
import { TeamClient } from "./TeamClient";

interface RosterEmployee {
  display_name: string;
  email?: string | null;
  job_title?: string | null;
  department?: string | null;
}

export default async function TeamPage() {
  const tenantId = await getEffectiveTenantId();
  const profiles = await getProfiles(tenantId);

  // Onboarding roster + already-sent invites live in tenants.onboarding_data.
  let roster: RosterEmployee[] = [];
  let invitedEmails: string[] = [];

  if (!MOCK_MODE) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("onboarding_data")
        .eq("id", tenantId)
        .single();
      const od = (tenant?.onboarding_data as Record<string, unknown>) ?? {};
      roster        = (od.extracted_employees as RosterEmployee[]) ?? [];
      invitedEmails = (od.invited_emails as string[]) ?? [];
    }
  }

  const members = profiles.map((p) => ({
    id:           p.id,
    display_name: p.display_name,
    role:         p.role as string,
    job_title:    p.job_title ?? null,
    department:   p.department ?? null,
    active:       p.active,
  }));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Team & Invites"
        subtitle="Your members, the roster imported during onboarding, and pending invitations"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <TeamClient members={members} roster={roster} invitedEmails={invitedEmails} />
      </div>
    </div>
  );
}

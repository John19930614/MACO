// Resolves the calling user's role in BOTH mock and live modes.
//
// getServerUser() returns null under MOCK_MODE (it's built for a real Supabase
// session), so gating on it alone would reject every caller in the demo
// environment. This mirrors the resolveCallerRole() helper already used by
// src/lib/actions/predictive-risk-engine.ts, extracted so the Phase 5 actions
// can share one implementation. Not a Server Action (no "use server") — it's an
// internal server-side utility imported by the action modules.

import { MOCK_MODE } from "@/lib/env";
import { getServerUser, getServerProfileId } from "@/lib/auth/session";
import { MOCK_PROFILES_ALL } from "@/lib/data/mock";
import type { Role } from "@/lib/constants";

export async function resolveCallerRole(): Promise<Role | null> {
  if (MOCK_MODE) {
    const profileId = await getServerProfileId();
    return (MOCK_PROFILES_ALL.find((p) => p.id === profileId)?.role as Role) ?? null;
  }
  const user = await getServerUser();
  return (user?.role as Role) ?? null;
}

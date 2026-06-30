import "server-only";
import { redirect } from "next/navigation";
import { MOCK_MODE } from "@/lib/env";
import { isSuperadmin } from "@/lib/auth/session";

/**
 * Page-level access guard for the AI Dev Command Center (/admin/dev-command/*).
 *
 * Defense in depth: the edge gate in middleware.ts already redirects any
 * non-superadmin away from /admin/* in live mode. This server-side guard is the
 * second layer, called at the top of every dev-command page.
 *
 * MOCK_MODE: middleware is skipped (no Supabase configured), so we allow render
 * here too — the Phase 2 shell is meant to be previewable with sample data.
 * Live: a caller whose profile is not a Reliance superadmin is bounced to the
 * tenant dashboard, exactly like the /sa console.
 */
export async function requireDevCommandAccess(): Promise<void> {
  if (MOCK_MODE) return;
  // A transient profile-fetch failure must NOT throw to the error boundary
  // (that nukes the whole page). Treat any failure as "not authorized" and
  // bounce to the dashboard — the edge middleware is the primary gate anyway.
  let ok = false;
  try {
    ok = await isSuperadmin();
  } catch {
    redirect("/dashboard");
  }
  if (!ok) redirect("/dashboard");
}

/**
 * AI Dev Command Center — File safety checker (Phase 12).
 *
 * Decides whether an approved artifact's target path may be applied. Three
 * outcomes:
 *   • allowed   — inside the dev-command sandbox / docs / migration drafts.
 *   • dangerous — touches a sensitive area; needs an EXTRA approval of a specific
 *                 type before it can be applied.
 *   • blocked   — outside the allowed area entirely.
 *
 * Pure + import-safe (no secrets), so the UI and the server action both use it.
 */
import type { ApprovalType } from "./types";

export interface PathCheck {
  allowed: boolean;
  dangerous: boolean;
  category: string;
  reason: string;
  /** When dangerous, the extra approval type required to apply. */
  requiredApproval: ApprovalType | null;
}

// Paths the team may apply to freely (still needs file_write approval).
// Mapped to this project's real structure.
const ALLOWED: RegExp[] = [
  /^src\/app\/\(app\)\/admin\/dev-command\//,
  /^src\/lib\/devcenter\//,
  /^docs\//,
  /^supabase\/migrations\/drafts\//,
];

// Sensitive areas — each needs a matching extra approval before applying.
const DANGEROUS: { re: RegExp; category: string; label: string; approval: ApprovalType }[] = [
  { re: /^src\/lib\/auth\//, category: "auth", label: "authentication files", approval: "auth_permission_change" },
  { re: /^src\/middleware\.ts$/, category: "middleware", label: "middleware", approval: "auth_permission_change" },
  { re: /(^|\/)\.env|^src\/lib\/env\.ts$/, category: "env", label: "environment config", approval: "environment_variable_change" },
  { re: /(rls|policy)/i, category: "rls", label: "data-access rules", approval: "rls_policy_change" },
  { re: /^src\/app\/layout\.tsx$|^src\/app\/\(app\)\/layout\.tsx$/, category: "root_layout", label: "the root layout", approval: "file_write" },
  { re: /^src\/app\/api\//, category: "api", label: "production API routes", approval: "file_write" },
  { re: /^supabase\/migrations\/(?!drafts\/)/, category: "migration", label: "existing database migrations", approval: "database_change" },
  { re: /^src\/app\/\(app\)\//, category: "customer_module", label: "an existing platform module", approval: "file_write" },
];

const norm = (p: string) => p.replace(/^\.?\//, "");

export function checkPath(path: string | null): PathCheck {
  if (!path) return { allowed: false, dangerous: false, category: "none", reason: "No file path.", requiredApproval: null };
  const p = norm(path);
  if (ALLOWED.some((re) => re.test(p))) {
    return { allowed: true, dangerous: false, category: "allowed", reason: "In the allowed dev-command / docs area.", requiredApproval: null };
  }
  for (const d of DANGEROUS) {
    if (d.re.test(p)) {
      return { allowed: false, dangerous: true, category: d.category, reason: `Touches ${d.label} — needs an extra approval.`, requiredApproval: d.approval };
    }
  }
  return { allowed: false, dangerous: false, category: "outside", reason: "Outside the allowed area — can't be applied here.", requiredApproval: null };
}

/** Destructive changes (deletes) always need a file_delete approval. */
export function isDestructive(changeType: string | null | undefined): boolean {
  return changeType === "delete";
}

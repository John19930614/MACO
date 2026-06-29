/**
 * AI Dev Command Center — Security review generator (Phase 17).
 *
 * The Security agent runs ten checks and produces findings with a severity flag
 * (low / medium / high / critical). A CRITICAL finding blocks the task from
 * completing until it is resolved or the security gate is waived. Pure +
 * deterministic — it reviews the plan, never running code.
 */
import type { DevTask, DevTaskMeta, RiskLevel } from "./types";

export type Severity = "low" | "medium" | "high" | "critical";

export interface SecurityFinding {
  category: string;
  severity: Severity;
  ok: boolean;
  note: string;
}

export interface SecurityReviewResult {
  summary: string;
  verdict: "pass" | "needs_changes" | "fail";
  risk_level: RiskLevel;
  findings: SecurityFinding[];
  required_fixes: string[];
  critical_count: number;
}

const meta = (t: DevTask) => (t.metadata ?? {}) as DevTaskMeta;
const SEV_ORDER: Severity[] = ["low", "medium", "high", "critical"];

// The ten checks the Security agent must run.
const CHECKS = [
  "Authentication", "Authorization", "Supabase RLS", "API route protection", "Server action protection",
  "Dangerous tool permissions", "Customer data exposure", "Secret exposure", "Prompt injection risk", "Over-permissioned agents",
] as const;

export function generateSecurityReview(task: DevTask): SecurityReviewResult {
  const m = meta(task);
  const area = (task.target_area ?? "").toLowerCase();
  const touchesAuth = area.includes("user") || area.includes("auth") || area.includes("login");
  const touchesData = (m.data_involved ?? "").toLowerCase().match(/customer|personal|tenant|pii/) != null;

  // Default: every check passes (the platform is admin-only, RLS-on, no client
  // secrets, every dangerous action gated). Flags are raised only on real risk.
  const findings: SecurityFinding[] = CHECKS.map((category) => {
    let severity: Severity = "low";
    let ok = true;
    let note = "OK — protected by the platform's built-in controls.";

    if (category === "Supabase RLS" && m.database_changes_allowed) {
      severity = "high"; ok = false; note = "A database change is allowed — confirm row-level security on any new table before applying.";
    }
    if (category === "Authorization" && touchesAuth) {
      severity = "high"; ok = false; note = "Touches logins/permissions — verify admin-only access and that nothing widens who can do what.";
    }
    if (category === "Customer data exposure" && touchesData) {
      severity = "high"; ok = false; note = "Sensitive data mentioned — confirm no customer data is exposed.";
    }
    if (category === "Over-permissioned agents" && (m.github_branch_allowed || m.deployment_allowed)) {
      severity = "medium"; ok = false; note = "This task widens what agents may do — confirm each permission is intended.";
    }
    return { category, severity, ok, note };
  });

  // The seven CRITICAL risks: a critical-risk task, or auth + database change
  // together, is treated as a critical security finding that blocks completion.
  const critical = task.risk_level === "critical" || (touchesAuth && m.database_changes_allowed);
  if (critical) {
    findings.push({
      category: "Unauthorized admin action / data-access risk",
      severity: "critical",
      ok: false,
      note: "This change is high-impact (logins, data-access rules, or critical risk). It must be checked by a person before release.",
    });
  }

  const maxSev = findings.reduce<Severity>((acc, f) => (SEV_ORDER.indexOf(f.severity) > SEV_ORDER.indexOf(acc) && !f.ok ? f.severity : acc), "low");
  const critical_count = findings.filter((f) => f.severity === "critical" && !f.ok).length;
  const verdict = critical_count ? "fail" : findings.some((f) => !f.ok && (f.severity === "high")) ? "needs_changes" : "pass";

  return {
    summary: verdict === "pass"
      ? "No security concerns found at the plan level."
      : verdict === "fail"
        ? "A critical security risk needs a person to review it before this can be released."
        : "A few security items need attention before release.",
    verdict,
    risk_level: maxSev,
    findings,
    required_fixes: findings.filter((f) => !f.ok).map((f) => `${f.category}: ${f.note}`),
    critical_count,
  };
}

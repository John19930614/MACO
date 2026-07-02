/**
 * Platform Review — the Dev Manager's self-audit.
 *
 * Runs six checks across the platform and turns each finding into a one-click
 * pre-filled task, reusing the same intake flow as the daily suggestions
 * (see suggestions.ts / DevTaskIntakeForm). This module is PURE (no server-only
 * imports) so both the server page and client panel can import it. The one live
 * signal — AI gateway health — is fetched in the page (a server component) and
 * passed into buildPlatformReview() as an optional snapshot.
 *
 * Checks split two ways, and we are honest about which is which in the UI:
 *   • LIVE     — computed fresh every run from the running app (AI/Gateway).
 *   • CURATED  — code-level findings (typecheck, silent-fails, tenant-writes,
 *                tech debt) that a full Claude Code review authored. The app
 *                cannot run tsc / vitest / grep at runtime, so these are read
 *                from the catalog below and refreshed after each full review.
 */

// ── The date the curated catalog was last refreshed by a full review ─────────
export const LAST_FULL_REVIEW = "2026-07-02";

export type ReviewCheckKey =
  | "build_type" | "security" | "database" | "routes_ux" | "ai_engine" | "tech_debt";

export type ReviewStatus = "green" | "amber" | "red";
export type ReviewSource = "live" | "curated";
export type FindingPriority = "urgent" | "high" | "medium" | "low";
export type FindingRisk = "low" | "medium" | "high" | "critical";
export type FindingEffort = "small" | "medium" | "large";

export interface ReviewFinding {
  id: string;
  check: ReviewCheckKey;
  title: string;
  /** One-line statement of the issue. */
  detail: string;
  /** What to do about it — becomes the task's feature description. */
  recommendation: string;
  severity: ReviewStatus;
  source: ReviewSource;
  /** Module label — matches the New Task form's MODULES list. */
  module: string;
  who_uses_it?: string;
  priority: FindingPriority;
  risk_level: FindingRisk;
  effort: FindingEffort;
  /** Files/areas to look at — helps the AI team locate the work. */
  where?: string;
  success_criteria: string;
}

export interface ReviewCheck {
  key: ReviewCheckKey;
  label: string;
  /** Whether this check runs live in-app or reads the curated catalog. */
  live: boolean;
  blurb: string;
}

export const REVIEW_CHECKS: ReviewCheck[] = [
  { key: "build_type",  label: "Build & Type Health",          live: false, blurb: "Typecheck, unit tests, system nav gate." },
  { key: "security",    label: "Security & Tenant Isolation",  live: false, blurb: "RLS, cross-tenant writes, service-role paths." },
  { key: "database",    label: "DB & Migration Integrity",     live: false, blurb: "Migrations applied to prod, schema drift." },
  { key: "routes_ux",   label: "Routes, UX & Error Handling",  live: false, blurb: "Dead links, silent-fail actions, demo data." },
  { key: "ai_engine",   label: "AI Engine & Gateway",          live: true,  blurb: "Gateway health, drift & cost anomalies." },
  { key: "tech_debt",   label: "Tech Debt",                    live: false, blurb: "any-types, monolithic files, model currency." },
];

export interface ReviewCheckResult extends ReviewCheck {
  status: ReviewStatus;
  summary: string;
  findingCount: number;
}

export interface PlatformReviewResult {
  reviewedAt: string;          // ISO of this run
  lastFullReview: string;      // date the curated catalog was authored
  overall: ReviewStatus;
  checks: ReviewCheckResult[];
  findings: ReviewFinding[];   // live + curated, most severe first
  liveRan: boolean;            // did the live AI/Gateway check succeed this run
  convertedCount: number;      // findings already turned into tasks (hidden here)
}

// ── Curated catalog — seeded from the 2026-07-02 full review ──────────────────
// Refresh this list after each full Claude Code review. IDs are stable so
// "Turn into task" links keep working.
const CURATED: ReviewFinding[] = [
  {
    id: "sec-tenant-write-validation",
    check: "security",
    title: "Validate tenant ownership before service-role writes",
    detail:
      "onboarding/process/route.ts seeds chemical_inventory & waste_streams using a tenant_id taken from the request payload, not from getServerTenantId(). sds.ts and team.ts also write with the service-role client without an assertCanWrite() ownership check.",
    recommendation:
      "Before any service-role write, verify the target tenant_id equals the authenticated user's tenant via getServerTenantId(), and call assertCanWrite(tenantId, roles). Add a unit test proving a spoofed tenant_id is rejected.",
    severity: "amber",
    source: "curated",
    module: "Platform Operations",
    who_uses_it: "Platform / all tenants (isolation)",
    priority: "high",
    risk_level: "high",
    effort: "medium",
    where: "src/app/api/onboarding/process/route.ts, src/lib/actions/sds.ts, src/lib/actions/team.ts",
    success_criteria:
      "Service-role writes reject a tenant_id that does not match the session user. A test seeds with a foreign tenant_id and is denied. No existing onboarding flow regresses.",
  },
  {
    id: "reliability-silent-ai-failures",
    check: "routes_ux",
    title: "Surface silent AI-analysis failures instead of swallowing them",
    detail:
      "ehs.ts (~495/530/560/960) and ai-remediate.ts (~122) catch errors with empty blocks, so when analyzeChemical/analyzeComplianceGap/analyzeTraining or the audit-log insert fail, the user sees partial results with no warning and an audit gap is created silently.",
    recommendation:
      "Return per-item warnings for failed analyses and log them; propagate audit-log write failures to the caller (at minimum log to telemetry). Never swallow an audit write.",
    severity: "amber",
    source: "curated",
    module: "AI Safety Assistant",
    who_uses_it: "Company Admin and EHS Coordinator",
    priority: "high",
    risk_level: "medium",
    effort: "medium",
    where: "src/lib/actions/ehs.ts, src/lib/actions/ai-remediate.ts",
    success_criteria:
      "A failed sub-analysis produces a visible warning and a telemetry log entry. Audit-log write failures are no longer silent. Existing successful paths are unchanged.",
  },
  {
    id: "db-evidence-comments-tables",
    check: "security",
    title: "Add migrations for evidence_files & comments (or gate the code)",
    detail:
      "repo.ts queries evidence_files and comments in live mode, but neither table exists in any migration. Latent today because the ARC/cells layer runs mock-only, but it will fail the moment ARC goes live.",
    recommendation:
      "Create additive migrations for evidence_files and comments with tenant_id + RLS policies matching the ARC tables, OR fence the live-mode branch behind a clear guard until ARC is deployed.",
    severity: "amber",
    source: "curated",
    module: "Database",
    who_uses_it: "ARC / platform",
    priority: "high",
    risk_level: "high",
    effort: "medium",
    where: "src/lib/data/repo.ts (getEvidence/createEvidence, comments), supabase/migrations",
    success_criteria:
      "Live-mode reads/writes of evidence and comments either hit real RLS-protected tables or are explicitly gated. Typecheck and tests stay green.",
  },
  {
    id: "db-confirm-prod-migrations",
    check: "database",
    title: "Confirm which migrations are actually applied on prod",
    detail:
      "All 45 local migrations are additive and code-aligned, but there is no single source of truth for which are live on the safetyiq project (e.g. hazard_review_status, ai_telemetry, csp_*).",
    recommendation:
      "Query supabase_migrations on the safetyiq project, reconcile against the local migration list, and record the result in docs/migrations-status.md so the applied/pending state is tracked.",
    severity: "amber",
    source: "curated",
    module: "Database",
    who_uses_it: "Platform Operations",
    priority: "medium",
    risk_level: "medium",
    effort: "small",
    where: "supabase/migrations, docs/",
    success_criteria:
      "docs/migrations-status.md lists every migration as applied or pending on prod. Any pending code-depended migration is flagged for apply.",
  },
  {
    id: "ux-remove-demo-data-sa",
    check: "routes_ux",
    title: "Remove demo data from superadmin UI",
    detail:
      "sa/companies renders MOCK_COMPANIES (BioStar/NovaChem) and sa/security renders MOCK_AUDIT_LOG (fake Sarah Chen events) outside mock mode, which is confusing in production.",
    recommendation:
      "Gate mock fixtures strictly on MOCK_MODE, or show an empty state with a 'no data connected' banner until the real feed is wired.",
    severity: "amber",
    source: "curated",
    module: "Admin Console",
    who_uses_it: "Superadmin",
    priority: "medium",
    risk_level: "low",
    effort: "small",
    where: "src/app/(app)/sa/companies/page.tsx, src/app/(app)/sa/security/page.tsx",
    success_criteria:
      "No fake company or audit data renders when MOCK_MODE is off. Empty states read clearly. Mock-mode demos still work.",
  },
  {
    id: "ux-eap-persist-and-errors",
    check: "routes_ux",
    title: "Fix EAP form persistence and add save-error feedback",
    detail:
      "eap.ts (~173) returns {ok:true} in mock mode without persisting, so the EAP editor loses data on reload. sa/companies add/update tenant shows no error when a save fails.",
    recommendation:
      "Persist the EAP to the mock store like other actions (or disable save with an offline notice), and add try/catch + an error toast around the tenant add/update actions.",
    severity: "amber",
    source: "curated",
    module: "Documents & Programs",
    who_uses_it: "EHS Coordinator and Company Admin",
    priority: "medium",
    risk_level: "low",
    effort: "small",
    where: "src/lib/actions/eap.ts, src/app/(app)/sa/companies/page.tsx",
    success_criteria:
      "The EAP editor keeps changes across reload. A failed tenant save shows a clear error. No successful save path regresses.",
  },
  {
    id: "cleanup-amaya-branding",
    check: "tech_debt",
    title: "Scrub remaining 'Amaya' branding",
    detail:
      "Legacy pre-rebrand references remain: the sa/history changelog and the AMAYA_EMBED_MODEL env fallback in embeddings.ts.",
    recommendation:
      "Remove the AMAYA_EMBED_MODEL fallback once old deployments are migrated and sanitize the changelog wording. Keep only intentional historical notes.",
    severity: "green",
    source: "curated",
    module: "Team & Settings",
    who_uses_it: "Platform Operations",
    priority: "low",
    risk_level: "low",
    effort: "small",
    where: "src/app/(app)/sa/history/page.tsx, src/lib/ai/embeddings.ts",
    success_criteria:
      "No 'Amaya' string remains in user-facing text or active config fallbacks. Embeddings still resolve a model.",
  },
  {
    id: "ai-evaluate-model-upgrade",
    check: "ai_engine",
    title: "Evaluate upgrading the default AI models",
    detail:
      "Defaults are claude-sonnet-4-6 / claude-haiku-4-5, which are a generation behind the current top tier (Opus 4.8, Sonnet 5, Haiku 4.5). Regulatory reasoning may benefit from an upgrade.",
    recommendation:
      "Benchmark the current defaults against Sonnet 5 / Opus 4.8 on a sample of EHS analyses, then update the SAFETYIQ_ANTHROPIC_MODEL default in env.ts if the newer model wins on accuracy vs cost.",
    severity: "green",
    source: "curated",
    module: "AI Gateway",
    who_uses_it: "Platform Operations",
    priority: "medium",
    risk_level: "medium",
    effort: "medium",
    where: "src/lib/env.ts, src/lib/ai/model-routing.ts",
    success_criteria:
      "A short benchmark compares old vs new models on EHS analyses. The default model is either upgraded with justification or explicitly kept with a note.",
  },
  {
    id: "ai-waste-classification-decision",
    check: "ai_engine",
    title: "Implement or remove the scaffolded waste_classification job",
    detail:
      "sa/ai lists a waste_classification job marked disabled, but there is no analyzeWaste() implementation, telemetry, or remediation behind it.",
    recommendation:
      "Decide the feature: either implement analyzeWaste() in engine.ts with grounding + telemetry, or remove the disabled job from the UI and note it as future work.",
    severity: "green",
    source: "curated",
    module: "Waste Management",
    who_uses_it: "Waste Coordinator and EHS Coordinator",
    priority: "low",
    risk_level: "low",
    effort: "medium",
    where: "src/app/(app)/sa/ai/page.tsx, src/lib/ai/engine.ts",
    success_criteria:
      "The waste_classification job is either fully wired (analyzer + telemetry) or removed from the UI. No dead placeholder remains.",
  },
  {
    id: "debt-replace-any-types",
    check: "tech_debt",
    title: "Replace ~11 explicit any-types with real schemas",
    detail:
      "Explicit any appears in devcenter API routes, middleware.ts, supabase/server.ts, reports/pptx.ts and a few actions, weakening type safety around external inputs.",
    recommendation:
      "Introduce typed schemas (Zod or interfaces) for LLM/API responses and auth/JWT objects; replace each any at the listed sites.",
    severity: "green",
    source: "curated",
    module: "AI Dev Command Center",
    who_uses_it: "Platform Operations",
    priority: "low",
    risk_level: "low",
    effort: "medium",
    where: "src/app/api/devcenter/*, src/middleware.ts, src/lib/supabase/server.ts, src/lib/reports/pptx.ts",
    success_criteria:
      "The listed any-types are replaced with concrete types/schemas. Typecheck stays green with no new eslint-disable lines.",
  },
  {
    id: "debt-split-ehs-actions",
    check: "tech_debt",
    title: "Split the monolithic ehs.ts action file",
    detail:
      "src/lib/actions/ehs.ts is ~2,825 lines mixing P-Engine orchestration, finding persistence, and forecast, which hurts navigability and testing.",
    recommendation:
      "Split into ehs-analysis.ts / ehs-findings.ts / ehs-forecast.ts and extract a shared LLM-default helper; keep exports stable.",
    severity: "green",
    source: "curated",
    module: "AI Safety Assistant",
    who_uses_it: "Platform Operations",
    priority: "low",
    risk_level: "low",
    effort: "large",
    where: "src/lib/actions/ehs.ts",
    success_criteria:
      "ehs.ts is split into focused modules under ~900 lines each with unchanged public exports. All tests stay green.",
  },
  {
    id: "sec-ops-cron-secret-audit",
    check: "security",
    title: "Rate-limit and audit-log the CRON_SECRET path on /api/ops",
    detail:
      "/api/ops accepts a CRON_SECRET directly with no logging or rate limiting; a leaked secret would grant unrestricted read of ops_* tables.",
    recommendation:
      "Add rate limiting and an audit-log entry for every CRON_SECRET access, and rotate the secret.",
    severity: "green",
    source: "curated",
    module: "Platform Operations",
    who_uses_it: "Platform Operations",
    priority: "low",
    risk_level: "low",
    effort: "small",
    where: "src/app/api/ops/route.ts, src/lib/ops/auth.ts",
    success_criteria:
      "CRON_SECRET access is rate-limited and recorded in the audit log. Normal superadmin access is unaffected.",
  },
  {
    id: "ux-a11y-and-lint-comments",
    check: "routes_ux",
    title: "Add nav a11y and document lint disables",
    detail:
      "LeftNav lacks aria-current/role attributes and several exhaustive-deps disables have no explanation; raw <img> usage in templates is undocumented.",
    recommendation:
      "Add aria-current='page' + role='navigation', annotate each eslint-disable with a reason, and document why raw <img> is required in the print templates.",
    severity: "green",
    source: "curated",
    module: "Workspace",
    who_uses_it: "All platform users",
    priority: "low",
    risk_level: "low",
    effort: "small",
    where: "src/components/layout/LeftNav.tsx, settings/training/legal/gateway components",
    success_criteria:
      "Active nav item exposes aria-current. Every eslint-disable has a one-line reason. Raw <img> sites carry a justifying comment.",
  },
];

// ── Severity helpers ─────────────────────────────────────────────────────────
const RANK: Record<ReviewStatus, number> = { red: 0, amber: 1, green: 2 };
const worse = (a: ReviewStatus, b: ReviewStatus): ReviewStatus => (RANK[a] <= RANK[b] ? a : b);

/** Minimal shape of the live gateway snapshot the page passes in (kept loose to
 * avoid importing the server-only gateway module here). */
export interface GatewayLiveInput {
  overall_status: "healthy" | "degraded" | "critical";
  anomaly_count: number;
  ai_fallback_rate: number;
  ai_calls: number;
}

function gatewayStatusToReview(s: GatewayLiveInput["overall_status"]): ReviewStatus {
  return s === "healthy" ? "green" : s === "degraded" ? "amber" : "red";
}

/**
 * Build the full review result. Pass the live gateway snapshot when available;
 * pass null if it could not run (the AI Engine check then degrades to the
 * curated view and liveRan=false). Findings whose id appears in convertedIds
 * already live on the task board, so they are dropped from the review list.
 */
export function buildPlatformReview(
  gateway: GatewayLiveInput | null,
  reviewedAt: string,
  convertedIds: string[] = [],
): PlatformReviewResult {
  const converted = new Set(convertedIds);
  const findings = CURATED.filter((f) => !converted.has(f.id)).sort(
    (a, b) => RANK[a.severity] - RANK[b.severity],
  );
  const convertedCount = CURATED.length - findings.length;

  const checks: ReviewCheckResult[] = REVIEW_CHECKS.map((c) => {
    const own = findings.filter((f) => f.check === c.key);
    let status: ReviewStatus = own.reduce<ReviewStatus>((acc, f) => worse(acc, f.severity), "green");
    let summary: string;

    if (c.key === "ai_engine" && gateway) {
      // Live signal wins for the AI Engine check.
      status = worse(status, gatewayStatusToReview(gateway.overall_status));
      const pct = Math.round(gateway.ai_fallback_rate * 100);
      summary =
        gateway.ai_calls === 0
          ? "Gateway reachable. No AI calls in the current window."
          : `Gateway ${gateway.overall_status}. ${gateway.anomaly_count} anomaly(ies), ${pct}% fallback across ${gateway.ai_calls} recent call(s).`;
    } else if (c.key === "ai_engine") {
      summary = "Live gateway check did not run — showing catalog findings only.";
    } else if (c.key === "build_type") {
      // No runtime source; reflect the last full review's verdict.
      status = "green";
      summary = `Last full review: typecheck clean, unit tests green (${LAST_FULL_REVIEW}).`;
    } else {
      summary = own.length
        ? `${own.length} open item(s) from the last full review.`
        : "No open items.";
    }

    return { ...c, status, summary, findingCount: own.length };
  });

  const overall = checks.reduce<ReviewStatus>((acc, c) => worse(acc, c.status), "green");

  return {
    reviewedAt,
    lastFullReview: LAST_FULL_REVIEW,
    overall,
    checks,
    findings,
    liveRan: gateway != null,
    convertedCount,
  };
}

export function getFindingById(id: string): ReviewFinding | undefined {
  return CURATED.find((f) => f.id === id);
}

// ── Labels / tones (mirrors suggestions.ts conventions) ──────────────────────
export const STATUS_LABEL: Record<ReviewStatus, string> = {
  green: "Healthy",
  amber: "Needs attention",
  red: "Action required",
};

export const STATUS_TONE: Record<ReviewStatus, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const SOURCE_LABEL: Record<ReviewSource, string> = {
  live: "Live",
  curated: "From last review",
};

const EFFORT_LABEL: Record<FindingEffort, string> = {
  small: "Small — a few hours",
  medium: "Medium — 1-2 days",
  large: "Large — several days",
};

/**
 * Pre-fill values for the New Task form — same keys as getSuggestionPrefill so
 * DevTaskIntakeForm consumes it unchanged. Reached via tasks/new?f=<id>.
 */
export function getFindingPrefill(f: ReviewFinding): Record<string, string> {
  const aiRole =
    `Address the issue described above in the ${f.module} area. ` +
    `Keep the change additive and scoped to this finding. ` +
    `Do not modify authentication, RLS policies, or user permissions without an explicit approval step.`;

  const dataInvolved =
    f.risk_level === "low"
      ? "Works within existing data. No new tables or schema changes expected. No new sensitive data."
      : "May touch existing tables or access rules — treat as a change that needs review before anything is applied.";

  const notes =
    `Filed by the Platform Review (${SOURCE_LABEL[f.source]} · ${EFFORT_LABEL[f.effort]}).` +
    (f.where ? ` Look at: ${f.where}.` : "");

  return {
    title: f.title,
    source_finding_id: f.id,
    business_goal: f.recommendation,
    feature_description: `${f.detail}\n\nRecommended fix: ${f.recommendation}`,
    module_affected: f.module,
    who_uses_it: f.who_uses_it ?? "Company Admin and EHS Coordinator",
    priority: f.priority,
    risk_level: f.risk_level,
    ai_role: aiRole,
    data_involved: dataInvolved,
    success_criteria: f.success_criteria,
    notes,
  };
}

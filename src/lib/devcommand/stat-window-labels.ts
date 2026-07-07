/**
 * Time-window labels for the Overview stat cards on /admin/dev-command.
 *
 * Each entry is the full subtext shown under a card's number. Traced against
 * the real queries in src/lib/devcenter/sample.ts (dashboardMetrics) and
 * src/lib/devcenter/repo.ts (getLiveDashboardData) — see
 * docs/dev-command-overview-stat-windows.md for the file:line mapping table.
 *
 * Do not edit a label without re-tracing its query — a stale label is worse
 * than no label.
 */
export const STAT_CARD_WINDOW_LABELS = {
  open_tasks: "Tasks still in progress (currently open)",
  need_approval: "Waiting on your yes/no (currently open)",
  // NOTE: window differs by mode — mock data filters to "today" (sample.ts),
  // live data is a "running" status snapshot (repo.ts). Labeled for the
  // live/production behavior. See docs Open Questions.
  runs_today: "AI agents currently working (active right now)",
  failed_runs: "Agent runs that errored (currently open)",
  security_warnings: "Critical findings blocking release (currently open)",
  xp_failures: "Ease-of-use problems found (currently open)",
  draft_plans: "Code drafts awaiting your review (currently open)",
  // NOTE: never overridden by live counts — always computed from
  // SAMPLE_DEPLOYMENTS regardless of MOCK_MODE. Window is confirmed from the
  // sample filter itself; the live data-wiring gap is flagged in the docs.
  active_prs: "PRs open on GitHub (currently open)",
  recent_deploys: "Preview and production releases (all time)",
  audit_today: "Actions logged today (today)",
} as const;

export type StatCardId = keyof typeof STAT_CARD_WINDOW_LABELS;

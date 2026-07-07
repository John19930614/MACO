# Overview stat grid: risk cards now shown first

On the AI Dev Command Center Overview page (`/admin/dev-command`), the **Security blockers**, **Failed reviews**, and **Experience issues** cards now always appear first in the stat grid — before the other activity counts (Open tasks, Need your approval, Active agents, Draft artifacts, Open pull requests, Deployments, Audit entries today).

## Why

A real blocker (security issue, failed review, or experience problem) should never get lost among routine activity numbers. Pinning these three cards first means an admin can glance at the top-left of the grid and immediately know if something needs attention.

## What changed

- Only the **display order** of existing stat cards changed.
- No card's label, computed value, hint, tone, or link changed.
- No cards were added or removed.
- The three risk cards are always shown first, **even when their value is zero**.
- The remaining cards keep their previous relative order, just shifted after the risk cards.

## Where the change lives

- `src/lib/devcenter/stat-card-order.ts` — new pure helper (`reorderStatCards`, `RISK_CARD_KEYS`) that pins `security_warnings`, `failed_runs`, and `xp_failures` first and appends the rest unchanged.
- `src/lib/devcenter/sample.ts` — `dashboardMetrics()` now returns `reorderStatCards(rawCards)` instead of the raw array.
- `src/app/(app)/admin/dev-command/page.tsx` and `_components/DevCommandDashboard.tsx` are unchanged — they already just render whatever order `dashboardMetrics()` returns.

## What did not change

- Routes, permissions, and access control for `/admin/dev-command` are unchanged (still admin/superadmin only).
- No database schema or migration changes.
- No changes to other Dev Command sub-pages (agents, approvals, audit-log, docs, import, review, settings, tasks).

# AGENTS.md — conventions & guardrails for AI coding tools

This file guides AI coding assistants working in the SafetyIQ repo. Read it before
making changes.

## What SafetyIQ is
Map-first safety intelligence platform built on the **Safety Cell** model and the
**ARC (Adaptive Risk Continuum)** method. Next.js 15 (App Router) + TypeScript +
Tailwind v4 + Supabase + MapLibre + React Flow + OpenAI.

## Non-negotiable safety rules (manual §8)
1. **AI is advisory.** Never let AI output override human judgment, legal
   obligations, or company procedure.
2. **Findings are pending by default.** AI findings and AI-proposed causal edges
   are stored with `review_status: "pending"` and must not mutate official
   records until a human accepts them.
3. **Force review for serious risk.** High/critical recommendations must set
   `human_review_required = true` regardless of model confidence (enforced in
   `src/lib/ai/engine.ts`).
4. **Audit everything sensitive.** Proof status changes, edge reviews, AI review
   decisions, role changes, and action closures go through `addAudit(...)`.
5. **Secrets are server-only.** `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`
   must never reach the browser. The AI engine is marked `server-only`.
6. **Risk score is for sorting/heat only** — never a risk-acceptance verdict.

## Conventions
- **Single source of truth for vocabulary:** `src/lib/constants.ts` (severity,
  proof states, edge types, roles, taxonomy) and `src/lib/arc/arc.ts` (ARC layers,
  GUS verticals, HSL dimensions). Don't hardcode these strings elsewhere.
- **Data access only through `src/lib/data/repo.ts`.** UI and API routes never
  import Supabase or the mock store directly. The repo switches on `MOCK_MODE`.
- **Mock mode must keep working.** Any new entity needs fixtures in
  `src/lib/data/mock.ts` and a repo function that handles both mock and live.
- **Validate input with Zod** (`src/lib/schemas.ts`) at the API boundary.
- **Client vs server:** map (MapLibre) and graph (React Flow) components are
  `"use client"` and dynamically imported with `ssr: false` where they touch
  `window`. Pages are server components that fetch via the repo and pass props.
- **Path alias:** `@/*` → `src/*`.
- **Styling:** Tailwind v4 with palette tokens in `src/app/globals.css`
  (`--color-primary`, `--color-accent`, `--color-ai`, `--color-hazard`,
  `--color-safe`, `--color-warning`, severity vars `--color-sev-{low,medium,high,critical}`).

## Before you finish
- `npm run typecheck` and `npm run build` must pass.
- New API routes follow the pattern in `src/app/api/cells/route.ts`
  (Zod parse → repo call → `NextResponse.json`).
- Keep ARC the methodology and SafetyIQ the product: new intelligence features map
  to an ARC layer (EXP / P-CLSS / HSL / GUS / VELA) — see docs/arc-integration.md.

# Dev Command — codebase grounding

## The problem it fixes

The AI Dev Command's planning + implementation agents used to receive only the
task and the planning notes — **no facts about the real codebase**. So they
invented files, routes, enums, and dependencies that don't exist here (e.g.
`add-enriched-chemical-inventory.ts`, `/dashboard/documents`, a competing
`DocumentStatus` enum, RTL/jsdom tests, ExcelJS). Verbatim implementation of
those plans produced dead, non-running UI.

## How grounding works

Every agent now gets a **codebase context** block prepended to its system prompt.
Two parts:

1. **Conventions** (`src/lib/devcenter/codebaseContext.ts`, hand-written) — the
   rules a scan can't infer: use `ehsRepo` for data, `getEffectiveTenantId()` for
   tenancy, the in-house `xlsExport` (not ExcelJS), lucide + primitives (no emoji),
   vitest node tests only (no RTL), reuse `constants.ts` enums, no `/dashboard` or
   `/platform` URL segments. Plus a **REALITY RULE**: every path/route/enum/dep an
   agent references must exist in the context or be a new file consistent with it;
   if the spec references something unreal, adapt to the real analog and say so.

2. **Manifest** (`src/lib/devcenter/codebaseContext.generated.ts`, auto-generated)
   — a real snapshot of routes, API routes, `ehsRepo` data functions, auth
   helpers, exported constants/enums, production dependencies, and the test
   convention.

## Where it's injected

- **All 6 planning agents** — one point in `withAI()` in
  `src/lib/devcenter/planning-agents.ts`. The provider caches the system prefix,
  so the context is cheap across every agent and record.
- **Implementation brief** — `src/lib/actions/generateImplementation.ts`
  (appended to its system prompt).

## Keeping it accurate

`scripts/gen-codebase-context.mjs` regenerates the manifest on every build via the
`prebuild` npm script, so it can't drift as the app grows. Run it by hand anytime:

```bash
node scripts/gen-codebase-context.mjs
```

When conventions change (new patterns, new "do/don't" rules), edit the
`CONVENTIONS` string in `src/lib/devcenter/codebaseContext.ts` — that part is
intentionally hand-maintained.

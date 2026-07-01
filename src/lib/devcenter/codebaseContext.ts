// Codebase context injected into every Dev Command AI agent so they plan against
// the REAL project — not an imagined one. Two parts:
//   • CONVENTIONS — hand-written rules a structural scan can't infer (the ones
//     that cause the worst hallucinations). Keep this current.
//   • CODEBASE_MANIFEST — auto-generated structural snapshot (routes, data layer,
//     enums, deps, test convention). Regenerated on every prebuild.

import { CODEBASE_MANIFEST } from "./codebaseContext.generated";

const CONVENTIONS = `## CONVENTIONS (authoritative — follow these exactly)

- **Framework/layout**: Next.js 15 App Router. App lives in maco-platform/, source under src/, import alias @/ → src/. Authenticated pages are under src/app/(app)/ — the "(app)" is a route GROUP, so it is NOT part of the URL. There is NO /dashboard or /platform URL segment. Link to real routes only (see manifest).
- **Data**: read through the repo layer (src/lib/data/ehsRepo.ts — getChemicals, getDocuments, etc.). It is RLS-scoped and mock-mode safe. Do NOT invent "file-based" data reads and do NOT return [] as a stand-in — that renders permanently empty UI.
- **Tenant / auth**: resolve the tenant with getEffectiveTenantId() / getServerTenantId() from src/lib/auth/session.ts. There is NO session.orgId and NO "placeholder-org-id".
- **Enums / constants**: reuse what exists in src/lib/constants.ts (e.g. ROLES, DocumentStatus). Never define a competing enum — map to the existing one.
- **Excel/reports**: use the in-house engine src/lib/xlsExport.ts (+ src/lib/reports/). exceljs is NOT a dependency; do not add it. SheetJS "xlsx" is available.
- **Server actions**: "use server" files in src/lib/actions/ following the exportChemicalSummaries.ts / ehs.ts patterns. AI calls go through src/lib/ai/provider.ts (generateStructuredJson) — there is no external AI_GATEWAY_URL HTTP endpoint.
- **UI**: use lucide-react icons + existing primitives (PageHeader, Card, Pill, Field/Input/Select). No emoji icons.
- **Tests**: vitest, node environment, in test/**/*.test.ts. @testing-library/react and jsdom are NOT installed — do NOT propose .tsx component tests using RTL. Test pure logic + server actions in node.
- **Migrations**: additive SQL in supabase/migrations/, "add column if not exists", RLS inherited. Applied to prod only with explicit human approval.

## REALITY RULE (do this before proposing anything)
Every file path, route, URL, enum, symbol, or dependency you reference MUST appear in the CONTEXT below, or be a NEW file that is consistent with these conventions. If the task/spec references something that does NOT exist here (a file, a route like /dashboard/x, an enum, a library like exceljs), DO NOT reproduce it verbatim — adapt to the real analog and STATE the adaptation plainly (e.g. "spec said X; real analog is Y"). Never invent files, routes, enums, or dependencies.`;

/** The full context block to prepend to an agent's system prompt. */
export function codebaseContextForPrompt(): string {
  return `--- CODEBASE CONTEXT (plan against THIS, not assumptions) ---\n\n${CONVENTIONS}\n\n${CODEBASE_MANIFEST}\n\n--- END CODEBASE CONTEXT ---`;
}

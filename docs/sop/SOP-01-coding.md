# SOP-01 — Coding SOP

| | |
|---|---|
| **Owner** | Engineer (human or AI coding assistant) |
| **Trigger** | Any change to code in `maco-platform/` |
| **Definition of done** | `typecheck` + `build` + `vitest` all green; conventions below honored; change recorded |
| **Related** | `AGENTS.md` (rules) · [SOP-06 System Test](README.md) · [SOP-07 Migration](SOP-07-database-migration.md) · [SOP-08 RLS](SOP-08-multitenancy-rls.md) |

---

## 1. Purpose & scope

How to make a code change to SafetyIQ correctly and safely, every time. Applies
to all application code (`src/`), tests (`test/`), and migrations
(`supabase/migrations/`). It exists because this platform is **multi-tenant** and
**safety-critical**: a careless change can leak one client's data to another, or
let advisory AI output masquerade as an authoritative safety record.

If a step here ever conflicts with `AGENTS.md` §"Non-negotiable safety rules,"
**`AGENTS.md` wins** — those six rules are inviolable.

---

## 2. The five non-negotiables (carry these in your head)

These are the rules most likely to be violated by a well-meaning change:

1. **AI is advisory.** AI findings and AI-proposed causal edges are stored
   `review_status: "pending"` and must not mutate official records until a human
   accepts them. High/critical → `human_review_required = true` regardless of
   model confidence.
2. **Tenant isolation is sacred.** Every tenant-scoped read/write is filtered by
   `tenant_id`. Never write a query, repo function, or storage path that could
   return another tenant's data. (A cross-tenant storage IDOR has already shipped
   and been fixed once — see memory `system_audit_findings`.)
3. **Secrets are server-only.** `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
   `ANTHROPIC_API_KEY` never reach the browser. Server-only modules carry the
   `server-only` import.
4. **One vocabulary.** Enums (severities, statuses, edge types, roles, HSL
   dimensions) live in `src/lib/constants.ts` and `src/lib/arc/arc.ts` — and are
   mirrored by CHECK constraints in `supabase/migrations/0001_init.sql`. Never
   hardcode these strings elsewhere; never let the two drift (the
   `schema-consistency` test enforces this).
5. **Mock mode must keep working.** Every screen runs offline on fixtures. Any
   new entity needs both a fixture in `src/lib/data/mock.ts` and a repo function
   that handles mock **and** live.

---

## 3. Architecture rules (where code is allowed to go)

| Concern | Rule |
|---|---|
| **Data access** | Only through `src/lib/data/repo.ts`. UI and API routes never import Supabase or the mock store directly — the repo switches on `MOCK_MODE`. |
| **Input validation** | Validate at the API boundary with Zod (`src/lib/schemas.ts`). Parse → repo call → `NextResponse.json`. Pattern: `src/app/api/cells/route.ts`. |
| **Client vs server** | Pages are server components that fetch via the repo and pass props. Browser-only components (MapLibre map, React Flow graph, 3D) are `"use client"` and dynamically imported with `ssr: false`. |
| **Path alias** | `@/*` → `src/*`. |
| **Styling** | Tailwind v4 with the palette tokens defined in `src/app/globals.css` — `--color-primary`, `--color-accent`, `--color-ai`, `--color-hazard`, `--color-safe`, `--color-warning`, and severity vars `--color-sev-{low,medium,high,critical}`. Don't hardcode a hex that already has a token. |
| **Audit** | Proof-status changes, edge reviews, AI review decisions, role changes, action closures go through `addAudit(...)`. |

---

## 4. Procedure — making a change

### Step 0 — Branch & protect your work ⚠️
This repo lives under **OneDrive**, and an out-of-band `git reset --hard` /
sync has wiped uncommitted edits mid-session before. Therefore:
- Work on a branch, not `master`.
- **Commit early and often.** Don't leave large uncommitted diffs sitting in the
  working tree. (Full procedure: SOP-03.)

### Step 1 — Understand before editing
- Read the surrounding code; match its naming, comment density, and idioms.
- Find the single source of truth for any vocabulary you touch (§2.4).
- If it's a data feature: trace the repo function (mock + live branches) first.

### Step 2 — Make the change
- Follow the architecture rules in §3.
- New API route → copy the `api/cells/route.ts` shape (Zod parse → repo → JSON).
- New entity → add: (a) the TypeScript type in `src/lib/types.ts`, (b) any enum
  in `constants.ts`/`arc.ts`, (c) the matching CHECK in `0001_init.sql`,
  (d) a mock fixture, (e) the repo function, (f) Zod schema.
- Touching the AI engine/gateway/prompts → also follow SOP-19 (AI Governance).
- Touching the schema → also follow SOP-07 (Migration) and SOP-08 (RLS).

### Step 3 — Verify locally (the gate)
Run, in order — **all three must pass**:
```bash
npm run typecheck     # tsc --noEmit — zero type errors
npm run build         # compiles + lints + prerenders every route
npm run test          # vitest run — full unit/integration suite
```
For anything that adds/changes a route or a user-visible screen, also run the
**system test** (SOP-06): build + the all-nav route smoke test. For anything that
touches tenant-scoped data, run the live RLS test (`npm run test:live`, SOP-08).

### Step 4 — Self-review against the checklist (§6)
Read your own diff once more against the checklist before declaring done.

### Step 5 — Record it
- Commit with a clear message.
- If the change is a non-obvious project fact (an architectural decision, a
  prod-affecting change, a gotcha), update the memory library (SOP-23) and the
  relevant `docs/`.
- Explain any DB/cloud/infrastructure change in plain English before applying it
  (standing preference — memory `feedback_explain_changes`).

---

## 5. Definition of done

A change is **done** only when:
- [ ] `typecheck`, `build`, and `vitest` are all green.
- [ ] Mock mode still works (no new entity left without a fixture + repo branch).
- [ ] No secret can reach the client; no query can cross a tenant boundary.
- [ ] Any new enum value has a matching migration CHECK (schema-consistency green).
- [ ] Audit trail written for any sensitive mutation.
- [ ] Change is committed; docs + memory updated if the fact is non-obvious.

---

## 6. Pre-commit checklist (copy into the PR / commit notes)

```
[ ] typecheck passes        [ ] build passes        [ ] vitest passes
[ ] mock mode works         [ ] repo.ts used (no direct Supabase in UI/API)
[ ] Zod-validated at boundary
[ ] tenant_id enforced on every new read/write
[ ] no server secret imported client-side
[ ] enums only from constants.ts / arc.ts (+ matching 0001_init.sql CHECK)
[ ] addAudit() on sensitive mutations
[ ] AI output stays pending until human review (if AI touched)
[ ] committed on a branch (not left uncommitted under OneDrive)
[ ] docs + memory updated if the change is non-obvious
```

---

## 7. Anti-patterns (rejected on sight)

- Importing `@supabase/*` or `mock.ts` directly into a page or API route.
- A new status/severity/role string typed inline instead of added to the enum.
- A repo function that handles live but not mock (or vice versa).
- An AI finding written straight to an official record without `pending` review.
- A query missing its `tenant_id` filter "because it's just a quick read."
- A `service_role` key, or any secret, referenced from a client component.
- Shipping with `build` warnings treated as errors silenced rather than fixed
  where they indicate a real problem (unused-var noise is acceptable; type or
  hook-dependency warnings that hint at bugs are not).

---

## 8. Enforcement

- **Automated:** `typecheck` + `build` + `vitest` are the hard gate. The
  `schema-consistency`, `tenancy`, `permissions`, and `authz-routes` tests
  specifically defend rules §2.2 and §2.4 — do not skip or weaken them to make a
  change pass; fix the change instead.
- **Manual:** §6 checklist on every commit; SOP-02 (Code Review) for merges to
  `master`.

---

*Revision: v1 · 2026-06-27 · first written. Mark "live" after the next change
ships through it end-to-end.*

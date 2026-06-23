# SafetyIQ — EHS Compliance Platform

AI-powered Environment, Health & Safety (EHS) platform by **Reliance Predictive
Safety Technologies**. A multi-tenant SaaS that turns a company's chemical
inventory, SOPs, audits, and incidents into a connected compliance program —
with the chemical inventory as the source of truth that cascades into waste
profiles, training assignments, and AI hazard flags.

## Modules

Chemical management (SDS & GHS hazard mapping) · Legal register · Audits &
findings · CAPA (corrective/preventive actions) · Incident reporting · OSHA
300/301 logs · Training & competency · Documents & SOP library · Risk
assessments · Waste management · Biosafety · Ergonomics · Monitoring &
equipment · Reports & analytics · Amaya AI assistant.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The app boots in **mock mode** out of the box (`NEXT_PUBLIC_SAFETYIQ_MOCK=true`,
or whenever the Supabase env vars are absent). Every screen works with
deterministic in-memory fixtures (the *BioStar Research* demo tenant) — **no
backend or API keys required**. Sign in from the login page using any of the
demo accounts listed there.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit tests (Vitest) |
| `npm run db:start` / `db:reset` / `db:stop` | Local Supabase stack (Docker) |

---

## Going live (Supabase + AI)

1. Create a Supabase project and apply the SQL in `supabase/migrations/` (via
   the Supabase CLI `supabase db push`, or the SQL editor in order).
2. Copy `.env.example` → `.env.local` and fill in real values. Set
   `NEXT_PUBLIC_SAFETYIQ_MOCK=false` (or remove it). Required:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (**server-only** — admin tasks: onboarding seed,
     team invites, auth callback provisioning)
   - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for the AI features
   - `SAFETYIQ_APP_URL` (your public origin, used to build auth-redirect links)
3. In Supabase → Authentication → URL Configuration, add your redirect URLs
   (`<origin>/auth/callback` and `<origin>/auth/set-password`) so employee
   invites and password resets can return to the app.
4. Deploy (e.g. Vercel); set the same env vars for preview and production.

When Supabase keys are present and mock mode is off, every page resolves the
caller's tenant and reads/writes live Postgres. Tenant isolation is enforced by
Postgres **Row-Level Security** — each table is scoped to the user's `tenant_id`,
with cross-tenant access reserved for Reliance admin accounts. The AI engine
(`src/lib/ai/engine.ts`) calls the configured model; with no key it falls back
to a deterministic heuristic.

### Onboarding & auth

- New tenants upload SOPs, manuals, rosters, and registers; the onboarding
  pipeline (`src/app/api/onboarding/process/route.ts`) uses AI to extract and
  seed each module, then surfaces a welcome banner and team roster.
- Auth supports email/password sign-in, employee invites (magic link →
  `/auth/callback` → set password), and self-service password reset. Manage the
  team from the **Team & Invites** page.

---

## Architecture

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15 App Router, React, TypeScript, Tailwind |
| Data / Auth / Storage | Supabase (Postgres + RLS), `@supabase/ssr` clients |
| AI | Anthropic (default) or OpenAI — server-only |
| Validation | Zod (`src/lib/schemas.ts`) |

```
src/
  app/(app)/        the EHS module pages (dashboard, chemicals, capa, …)
  app/(auth)/       login
  app/auth/         invite/recovery callback + set-password
  app/api/          onboarding pipeline + other routes
  lib/
    data/           ehsRepo (read facade) + in-memory store & mock fixtures
    actions/        server actions (ehs.ts, team.ts)
    auth/           session helpers (tenant/profile resolution)
    ai/             prompt + engine
    supabase/       browser + server clients
supabase/migrations/   schema + RLS policies
```

## Safety governance

SafetyIQ's AI is **decision support** — it never overrides human safety
judgment, legal obligation, or company procedure. AI output is stored as
pending and cannot mutate official records without review.

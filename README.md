# AMAYA — Advanced Mapping AI for Yielding Action

Map-first safety intelligence platform that turns inspections, incidents, permits,
and observations into connected **Safety Cells** — living risk objects that capture
*where* a risk is, *why* it happens, *what control proof* exists, and *what action*
will prevent it from happening again.

AMAYA is the implementation of **ARC — the Adaptive Risk Continuum** method by
Reliance Predictive Safety Technologies. See [docs/arc-integration.md](docs/arc-integration.md).

> Built from the build manual (`AMAYA_Build_Manual_and_Visual_Mockup`) with the
> ARC method diagram woven in as a first-class part of the product.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000  (opens the map-first dashboard)
```

The app boots in **mock mode** out of the box (`NEXT_PUBLIC_AMAYA_MOCK=true` in
`.env.local`). Every screen — map, Safety Cells, Control Proof Ledger, Causality
Map, Risk Dashboard, and all ARC screens — works with deterministic fixture data
and **no backend or API keys required**. A "Demo / mock data" badge shows in the
top bar while mock mode is active.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm run typecheck` | `tsc --noEmit` |

---

## Going live (Supabase + AI)

1. Create a Supabase project. Apply the SQL in `supabase/migrations/` (via the
   Supabase CLI `supabase db push`, or paste into the SQL editor in order:
   `0001_init.sql`, `0002_rls.sql`), then optionally run `supabase/seed.sql`.
2. Copy `.env.example` → `.env.local` and fill in real values. Set
   `NEXT_PUBLIC_AMAYA_MOCK=false` (or remove it).
3. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are **server-only** — never
   exposed to the browser (manual §8.2).
4. Deploy to Vercel; connect the repo and set the same env vars for preview and
   production.

When Supabase keys are present and mock mode is off, the data layer
(`src/lib/data/repo.ts`) queries Supabase tables whose names match the migration.
The AI Causality Engine (`src/lib/ai/engine.ts`) calls the configured model; with
no key it falls back to a deterministic heuristic analysis.

---

## Local database (Docker) — live RLS verified

For real-Postgres validation (not mock), use the local Supabase stack:

```bash
npm run db:start     # boot Postgres + Auth + Storage in Docker (first run pulls images)
npm run db:reset     # apply supabase/migrations/* + seed.sql
npm run test:live    # boot + reset + run the live RLS proof, then report
npm run db:stop      # shut the stack down
```

`npm run test:live` runs [`test-live/rls.live.test.ts`](test-live/rls.live.test.ts):
it creates two tenant-scoped users, signs in as each against the real database,
and asserts Postgres RLS blocks cross-tenant reads **and** writes while keeping
VELA cross-tenant. `embeddings.live.test.ts` proves the pgvector `match_cells`
function ranks the nearest cell and stays tenant-scoped. This is the proof mock
mode cannot give. Status: **6/6 passing** against local Postgres. The same
migrations run unchanged on hosted Supabase later.

The proactive **P-CLSS** engine runs on a schedule in production via a Vercel
Cron (`vercel.json` → `/api/cron/pclss`, guarded by `CRON_SECRET`); the ARC
Intelligence page also has a manual "Run engine now" and an "Auto" toggle.

## Architecture

| Layer | Tech | Notes |
| --- | --- | --- |
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind v4 | Map-first UI |
| Map | MapLibre GL JS | Offline-friendly dark basemap + severity pins |
| Causality graph | @xyflow/react (React Flow) | AI-proposed edges shown dashed, pending review |
| Data / Auth / Storage | Supabase (Postgres, RLS) | `@supabase/ssr` clients |
| AI | OpenAI (configurable) | Server-only; structured pending findings |
| Validation | Zod | `src/lib/schemas.ts` |

Folder map:

```
src/
  app/(app)/        map · cells · proof · causality · dashboard · arc/*
  app/api/          cells · evidence · proof · ai · graph · actions · arc/*
  components/       layout · map · cells · causality · ui
  lib/
    arc/arc.ts      ARC method definitions (EXP, P-CLSS, HSL, GUS, VELA)
    data/           repo (facade) · store + mock fixtures
    ai/             prompt template + engine (manual Appendix B, §5.10)
    supabase/       browser + server clients
supabase/migrations/   core data model + ARC tables + RLS
docs/                  build manual reference, ARC integration, data dictionary, test plan
public/                arc-method.svg + illustration assets
```

## Safety governance (non-negotiable)

AMAYA AI is **decision support**. It never overrides human safety judgment, legal
obligation, or company procedure. AI output is stored as **pending** and cannot
mutate official records; high/critical recommendations are forced to
`human_review_required`. See [AGENTS.md](AGENTS.md) and manual §8.

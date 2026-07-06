# event_embeddings missing-table fix

**What happened:** Part of the AI activity-search code ([src/lib/ai/embeddings.ts](../src/lib/ai/embeddings.ts)) queries a database table, `event_embeddings`, that no applied migration had ever created. It existed only in an old, unused draft migration (`supabase/_legacy_amaya_migrations/0006_event_embeddings.sql`) that was never run against production.

**What a user experiences:** Nothing crashes for the whole app. The AI-powered "find similar incidents/outcomes" feature just wouldn't return smart results — it degrades silently rather than breaking anything else.

**What we did:**
1. Checked prod via Supabase's table inspector (`list_tables`) to confirm `event_embeddings` genuinely did not exist yet — it did not.
2. Added a new, additive-only database migration ([supabase/migrations/20260706000000_event_embeddings.sql](../supabase/migrations/20260706000000_event_embeddings.sql)) creating `event_embeddings` with per-tenant data isolation (Row Level Security), matching the same pattern already used for the sibling `cell_embeddings` table. Applied directly to prod and verified: table exists, RLS is enabled, both a read policy and a write policy are in place.
3. Added a safety guard in the code (`EVENT_EMBEDDINGS_ENABLED` flag, off by default) plus explicit handling of Postgres's "table does not exist" error code, so the app always quietly skips the AI similarity lookup instead of throwing — whether the flag is off, or the table happens to be missing in some other environment (e.g. a local dev database that hasn't run migrations yet).

**Support/success one-liner:** "If a customer reports AI similar-incident suggestions aren't showing, this is expected right now — the feature is gated behind a flag while we roll it out, and it always fails safely with no smart-search data rather than an error. No action needed."

**Status:** DONE 2026-07-06. Migration applied to prod and verified (table + RLS + policies confirmed via `pg_tables`/`pg_policies`), code guard shipped, deployed to prod (`dpl_HS1aTWEtpQnNPqTPwJBcC9ycGi1a`, https://safetyiq-platform.vercel.app). `EVENT_EMBEDDINGS_ENABLED` remains unset in production until the feature is ready to turn on; when it is, set it to `true` in Vercel's environment variables for the project. Re-run the Platform Review scan to confirm the `scan:ghost-table:event_embeddings` finding clears.

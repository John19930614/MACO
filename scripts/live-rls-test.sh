#!/usr/bin/env bash
# Boot the local Supabase stack, apply migrations + seed, then run the LIVE RLS
# proof against the real Postgres. Requires Docker Desktop to be running.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Starting local Supabase (first run pulls Docker images; can take a few minutes)…"
npx --yes supabase start

echo "→ Applying migrations + seed (db reset)…"
npx --yes supabase db reset

echo "→ Reading local keys from supabase status…"
eval "$(npx --yes supabase status -o env)"
export LIVE_SUPABASE_URL="${API_URL}"
export LIVE_ANON_KEY="${ANON_KEY}"
export LIVE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"

echo "→ Running live RLS tests against ${LIVE_SUPABASE_URL}…"
npx vitest run --config vitest.live.config.ts

-- ============================================================================
-- Security hardening for the Chemical & GHS Intelligence module
-- ============================================================================
-- Resolves Supabase security-advisor findings introduced by 20260625010000:
--   1. chemical_inventory_risk_view was SECURITY DEFINER (default) → it would
--      bypass RLS and could leak cross-tenant rows. Switch to security_invoker
--      so it enforces the querying user's RLS on the underlying tables.
--   2. set_updated_at() had a mutable search_path → pin it.
-- ============================================================================

-- 1. Make the risk roll-up view honor the caller's RLS (no cross-tenant leak).
alter view public.chemical_inventory_risk_view set (security_invoker = on);

-- 2. Pin the trigger function's search_path (now() is in pg_catalog, always available).
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- Fix infinite recursion in the RLS helpers.
--
-- current_role_name() / current_tenant_id() read from `profiles`, but the
-- profiles RLS policy (profiles_self_read) itself calls current_role_name().
-- Under a user context a write that evaluates these helpers recurses until
-- Postgres aborts with "stack depth limit exceeded" (54001).
--
-- SECURITY DEFINER runs the lookup as the function owner, bypassing RLS on the
-- profiles read and breaking the cycle. The functions only read the caller's own
-- role/tenant by auth.uid(), so this does not widen visibility.
-- ════════════════════════════════════════════════════════════════════════

create or replace function current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from profiles where id = auth.uid()
$$;

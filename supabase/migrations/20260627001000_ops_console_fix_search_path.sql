-- =============================================================================
-- Forward-fix for 20260627000000_ops_console.sql
-- =============================================================================
-- The security advisor flagged public.ops_set_updated_at() with a role-mutable
-- search_path (lint 0011_function_search_path_mutable). Pin it to `public`, the
-- same way auth_tenant_id() / is_reliance_admin() are declared. No behavior
-- change — the trigger only stamps updated_at.
-- =============================================================================

create or replace function public.ops_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

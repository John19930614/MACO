-- ════════════════════════════════════════════════════════════════════════
-- Table privileges for the Supabase API roles.
--
-- The schema enables RLS and defines policies (0002, 0007), but PostgREST still
-- needs table-level GRANTs or it returns "permission denied for table …" before
-- RLS is even consulted. Hosted Supabase auto-grants these; a migrations-only
-- local/CI database does not, so grant them explicitly here.
--
-- RLS remains the actual gate for anon/authenticated (the policies decide what
-- each tenant/role may see and do); service_role bypasses RLS by design.
-- ════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- Future tables/sequences/routines inherit the same grants.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;

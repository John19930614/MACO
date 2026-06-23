-- ════════════════════════════════════════════════════════════════════════
-- SECURITY FIX: in_tenant() leaked every tenant's rows to the anon role.
--
-- in_tenant(t) was `current_tenant_id() is null or t = current_tenant_id()`.
-- The `is null` branch was meant to let a GLOBAL OPERATOR (an authenticated
-- profile whose tenant_id is null) see all tenants. But an UNAUTHENTICATED
-- caller (anon — the public key, no JWT) also resolves current_tenant_id() to
-- null (no profile row), so anon was treated as a global operator and could read
-- every tenant's data via the public key.
--
-- Fix: only an authenticated user that actually has a profile may pass, and the
-- global-operator branch requires that profile to exist. Anon (no profile) is
-- denied everywhere in_tenant gates. SECURITY DEFINER so the profiles lookup
-- isn't itself subject to RLS.
-- ════════════════════════════════════════════════════════════════════════

create or replace function in_tenant(row_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.tenant_id is null or p.tenant_id = row_tenant)
  )
$$;

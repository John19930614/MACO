-- ════════════════════════════════════════════════════════════════════════
-- Insert policies for app-written tables that had none.
--
-- The app writes these via the authenticated user's client (not the service
-- role), so without an INSERT policy RLS silently rejected every write — the
-- repo ignored the error and the call looked like it succeeded. Surfacing those
-- errors (dbWrite) exposed it. Gate inserts to the user's own tenant; the rows
-- are append-only system/derived records.
-- ════════════════════════════════════════════════════════════════════════

-- Every write appends an audit entry as the acting user. Bind actor_id to
-- auth.uid() so a client hitting PostgREST directly cannot forge entries
-- attributing actions to another user (the app already stamps the real user).
create policy write_audit on audit_log
  for insert with check (in_tenant(tenant_id) and actor_id = auth.uid());

-- AI findings are produced by analysis the user triggered; stored pending review.
create policy write_findings on ai_findings
  for insert with check (in_tenant(tenant_id));

-- EXP captures (knowledge ghost) — contributor and up, matching the app gate.
create policy write_exp on exp_captures
  for insert with check (in_tenant(tenant_id) and current_role_name() in ('contributor','supervisor','safety_manager','admin'));

-- P-CLSS proactive run log.
create policy write_pclss on pclss_runs
  for insert with check (in_tenant(tenant_id));

# SafetyIQ — Framework Gaps & Issues (audit 2026-06-27)

Goal: **find gaps/issues and fix the existing framework — not remake it.** Severity → what's broken → proposed fix. Verified against the live prod DB (`bjgqjpekhicqlunxbobo`).

---

## 🔴 GAP 1 — The ARC / intelligence framework has NO live database (CRITICAL, needs a decision)
**Verified:** 16 core tables are **MISSING in production**: `safety_cells, control_proofs, causal_edges, ai_findings, actions, exp_captures, hsl_signals, pclss_runs, vela_insights, cell_embeddings, event_cells, evidence, comments, gateway_rejects, staged_records, locations`.

**Impact:** In **live mode**, the whole SafetyIQ intelligence layer is non-functional — Safety Cells, the AI Gateway pipeline (reads `safety_cells`), VELA, GUS causality, EXP capture, HSL, P-CLSS forecasting, the `/cells/*` and `/arc/*` pages, and the related APIs (`/api/cells`, `/api/arc/*`, `/api/graph`, `/api/proof`, `/api/events`, `/api/evidence`, `/api/actions`, `/api/embeddings`) all hit missing tables. It only works in **mock/demo** mode. (These routes are superadmin-only in nav, so client tenants don't see them — but the framework you describe as the product's brain is not live.)

**Also causes:** the silent `gateway-agent` cron — `runGatewayHealthCheck` loads the gateway dataset (`safety_cells` …) which errors before it can log.

**✅ FIXED 2026-06-27 (John: "make it live").** Applied `0001_init` → `0002_rls` → `0003_embeddings` to prod (+ `20260627006000_arc_live_hardening`). All 16 tables now exist with RLS; advisors have **no errors** (fixed a `locations` RLS-disabled ERROR the original migration left, + pinned search_path on `in_tenant`/`match_cells`). Tables are empty (no seed) — live-mode `/cells` + `/arc/*` no longer hit missing tables; they'll populate as cells/EXP/etc. are created. Remaining low-risk advisor WARNs only (function-executable class, by design; vector-in-public benign).

---

## 🟠 GAP 2 — Background health monitor (gateway-agent cron) never runs (MEDIUM)
**Cause:** two-part — (a) missing `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` in **Vercel** env (route fail-closes), and (b) once it runs it loads `safety_cells` (GAP 1) and errors. `gateway_agent_health_log` is empty.
**Fix:** John adds the two env vars in Vercel + redeploys (config, can't be done from here); GAP 1 must also be resolved for the gateway dataset to load.

## 🟠 GAP 3 — Standing security-advisor warnings (MEDIUM, partly by design)
From Supabase security advisors (unchanged all session):
- `auth_tenant_id()` and `is_reliance_admin()` are `SECURITY DEFINER` and **callable by anon/authenticated** via RPC. Low data risk (they only return the caller's own tenant / admin flag) but flagged. **Fix:** `revoke execute ... from anon, authenticated` (they're only needed inside RLS policies, not as RPCs).
- `ghs-pictograms` **public bucket allows listing** all files. **Fix:** tighten the storage SELECT policy to object-read only.
- **Leaked-password protection disabled** in Supabase Auth. **Fix:** John toggles it on (Auth settings).

## 🟡 GAP 4 — Operator login / RBAC (MEDIUM, operational)
John's everyday logins (`john.h.haldemann@gmail/hotmail`) are **tenant users** (Cortexa), so they can't reach `/sa/*` or the ops tools; only `safety360docs11@gmail.com` is superadmin (tenant_id NULL). Not a code bug, but it blocks John from using the admin/console surfaces. **Fix options:** sign in as the superadmin account (needs a password reset — explicit go-ahead required), or use service-role admin mode in the standalone console.

## 🟢 GAP 5 — audit logging (FIXED 2026-06-27)
`audit_log` was missing in prod + `addAudit` used a colliding mock-id generator → every prod audit write threw. **Fixed:** table created + DB-generated ids + best-effort; deployed + verified.

## 🟢 GAP 6 — overlapping admin surfaces (LOW, cleanup)
The standalone `SafetyIQ-Admin-Console.html` (outer folder, not in git) overlaps the in-app `/sa/*` + `/api/ops`. Decide one canonical; keep the HTML as a zero-deploy fallback. No urgency.

---

## Recommended order
1. **Decide GAP 1** (is ARC meant to be live?) — everything else partly depends on it.
2. If yes → apply ARC migrations (fixes GAP 1, unblocks GAP 2's data load).
3. **GAP 3 security tightening** — quick, low-risk code/SQL fixes I can do with approval.
4. **GAP 2 / GAP 4** — config + access, need John (Vercel env / password).

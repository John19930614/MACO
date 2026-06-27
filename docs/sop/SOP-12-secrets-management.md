# SOP-12 — Environment & Secrets Management SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | Adding, reading, or rotating any key/secret/env var |
| **Definition of done** | Secret present where the runtime needs it, absent from the client bundle and git, documented |
| **Related** | [SOP-11 Release](SOP-11-release-deployment.md) · [SOP-01 Coding](SOP-01-coding.md) · [SOP-18 Access Control](README.md) |

---

## 1. Purpose & scope

How secrets are stored, used, and rotated. A leaked `service_role` key bypasses
all RLS (every tenant's data); a leaked AI key is a billing/abuse risk. The
platform's entire tenant-isolation story (SOP-08) assumes the service key never
leaves the server.

---

## 2. The secrets (what exists)

Server-only (must NEVER reach the browser):
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS; highest-value secret.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` — AI providers.
- `RESEND_API_KEY` — transactional email / invites.
- `CRON_SECRET` — guards `/api/health` and cron endpoints.

Public by design (safe in the browser, `NEXT_PUBLIC_` prefix):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key is
  RLS-bound and meant to be public.

Accessor: server secrets are read through `serverSecrets()` in `src/lib/env.ts`
— a server-only path. Server-only modules carry the `server-only` import so a
client import fails the build.

---

## 3. The rules

1. **`NEXT_PUBLIC_` = public.** Anything with that prefix ships to the browser.
   Never prefix a real secret with it.
2. **Secrets are read server-side only**, via `serverSecrets()` / server modules.
   No secret in a `"use client"` component, ever.
3. **Never commit secrets.** `.gitignore` excludes `.env`, `.env*.local`,
   `.env.local`, `supabase/.env`. Don't `git add -f` them.
4. **Never print a secret.** No `console.log`, no echo, no committing it into a
   doc, test, or error message. (When inspecting env in a shell, redact.)
5. **Prod secrets live in Vercel**, not in a committed file. `.env.local` is for
   local dev only.
6. **Rotate on exposure.** If a secret is ever pasted, logged, or shared, rotate
   it at the provider and update Vercel — don't wait.

---

## 4. Where each secret lives

| Location | Purpose |
|---|---|
| `.env.local` (gitignored) | Local dev values |
| `.env.production` (gitignored) | Local prod-mode testing |
| **Vercel project env vars** | The real production source of truth |
| Supabase dashboard | DB-side keys originate here |

> Outstanding (memory `deployment_vercel`): John still owes 2 secret env keys +
> the Supabase redirect URL in Vercel, then a redeploy. Until set, prod features
> needing them run degraded.

---

## 5. Procedure — adding / rotating a secret

1. Add it at the provider (Supabase / OpenAI / Anthropic / Resend).
2. Add to **Vercel** env vars (Production scope) — this is what prod uses.
3. Add to local `.env.local` for dev (never committed).
4. If consumed in code, read it via `serverSecrets()` / a `server-only` module —
   never directly in client code.
5. Redeploy (SOP-11) so Vercel picks up the new value.
6. For a rotation: update everywhere, then **invalidate the old value** at the
   provider.

---

## 6. Checklist

```
[ ] secret has no NEXT_PUBLIC_ prefix
[ ] read only via serverSecrets()/server-only module
[ ] not committed (.gitignore intact, no -f)
[ ] not logged/echoed/pasted anywhere
[ ] set in Vercel (prod source of truth), not just .env.local
[ ] redeploy done so prod has it
[ ] on rotation: old value invalidated at the provider
```

---

*Revision: v1 · 2026-06-27 · first written.*

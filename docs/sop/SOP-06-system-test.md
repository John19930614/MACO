# SOP-06 — System Test SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | Pre-release, after a merge to `master`, or on demand ("run a system test") |
| **Definition of done** | Build green; every nav route returns HTTP 200; suite green |
| **Related** | [SOP-01 Coding](SOP-01-coding.md) · [SOP-11 Release](SOP-11-release-deployment.md) · [SOP-08 RLS](SOP-08-multitenancy-rls.md) |

---

## 1. Purpose & scope

A fast, repeatable "is the whole app healthy" check across **every navigation
destination** — not just the unit suite. It catches a page that compiles but
throws at render, a dead nav link, or a route that regressed after a refactor.

The system test has four layers; run the ones that fit the change (a release
runs all four):

1. **Static / dead-link** — every nav href maps to a real `page.tsx`.
2. **Build** — `next build` compiles + type-checks + prerenders every route.
3. **Unit/integration** — `vitest run` (includes the schema-consistency,
   tenancy, permissions, authz guards).
4. **Runtime route smoke** — start the app in **mock mode** and hit every nav
   route; each must return 200 with no server-side exception.

---

## 2. Procedure

### Layers 2 & 3 — build + suite
```bash
npm run build
npm run test
```

### Layer 4 — runtime route smoke (the all-nav check)
In one terminal, start the app in **mock mode** (so middleware passes through and
every page SSR-renders without real auth):
```bash
NEXT_PUBLIC_SAFETYIQ_MOCK=true npx next dev -p 3210
```
In another, once it's listening:
```bash
npm run test:system          # defaults to http://localhost:3210
# or: SYSTEM_TEST_BASE=<url> npm run test:system   (against a preview deploy)
```
`scripts/system-test.mjs` fetches all ~56 nav routes (Company + Reliance/SA +
Operate/ARC), prints a PASS/REDIR/FAIL table, and **exits non-zero if any route
fails or unexpectedly redirects** — so it works as a release gate.

> Cold first-hit times are large in dev (on-demand compilation) — that's normal,
> not a failure. Only the status code matters.

### Interpreting results
- **PASS / 200** — page rendered.
- **FAIL / 500** — a server-side exception. Read the dev-server log, fix the
  source, re-run.
- **REDIR / 3xx** — in mock mode this usually means the server wasn't actually in
  mock mode (middleware bounced to `/login`). Restart with the env var set.

---

## 3. Maintenance — keep the route list honest

The route list in `scripts/system-test.mjs` mirrors the nav in
`src/components/layout/LeftNav.tsx`. **When a nav destination is added or removed
there, update the script's `ROUTES` in the same change.** A quick dead-link check:
every nav href should have a `src/app/(app)<href>/page.tsx`.

---

## 4. When to run

| Situation | Layers |
|---|---|
| Quick local change | 2 + 3 |
| Added/changed a route or screen | 1 + 2 + 3 + 4 |
| Pre-release (SOP-11) | all four |
| "Run a system test" on demand | all four + report |

---

## 5. Checklist

```
[ ] build green
[ ] vitest green (incl. schema-consistency / tenancy / permissions / authz)
[ ] mock-mode server up; npm run test:system → all routes PASS (200)
[ ] route list updated if nav changed
[ ] failures diagnosed from source, not silenced
```

---

*Revision: v1 · 2026-06-27 · first written. Codifies the 56-route system test
run on 2026-06-27 (all nav routes PASS).*

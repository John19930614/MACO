# SOP-05 — Testing SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | Writing or maintaining tests; adding behavior that needs coverage |
| **Definition of done** | New behavior covered; the right test tier chosen; suites green |
| **Related** | [SOP-01 Coding](SOP-01-coding.md) · [SOP-06 System Test](SOP-06-system-test.md) · [SOP-08 RLS](SOP-08-multitenancy-rls.md) |

---

## 1. Purpose & scope

What to test, where, and with which tool. The platform leans on **fixtures +
guards** rather than a heavy E2E suite, so the discipline is: every safety
property has a test that fails loudly when it breaks.

---

## 2. The test tiers (pick the right one)

| Tier | Tool / command | Use for |
|---|---|---|
| **Unit / integration** | Vitest — `npm run test` (`test/*.test.ts`) | Logic, repo functions, schemas, engine output, the **guard** tests |
| **Live RLS** | `npm run test:live` (`test-live/*`, needs Docker) | Proving Postgres RLS reproduces the mock isolation contract |
| **System / routes** | `npm run test:system` (mock server) | Every nav route renders (SOP-06) |
| **Build/type** | `npm run build` / `typecheck` | Compile + prerender every route |

The **guard tests** are load-bearing — keep them green, never weaken them to pass
a change: `schema-consistency`, `tenancy`, `permissions`, `authz-routes`, plus
the AI guards (`gateway`, `grounding`, `model-routing`, `review-policy`, `eval`).

---

## 3. Rules

1. **New entity → fixture + test.** A new repo entity needs a `mock.ts` fixture
   and a test exercising both mock and (where relevant) live paths.
2. **New safety property → new guard.** Tenancy, authz, enum, or AI-governance
   behavior gets a test that fails if the property regresses.
3. **Test behavior, not implementation.** Assert on outputs/contracts so refactors
   don't churn tests.
4. **Determinism.** Fixtures are deterministic (the BioStar demo tenant); don't
   write tests that depend on wall-clock, network, or live keys (those belong in
   `test-live`).
5. **A bug fix ships with a test** that would have caught it.

---

## 4. Procedure

1. Pick the tier (§2). Most logic → Vitest; isolation → `test:live`; routes →
   `test:system`.
2. Write/extend the test alongside the change.
3. Run `npm run test`; for data/isolation changes also `npm run test:live`; for
   route/UI changes also the system test.
4. Confirm the new test actually fails without the fix (sanity-check the guard).

---

## 5. Checklist

```
[ ] right tier chosen for what changed
[ ] new entity has fixture + test (mock + live where relevant)
[ ] new safety property has a guard test
[ ] bug fix includes a regression test
[ ] no reliance on clock/network/live keys in unit tier
[ ] npm run test green (+ test:live / test:system as applicable)
```

---

*Revision: v1 · 2026-06-27 · first written.*

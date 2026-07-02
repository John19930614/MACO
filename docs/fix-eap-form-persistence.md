# Fix: EAP Form Persistence, Save-Error Feedback & Amaya Chat Removal

_Shipped 2026-07-02 · no database migration · no new dependencies_

## What was broken

### 1 — Emergency Action Plan editor (mock/demo mode)
In mock mode, clicking **Save** in the EAP editor appeared to work — the button
confirmed and no error was shown — but nothing was actually saved.
`saveEap()` returned `{ok:true}` without writing anywhere, and `getEap()`
always returned the static demo fixture. Reloading the page silently reset the
form to the original defaults.

### 2 — Company management page (`/sa/companies`)
Errors from add/update/archive/restore **were** reported, but in the green
success toast — a failure rendered as "✓ Error: …", which reads as a success at
a glance. And if the server action itself rejected (network drop, unexpected
server error), nothing was caught: the admin saw no feedback at all.

### 3 — Legacy quick-chat ("Amaya chat")
The floating chat bubble (`AssistantDrawer`) was a leftover from the Amaya era:
a rule-based canned-reply widget that only pattern-matched keywords and pointed
at module pages. It looked like a live AI assistant but wasn't, and the real
SafetyIQ AI assistant already lives at `/ai`.

## What was fixed

### EAP editor — changes now survive reloads (mock mode)
- The mock store (`src/lib/data/store.ts`) gained an `eap` slot.
- `saveEap()` in mock mode merges the submitted fields into that slot;
  `getEap()` reads it back, falling back to the demo fixture until first save.
- Reloading the editor now shows your last saved values.
- **The live (Supabase) save path is unchanged** — it already returned
  `{ok:false, error}` on database errors, and the form already displayed them.

### EAP editor — rejected saves no longer vanish
The form's submit handler now catches a rejected server action (network drop /
unexpected server error) and shows the same inline error box as any other save
failure, keeping the entered values on screen.

### Company management — honest error toasts
- The toast now has an error variant: red, "⚠", `role="alert"`, and it stays
  up 6 s instead of 3.5 s. Success toasts are unchanged.
- Add, update, archive, and restore calls are wrapped in try/catch so a
  rejected action also produces a visible error toast, and the modal stays
  open with the entered data intact.
- The server actions in `src/lib/actions/sa.ts` needed no changes — they
  already return `{ok:false, error}` and keep the superadmin (`getSaCtx`)
  guard on every path.

### Amaya chat removed
`AssistantDrawer.tsx` is deleted and unmounted from the app layout. The full
SafetyIQ AI assistant at `/ai` (linked from the left nav) is unaffected.

## What did NOT change
- Live-mode EAP save behaviour and its error handling.
- Auth guards: superadmin (`getSaCtx`) on all tenant actions; tenant scoping
  via `getServerTenantId()` on EAP reads/writes.
- No database schema changes; no new UI libraries.

## Files changed
| File | Change |
|---|---|
| `src/lib/data/store.ts` | New `eap` slot in the mock store |
| `src/lib/actions/eap.ts` | Mock save persists to the store; mock read falls back to fixture |
| `src/app/(app)/emergency/edit/EapEditForm.tsx` | Catches rejected save actions → inline error |
| `src/app/(app)/sa/companies/page.tsx` | Error-variant toast; try/catch on all tenant calls |
| `src/app/(app)/layout.tsx` | AssistantDrawer unmounted |
| `src/components/layout/AssistantDrawer.tsx` | **Deleted** |
| `test/eap-persistence.test.ts` | New: mock round-trip, merge, reset, live error paths |

## Testing
```bash
npm run typecheck
npx vitest run test/eap-persistence.test.ts   # 8 tests
npm test                                       # full suite
npm run test:system                            # all-56-nav gate (layout changed)
```

Note for reviewers: the original incoming spec described a different codebase
shape (`canWrite()` guard in `eap.ts`, `@/lib/mock/store`, `src/tests/`,
try/catch missing on the live EAP path, silently-swallowed tenant errors).
Those didn't match reality and were adapted as described above.

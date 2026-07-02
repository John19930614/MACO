# Navigation Accessibility & Lint Conventions

> **Applies to:** `src/components/layout/LeftNav.tsx`, `src/lib/nav/activeKey.ts`,
> print/PDF template files, and any file containing `eslint-disable` comments.

This document records the rationale for three related changes: navigation ARIA
attributes, the `eslint-disable` annotation convention, and the raw `<img>`
justification pattern used in print/PDF templates.

> **Implementation note (how this landed vs. the original spec).** The original
> task described a greenfield `LeftNav` with a flat `NavItem[]` (`key`/`children`)
> and separate `passport/page.tsx` + `label/page.tsx` print templates. The real
> codebase differs: `LeftNav` is a role-driven, section-based component with no
> per-item `key`, there is **no** `chemicals/[id]/label` route, the package
> manager is **npm** (not pnpm), and Vitest only collects tests under
> `test/**/*.test.ts`. The change was therefore *adapted* onto the real code
> rather than applied verbatim — see the deviations noted inline below.

---

## 1. Navigation ARIA attributes

### What changed

`LeftNav` (`src/components/layout/LeftNav.tsx`) now renders:

```tsx
<nav role="navigation" aria-label="Main navigation">
  ...
  <Link aria-current={active ? "page" : undefined} href={item.href}>
    {item.label}
  </Link>
  ...
</nav>
```

### Why

| Attribute | Purpose |
|---|---|
| `role="navigation"` | Explicit landmark role. Although `<nav>` implies this role, some older screen readers (JAWS < 18, TalkBack on Android < 9) do not expose it without the explicit attribute. |
| `aria-label="Main navigation"` | Distinguishes this landmark from secondary `<nav>` elements (breadcrumbs, pagination, the mobile drawer). Screen-reader users can jump directly to *Main navigation* in their landmarks list. |
| `aria-current="page"` | ARIA 1.1 pattern. Announces **"current page"** on the active link. `undefined` (not `false`) is used for inactive links so the attribute is omitted entirely rather than serialised as `aria-current="false"`. |

### Active-route logic

The active link is derived from a pure helper,
`getActiveKey(pathname, items)`, defined in **`src/lib/nav/activeKey.ts`** and
re-exported from `LeftNav.tsx` (so it is importable from either module). It is
the single source of truth for active detection — the component maps its
section-based nav entries onto the generic `NavItem` shape (using each entry's
`href` as its `key`) and calls `getActiveKey` once per render.

Matching rules:

1. **Exact match** — `item.href === pathname`
2. **Longest-prefix match** — `pathname.startsWith(item.href)`, longest wins
   (root `'/'` is excluded from prefix matching so it never matches everything)
3. **No match** — returns `null` (no `aria-current` applied)

> **Why a separate `src/lib/nav/activeKey.ts` module?** `LeftNav.tsx` is a
> `"use client"` component that imports Supabase, React context, and icon
> libraries. Extracting the pure logic keeps the unit test in a plain Node
> environment with no client runtime to boot, and gives the helper a stable home
> independent of the component's rendering concerns.

This function is covered by a Vitest unit test in
**`test/getActiveKey.test.ts`** (9 cases: exact, root-only, root-exclusion,
nested exact ×2, longest-prefix ×2, no-match, empty list).

> **Deviation:** the test lives in `test/` (not `src/lib/nav/__tests__/`) because
> `vitest.config.ts` only collects `test/**/*.test.ts`; a test under `src/` would
> silently never run.

### Behavioural note

The previous implementation special-cased `/dashboard` to require an exact match
and used a plain `startsWith` for every other item. Because no nav `href` in the
current menu is a prefix of another, the longest-prefix rule produces identical
highlighting for every existing route; the only difference is that a
hypothetical `/dashboard/<sub>` route would now also highlight *Command Center*,
which is the desired behaviour.

---

## 2. `eslint-disable` annotation convention

### Rule

Every `eslint-disable`, `eslint-disable-next-line`, and `eslint-disable-line`
comment **must** include a plain-English reason after ` -- `.

### Format

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps -- <reason>
// eslint-disable-line @typescript-eslint/no-explicit-any -- <reason>
/* eslint-disable-next-line react-hooks/exhaustive-deps -- <reason> */
```

### Why

A suppression without a reason looks like a bug. A suppression *with* a reason
lets the next developer evaluate whether the exception is still valid or can be
removed. The reasons in this codebase fall into a few recurring buckets:

| Rule | Typical reason in this codebase |
|---|---|
| `@typescript-eslint/no-explicit-any` | `@supabase/ssr` doesn't export its `CookieOptions` type; or the Anthropic SDK types `response.content` as a block union that we narrow manually; or a Supabase join returns an untyped row shape. |
| `react-hooks/exhaustive-deps` | An effect/memo is intentionally driven by a narrow trigger; the excluded deps are stable setters or imperatively-read values, and re-running on them would restart an animation or re-fire audio/TTS. |
| `@next/next/no-img-element` | `html2canvas`/`jsPDF` cannot resolve `next/image`'s `/_next/image` loader URL at capture time (see §3), or the `src` is a runtime blob/object URL that `next/image` cannot optimise. |

### Three dead directives were removed, not annotated

`next lint` runs with `reportUnusedDisableDirectives` on (Next.js default), which
flags directives that suppress nothing. Three such stale directives were
**removed** rather than annotated with a fictional reason:

- `src/lib/reports/pptx.ts` — `no-explicit-any` above a fully-generic
  `chunkRows<T>(rows: T[])` that contains no `any`.
- `src/lib/actions/sds.ts` — `no-explicit-any` above an `anthropic.messages.create`
  call that casts with `as never` / `as Anthropic.Tool[...]`, not `any`.
- `src/components/layout/GusStatusBriefing.tsx` — `exhaustive-deps` on an effect
  whose dependency array (`[user.is_reliance]`) is already complete.

### Enforcement (optional, future)

To make this convention machine-checkable, add to `eslint.config.mjs`:

```js
linterOptions: { reportUnusedDisableDirectives: true }, // flags stale directives
```

The `eslint-plugin-eslint-comments` `require-description` rule would additionally
enforce the ` -- <reason>` text at lint time. Neither is enabled today; the
convention is currently maintained by review.

---

## 3. Raw `<img>` in print / PDF templates

### Rule

Every raw `<img>` inside a print or PDF template **must** carry an adjacent
comment explaining why `next/image` (`<Image>`) is not used.

### Why `<Image>` breaks PDF/print export

- **html2canvas / jsPDF** capture the DOM by traversing real nodes and fetching
  `src` URLs directly. `next/image` rewrites `src` to
  `/_next/image?url=...&w=...&q=...`, a server route that is unavailable (or
  wrong-origin) during client-side capture, so the image renders blank in the
  exported file. A plain `<img>` with a **data-URL** or otherwise resolvable
  `src` is the only reliable pattern.
- `next/image` also wraps the element in a `<span>`, which interferes with
  `@media print` layout and page-break CSS.

### Affected sites

| File | Why raw `<img>` |
|---|---|
| `src/components/chemicals/BuildSmartChemicalPassport.tsx` | Passport captured to PNG/PDF; QR is a data-URL. |
| `src/components/chemicals/PassportActions.tsx` | Writes passport HTML into a bare print window with no Next.js runtime. |
| `src/app/(app)/reports/page.tsx` | `print-only` compliance-report header logo. |
| `src/app/(app)/audits/[id]/AuditConductForm.tsx` | Not a print template, but evidence `src` values are runtime blob/object URLs `next/image` can't optimise — annotated for the same reason. |

> **Deviation:** the spec named `chemicals/[id]/passport/page.tsx` and a
> (non-existent) `chemicals/[id]/label/page.tsx`. The passport route renders the
> `BuildSmartChemicalPassport` / `PassportActions` components, which is where the
> real raw `<img>` tags live — so the justification comments were placed there.

If you add a new print template that requires a raw `<img>`, add it to this table
and include a matching comment + annotated `eslint-disable`.

---

## Testing

```bash
# Run the getActiveKey unit test (9 cases, Node environment — no jsdom)
npx vitest run test/getActiveKey.test.ts

# Full suite / lint / types
npm test
npm run lint
npm run typecheck
```

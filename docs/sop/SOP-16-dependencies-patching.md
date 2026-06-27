# SOP-16 — Dependency & Patch SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | Monthly; and on any disclosed CVE in a dependency |
| **Definition of done** | Known-critical vulns addressed; updates verified through the full gate |
| **Related** | [SOP-01 Coding](SOP-01-coding.md) · [SOP-17 Security](SOP-17-security-review.md) · [SOP-11 Release](SOP-11-release-deployment.md) |

---

## 1. Purpose & scope

Keep dependencies current and safe without breaking the app. The stack's core
pins matter: **Next 15, React 19, Tailwind v4, Supabase JS, the AI SDKs**
(`@anthropic-ai/sdk`, `openai`), `zod`, `xlsx`, `pptxgenjs`. A careless major
bump (esp. Next/React/Tailwind) can break the build or runtime; an *un*-patched
CVE can be a security hole.

---

## 2. Rules

1. **Security patches first.** A disclosed CVE in a used package is prioritized
   over feature updates.
2. **Patch/minor freely, major deliberately.** Patch and minor bumps are low-risk;
   majors (Next/React/Tailwind/Supabase) get their own change with the full gate
   and a system test.
3. **Never ship an update unverified.** Every bump goes through
   `typecheck + build + test` (+ system test for anything that could affect
   rendering).
4. **Lockfile is committed.** `package-lock.json` changes ship with the bump so
   prod installs the same tree.

---

## 3. Procedure

### Monthly
1. Review outstanding advisories:
   ```bash
   npm audit
   npm outdated
   ```
2. Apply security fixes and low-risk patch/minor updates.
3. Run the gate: `npm run typecheck && npm run build && npm run test`.
4. If anything that renders changed, run the system test (SOP-06).
5. Commit (lockfile included) and deploy (SOP-11).

### On a CVE
1. Confirm the package is actually used and the vuln is reachable.
2. Update to the fixed version (or mitigate); run the gate.
3. If exploitable in prod, treat as an incident (SOP-14) and expedite.

### Major version bump
1. Read the migration guide; do it as its own change on a branch.
2. Full gate + system test + a manual spot-check of affected areas.

---

## 4. Checklist

```
[ ] npm audit reviewed; security fixes applied
[ ] patch/minor updates applied; majors handled as their own change
[ ] gate green (typecheck/build/test) [+ system test if rendering affected]
[ ] package-lock.json committed with the bump
[ ] deployed + smoke-checked (SOP-11)
```

---

*Revision: v1 · 2026-06-27 · first written.*

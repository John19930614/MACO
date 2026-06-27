# SOP-23 — Documentation & Memory Sync SOP

| | |
|---|---|
| **Owner** | Engineer / AI |
| **Trigger** | After any significant change, decision, or discovery |
| **Definition of done** | The right knowledge store is updated and accurate; no stale claims left behind |
| **Related** | [SOP-01 Coding](SOP-01-coding.md) · [SOP-04 AI-Assisted Dev](SOP-04-ai-assisted-development.md) · `AGENTS.md` |

---

## 1. Purpose & scope

Keep the platform's knowledge accurate so the next person (or AI session) builds
on truth, not stale claims. This SOP exists because a stale claim has real cost:
an outdated `--color-*` token list in `AGENTS.md` propagated a wrong fact straight
into a new SOP (caught and fixed 2026-06-27). Docs that lie are worse than no
docs.

---

## 2. Where each kind of knowledge lives (write to the right store)

| Store | Holds | Update when |
|---|---|---|
| **`AGENTS.md`** | Conventions + non-negotiable rules for coding here | A convention/rule/stack fact changes |
| **`docs/`** | Reference: data dictionary, migration plan, to-production, extraction map, **SOP library** | The architecture, schema, or a procedure changes |
| **`docs/sop/`** | Procedures (this library) + its `README.md` catalog | A repeatable process changes, or an SOP is written/run |
| **Memory library** (Claude auto-memory + `MEMORY.md` index) | Non-obvious project facts, decisions, gotchas, preferences | A decision/discovery that isn't derivable from the code |
| **Code comments** | Local "why" next to the code | The reasoning isn't obvious from the code itself |

> Rule of thumb: if it's *how to do a thing repeatedly* → SOP. If it's *a rule* →
> `AGENTS.md`. If it's *a non-obvious fact/decision* → memory. If it's *reference
> detail* → `docs/`. Don't duplicate the same fact across stores.

---

## 3. Rules

1. **Update docs in the same change as the code.** Don't let a migration ship
   without the data-dictionary update, or a nav change without the SOP-06 route
   list (and this catalog).
2. **Fix stale claims when you find them** — don't copy them forward. A wrong
   doc is a bug.
3. **One source of truth.** Cross-link (`[[memory-name]]`, SOP links) instead of
   restating; conflicting copies are how drift starts.
4. **Memory is for the non-obvious.** Don't record what the repo already says
   (structure, git history); record decisions, gotchas, and preferences.
5. **Keep the catalog honest.** When an SOP is written or a status changes,
   update `docs/sop/README.md` (status + written index) in the same change.

---

## 4. Procedure

1. After a change, ask: *what did someone-future need to know that isn't in the
   code?* Write that to the right store (§2).
2. If you touched a convention → `AGENTS.md`. A schema/arch detail → `docs/`. A
   process → an SOP. A decision/gotcha → memory (+ `MEMORY.md` index line).
3. Scan what you edited for now-stale claims and fix them.
4. Verify factual claims you wrote (paths/symbols exist) — the same trust-but-
   verify habit that catches doc drift (SOP-04).

---

## 5. Checklist

```
[ ] knowledge written to the RIGHT store (not duplicated)
[ ] docs updated in the same change as the code
[ ] stale claims found-and-fixed, not carried forward
[ ] cross-linked instead of restated
[ ] memory holds only non-obvious facts (+ MEMORY.md index line)
[ ] SOP catalog (README) status/index updated if an SOP changed
[ ] factual claims verified (paths/symbols real)
```

---

*Revision: v1 · 2026-06-27 · first written.*

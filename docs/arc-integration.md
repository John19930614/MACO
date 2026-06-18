# ARC × AMAYA — how the method maps to the product

**ARC (Adaptive Risk Continuum)** is the methodology; **AMAYA** is the platform
that implements it. The Safety Cell product captures and proves risk; ARC is the
intelligence loop that makes those cells compound in value. The published method
diagram lives at `public/arc-method.svg` and is rendered in-app at `/arc`.

```
EXP  →  P-CLSS  →  HSL  →  Continuous learning curve
        (powered by GUS per-vertical engines, unified by VELA)
        ARC loop: every reviewed outcome feeds back to Anticipate
```

## Layer → implementation map

| ARC layer | Stages | AMAYA implementation | Code / tables |
| --- | --- | --- | --- |
| **EXP** — Experience Intelligence Protocol | Elicit · Convert · Embed | AI interviews & walk-floor capture become geo-tagged hazard memory and embed into the "knowledge ghost"; hazard genome + (Phase 2) pgvector embeddings | `exp_captures`, `/api/arc/exp`, `/arc/intelligence` |
| **P-CLSS** — Proactive Continuous Learning Safety System | Anticipate · Hunt · Forecast · Pre-empt · Evolve | Always-running engine runs scan open cells & proof gaps, forecast clusters, and push pre-emptive actions to the review queue | `pclss_runs`, `/api/arc/pclss`, `src/lib/ai/engine.ts` |
| **HSL** — Human Signal Layer | 6 dimensions | Each dimension stored as a periodic reading per site; feeds the dashboard, risk score, and Anticipate | `hsl_signals`, `/api/arc/hsl`, `/arc/hsl` |
| **Continuous learning curve** | — | Reviewed outcomes feed back to Anticipate → compounding moat | accepted findings/edges loop |
| **GUS** | 19 verticals | Per-vertical tuned engine; each site declares its vertical | `sites.vertical`, `/arc/verticals` |
| **VELA** | cross-vertical | Master intelligence that promotes a failure mode proven in one vertical into a pre-emptive warning in another | `vela_insights`, `/api/arc/vela` |

## The six HSL dimensions
Defined in `src/lib/arc/arc.ts` (`HSL_DIMENSIONS`):

1. **Psychological safety gap** — silence is a live signal (worse when high)
2. **Cultural drift index** — erodes between audits (worse when high)
3. **Cognitive load monitor** — fatigue tracked live (worse when high)
4. **Invisible workforce** — contractors covered (worse when high)
5. **EXP knowledge ghost** — expert judgment retained (worse when **low**)
6. **Crew trauma score** — 30-day elevated watch after a serious event (worse when high)

## Why this matters
A traditional safety database is a filing cabinet. ARC makes AMAYA a living
intelligence layer: EXP seeds the model, P-CLSS validates and pre-empts, HSL adds
the human dimensions others ignore, GUS specializes per vertical, and VELA learns
across all of them. The loop is the moat.

# SOP-19 — AI Governance SOP

| | |
|---|---|
| **Owner** | Engineer |
| **Trigger** | Any change to the AI engine, gateway, prompts, model routing, or grounding |
| **Definition of done** | AI output stays advisory, grounded, audited; forced-review rules intact; guards green |
| **Related** | [SOP-01 Coding](SOP-01-coding.md) · [SOP-17 Security](SOP-17-security-review.md) · [SOP-02 Review](SOP-02-code-review.md) · `AGENTS.md` §safety rules |

---

## 1. Purpose & scope

How to change anything AI-touching without breaking the platform's core promise:
**AI is advisory, never authoritative.** This is a *safety* platform — an AI
recommendation that silently became an official record, or a hallucinated CAS
number / regulation that nobody flagged, is a real-world hazard, not a UX bug.

Applies to: `src/lib/ai/*` (engine, grounding, model-routing, review-policy,
prompt, telemetry, cache, circuit) and `src/lib/gateway/*` (pipeline, admit,
agent).

This SOP operationalizes `AGENTS.md`'s non-negotiable safety rules — those rules
win on any conflict.

---

## 2. The governing rules (must survive every change)

1. **Advisory only.** AI output never overrides human judgment, legal
   obligation, or company procedure.
2. **Pending by default.** AI findings and AI-proposed causal edges are stored
   `review_status: "pending"` and must not mutate official records until a human
   accepts them.
3. **Force review for serious risk.** High/critical recommendations set
   `human_review_required = true` regardless of model confidence — enforced by
   `requiresHumanReview(...)` in `src/lib/ai/engine.ts`. Don't bypass it.
4. **Ground before trust.** Model output passes the grounding gateway
   (`src/lib/ai/grounding.ts` → `AiGatewayReview` / `GroundingIssue`) which flags
   hallucinated CAS numbers, unrecognized regulatory refs, etc., **before** the
   output is shown as trusted.
5. **Validate at the gate.** New records flow through the gateway pipeline
   (`runGatewayPipeline`, `admitCell` / `admitEvent`) — a record that fails a
   hard check is blocked, not silently admitted.
6. **Audit AI decisions.** Accept/reject of findings and edges goes through
   `addAudit(...)`.
7. **Secrets server-only.** The engine is `server-only`; AI keys never reach the
   client (SOP-12).
8. **Risk score is for sorting/heat only** — never a risk-acceptance verdict.

---

## 3. Procedure — changing AI behavior

1. **Locate the contract.** Output shapes are typed (`AiAnalysisOutput`,
   `CausalityOutput`, `AiGatewayReview`) — change the type + prompt + grounding
   together so they stay consistent.
2. **Preserve the gates.** If you touch the engine, confirm `requiresHumanReview`
   still fires for high/critical and that new findings default to `pending`.
3. **Grounding keeps pace.** New output fields that assert facts (CAS, reg refs,
   chemical names) need a matching grounding check, or they ship unverified.
4. **Model routing / cost.** Model-tier or provider changes go through
   `model-routing.ts`; keep telemetry (`telemetry.ts`) and the circuit breaker
   (`circuit.ts`) intact so failures degrade gracefully, not silently.
5. **Verify.**
   ```bash
   npm run test     # ai-analytics, gateway, grounding, model-routing, review-policy,
                    # prevention, eval, telemetry, circuit guards
   ```
   Then exercise the change in the app: run an analysis on a high/critical item
   and confirm it lands **pending** with `human_review_required`.
6. **Security pass** if the change widens what AI can write or read (SOP-17).

---

## 4. Red flags (stop and fix)

- A code path that writes AI output straight into an official record without a
  human accept step.
- A high/critical recommendation that does **not** force review.
- A new fact-asserting output field with no grounding check.
- AI output treated as a trusted command (prompt-injection surface).
- A model/provider change that removes telemetry or the circuit breaker.
- An AI key referenced from a client component.

---

## 5. Checklist

```
[ ] output stays advisory + pending until human accept
[ ] requiresHumanReview still fires for high/critical
[ ] new fact-asserting fields have grounding checks
[ ] gateway pipeline still blocks hard-fail records (not silent admit)
[ ] AI accept/reject audited via addAudit()
[ ] engine stays server-only; no AI key client-side
[ ] AI guard tests green (gateway/grounding/model-routing/review-policy/eval/…)
[ ] verified in-app: high/critical analysis lands pending + forced review
```

---

*Revision: v1 · 2026-06-27 · first written.*

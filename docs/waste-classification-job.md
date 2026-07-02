# Waste Classification AI Job — Decision Record

**Platform Review finding:** `ai-waste-classification-decision` — "/sa/ai lists a
waste_classification job marked disabled, but there is no analyzeWaste()
implementation, telemetry, or remediation behind it."

**Decision: IMPLEMENT** (2026-07-02). The AI/Risk dashboards already carried
display labels for the job, the P-Engine scan already fetched waste streams for
grounding, and the waste-profile wizard already proved the AI classification
path — wiring the finding job was cheaper than removing the scaffold honestly.

## What the job does

`analyzeWaste(stream, prior?)` in `src/lib/ai/engine.ts` is a sibling of
`analyzeChemical` / `analyzeComplianceGap`, sharing the same `runAnalysis()`
core (input-hash caching, live-model call with deterministic heuristic
fallback, grounding gateway, calibrated human-review policy). It verifies a
waste stream's **recorded classification** against the rest of the record:

- An EPA D/F/K/P/U waste code on a stream classified `non_hazardous` /
  `general` / `recyclable` → **critical classification mismatch** (the stream
  is RCRA hazardous regardless of the label) — forces human review.
- Quantity above `regulatory_limit` → generator-threshold finding — forces
  human review.
- Shipped (`manifested`/`disposed`/`reported`) high-control stream without a
  manifest number → cradle-to-grave tracking finding.
- High-control classification without a waste code → incomplete
  characterization.
- Hazardous stream routed to landfill → land-disposal-restriction finding.

Allowed classification values come from `WASTE_CLASSIFICATIONS` in
`src/lib/constants.ts` (also embedded in the live-model prompt).

## How it runs

`runPredictabilityScan()` in `src/lib/actions/ehs-ai.ts` selects up to 3 waste
streams with classification-integrity signals per scan and emits
`waste_classification` findings through the existing persistence path
(`ai_findings` — plain-text `job` column, **no migration needed**). Per-call
telemetry is recorded inside the provider (`recordAiCall`), same as every other
job. The `/sa/ai` job table row is now `enabled: true`.

## Deliberate departures from the intake spec

The auto-generated spec assumed a Zod-based provider API, a job registry +
dispatch switch in engine.ts, a `src/lib/repos/ehsRepo` path, a gateway-agent
cron route, and shadcn Card components — none of which exist. It was adapted
to the real `runAnalysis` pattern instead, and the spec's UI "Decision Record
card" was replaced by this document.

## Future work

- Notify the assigned EHS/Waste Coordinator when a mismatch finding is
  approved (remediation hook — same open item as the other jobs).
- Consider a write-back of the verified classification to the waste stream
  after human approval of a mismatch finding.

## Tests

`test/waste-classification.test.ts` — heuristic-path coverage: mismatch,
over-limit, missing manifest, missing code, consistent stream, risk banding,
review forcing. Run: `npx vitest run test/waste-classification.test.ts`.

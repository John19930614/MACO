# AMAYA test & acceptance plan (manual §5.14, §7, Appendix E)

## Automated gates
- `npm run typecheck` — no type errors.
- `npm run build` — compiles, lints, prerenders all routes.

## Manual acceptance walkthrough (mock mode)
1. **Map** — open `/map`. Pins render by severity; critical pins pulse. Filters
   (site / severity / status) and the Heat toggle change what's shown. Clicking a
   pin opens the right drawer.
2. **Create Cell** — `/cells/new`. Required fields validate; on submit you land on
   the new cell's record and it appears on the map + in `/cells`.
3. **Control Proof** — change a proof status from a cell record; it reflects in
   `/proof` and the change is written to the audit log. Weak/missing/expired
   proof sorts to the top of the ledger.
4. **AI engine** — "Run analysis" on a cell creates a **pending** finding with a
   plain-language summary, counterfactual prevention, and (if applicable) pending
   causal edges. High/critical cells force `human_review_required`.
5. **Review** — Accept/Reject a finding; Accept/Reject AI-proposed edges on
   `/causality` (dashed = pending). Rejected edges drop from the official graph.
6. **Dashboard** — `/dashboard` counts (high-risk, missing proof, review queue,
   overdue actions, repeat locations) match the underlying data.
7. **ARC** — `/arc` renders the method diagram and the EXP/P-CLSS/HSL layer cards;
   `/arc/hsl` shows the six dimensions per site; `/arc/intelligence` shows P-CLSS
   runs, EXP captures, and VELA insights; `/arc/verticals` shows the 19 GUS
   verticals with live ones highlighted.

## Security checks (live mode)
- Service-role key never present in client bundles.
- RLS enabled on all tenant tables (`0002_rls.sql`); proof/edge/action writes
  gated to supervisor+; reads require authentication.
- Preview and production env vars are separated.

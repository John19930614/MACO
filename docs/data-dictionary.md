# AMAYA data dictionary (starter)

Mirrors `supabase/migrations/0001_init.sql`–`0005_risk_objects.sql` and `src/lib/types.ts`.

## Core tables

| Table | Purpose |
| --- | --- |
| `profiles` | User role + default site (linked to `auth.users`) |
| `sites` | Facility boundary + GUS vertical + map center |
| `locations` | Map point / area / floor zone / asset / route |
| `safety_cells` | **The hub.** Living risk object |
| `evidence_files` | Photos, permits, forms, notes, sensor data (Storage path) |
| `control_proofs` | Control Proof Ledger — verification state per control |
| `causal_edges` | Links between cells (cause / contributing / prevention) |
| `ai_findings` | AI output, stored separate from official records |
| `actions` | Corrective / preventive action + closure |
| `audit_log` | Immutable trail of sensitive changes |
| `cell_embeddings` | (Phase 2) pgvector similarity |

## ARC extension tables

| Table | Purpose |
| --- | --- |
| `exp_captures` | EXP knowledge-ghost captures (interview / walk-floor / debrief) |
| `hsl_signals` | Human Signal Layer readings (six dimensions, periodic) |
| `pclss_runs` | Proactive engine run log (anticipate/hunt/forecast/preempt/evolve) |
| `vela_insights` | Cross-vertical master-intelligence patterns |

## Risk Intelligence Framework (manual §6, `0005_risk_objects.sql`)

Reliance is a living system of six connected **risk objects**. Five map onto
existing tables; `event_cells` and `behavior_cells` are the dedicated ones. The
unified graph is projected by `src/lib/risk/objects.ts` (`buildRiskGraph`).

| Risk object | Backed by | Notes |
| --- | --- | --- |
| Precursor | `safety_cells` | The early-warning hub — one precursor per cell |
| Control | `control_proofs` | A proof whose safeguard is defined/active (`proven` / `weak_proof` / `not_applicable`) |
| Failure | `control_proofs` | A proof that is broken/unverified (`missing` / `expired` / `conflicting` / `not_checked`) |
| Behavior | `behavior_cells` | Repeated human/org pattern across one or more precursors |
| Event | `event_cells` | An outcome, traced back to its precursor via `cell_id` |
| Learning | `ai_findings` + `vela_insights` | Per-cell analysis + cross-vertical learning |

| Table | Purpose |
| --- | --- |
| `event_cells` | Outcomes (incident / near_miss / claim / audit_finding / compliance_failure / property_loss / service_interruption) |
| `behavior_cells` | Repeated patterns (weak_closeout / slow_response / recurring_issue / process_drift / production_pressure) |

## Key fields

| Field | Meaning |
| --- | --- |
| `hazard_genome.energySource` | gravity, motion, electrical, chemical, thermal… |
| `hazard_genome.exposureType` | line_of_fire, fall, struck_by, caught_in, contact… |
| `hazard_genome.trigger` | condition that starts/worsens the risk (weather, congestion…) |
| `hazard_genome.controlGap` | missing, weak, expired, bypassed, unverified |
| `safety_cells.severity` | low / medium / high / critical |
| `safety_cells.risk_score` | 0–100, **sorting & heat only** — not a risk verdict |
| `safety_cells.status` | open / in_review / action_assigned / closed / pending_review |
| `control_proofs.status` | not_checked / proven / weak_proof / missing / expired / not_applicable / conflicting |
| `causal_edges.type` | caused_by / contributed_to / same_control_gap / same_location / prevention_for / contradicts |
| `event_cells.kind` | incident / near_miss / claim / audit_finding / compliance_failure / property_loss / service_interruption |
| `behavior_cells.pattern` | weak_closeout / slow_response / recurring_issue / process_drift / production_pressure |
| `*.review_status` | pending / accepted / edited / rejected / archived |
| `hsl_signals.dimension` | psych_safety_gap / cultural_drift_index / cognitive_load_monitor / invisible_workforce / knowledge_ghost / crew_trauma_score |

## API route map (Appendix A + ARC)

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/cells` | GET / POST | List for map filters / create |
| `/api/cells/[id]` | GET / PATCH | Full bundle / update |
| `/api/evidence` | POST | Create evidence metadata |
| `/api/proof` | PATCH | Change control proof status (audited) |
| `/api/ai/analyze-cell` | POST | Run engine → pending finding + pending edges |
| `/api/ai/findings` | GET / PATCH | List / accept / reject findings |
| `/api/graph` | GET | Nodes + edges for causality view |
| `/api/graph/edges` | POST / PATCH | Create / review causal edges |
| `/api/actions` | GET / POST / PATCH | Manage actions |
| `/api/arc/exp` | GET | EXP captures |
| `/api/arc/hsl` | GET | HSL readings |
| `/api/arc/pclss` | GET | P-CLSS run log |
| `/api/arc/vela` | GET | VELA insights |

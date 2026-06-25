/**
 * ARC — Adaptive Risk Continuum
 * ─────────────────────────────
 * ARC is the methodology SafetyIQ implements. This module is the canonical,
 * typed description of every ARC layer so the UI pages and the engine stay
 * in sync with the Reliance Risk Intelligence Framework.
 *
 * Layer stack (top → bottom of the diagram):
 *   EXP     Experience Intelligence Protocol     — Elicit · Convert · Embed
 *   P-CLSS  Proactive Continuous Learning Safety  — Anticipate · Hunt · Forecast · Pre-empt · Evolve
 *   HSL     Human Signal Layer                    — the six dimensions others ignore
 *   Curve   Continuous learning curve             — the compounding moat
 *   GUS     Per-vertical AI engine                — 19 verticals
 *   VELA    Master intelligence                   — cross-vertical
 */

export const ARC_TAGLINE = "Adaptive Risk Continuum — Reliance Predictive Safety Technologies";

export type ArcLayerKey = "exp" | "pclss" | "hsl" | "curve" | "engine";

export interface ArcStage {
  key: string;
  name: string;
  blurb: string;
}

export interface ArcLayer {
  key: ArcLayerKey;
  code: string;
  title: string;
  color: string; // matches globals.css --color-* token
  summary: string;
  stages: ArcStage[];
  /** How SafetyIQ's Safety-Cell product realizes this layer. */
  safetyiqMapping: string;
}

// ── EXP — Experience Intelligence Protocol ─────────────────────────────────
export const EXP: ArcLayer = {
  key: "exp",
  code: "EXP",
  title: "Experience Intelligence Protocol",
  color: "exp",
  summary:
    "Captures the tacit expertise of the workforce and freezes it into a living model — the knowledge ghost — so hard-won judgment is never lost to turnover.",
  safetyiqMapping:
    "AI interviews and walk-floor capture feed Safety Cells. Hazard genome + pgvector embeddings convert experience into geo-tagged hazard memory that the Causality Engine reasons over.",
  stages: [
    { key: "elicit", name: "Elicit", blurb: "AI interviews · walk-floor" },
    { key: "convert", name: "Convert", blurb: "Geo-tagged hazard memory" },
    { key: "embed", name: "Embed", blurb: "Live model · knowledge ghost" },
  ],
};

// ── P-CLSS — Proactive Continuous Learning Safety System ───────────────────
export const PCLSS: ArcLayer = {
  key: "pclss",
  code: "P-CLSS",
  title: "Proactive Continuous Learning Safety System",
  color: "pclss",
  summary:
    "The always-running engine. It does not wait for an incident report — it anticipates, hunts, forecasts, pre-empts, and evolves on its own clock.",
  safetyiqMapping:
    "Scheduled engine runs scan open Safety Cells and control proof gaps, forecast where the next event clusters, and propose pre-emptive actions into the human review queue.",
  stages: [
    { key: "anticipate", name: "Anticipate", blurb: "Model the next failure before it happens" },
    { key: "hunt", name: "Hunt", blurb: "Actively seek weak signals across cells" },
    { key: "forecast", name: "Forecast", blurb: "Project risk onto locations and tasks" },
    { key: "preempt", name: "Pre-empt", blurb: "Recommend prevention ahead of the event" },
    { key: "evolve", name: "Evolve", blurb: "Fold outcomes back into the model" },
  ],
};

// ── HSL — Human Signal Layer (the six dimensions) ──────────────────────────
export interface HslDimension extends ArcStage {
  /** Direction of concern: higher value = more risk. */
  worseWhen: "high" | "low";
  detail: string;
}

export const HSL_DIMENSIONS: HslDimension[] = [
  {
    key: "psych_safety_gap",
    name: "Psychological safety gap",
    blurb: "Silence is a live signal",
    worseWhen: "high",
    detail:
      "Measures the gap between observed hazards and reported ones. When crews stop speaking up, the absence of reports is itself the warning.",
  },
  {
    key: "cultural_drift_index",
    name: "Cultural drift index",
    blurb: "Erodes between audits",
    worseWhen: "high",
    detail:
      "Tracks how far day-to-day practice has drifted from the standard since the last audit. Culture decays continuously, not on the audit calendar.",
  },
  {
    key: "cognitive_load_monitor",
    name: "Cognitive load monitor",
    blurb: "Fatigue tracked live",
    worseWhen: "high",
    detail:
      "Estimates crew fatigue and task-stacking in real time so high-load windows are flagged before judgment degrades.",
  },
  {
    key: "invisible_workforce",
    name: "Invisible workforce",
    blurb: "Contractors covered",
    worseWhen: "high",
    detail:
      "Brings contractors and transient crews — usually outside the safety system — into the same signal model as direct employees.",
  },
  {
    key: "knowledge_ghost",
    name: "EXP knowledge ghost",
    blurb: "Expert judgment stays",
    worseWhen: "low",
    detail:
      "Coverage of captured expert judgment for the active task. Falls when experienced people leave faster than EXP can capture them.",
  },
  {
    key: "crew_trauma_score",
    name: "Crew trauma score",
    blurb: "30-day elevated watch",
    worseWhen: "high",
    detail:
      "After a serious event, the affected crew carries elevated risk. SafetyIQ holds a 30-day elevated-watch window on those teams.",
  },
];

export const HSL: ArcLayer = {
  key: "hsl",
  code: "HSL",
  title: "Human Signal Layer",
  color: "hsl",
  summary:
    "The six human dimensions that conventional safety systems ignore. SafetyIQ treats each as a continuous, live measurement — not an annual survey.",
  safetyiqMapping:
    "Each dimension is stored as a periodic reading per site and feeds the dashboard, the risk score, and the P-CLSS Anticipate stage.",
  stages: HSL_DIMENSIONS.map(({ key, name, blurb }) => ({ key, name, blurb })),
};

export const ARC_LAYERS: ArcLayer[] = [EXP, PCLSS, HSL];

// ── GUS — 19 per-vertical engines ──────────────────────────────────────────
export interface Vertical {
  slug: string;
  name: string;
  icon: string; // lucide icon name
}

export const GUS_VERTICALS: Vertical[] = [
  { slug: "construction", name: "Construction", icon: "HardHat" },
  { slug: "oil-gas", name: "Oil & Gas", icon: "Flame" },
  { slug: "mining", name: "Mining", icon: "Pickaxe" },
  { slug: "manufacturing", name: "Manufacturing", icon: "Factory" },
  { slug: "warehousing", name: "Warehousing & Logistics", icon: "Package" },
  { slug: "utilities", name: "Utilities & Power", icon: "Zap" },
  { slug: "transportation", name: "Transportation", icon: "Truck" },
  { slug: "maritime", name: "Maritime & Ports", icon: "Anchor" },
  { slug: "aviation", name: "Aviation Ground Ops", icon: "Plane" },
  { slug: "rail", name: "Rail", icon: "TrainFront" },
  { slug: "agriculture", name: "Agriculture", icon: "Wheat" },
  { slug: "food-processing", name: "Food Processing", icon: "Beef" },
  { slug: "chemical", name: "Chemical & Petrochemical", icon: "FlaskConical" },
  { slug: "pharma", name: "Pharmaceutical", icon: "Pill" },
  { slug: "healthcare", name: "Healthcare Facilities", icon: "HeartPulse" },
  { slug: "telecom", name: "Telecom & Towers", icon: "RadioTower" },
  { slug: "waste", name: "Waste & Recycling", icon: "Recycle" },
  { slug: "facilities", name: "Facilities & FM", icon: "Building2" },
  { slug: "renewables", name: "Renewables", icon: "Wind" },
];

export const GUS = {
  code: "GUS",
  title: "Per-vertical AI engine",
  subtitle: `${GUS_VERTICALS.length} verticals`,
  summary:
    "The per-vertical AI engine. Each of the 19 verticals gets a tuned model that understands its own hazards, tasks, regulations, and language.",
} as const;

// ── VELA — master cross-vertical intelligence ──────────────────────────────
export const VELA = {
  code: "VELA",
  title: "Master intelligence",
  subtitle: "cross-vertical",
  summary:
    "VELA sits above every GUS engine. It learns patterns that no single vertical could see alone — a control failure mode proven in mining becomes a pre-emptive warning in construction.",
} as const;

/** The compounding-moat narrative attached to the learning curve. */
export const LEARNING_CURVE = {
  code: "Curve",
  title: "Continuous learning curve",
  summary:
    "Every reviewed outcome feeds back to Anticipate. EXP seeds the curve, P-CLSS validates it, and the system becomes self-improving — the gap to competitors widens over time.",
  milestones: [
    { at: "EXP seeds", note: "Experience capture bootstraps the model" },
    { at: "Validates", note: "P-CLSS confirms predictions against outcomes" },
    { at: "Self-improving", note: "The loop compounds — the moat" },
  ],
} as const;

/**
 * AI-output grounding gateway (pure, deterministic).
 *
 * The AI engine's findings are persisted to the human-review queue. Before they
 * are trusted, this gateway validates the model/heuristic output against the
 * input record to catch hallucinations and internal inconsistencies — a
 * fabricated CAS number, a regulatory citation that names no real authority, a
 * risk_level that disagrees with its score, an out-of-range score. It mirrors
 * the data-validation gateway (src/lib/gateway/pipeline.ts) but for AI output.
 *
 * A "fail" issue means the output should not be auto-trusted — the engine forces
 * human review. "warn" issues are surfaced to the reviewer but don't block.
 */
import { riskLevelFromScore100 } from "@/lib/constants";
import type { AiAnalysisOutput, AiGatewayReview, GroundingIssue } from "@/lib/types";

export interface GroundingContext {
  /** The input chemical's real CAS number, if any — used to catch CAS hallucination. */
  knownCas?: string | null;
  /** The input requirement's regulation reference, if any. */
  knownRegRef?: string | null;
}

// Recognised regulatory authorities / citation tokens. A regulatory_ref that
// names none of these is suspicious (the model may have invented it). Matched on
// token boundaries (letters only, digits allowed) so short tokens like "EC"
// don't false-match inside words such as "dirECtive".
const REG_AUTHORITIES = [
  "OSHA", "EPA", "CFR", "ISO", "NFPA", "ANSI", "GHS", "TSCA", "RCRA", "DOT",
  "NIOSH", "ACGIH", "REACH", "CLP", "COSHH", "HSE", "WHMIS", "CERCLA", "SARA",
  "CAA", "CWA", "HAZCOM", "USC", "EU", "EC",
];
const REG_AUTHORITY_RE = new RegExp(`(?<![A-Za-z])(?:${REG_AUTHORITIES.join("|")})(?![A-Za-z])`, "i");

// CAS Registry Number shape: 2–7 digits - 2 digits - 1 check digit.
const CAS_RE = /\b\d{2,7}-\d{2}-\d\b/g;

const worst = (issues: GroundingIssue[]): AiGatewayReview["status"] =>
  issues.some((i) => i.status === "fail") ? "fail" : issues.length ? "warn" : "pass";

/** Validate an AiAnalysisOutput against its input context. Pure. */
export function reviewAnalysisOutput(o: AiAnalysisOutput, ctx: GroundingContext = {}): AiGatewayReview {
  const issues: GroundingIssue[] = [];

  // 1. risk_score must be a finite 0–100 value.
  if (!Number.isFinite(o.risk_score) || o.risk_score < 0 || o.risk_score > 100) {
    issues.push({ check: "risk_score_range", status: "fail", message: `risk_score ${o.risk_score} is outside 0–100` });
  }

  // 2. risk_level must match the score's band (catches model self-inconsistency).
  if (Number.isFinite(o.risk_score) && o.risk_level !== riskLevelFromScore100(o.risk_score)) {
    issues.push({
      check: "risk_level_consistency",
      status: "warn",
      message: `risk_level "${o.risk_level}" inconsistent with score ${o.risk_score} (expected "${riskLevelFromScore100(o.risk_score)}")`,
    });
  }

  // 3. Every regulatory_ref should name a recognised authority.
  for (const ref of o.regulatory_refs) {
    if (!REG_AUTHORITY_RE.test(ref)) {
      issues.push({ check: "reg_ref_unrecognized", status: "warn", message: `regulatory ref "${ref}" cites no recognised authority` });
    }
  }

  // 4. CAS grounding. A wrong CAS in the SUMMARY (the model's headline about this
  //    record) is a hallucination (hard fail). A different CAS elsewhere
  //    (findings/gaps) may legitimately reference a related substance, so it is
  //    only a warn — avoids false-failing valid multi-substance analyses.
  if (ctx.knownCas) {
    const inSummary = new Set((o.plain_language_summary.match(CAS_RE) ?? []).filter((c) => c !== ctx.knownCas));
    const elsewhere = new Set(([...o.findings.map((f) => f.description), ...o.gaps].join(" ").match(CAS_RE) ?? []));
    for (const cas of inSummary) {
      issues.push({ check: "cas_hallucination", status: "fail", message: `summary cites CAS ${cas}, not the record's CAS ${ctx.knownCas}` });
    }
    for (const cas of elsewhere) {
      if (cas !== ctx.knownCas && !inSummary.has(cas)) {
        issues.push({ check: "cas_mismatch", status: "warn", message: `output mentions CAS ${cas}, not the record's CAS ${ctx.knownCas} (possibly a related substance)` });
      }
    }
  }

  // 5. A high-risk finding with no recommended action is incomplete.
  if (Number.isFinite(o.risk_score) && o.risk_score >= 49 && o.recommended_actions.length === 0) {
    issues.push({ check: "missing_actions", status: "warn", message: `high risk (${o.risk_score}) with no recommended actions` });
  }

  return { status: worst(issues), issues };
}

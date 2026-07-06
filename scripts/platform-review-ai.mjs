// Platform Review — the Claude judgment pass.
//
// Complements the codified scanner (platform-review-scan.mjs) with the class of
// issues greps can't express: risky patterns, design smells, missing
// validation, cross-cutting concerns. Sends the codebase structure snapshot +
// a deterministic set of hotspot files to the Claude API and asks for
// structured findings in the dev_review_findings shape.
//
//   node scripts/platform-review-ai.mjs --json out.json
//
// No-ops cleanly (exit 0, empty findings) when ANTHROPIC_API_KEY is absent so
// the workflow runs green without the secret. Cost: one call, roughly
// $0.30–$1.50 depending on hotspot size.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const MODEL = process.env.SAFETYIQ_ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_FINDINGS = 5;
const MAX_FILE_LINES = 500;

// Deterministic hotspots: the security/infra spine plus the largest action
// modules — where a judgment reviewer earns their keep.
const SPINE_FILES = [
  "src/middleware.ts",
  "src/lib/env.ts",
  "src/lib/supabase/server.ts",
  "src/lib/auth/session.ts",
];

function largestActionFiles(root, n = 6) {
  const dir = join(root, "src", "lib", "actions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
    .map((f) => ({ f: `src/lib/actions/${f}`, size: statSync(join(dir, f)).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, n)
    .map((x) => x.f);
}

function clip(content) {
  const lines = content.split("\n");
  return lines.length <= MAX_FILE_LINES
    ? content
    : lines.slice(0, MAX_FILE_LINES).join("\n") + `\n// … clipped at ${MAX_FILE_LINES} of ${lines.length} lines`;
}

const VALID = {
  check_key: new Set(["build_type", "security", "database", "routes_ux", "ai_engine", "tech_debt"]),
  severity: new Set(["green", "amber", "red"]),
  priority: new Set(["urgent", "high", "medium", "low"]),
  risk_level: new Set(["low", "medium", "high", "critical"]),
  effort: new Set(["small", "medium", "large"]),
};

export function sanitizeAiFindings(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const f of raw.slice(0, MAX_FINDINGS)) {
    if (!f || typeof f !== "object" || !f.title || !f.detail || !f.recommendation) continue;
    const slug = String(f.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
    out.push({
      finding_key: `ai:${slug}`,
      check_key: VALID.check_key.has(f.check_key) ? f.check_key : "tech_debt",
      title: String(f.title).slice(0, 200),
      detail: String(f.detail).slice(0, 2000),
      recommendation: String(f.recommendation).slice(0, 2000),
      severity: VALID.severity.has(f.severity) ? f.severity : "amber",
      source: "ai",
      module: typeof f.module === "string" ? f.module.slice(0, 80) : "Platform Operations",
      who_uses_it: typeof f.who_uses_it === "string" ? f.who_uses_it.slice(0, 120) : "Platform Operations",
      priority: VALID.priority.has(f.priority) ? f.priority : "medium",
      risk_level: VALID.risk_level.has(f.risk_level) ? f.risk_level : "medium",
      effort: VALID.effort.has(f.effort) ? f.effort : "medium",
      where_hint: typeof f.where === "string" ? f.where.slice(0, 400) : null,
      success_criteria: typeof f.success_criteria === "string" ? f.success_criteria.slice(0, 600)
        : "The described issue is fixed and the finding clears on the next review run.",
    });
  }
  return out;
}

export function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
}

async function main() {
  const jsonFlag = process.argv.indexOf("--json");
  const outPath = jsonFlag !== -1 ? process.argv[jsonFlag + 1] : null;
  const emit = (findings, note) => {
    if (outPath) writeFileSync(outPath, JSON.stringify(findings, null, 2), "utf-8");
    console.log(`platform-review-ai: ${note} — ${findings.length} finding(s)${outPath ? ` → ${outPath}` : ""}`);
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    emit([], "ANTHROPIC_API_KEY not set, skipping the AI pass");
    return;
  }

  const root = process.cwd();
  const files = [...SPINE_FILES, ...largestActionFiles(root)];
  const sections = [];
  for (const f of files) {
    const full = join(root, f);
    if (!existsSync(full)) continue;
    sections.push(`### ${f}\n\`\`\`ts\n${clip(readFileSync(full, "utf-8"))}\n\`\`\``);
  }
  const contextPath = join(root, "src", "lib", "devcenter", "codebaseContext.generated.ts");
  const structure = existsSync(contextPath) ? clip(readFileSync(contextPath, "utf-8")) : "(unavailable)";

  const prompt = `You are reviewing SafetyIQ, a multi-tenant Next.js 15 + Supabase EHS platform. Tenant isolation is enforced by RLS; superadmin surfaces use the service-role client deliberately. A codified scanner already catches empty catches, explicit anys, ghost tables, unexplained lint disables and oversized files — do NOT repeat those. Look for what only a careful reviewer finds: auth/session weaknesses, tenant-isolation gaps, unvalidated external input, race conditions, misuse of server/client boundaries, misleading UX around failures, and risky defaults.

## Codebase structure snapshot
${structure}

## Hotspot files
${sections.join("\n\n")}

Reply with ONLY a JSON array (max ${MAX_FINDINGS} items, most severe first). Each item:
{"title": "...", "detail": "what/where, concrete", "recommendation": "the fix", "check_key": "security|database|routes_ux|ai_engine|tech_debt|build_type", "severity": "red|amber|green", "priority": "urgent|high|medium|low", "risk_level": "critical|high|medium|low", "effort": "small|medium|large", "module": "...", "where": "file:line", "success_criteria": "..."}
Only report issues you are confident about from the code shown. An empty array is a valid answer.`;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const findings = sanitizeAiFindings(extractJsonArray(text));
    emit(findings, `model ${MODEL} reviewed ${sections.length} hotspot file(s)`);
  } catch (e) {
    // Never fail the workflow on an API hiccup — the scan findings still land.
    emit([], `AI pass failed (${e?.message ?? e}), continuing without it`);
  }
}

if (process.argv[1] && basename(process.argv[1]).startsWith("platform-review-ai")) {
  await main();
}

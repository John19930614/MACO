// Platform Review — findings writer.
//
// Takes the JSON emitted by platform-review-scan.mjs / platform-review-ai.mjs
// and syncs it into dev_review_findings so /admin/dev-command/review shows it:
//   • upsert every finding on its stable finding_key (status → open,
//     last_seen_at → now; first_seen_at is preserved on update)
//   • auto-RESOLVE open findings from the same source that this run no longer
//     produced — fixed issues drop off the review by themselves. Sources not in
//     this run are untouched (an AI-less run never resolves AI findings).
//
// Usage:  node scripts/platform-review-write.mjs findings-scan.json [findings-ai.json ...]
// Env:    SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
//         GITHUB_RUN_ID (optional). No-ops cleanly without creds; never fails CI.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("platform-review-write: no Supabase service creds — skipping (this is fine on forks).");
  process.exit(0);
}

const findings = process.argv.slice(2).flatMap((p) => {
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    console.error(`platform-review-write: could not read ${p}: ${e?.message ?? e}`);
    return [];
  }
});

const runId = process.env.GITHUB_RUN_ID || "local";
const now = new Date().toISOString();
const sb = createClient(url, key, { auth: { persistSession: false } });

try {
  if (findings.length) {
    const rows = findings.map((f) => ({
      ...f,
      status: "open",
      run_id: runId,
      last_seen_at: now,
      resolved_at: null,
    }));
    const { error } = await sb.from("dev_review_findings").upsert(rows, { onConflict: "finding_key" });
    if (error) throw new Error(`upsert: ${error.message}`);
  }

  // Auto-resolve what this run's sources no longer report.
  const sources = [...new Set(findings.map((f) => f.source))];
  let resolved = 0;
  for (const source of sources.length ? sources : []) {
    const keep = findings.filter((f) => f.source === source).map((f) => f.finding_key);
    let q = sb
      .from("dev_review_findings")
      .update({ status: "resolved", resolved_at: now })
      .eq("source", source)
      .eq("status", "open");
    if (keep.length) q = q.not("finding_key", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);
    const { data, error } = await q.select("finding_key");
    if (error) throw new Error(`auto-resolve(${source}): ${error.message}`);
    resolved += data?.length ?? 0;
  }

  console.log(
    `platform-review-write: upserted ${findings.length} open finding(s), auto-resolved ${resolved} (run ${runId}).`,
  );
} catch (e) {
  console.error(`platform-review-write: ${e?.message ?? e}`);
  process.exit(0); // telemetry write — never fail the workflow
}

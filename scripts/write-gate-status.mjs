// Writes one row to ops_gate_status summarising a CI gate run, so the Ops
// Console / /api/ops can honestly show "gate green" (it can't run the gate
// itself). No-ops cleanly when Supabase service creds aren't present (e.g. on a
// fork PR), and never fails the build.
//
// Usage:  node scripts/write-gate-status.mjs <job-status>
//   <job-status> = the GitHub Actions job.status (success|failure|cancelled).
// Env:    SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
//         GITHUB_SHA, GITHUB_REF_NAME (provided by Actions).

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("write-gate-status: no Supabase service creds — skipping (this is fine on forks).");
  process.exit(0);
}

const jobStatus = process.argv[2] || "";
const result = jobStatus === "success" ? "pass" : jobStatus === "cancelled" ? "skip" : "fail";

const row = {
  sha: (process.env.GITHUB_SHA || "").slice(0, 7) || null,
  branch: process.env.GITHUB_REF_NAME || null,
  typecheck: result, test: result, build: result, system: result,
  // tenancy/live aren't run in the default CI gate (mock mode, no Docker) → unknown
  tenancy: "unknown", live: "unknown",
  source: "ci",
};

try {
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("ops_gate_status").insert(row);
  if (error) { console.error("write-gate-status:", error.message); process.exit(0); }
  console.log(`write-gate-status: recorded '${result}' for ${row.sha || "(no sha)"}.`);
} catch (e) {
  console.error("write-gate-status:", e?.message || e);
  process.exit(0); // never fail CI on telemetry write
}

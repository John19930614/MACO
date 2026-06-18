#!/usr/bin/env node
/**
 * AMAYA ETL importer. Reads a source platform's CSV export + a field mapping and
 * sends them to the running app's /api/etl/import, which validates and inserts
 * the rows. Run a --dry pass first to see the reconciliation report.
 *
 * Usage:
 *   node scripts/etl-import.mjs --file data.csv --mapping mapping.json [--base http://localhost:3000] [--dry]
 */
import { readFileSync } from "node:fs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const file = arg("file");
const mappingPath = arg("mapping");
const base = arg("base", "http://localhost:3000");
const dry = Boolean(arg("dry", false));

if (!file || !mappingPath) {
  console.error("Usage: node scripts/etl-import.mjs --file data.csv --mapping mapping.json [--base URL] [--dry]");
  process.exit(1);
}

const csv = readFileSync(file, "utf8");
const mapping = JSON.parse(readFileSync(mappingPath, "utf8"));

const res = await fetch(`${base}/api/etl/import`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ csv, mapping, dry }),
});

if (!res.ok) {
  console.error(`Import failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const out = await res.json();
console.log(`\n  AMAYA ETL — ${dry ? "DRY RUN (no writes)" : "IMPORT"} against ${base}`);
console.log("  ─────────────────────────────────────────────");
console.log(`  rows read : ${out.report.read}`);
console.log(`  valid     : ${out.report.valid}`);
console.log(`  imported  : ${out.report.imported}`);
console.log(`  rejected  : ${out.report.invalid}`);
if (out.rejected.length) {
  console.log("\n  Rejected rows:");
  for (const r of out.rejected.slice(0, 20)) console.log(`   • row ${r.row} (${r.legacyId}): ${r.issues.join("; ")}`);
  if (out.rejected.length > 20) console.log(`   …and ${out.rejected.length - 20} more`);
}
if (!dry && out.created.length) {
  console.log(`\n  Imported ${out.created.length} cells (legacy → new id):`);
  for (const c of out.created.slice(0, 10)) console.log(`   • ${c.legacyId} → ${c.cellId}`);
  if (out.created.length > 10) console.log(`   …and ${out.created.length - 10} more`);
}
console.log("");

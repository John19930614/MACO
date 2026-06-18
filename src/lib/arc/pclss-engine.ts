/**
 * P-CLSS — the Proactive Continuous Learning Safety System engine (server-only).
 * This is the "always running" loop made real: it scans open Safety Cells and
 * their control-proof gaps, ranks weak signals (Hunt), and for the strongest
 * signals that aren't already queued it runs the Causality Engine to produce
 * PENDING pre-emptive findings (Pre-empt). Every run is recorded so the loop is
 * auditable. Findings remain advisory and human-reviewed (manual §8.1).
 */
import "server-only";
import { getCells, getProofs, getFindings, saveFinding, savePclssRun, getSites } from "@/lib/data/repo";
import { analyzeCell } from "@/lib/ai/engine";
import { findSignals } from "./intelligence";
import { nextId } from "@/lib/data/store";
import type { PclssRun, AiFinding, ControlProof } from "@/lib/types";

export interface PclssResult {
  run: PclssRun;
  findings: AiFinding[];
  signalsFound: number;
}

const MAX_PREEMPT = 3;

export async function runPclss(siteId?: string): Promise<PclssResult> {
  const cells = await getCells(siteId ? { site_id: siteId } : {});
  const openCells = cells.filter((c) => c.status !== "closed");

  const proofs = await getProofs();
  const byCell = new Map<string, ControlProof[]>();
  for (const p of proofs) {
    const arr = byCell.get(p.cell_id);
    if (arr) arr.push(p);
    else byCell.set(p.cell_id, [p]);
  }

  // Hunt: rank weak signals.
  const signals = findSignals(openCells, byCell);

  // Pre-empt: queue analysis for the top signals not already pending.
  const pending = new Set(
    (await getFindings()).filter((f) => f.review_status === "pending").map((f) => f.cell_id),
  );
  const targets = signals.filter((s) => !pending.has(s.cell.id)).slice(0, MAX_PREEMPT);

  const findings: AiFinding[] = [];
  let actionsProposed = 0;
  for (const s of targets) {
    const candidates = cells.filter((c) => c.id !== s.cell.id && c.site_id === s.cell.site_id);
    const finding = await analyzeCell(s.cell, candidates);
    await saveFinding(finding);
    findings.push(finding);
    const out = finding.output as { prevention?: unknown[] };
    actionsProposed += out.prevention?.length ?? 0;
  }

  const run: PclssRun = {
    id: nextId("run"),
    tenant_id: openCells[0]?.tenant_id ?? cells[0]?.tenant_id ?? "",
    site_id: siteId ?? cells[0]?.site_id ?? "",
    stage: "preempt",
    summary: `Scanned ${openCells.length} open cell(s); surfaced ${signals.length} weak signal(s); queued ${findings.length} pre-emptive analysis(es) for human review.`,
    cells_scanned: openCells.length,
    signals_found: signals.length,
    actions_proposed: actionsProposed,
    created_at: new Date().toISOString(),
  };
  await savePclssRun(run);

  return { run, findings, signalsFound: signals.length };
}

/**
 * Run P-CLSS for every site — used by the scheduled cron path so each platform
 * gets its own proactive pass. In a multi-tenant production deployment the cron
 * runs with the service role; here it iterates the visible sites.
 */
export async function runPclssForAllSites(): Promise<PclssResult[]> {
  const sites = await getSites();
  const results: PclssResult[] = [];
  for (const s of sites) results.push(await runPclss(s.id));
  return results;
}

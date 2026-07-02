"use server";

// EHS AI actions — the P-Engine predictability scan, the AI program builder,
// and the staged document-import review queue. Split from the original
// monolithic ehs.ts; function bodies are unchanged. Callers keep importing
// from "@/lib/actions/ehs" (the barrel).

import { revalidatePath } from "next/cache";
import { MOCK_MODE, serverSecrets } from "@/lib/env";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { PROGRAM_DEFS, generateProgram, type SourceBlock } from "@/lib/ai/programBuilder";
import { KIND_DEFS, extractRows, type RowKind } from "@/lib/ai/extractDocuments";
import { COMPLIANCE_STATUS_META, type ComplianceStatus } from "@/lib/constants";
import type { AiFinding, AiAnalysisOutput, WasteStream } from "@/lib/types";
import { analyzeChemical, analyzeComplianceGap, analyzeTraining, analyzeWaste, buildPredictabilityForecast } from "@/lib/ai/engine";
import {
  getChemicals, getLegalRequirements, getTrainingRecords, getTrainingCourses, getCapaActions,
  getIncidents, getAudits, getRiskAssessments, getEquipment, getWasteStreams,
  getDocuments, getOshaCases, getBiosafetyLabs, getErgonomicsJobTasks, getProfiles, getAiFindings,
} from "@/lib/data/ehsRepo";
import { getCtx } from "./ehs-shared";

// ── P-Engine predictability scan ──────────────────────────────────────────────
// Reads the tenant's live EHS data, computes per-module compliance scores,
// generates AI findings (via the engine — heuristic when no AI key), builds a
// predictability forecast, and persists everything. Replaces the old cosmetic
// "Run Scan" button so the AI/compliance layer is real for live tenants.

function clampPct(n: number): number { return Math.max(0, Math.min(100, Math.round(n))); }
function pctStatus(p: number): ComplianceStatus {
  return p >= 80 ? "compliant" : p >= 65 ? "minor_gap" : "major_gap";
}

export async function runPredictabilityScan() {
  if (MOCK_MODE) { revalidatePath("/ai"); revalidatePath("/dashboard"); return { ok: true, mock: true }; }

  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: "Session expired — please reload." };
  const { tenantId, siteId } = ctx;
  const now = new Date();

  const [chemicals, legal, records, capas, incidents, audits, risks, equipment, waste, documents, oshaCases, bioLabs, ergoTasks, courses, profiles] =
    await Promise.all([
      getChemicals(tenantId), getLegalRequirements(tenantId), getTrainingRecords(tenantId),
      getCapaActions(tenantId), getIncidents(tenantId), getAudits(tenantId),
      getRiskAssessments(tenantId), getEquipment(tenantId), getWasteStreams(tenantId),
      getDocuments(tenantId), getOshaCases(tenantId), getBiosafetyLabs(tenantId), getErgonomicsJobTasks(tenantId),
      getTrainingCourses(tenantId), getProfiles(tenantId),
    ]);

  // ── Per-module compliance scores (derived from real data) ──
  const sdsOk = chemicals.filter((c) => c.sds_expiry && new Date(c.sds_expiry) > now).length;
  const chemPct = chemicals.length ? clampPct((100 * sdsOk) / chemicals.length) : 100;

  const assessed = legal.filter((l) => l.status !== "not_applicable");
  const legalPct = assessed.length
    ? clampPct(assessed.reduce((s, l) => s + (COMPLIANCE_STATUS_META[l.status]?.score ?? 0), 0) / assessed.length)
    : 50;

  const passedRecs = records.filter((r) => r.passed);
  const currentRecs = passedRecs.filter((r) => !r.expiry_date || new Date(r.expiry_date) > now);
  const expiredCerts = passedRecs.length - currentRecs.length;
  const trainingPct = passedRecs.length ? clampPct((100 * currentRecs.length) / passedRecs.length) : 50;

  const capaClosed = capas.filter((c) => c.status === "closed").length;
  const capaInProg = capas.filter((c) => c.status === "in_progress").length;
  const capaOverdue = capas.filter((c) => c.status === "overdue" || ((c.status === "open" || c.status === "in_progress") && c.due_date != null && new Date(c.due_date) < now)).length;
  const capaPct = capas.length ? clampPct((100 * (capaClosed + 0.5 * capaInProg)) / capas.length - capaOverdue * 5) : 100;

  const auditScores = audits
    .filter((a) => a.status === "completed")
    .map((a) => { try { return JSON.parse(a.notes ?? "{}").score as number; } catch { return null; } })
    .filter((n): n is number => typeof n === "number");
  const auditPct = audits.length ? (auditScores.length ? clampPct(auditScores.reduce((s, n) => s + n, 0) / auditScores.length) : 50) : 100;

  const openHighInc = incidents.filter((i) => (i.severity === "high" || i.severity === "critical") && i.status !== "closed").length;
  const incPct = clampPct(100 - openHighInc * 15 - oshaCases.length * 5);

  const overdueReviews = risks.filter((r) => r.review_date && new Date(r.review_date) < now).length;
  const extremeRisks = risks.filter((r) => r.risk_level === "extreme" || r.risk_level === "high").length;
  const riskPct = risks.length ? clampPct(100 - overdueReviews * 10 - extremeRisks * 5) : 100;

  const wastePct = waste.length ? 75 : 100;

  const equipOverdue = equipment.filter((e) =>
    (e.next_calibration_date && new Date(e.next_calibration_date) < now) ||
    (e.next_inspection_date && new Date(e.next_inspection_date) < now)).length;
  const equipPct = equipment.length ? clampPct((100 * (equipment.length - equipOverdue)) / equipment.length) : 100;

  const docPct = documents.length ? clampPct(50 + documents.length * 3) : 40;
  const bioPct = bioLabs.length ? 70 : 100;
  const oshaPct = oshaCases.length ? clampPct(100 - oshaCases.length * 8) : 100;
  const ergoPct = ergoTasks.length ? 75 : 100;

  const moduleScores: Record<string, number> = {
    chemical: chemPct, legal: legalPct, training: trainingPct, capa: capaPct,
    audits: auditPct, incidents: incPct, risk: riskPct, waste: wastePct,
    equipment: equipPct, documents: docPct, biosafety: bioPct,
    osha: oshaPct, ergonomics: ergoPct,
  };

  const scoreRows = Object.entries(moduleScores).map(([module, pct]) => ({
    tenant_id: tenantId, site_id: siteId, module, score: pct, max_score: 100,
    percentage: pct, status: pctStatus(pct), calculated_at: now.toISOString(),
    details: { source: "p-engine-scan" },
  }));

  // ── AI findings: worst-offender chemicals + legal requirements ──
  const topChems = [...chemicals]
    .sort((a, b) =>
      (b.ghs_classes.length + (b.is_scheduled ? 5 : 0)) - (a.ghs_classes.length + (a.is_scheduled ? 5 : 0)))
    .slice(0, 4);
  const worstLegal = legal
    .filter((l) => l.status === "non_compliant" || l.status === "major_gap" || l.status === "minor_gap")
    .slice(0, 3);
  // Waste streams with classification-integrity signals: an EPA D/F/K/P/U code
  // on a stream recorded as non-hazardous, quantity over the regulatory limit,
  // or a high-control classification worth verifying.
  const wasteSignal = (w: WasteStream) =>
    (/^[DFKPU]\d{3}/i.test(w.waste_code ?? "") && ["non_hazardous", "general", "recyclable"].includes(w.classification) ? 5 : 0) +
    (w.regulatory_limit != null && w.quantity > w.regulatory_limit ? 4 : 0) +
    (["hazardous", "radioactive", "clinical", "scheduled"].includes(w.classification) ? 2 : 0);
  const topWaste = [...waste]
    .filter((w) => wasteSignal(w) > 0)
    .sort((a, b) => wasteSignal(b) - wasteSignal(a))
    .slice(0, 3);

  // Analysis cache: reuse a prior pending finding when a record's inputs are
  // unchanged, so this scan only re-calls the model for what actually changed.
  const priorByKey = new Map<string, AiFinding>();
  for (const f of await getAiFindings(tenantId)) {
    if (f.review_status === "pending") priorByKey.set(`${f.source_type}|${f.source_id ?? ""}`, f);
  }

  const findings: AiFinding[] = [];
  for (const c of topChems) {
    if (c.ghs_classes.length === 0 && !c.is_scheduled) continue;
    try { findings.push(await analyzeChemical(c, priorByKey.get(`chemical|${c.id}`))); } catch { /* skip */ }
  }
  for (const l of worstLegal) {
    try { findings.push(await analyzeComplianceGap(l, priorByKey.get(`legal_requirement|${l.id}`))); } catch { /* skip */ }
  }
  for (const w of topWaste) {
    try { findings.push(await analyzeWaste(w, priorByKey.get(`waste_stream|${w.id}`))); } catch { /* skip */ }
  }
  // Training gap analysis — one tenant-level finding over role-based coverage.
  if (courses.length > 0 && profiles.length > 0) {
    try {
      findings.push(await analyzeTraining({ tenant_id: tenantId, site_id: siteId, courses, records, profiles, now: now.getTime() }, priorByKey.get("training|")));
    } catch { /* skip */ }
  }

  const actionsProposed = findings.reduce((s, f) => s + ((f.output as AiAnalysisOutput)?.recommended_actions?.length ?? 0), 0);

  const forecast = buildPredictabilityForecast({
    complianceScores: moduleScores,
    overdueCapaCount: capaOverdue,
    overdueTrainingCount: expiredCerts,
    expiringSdsCount: chemicals.filter((c) => c.sds_expiry && new Date(c.sds_expiry) <= now).length,
    openIncidentCount: incidents.filter((i) => i.status !== "closed").length,
  });

  const itemsScanned = chemicals.length + legal.length + records.length + capas.length +
    incidents.length + audits.length + risks.length + equipment.length + waste.length +
    documents.length + oshaCases.length + bioLabs.length;

  // ── Persist: recompute scores, refresh pending findings, log the run ──
  await ctx.client.from("compliance_scores").delete().eq("tenant_id", tenantId);
  if (scoreRows.length) {
    const { error } = await ctx.client.from("compliance_scores").insert(scoreRows);
    if (error) return { ok: false, error: error.message };
  }

  // Keep human-reviewed findings; replace the pending (machine-proposed) set.
  await ctx.client.from("ehs_ai_findings").delete().eq("tenant_id", tenantId).eq("review_status", "pending");
  if (findings.length) {
    const { error } = await ctx.client.from("ehs_ai_findings").insert(findings.map((f) => ({
      tenant_id: tenantId, site_id: siteId, cell_id: null, job: f.job,
      source_type: f.source_type, source_id: f.source_id, model: f.model,
      prompt_version: f.prompt_version, input_summary: f.input_summary, output: f.output,
      confidence: f.confidence, review_status: "pending", human_review_required: f.human_review_required,
    })));
    if (error) return { ok: false, error: error.message };
  }

  const { error: runError } = await ctx.client.from("predictability_runs").insert({
    tenant_id: tenantId, site_id: siteId, stage: "forecast",
    summary: `P-Engine scanned ${itemsScanned} EHS records across ${scoreRows.length} modules. Compliance trend: ${forecast.compliance_trend}; 30-day projection ${forecast.predicted_compliance_score_30d}%. Top risk modules: ${forecast.top_risk_modules.join(", ")}. ${findings.length} findings raised, ${actionsProposed} actions proposed.`,
    items_scanned: itemsScanned, signals_found: findings.length, actions_proposed: actionsProposed,
    forecast_data: forecast,
  });
  if (runError) return { ok: false, error: runError.message };

  revalidatePath("/ai");
  revalidatePath("/dashboard");
  return { ok: true, scanned: itemsScanned, findings: findings.length, modules: scoreRows.length };
}

// ── AI Program Builder ────────────────────────────────────────────────────────
// Reads the company's uploaded manuals/SOPs + live data and authors a required
// EHS program/SOP as a real, editable document (draft), linked to the regulation
// it satisfies. Surfaces wherever the platform references that document.
export async function buildProgramFromDocs(programKey: string) {
  if (MOCK_MODE) return { ok: false as const, error: "Program builder runs in live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  const def = PROGRAM_DEFS.find((d) => d.key === programKey);
  if (!def) return { ok: false as const, error: "Unknown program." };
  const { tenantId, client } = ctx;

  // Company / site / EHS lead context
  const { data: tenantRow } = await client.from("tenants").select("name").eq("id", tenantId).single();
  const company = (tenantRow?.name as string) || "Your Company";
  const { data: siteRow } = await client.from("sites").select("name, address").eq("tenant_id", tenantId).limit(1).maybeSingle();
  const site = siteRow?.name ? (siteRow.address ? `${siteRow.name}, ${siteRow.address}` : (siteRow.name as string)) : "Main Site";
  const { data: profs } = await client.from("profiles").select("display_name, job_title, role").eq("tenant_id", tenantId);
  const lead = (profs ?? []).find((p) => p.role === "ehs_manager") ?? (profs ?? [])[0];
  const cho = lead ? `${lead.display_name}${lead.job_title ? `, ${lead.job_title}` : ""}` : "EHS Manager";

  const [chemicals, biosafetyLabs, wasteStreams] = await Promise.all([
    getChemicals(tenantId), getBiosafetyLabs(tenantId), getWasteStreams(tenantId),
  ]);
  void biosafetyLabs; void wasteStreams; // included in ctx for future program types

  // Best-effort: pull the company's uploaded safety manuals + SOPs to ground the AI.
  const sources: SourceBlock[] = [];
  const sourcePaths: string[] = [];
  const { serviceRoleKey } = serverSecrets();
  if (serviceRoleKey) {
    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } });
    for (const cat of ["safety_manual", "sop"]) {
      const { data: list } = await svc.storage.from("client-documents").list(`${tenantId}/${cat}`);
      for (const f of (list ?? []).slice(0, 3)) {
        const p = `${tenantId}/${cat}/${f.name}`;
        try {
          const { data: blob } = await svc.storage.from("client-documents").download(p);
          if (!blob) continue;
          if (f.name.toLowerCase().endsWith(".pdf")) {
            sources.push({ name: f.name, base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mimeType: "application/pdf" });
          } else {
            sources.push({ name: f.name, text: await blob.text() });
          }
          sourcePaths.push(p);
        } catch { /* skip unreadable file */ }
      }
    }
  }

  const sections = await generateProgram(def, { company, site, cho }, chemicals, sources);

  const today = new Date().toISOString().slice(0, 10);
  const review = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
  const { error } = await client.from("documents").insert({
    tenant_id: tenantId, title: def.title, category: def.category, version: "1.0",
    storage_path: "", effective_date: today, review_date: review, status: "draft",
    acknowledgment_required: true, regulation_ref: def.regulation,
    content: sections, generated: true, source_doc_paths: sourcePaths, owner_id: ctx.profileId,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/documents");
  revalidatePath("/legal");
  return { ok: true as const, title: def.title, sections: sections.length, grounded: sourcePaths.length };
}

// ── Ongoing Document Import → staging review queue ─────────────────────────────
// Extracts rows from uploaded files into a staging queue (NOT live tables).
// Each row is dedup-checked against existing records; a human accepts/rejects.

interface StagedRow {
  id: string; row_kind: string; candidate: Record<string, unknown>; label: string;
  source_name: string | null; status: string; dedup_of: string | null; dedup_note: string | null; created_at: string;
}

export async function getStagedRows(): Promise<StagedRow[]> {
  if (MOCK_MODE) return [];
  const ctx = await getCtx();
  if (!ctx) return [];
  const { data } = await ctx.client
    .from("document_staged_rows")
    .select("id, row_kind, candidate, label, source_name, status, dedup_of, dedup_note, created_at")
    .eq("tenant_id", ctx.tenantId).eq("status", "staged")
    .order("created_at", { ascending: false });
  return (data as StagedRow[] | null) ?? [];
}

export async function stageDocumentImport(kind: RowKind, files: { name: string; path: string }[]) {
  if (MOCK_MODE) return { ok: false as const, error: "Import runs in live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  const def = KIND_DEFS[kind];
  if (!def) return { ok: false as const, error: "Unknown document type." };
  const { serviceRoleKey } = serverSecrets();
  if (!serviceRoleKey) return { ok: false as const, error: "Import needs the service-role key configured." };
  const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } });

  // SECURITY: service-role download bypasses Storage RLS — reject any path that
  // isn't under the caller's own tenant prefix.
  if (files.some((f) => !f?.path || !f.path.startsWith(`${ctx.tenantId}/`))) {
    return { ok: false as const, error: "Invalid file path." };
  }

  // Existing live records → dedup keys
  const existing = kind === "chemical" ? await getChemicals(ctx.tenantId)
    : kind === "waste" ? await getWasteStreams(ctx.tenantId)
    : kind === "legal" ? await getLegalRequirements(ctx.tenantId)
    : kind === "training" ? await getTrainingCourses(ctx.tenantId)
    : kind === "incident" ? await getIncidents(ctx.tenantId)
    : await getEquipment(ctx.tenantId);
  const existingKeys = new Map(existing.map((e) => [def.dedupKey(e as unknown as Record<string, unknown>), e.id]));

  const staged: Record<string, unknown>[] = [];
  let emptyFiles = 0;
  for (const f of files) {
    let source: SourceBlock | null = null;
    try {
      const { data: blob } = await svc.storage.from("client-documents").download(f.path);
      if (blob) {
        if (f.name.toLowerCase().endsWith(".pdf")) source = { name: f.name, base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mimeType: "application/pdf" };
        else source = { name: f.name, text: await blob.text() };
      }
    } catch { /* unreadable */ }
    if (!source) { emptyFiles++; continue; }
    const rows = await extractRows(kind, [source]);
    if (rows.length === 0) { emptyFiles++; continue; }
    for (const r of rows) {
      const dup = existingKeys.get(def.dedupKey(r)) ?? null;
      staged.push({
        tenant_id: ctx.tenantId, site_id: ctx.siteId, row_kind: kind, candidate: r, label: def.label(r),
        source_name: f.name, source_path: f.path, status: "staged",
        dedup_of: dup, dedup_note: dup ? "Matches an existing record — review before accepting" : null,
      });
    }
  }
  if (staged.length === 0) {
    return { ok: true as const, staged: 0, dupes: 0, note: emptyFiles > 0 ? "No rows extracted — files had no readable content." : "No rows found." };
  }
  const { error } = await ctx.client.from("document_staged_rows").insert(staged);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/documents/import");
  return { ok: true as const, staged: staged.length, dupes: staged.filter((s) => s.dedup_of).length };
}

export async function approveStagedRow(id: string, editedJson?: string) {
  if (MOCK_MODE) return { ok: false as const, error: "Live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  const { data: row } = await ctx.client.from("document_staged_rows").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).single();
  if (!row) return { ok: false as const, error: "Row not found." };
  if (row.status !== "staged") return { ok: false as const, error: "Already reviewed." };
  const def = KIND_DEFS[row.row_kind as RowKind];
  if (!def) return { ok: false as const, error: "Unknown document type." };
  // Use the user's inline edits if provided; persist them on the staged row too.
  let candidate = row.candidate as Record<string, unknown>;
  if (editedJson) {
    try {
      const edited = JSON.parse(editedJson);
      if (edited && typeof edited === "object") {
        candidate = edited as Record<string, unknown>;
        await ctx.client.from("document_staged_rows").update({ candidate, label: def.label(candidate) }).eq("id", id).eq("tenant_id", ctx.tenantId);
      }
    } catch { /* ignore bad edits, use original */ }
  }
  const live = def.toLive(candidate, { tenantId: ctx.tenantId, siteId: ctx.siteId, createdBy: ctx.profileId });
  const { error } = await ctx.client.from(def.table).insert(live);
  if (error) return { ok: false as const, error: error.message };
  await ctx.client.from("document_staged_rows").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", ctx.tenantId);
  revalidatePath("/documents/import");
  revalidatePath("/chemicals"); revalidatePath("/waste"); revalidatePath("/legal"); revalidatePath("/dashboard");
  return { ok: true as const };
}


export async function rejectStagedRow(id: string) {
  if (MOCK_MODE) return { ok: false as const, error: "Live mode only." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false as const, error: "Session expired — please reload." };
  await ctx.client.from("document_staged_rows").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", ctx.tenantId);
  revalidatePath("/documents/import");
  return { ok: true as const };
}


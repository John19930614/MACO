/**
 * POST /api/onboarding/process
 *
 * Called immediately after the onboarding wizard completes. Downloads every
 * file the user uploaded to Supabase Storage, runs AI extraction for each
 * document category, and seeds the relevant database tables:
 *
 *   chemicals    → chemical_inventory
 *   hazard_waste → waste_streams
 *   employees    → tenants.onboarding_data.extracted_employees (for later invite)
 *   training_req → training_courses
 *   sds          → documents (category = "msds")
 *
 * Returns { ok: true, seeded: { chemicals: N, waste_streams: N, ... } }
 */
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { serverSecrets, aiProvider, hasLiveAi } from "@/lib/env";

// ── Supabase service-role client (bypasses RLS for seeding) ───────────────────

function serviceClient() {
  const { serviceRoleKey } = serverSecrets();
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ── File download helpers ─────────────────────────────────────────────────────

async function downloadFile(path: string): Promise<{ text: string; base64: string; mimeType: string }> {
  const svc = serviceClient();
  const { data: blob, error } = await svc.storage.from("client-documents").download(path);
  if (error || !blob) throw new Error(`Storage download failed: ${error?.message}`);

  const lower = path.toLowerCase();
  const buffer = await blob.arrayBuffer();

  // Excel → convert to CSV text for AI
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = xlsxRead(Buffer.from(buffer), { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const text = xlsxUtils.sheet_to_csv(ws);
    return { text, base64: "", mimeType: "text/csv" };
  }

  // PDF → base64 for Anthropic document API
  if (lower.endsWith(".pdf")) {
    const base64 = Buffer.from(buffer).toString("base64");
    return { text: "", base64, mimeType: "application/pdf" };
  }

  // CSV / DOC / TXT → plain text
  const text = await blob.text();
  return { text, base64: "", mimeType: "text/plain" };
}

// ── AI extraction (uses existing provider abstraction) ────────────────────────

interface UploadedFile { name: string; path: string }

async function extractWithAI(
  files: UploadedFile[],
  systemPrompt: string,
  userHint: string,
  schema: Anthropic.Tool.InputSchema,
  toolName: string,
): Promise<unknown[]> {
  if (!hasLiveAi()) return [];

  const { anthropicKey, anthropicModel, openaiKey, aiModel } = serverSecrets();
  const provider = aiProvider();

  const allRows: unknown[] = [];

  for (const file of files) {
    let fileData: { text: string; base64: string; mimeType: string };
    try {
      fileData = await downloadFile(file.path);
    } catch {
      if (process.env.NODE_ENV !== "production") { console.warn(`[onboarding] skipping ${file.name}: download failed`); }
      continue;
    }

    try {
      if (provider === "anthropic") {
        const client = new Anthropic({ apiKey: anthropicKey });
        const contentBlocks: Anthropic.MessageParam["content"] = [];

        if (fileData.base64 && fileData.mimeType === "application/pdf") {
          contentBlocks.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: fileData.base64 },
          } as Anthropic.DocumentBlockParam);
        } else if (fileData.text) {
          contentBlocks.push({ type: "text", text: `File: ${file.name}\n\n${fileData.text}` });
        }
        contentBlocks.push({ type: "text", text: userHint });

        const resp = await client.messages.create({
          model: anthropicModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: contentBlocks }],
          tools: [{ name: toolName, description: "Return the extracted rows.", input_schema: schema }],
          tool_choice: { type: "tool", name: toolName },
        });

        const block = resp.content.find((b) => b.type === "tool_use");
        if (block?.type === "tool_use") {
          const rows = (block.input as Record<string, unknown>).items;
          if (Array.isArray(rows)) allRows.push(...rows);
        }
      } else {
        // OpenAI path — text only
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: openaiKey });
        const userContent = fileData.text
          ? `File: ${file.name}\n\n${fileData.text}\n\n${userHint}`
          : `File: ${file.name} (binary)\n\n${userHint}`;

        const resp = await client.chat.completions.create({
          model: aiModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 4096,
        });
        const raw = resp.choices[0]?.message?.content;
        if (raw) {
          const parsed = JSON.parse(raw);
          const rows = parsed.items ?? parsed;
          if (Array.isArray(rows)) allRows.push(...rows);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") { console.error(`[onboarding] AI extraction failed for ${file.name}:`, err); }
    }
  }

  return allRows;
}

// ── Category processors ───────────────────────────────────────────────────────

async function processChemicals(files: UploadedFile[], tenantId: string, userId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object",
    required: ["items"],
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "quantity", "unit", "storage_location"],
          additionalProperties: false,
          properties: {
            name:                    { type: "string" },
            cas_number:              { type: ["string", "null"] },
            chemical_formula:        { type: ["string", "null"] },
            quantity:                { type: "number" },
            unit:                    { type: "string" },
            storage_location:        { type: "string" },
            supplier:                { type: ["string", "null"] },
            ghs_classes:             { type: "array", items: { type: "string" } },
            hazard_statements:       { type: "array", items: { type: "string" } },
            precautionary_statements:{ type: "array", items: { type: "string" } },
            is_scheduled:            { type: "boolean" },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an EHS data specialist. Extract chemical inventory records from the provided document. Return every chemical found. For GHS classes use standard identifiers like 'Flammable', 'Toxic', 'Corrosive', 'Oxidizer', 'Irritant', 'Environmental hazard', 'Explosive', 'Compressed gas'. If a field is unknown, use a sensible default (empty array, null, 0). Never invent data that isn't present.",
    "Extract all chemicals listed in this inventory document.",
    schema,
    "extract_chemicals",
  );

  if (rows.length === 0) return 0;

  const svc = serviceClient();
  const records = rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      tenant_id: tenantId,
      name: String(row.name ?? "Unknown Chemical"),
      cas_number: row.cas_number ? String(row.cas_number) : null,
      chemical_formula: row.chemical_formula ? String(row.chemical_formula) : null,
      quantity: Number(row.quantity) || 0,
      unit: String(row.unit || "units"),
      storage_location: String(row.storage_location || "Unspecified"),
      supplier: row.supplier ? String(row.supplier) : null,
      ghs_classes: Array.isArray(row.ghs_classes) ? row.ghs_classes : [],
      hazard_statements: Array.isArray(row.hazard_statements) ? row.hazard_statements : [],
      precautionary_statements: Array.isArray(row.precautionary_statements) ? row.precautionary_statements : [],
      is_scheduled: Boolean(row.is_scheduled),
      status: "active",
      created_by: userId,
    };
  });

  const { error } = await svc.from("chemical_inventory").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] chemicals insert:", error); } return 0; }
  return records.length;
}

async function processWasteStreams(files: UploadedFile[], tenantId: string, userId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object",
    required: ["items"],
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["waste_name", "classification", "quantity", "unit", "disposal_method"],
          additionalProperties: false,
          properties: {
            waste_name:         { type: "string" },
            waste_code:         { type: ["string", "null"] },
            classification:     { type: "string" },
            quantity:           { type: "number" },
            unit:               { type: "string" },
            disposal_method:    { type: "string" },
            disposal_contractor:{ type: ["string", "null"] },
            manifest_number:    { type: ["string", "null"] },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an EHS data specialist. Extract hazardous waste stream records from the provided manifest or record document. For classification use standard values like 'hazardous', 'non-hazardous', 'universal-waste', 'mixed'. For disposal_method use values like 'incineration', 'landfill', 'recycling', 'treatment', 'other'.",
    "Extract all waste streams or disposal records from this document.",
    schema,
    "extract_waste_streams",
  );

  if (rows.length === 0) return 0;

  const svc = serviceClient();
  const records = rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      tenant_id: tenantId,
      waste_name: String(row.waste_name ?? "Unknown Waste"),
      waste_code: row.waste_code ? String(row.waste_code) : null,
      classification: String(row.classification || "hazardous"),
      quantity: Number(row.quantity) || 0,
      unit: String(row.unit || "kg"),
      disposal_method: String(row.disposal_method || "other"),
      disposal_contractor: row.disposal_contractor ? String(row.disposal_contractor) : null,
      manifest_number: row.manifest_number ? String(row.manifest_number) : null,
      status: "active",
      created_by: userId,
    };
  });

  const { error } = await svc.from("waste_streams").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] waste_streams insert:", error); } return 0; }
  return records.length;
}

async function processEmployees(files: UploadedFile[], tenantId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object",
    required: ["items"],
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["display_name"],
          additionalProperties: false,
          properties: {
            display_name: { type: "string" },
            email:        { type: ["string", "null"] },
            job_title:    { type: ["string", "null"] },
            department:   { type: ["string", "null"] },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an HR data specialist. Extract the employee roster from the provided document. Return every person listed. Fields: display_name (full name), email (if present), job_title (if present), department (if present).",
    "Extract all employees or users listed in this roster.",
    schema,
    "extract_employees",
  );

  if (rows.length === 0) return 0;

  // Store extracted employees in tenant onboarding_data for the invite flow
  const svc = serviceClient();
  const { data: tenant } = await svc.from("tenants").select("onboarding_data").eq("id", tenantId).single();
  const existing = (tenant?.onboarding_data as Record<string, unknown>) ?? {};
  await svc.from("tenants").update({
    onboarding_data: { ...existing, extracted_employees: rows },
  }).eq("id", tenantId);

  return rows.length;
}

async function processTrainingCourses(files: UploadedFile[], tenantId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object",
    required: ["items"],
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "description", "course_type", "duration_minutes"],
          additionalProperties: false,
          properties: {
            title:               { type: "string" },
            description:         { type: "string" },
            course_type:         { type: "string" },
            duration_minutes:    { type: "number" },
            regulatory_ref:      { type: ["string", "null"] },
            validity_period_days:{ type: ["number", "null"] },
            required_roles:      { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an EHS training specialist. Extract training course or requirement records from the provided document. For course_type use values like 'safety', 'hazmat', 'emergency-response', 'regulatory', 'equipment', 'general'. Duration should be in minutes — estimate if not stated (e.g. '2 hours' → 120). If regulatory references like OSHA standards are mentioned, capture them in regulatory_ref.",
    "Extract all training courses, requirements, or certifications from this document.",
    schema,
    "extract_training_courses",
  );

  if (rows.length === 0) return 0;

  const svc = serviceClient();
  const records = rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      tenant_id: tenantId,
      title: String(row.title ?? "Training Course"),
      description: String(row.description || ""),
      course_type: String(row.course_type || "general"),
      duration_minutes: Number(row.duration_minutes) || 60,
      regulatory_ref: row.regulatory_ref ? String(row.regulatory_ref) : null,
      validity_period_days: row.validity_period_days ? Number(row.validity_period_days) : null,
      required_roles: Array.isArray(row.required_roles) ? row.required_roles : [],
      active: true,
    };
  });

  const { error } = await svc.from("training_courses").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] training_courses insert:", error); } return 0; }
  return records.length;
}

async function processSDS(files: UploadedFile[], tenantId: string) {
  if (files.length === 0) return 0;

  const svc = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const reviewDate = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);

  const records = files.map((f) => ({
    tenant_id: tenantId,
    title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() || "Safety Data Sheet",
    category: "msds",
    version: "1.0",
    storage_path: f.path,
    effective_date: today,
    review_date: reviewDate,
    status: "active",
    acknowledgment_required: false,
    regulation_ref: null,
  }));

  const { error } = await svc.from("documents").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] sds insert:", error); } return 0; }
  return records.length;
}

// ── Reference documents (COI, EMR letter, etc.) ───────────────────────────────
// No AI extraction — these are stored as reference records in the document
// library so they're filed and tracked, not silently dropped.
async function processReferenceDocs(files: UploadedFile[], tenantId: string, category: string) {
  if (files.length === 0) return 0;
  const svc = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const reviewDate = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
  const records = files.map((f) => ({
    tenant_id: tenantId,
    title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() || "Reference Document",
    category,
    version: "1.0",
    storage_path: f.path,
    effective_date: today,
    review_date: reviewDate,
    status: "active",
    acknowledgment_required: false,
    regulation_ref: null,
  }));
  const { error } = await svc.from("documents").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] reference docs insert:", error); } return 0; }
  return records.length;
}

// ── Safety Manual processor ───────────────────────────────────────────────────
// Reads the company safety manual / IIPP and seeds:
//   legal_requirements  — every regulation/standard referenced
//   training_courses    — every training requirement mentioned
//   risk_assessments    — every identified hazard or risk

async function processSafetyManual(files: UploadedFile[], tenantId: string) {
  if (files.length === 0) return { legal: 0, training: 0, risks: 0 };

  const schema: Anthropic.Tool.InputSchema = {
    type: "object",
    required: ["legal_requirements", "training_courses", "risk_assessments"],
    additionalProperties: false,
    properties: {
      legal_requirements: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "regulation_ref", "jurisdiction", "category"],
          additionalProperties: false,
          properties: {
            title:            { type: "string" },
            regulation_ref:   { type: "string" },
            jurisdiction:     { type: "string" },
            category:         { type: "string" },
            description:      { type: "string" },
          },
        },
      },
      training_courses: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "description", "course_type", "duration_minutes"],
          additionalProperties: false,
          properties: {
            title:                { type: "string" },
            description:          { type: "string" },
            course_type:          { type: "string" },
            duration_minutes:     { type: "number" },
            regulatory_ref:       { type: ["string", "null"] },
            validity_period_days: { type: ["number", "null"] },
            required_roles:       { type: "array", items: { type: "string" } },
          },
        },
      },
      risk_assessments: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "category", "activity", "risk_level"],
          additionalProperties: false,
          properties: {
            title:             { type: "string" },
            description:       { type: "string" },
            category:          { type: "string" },
            activity:          { type: "string" },
            risk_level:        { type: "string" },
            likelihood_score:  { type: "number" },
            consequence_score: { type: "number" },
          },
        },
      },
    },
  };

  const svc = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);

  let legalCount = 0;
  let trainingCount = 0;
  let riskCount = 0;

  for (const file of files) {
    let fileData: { text: string; base64: string; mimeType: string };
    try { fileData = await downloadFile(file.path); } catch { continue; }

    try {
      if (!hasLiveAi()) continue;
      const { anthropicKey, anthropicModel } = serverSecrets();
      const client = new Anthropic({ apiKey: anthropicKey });

      const contentBlocks: Anthropic.MessageParam["content"] = [];
      if (fileData.base64 && fileData.mimeType === "application/pdf") {
        contentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fileData.base64 },
        } as Anthropic.DocumentBlockParam);
      } else {
        contentBlocks.push({ type: "text", text: `File: ${file.name}\n\n${fileData.text}` });
      }
      contentBlocks.push({
        type: "text",
        text: "Carefully read this safety manual/IIPP and extract: (1) every regulatory standard, law, or requirement referenced (e.g. OSHA 29 CFR 1910.xxx, Cal/OSHA, EPA), (2) every training course or certification required, (3) every identified hazard or risk area with its activity and risk level. For risk_level use: extreme, high, medium, low, negligible. For category use: physical, chemical, biological, ergonomic, psychosocial, fire, electrical, environmental. For course_type use: safety, hazmat, emergency-response, regulatory, equipment, general.",
      });

      const resp = await client.messages.create({
        model: anthropicModel,
        max_tokens: 8192,
        system: "You are an expert EHS compliance specialist. Extract structured data from safety manuals, IIPP documents, and similar EHS policy documents. Be thorough — capture every regulation cited, every training requirement, and every hazard mentioned. Return only data that is actually present in the document.",
        messages: [{ role: "user", content: contentBlocks }],
        tools: [{ name: "extract_safety_manual", description: "Return extracted EHS data.", input_schema: schema }],
        tool_choice: { type: "tool", name: "extract_safety_manual" },
      });

      const block = resp.content.find((b) => b.type === "tool_use");
      if (block?.type !== "tool_use") continue;
      const extracted = block.input as {
        legal_requirements: Record<string, unknown>[];
        training_courses: Record<string, unknown>[];
        risk_assessments: Record<string, unknown>[];
      };

      // Seed legal requirements
      if (extracted.legal_requirements?.length > 0) {
        const legalRecords = extracted.legal_requirements.map((r) => ({
          tenant_id:             tenantId,
          title:                 String(r.title || "EHS Requirement"),
          regulation_ref:        String(r.regulation_ref || ""),
          jurisdiction:          String(r.jurisdiction || ""),
          category:              String(r.category || "general"),
          description:           String(r.description || ""),
          applicable_sectors:    [],
          review_frequency_days: 365,
          next_review_date:      nextYear,
          status:                "not_assessed",
        }));
        const { error } = await svc.from("legal_requirements").insert(legalRecords);
        if (!error) legalCount += legalRecords.length;
      }

      // Seed training courses
      if (extracted.training_courses?.length > 0) {
        const trainingRecords = extracted.training_courses.map((r) => ({
          tenant_id:             tenantId,
          title:                 String(r.title || "Training Course"),
          description:           String(r.description || ""),
          course_type:           String(r.course_type || "general"),
          duration_minutes:      Number(r.duration_minutes) || 60,
          regulatory_ref:        r.regulatory_ref ? String(r.regulatory_ref) : null,
          validity_period_days:  r.validity_period_days ? Number(r.validity_period_days) : null,
          required_roles:        Array.isArray(r.required_roles) ? r.required_roles : [],
          active:                true,
        }));
        const { error } = await svc.from("training_courses").insert(trainingRecords);
        if (!error) trainingCount += trainingRecords.length;
      }

      // Seed risk assessments
      if (extracted.risk_assessments?.length > 0) {
        const riskRecords = extracted.risk_assessments.map((r) => {
          const likelihood  = Number(r.likelihood_score)  || 2;
          const consequence = Number(r.consequence_score) || 3;
          return {
            tenant_id:         tenantId,
            title:             String(r.title || "Identified Hazard"),
            description:       String(r.description || ""),
            category:          String(r.category || "physical"),
            activity:          String(r.activity || ""),
            hazards:           [],
            existing_controls: [],
            likelihood_score:  likelihood,
            consequence_score: consequence,
            risk_score:        likelihood * consequence,
            risk_level:        String(r.risk_level || "medium"),
            additional_controls: [],
            review_date:       nextYear,
            status:            "active",
          };
        });
        const { error } = await svc.from("risk_assessments").insert(riskRecords);
        if (!error) riskCount += riskRecords.length;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") { console.error(`[onboarding] safety manual processing failed for ${file.name}:`, err); }
    }
  }

  return { legal: legalCount, training: trainingCount, risks: riskCount };
}

// ── SOPs / Policies processor ─────────────────────────────────────────────────
// Reads uploaded SOP and policy documents and creates an entry in the documents
// table for each procedure found, plus extracts any regulatory references.

async function processSOPs(files: UploadedFile[], tenantId: string) {
  if (files.length === 0) return { documents: 0, legal: 0 };

  const schema: Anthropic.Tool.InputSchema = {
    type: "object",
    required: ["procedures", "legal_requirements"],
    additionalProperties: false,
    properties: {
      procedures: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "category", "description"],
          additionalProperties: false,
          properties: {
            title:          { type: "string" },
            category:       { type: "string" },
            description:    { type: "string" },
            regulation_ref: { type: ["string", "null"] },
          },
        },
      },
      legal_requirements: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "regulation_ref", "jurisdiction", "category"],
          additionalProperties: false,
          properties: {
            title:          { type: "string" },
            regulation_ref: { type: "string" },
            jurisdiction:   { type: "string" },
            category:       { type: "string" },
            description:    { type: "string" },
          },
        },
      },
    },
  };

  const svc = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);

  let docCount = 0;
  let legalCount = 0;

  for (const file of files) {
    let fileData: { text: string; base64: string; mimeType: string };
    try { fileData = await downloadFile(file.path); } catch { continue; }

    // Always create a document record for the file itself
    await svc.from("documents").insert({
      tenant_id:               tenantId,
      title:                   file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() || "SOP Document",
      category:                "sop",
      version:                 "1.0",
      storage_path:            file.path,
      effective_date:          today,
      review_date:             nextYear,
      status:                  "active",
      acknowledgment_required: false,
      regulation_ref:          null,
    });
    docCount++;

    if (!hasLiveAi()) continue;

    try {
      const { anthropicKey, anthropicModel } = serverSecrets();
      const client = new Anthropic({ apiKey: anthropicKey });

      const contentBlocks: Anthropic.MessageParam["content"] = [];
      if (fileData.base64 && fileData.mimeType === "application/pdf") {
        contentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fileData.base64 },
        } as Anthropic.DocumentBlockParam);
      } else {
        contentBlocks.push({ type: "text", text: `File: ${file.name}\n\n${fileData.text}` });
      }
      contentBlocks.push({
        type: "text",
        text: "Extract: (1) individual procedures or SOPs listed in this document — each gets its own entry with title, category (sop, emergency_procedure, permit, work_instruction, policy, form), and a one-sentence description; (2) any regulatory references cited. If this is a single-procedure document, return it as one procedure entry.",
      });

      const resp = await client.messages.create({
        model: anthropicModel,
        max_tokens: 4096,
        system: "You are an EHS document specialist. Extract structured procedure and regulatory data from SOP documents, policy manuals, and work instructions.",
        messages: [{ role: "user", content: contentBlocks }],
        tools: [{ name: "extract_sops", description: "Return extracted procedures and requirements.", input_schema: schema }],
        tool_choice: { type: "tool", name: "extract_sops" },
      });

      const block = resp.content.find((b) => b.type === "tool_use");
      if (block?.type !== "tool_use") continue;
      const extracted = block.input as {
        procedures: Record<string, unknown>[];
        legal_requirements: Record<string, unknown>[];
      };

      // Create additional document records for each sub-procedure found (beyond the file-level record)
      if (extracted.procedures?.length > 1) {
        const subDocs = extracted.procedures.slice(1).map((p) => ({
          tenant_id:               tenantId,
          title:                   String(p.title || "SOP"),
          category:                String(p.category || "sop"),
          version:                 "1.0",
          storage_path:            file.path,
          effective_date:          today,
          review_date:             nextYear,
          status:                  "active",
          acknowledgment_required: false,
          regulation_ref:          p.regulation_ref ? String(p.regulation_ref) : null,
        }));
        const { error } = await svc.from("documents").insert(subDocs);
        if (!error) docCount += subDocs.length;
      }

      // Seed any legal requirements found
      if (extracted.legal_requirements?.length > 0) {
        const legalRecords = extracted.legal_requirements.map((r) => ({
          tenant_id:             tenantId,
          title:                 String(r.title || "Regulatory Requirement"),
          regulation_ref:        String(r.regulation_ref || ""),
          jurisdiction:          String(r.jurisdiction || ""),
          category:              String(r.category || "general"),
          description:           String(r.description || ""),
          applicable_sectors:    [],
          review_frequency_days: 365,
          next_review_date:      nextYear,
          status:                "not_assessed",
        }));
        const { error } = await svc.from("legal_requirements").insert(legalRecords);
        if (!error) legalCount += legalRecords.length;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") { console.error(`[onboarding] SOP processing failed for ${file.name}:`, err); }
    }
  }

  return { documents: docCount, legal: legalCount };
}

// ── OSHA 300/300A/301 Log processor ──────────────────────────────────────────
// Parses historical injury/illness logs → incidents table

async function processOshaLogs(files: UploadedFile[], tenantId: string, siteId: string | null, userId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["items"], additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "incident_type", "severity", "occurred_date", "location"],
          additionalProperties: false,
          properties: {
            title:                        { type: "string" },
            description:                  { type: "string" },
            incident_type:                { type: "string" },
            severity:                     { type: "string" },
            occurred_date:                { type: "string" },
            location:                     { type: "string" },
            injured_party:                { type: ["string", "null"] },
            injuries_description:         { type: ["string", "null"] },
            immediate_actions:            { type: ["string", "null"] },
            lost_time_days:               { type: ["number", "null"] },
            medical_treatment_required:   { type: "boolean" },
            regulatory_reportable:        { type: "boolean" },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an EHS data specialist. Extract every injury and illness case from this OSHA 300, 300A, or 301 log. For incident_type use: 'lost_time_injury', 'medical_treatment', 'first_aid', 'near_miss'. For severity: 'critical' (fatality/hospitalisation), 'high' (days away > 0), 'medium' (restricted work/medical treatment), 'low' (first aid). occurred_date must be ISO format YYYY-MM-DD.",
    "Extract all injury/illness cases from this OSHA log.",
    schema,
    "extract_osha_cases",
  );

  if (rows.length === 0) return 0;

  const svc = serviceClient();
  const records = rows.map((r) => {
    const row = r as Record<string, unknown>;
    const dateStr = String(row.occurred_date || "");
    const occurredAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
    return {
      tenant_id:                   tenantId,
      site_id:                     siteId,
      title:                       String(row.title || "OSHA Recordable Incident"),
      description:                 String(row.description || ""),
      incident_type:               String(row.incident_type || "medical_treatment"),
      severity:                    String(row.severity || "medium"),
      occurred_at:                 occurredAt,
      location:                    String(row.location || ""),
      injured_party:               row.injured_party ? String(row.injured_party) : null,
      injuries_description:        row.injuries_description ? String(row.injuries_description) : null,
      immediate_actions:           row.immediate_actions ? String(row.immediate_actions) : null,
      lost_time_days:              row.lost_time_days ? Number(row.lost_time_days) : null,
      medical_treatment_required:  Boolean(row.medical_treatment_required),
      regulatory_reportable:       Boolean(row.regulatory_reportable),
      reported_by:                 userId,
      status:                      "closed",
    };
  });

  const { error } = await svc.from("incidents").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] osha_logs insert:", error); } return 0; }
  return records.length;
}

// ── Org Chart processor ───────────────────────────────────────────────────────
// Extracts roles, departments and EHS responsibilities → stored in onboarding_data
// for later use in assigning profiles.

async function processOrgChart(files: UploadedFile[], tenantId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["items"], additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "job_title", "department"],
          additionalProperties: false,
          properties: {
            name:               { type: "string" },
            job_title:          { type: "string" },
            department:         { type: "string" },
            ehs_responsibility: { type: ["string", "null"] },
            email:              { type: ["string", "null"] },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an HR/EHS specialist. Extract every person listed in this org chart or responsibility matrix. Capture their name, job title, department, and any stated EHS responsibility (e.g. 'Chemical Hygiene Officer', 'Site Safety Manager', 'First Aid Responder'). Include emails if visible.",
    "Extract all people and their roles from this org chart.",
    schema,
    "extract_org_chart",
  );

  if (rows.length === 0) return 0;

  const svc = serviceClient();
  const { data: tenant } = await svc.from("tenants").select("onboarding_data").eq("id", tenantId).single();
  const existing = (tenant?.onboarding_data as Record<string, unknown>) ?? {};
  await svc.from("tenants").update({
    onboarding_data: { ...existing, extracted_org_structure: rows },
  }).eq("id", tenantId);

  return rows.length;
}

// ── Equipment Register processor ──────────────────────────────────────────────
// Parses equipment/calibration spreadsheets → equipment table (monitoring module)

async function processEquipmentRegister(files: UploadedFile[], tenantId: string, siteId: string | null) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["items"], additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "type", "location"],
          additionalProperties: false,
          properties: {
            name:                     { type: "string" },
            type:                     { type: "string" },
            serial_number:            { type: ["string", "null"] },
            location:                 { type: "string" },
            last_calibration_date:    { type: ["string", "null"] },
            next_calibration_date:    { type: ["string", "null"] },
            last_inspection_date:     { type: ["string", "null"] },
            next_inspection_date:     { type: ["string", "null"] },
            calibration_interval_days:{ type: ["number", "null"] },
            status:                   { type: "string" },
            regulatory_ref:           { type: ["string", "null"] },
            notes:                    { type: ["string", "null"] },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an EHS equipment specialist. Extract every piece of equipment from this register. For type use: 'general', 'air_monitor', 'gas_detector', 'noise_meter', 'pressure_vessel', 'electrical', 'lifting', 'ppe', 'fire_suppression', 'emergency', 'hvac', 'laboratory'. For status use: 'operational', 'calibration_due', 'inspection_due', 'out_of_service'. Dates must be ISO format YYYY-MM-DD.",
    "Extract all equipment records from this register.",
    schema,
    "extract_equipment",
  );

  if (rows.length === 0) return 0;

  const svc = serviceClient();
  const records = rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      tenant_id:                  tenantId,
      site_id:                    siteId,
      name:                       String(row.name || "Unknown Equipment"),
      type:                       String(row.type || "general"),
      serial_number:              row.serial_number ? String(row.serial_number) : null,
      location:                   String(row.location || ""),
      last_calibration_date:      row.last_calibration_date ? String(row.last_calibration_date) : null,
      next_calibration_date:      row.next_calibration_date ? String(row.next_calibration_date) : null,
      last_inspection_date:       row.last_inspection_date  ? String(row.last_inspection_date)  : null,
      next_inspection_date:       row.next_inspection_date  ? String(row.next_inspection_date)  : null,
      calibration_interval_days:  row.calibration_interval_days ? Number(row.calibration_interval_days) : null,
      status:                     String(row.status || "operational"),
      regulatory_ref:             row.regulatory_ref ? String(row.regulatory_ref) : null,
      notes:                      row.notes ? String(row.notes) : null,
    };
  });

  const { error } = await svc.from("equipment").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] equipment insert:", error); } return 0; }
  return records.length;
}

// ── Past Audit Reports processor ──────────────────────────────────────────────
// Parses PDF audit reports → audits + audit_findings (+ triggers CAPA for open items)

async function processAuditReports(files: UploadedFile[], tenantId: string, siteId: string | null, userId: string) {
  if (files.length === 0) return { audits: 0, findings: 0 };
  if (!hasLiveAi()) return { audits: 0, findings: 0 };

  const schema: Anthropic.Tool.InputSchema = {
    type: "object",
    required: ["audit_title", "audit_type", "audit_date", "scope", "findings"],
    additionalProperties: false,
    properties: {
      audit_title: { type: "string" },
      audit_type:  { type: "string" },
      audit_date:  { type: "string" },
      scope:       { type: "string" },
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "description", "category", "severity", "status"],
          additionalProperties: false,
          properties: {
            title:                { type: "string" },
            description:          { type: "string" },
            category:             { type: "string" },
            severity:             { type: "string" },
            status:               { type: "string" },
            capa_required:        { type: "boolean" },
            due_date_offset_days: { type: ["number", "null"] },
          },
        },
      },
    },
  };

  const svc = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  let auditCount = 0;
  let findingCount = 0;

  const { anthropicKey, anthropicModel } = serverSecrets();
  const client = new Anthropic({ apiKey: anthropicKey });

  for (const file of files) {
    let fileData: { text: string; base64: string; mimeType: string };
    try { fileData = await downloadFile(file.path); } catch { continue; }

    try {
      const contentBlocks: Anthropic.MessageParam["content"] = [];
      if (fileData.base64 && fileData.mimeType === "application/pdf") {
        contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData.base64 } } as Anthropic.DocumentBlockParam);
      } else {
        contentBlocks.push({ type: "text", text: `File: ${file.name}\n\n${fileData.text}` });
      }
      contentBlocks.push({
        type: "text",
        text: "Extract the audit metadata and all findings from this audit/inspection report. For audit_type: 'internal', 'external', 'regulatory', 'supplier', 'system', 'process'. For finding category: 'procedure','training','equipment','chemical','waste','documentation','emergency','general'. For severity: 'low','medium','high','critical'. For status: 'open','closed','accepted_risk'. capa_required should be true for medium/high/critical findings. due_date_offset_days = days from now for remediation (e.g. 30, 60, 90). audit_date must be YYYY-MM-DD.",
      });

      const resp = await client.messages.create({
        model: anthropicModel,
        max_tokens: 8192,
        system: "You are an EHS audit specialist. Extract structured audit data from inspection reports, audit summaries, and compliance assessments. Be thorough — capture every finding listed.",
        messages: [{ role: "user", content: contentBlocks }],
        tools: [{ name: "extract_audit", description: "Return extracted audit data.", input_schema: schema }],
        tool_choice: { type: "tool", name: "extract_audit" },
      });

      const block = resp.content.find((b) => b.type === "tool_use");
      if (block?.type !== "tool_use") continue;
      const extracted = block.input as {
        audit_title: string; audit_type: string; audit_date: string;
        scope: string; findings: Record<string, unknown>[];
      };

      // Insert audit record
      const auditDate = extracted.audit_date || today;
      const { data: audit, error: auditErr } = await svc.from("audits").insert({
        tenant_id:       tenantId,
        site_id:         siteId,
        title:           extracted.audit_title || file.name.replace(/\.[^.]+$/, ""),
        type:            extracted.audit_type || "internal",
        scheduled_date:  auditDate,
        completed_date:  auditDate,
        status:          "completed",
        lead_auditor_id: userId,
        scope:           extracted.scope || "",
      }).select("id").single();

      if (auditErr || !audit) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] audit insert:", auditErr); } continue; }
      auditCount++;

      // Insert findings
      if (extracted.findings?.length > 0) {
        const findingRecords = extracted.findings.map((f) => {
          const offsetDays = f.due_date_offset_days ? Number(f.due_date_offset_days) : 90;
          const dueDate = new Date(Date.now() + offsetDays * 86400 * 1000).toISOString().slice(0, 10);
          return {
            tenant_id:     tenantId,
            audit_id:      audit.id,
            site_id:       siteId,
            title:         String(f.title || "Audit Finding"),
            description:   String(f.description || ""),
            category:      String(f.category || "general"),
            severity:      String(f.severity || "medium"),
            status:        String(f.status || "open"),
            capa_required: Boolean(f.capa_required ?? true),
            due_date:      dueDate,
          };
        });
        const { data: insertedFindings, error: fErr } = await svc
          .from("audit_findings")
          .insert(findingRecords)
          .select("id, title, severity, capa_required, due_date");

        if (!fErr && insertedFindings) {
          findingCount += insertedFindings.length;

          // Auto-create CAPA records for findings that require corrective action
          const capaFindings = insertedFindings.filter((f: Record<string, unknown>) => f.capa_required);
          if (capaFindings.length > 0) {
            const capaRecords = capaFindings.map((f: Record<string, unknown>) => ({
              tenant_id:   tenantId,
              site_id:     siteId,
              title:       `[Audit Finding] ${String(f.title)}`,
              description: "Corrective action required for finding imported during onboarding.",
              kind:        "corrective",
              source_type: "audit_finding",
              source_id:   String(f.id),
              severity:    String(f.severity || "medium"),
              due_date:    f.due_date ? String(f.due_date) : null,
              status:      "open",
            }));
            await svc.from("capa_records").insert(capaRecords);
          }
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") { console.error(`[onboarding] audit report processing failed for ${file.name}:`, err); }
    }
  }

  return { audits: auditCount, findings: findingCount };
}

// ── JSAs / Risk Assessments processor ────────────────────────────────────────
// Parses Job Safety Analyses, HAZOP studies, and risk registers → risk_assessments

async function processJSAs(files: UploadedFile[], tenantId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["items"], additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "category", "activity", "risk_level"],
          additionalProperties: false,
          properties: {
            title:              { type: "string" },
            description:        { type: "string" },
            category:           { type: "string" },
            activity:           { type: "string" },
            hazards:            { type: "array", items: { type: "string" } },
            existing_controls:  { type: "array", items: { type: "string" } },
            additional_controls:{ type: "array", items: { type: "string" } },
            risk_level:         { type: "string" },
            likelihood_score:   { type: "number" },
            consequence_score:  { type: "number" },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an EHS risk specialist. Extract every risk, hazard, or JSA task from this document as individual risk assessment records. For category: 'physical','chemical','biological','ergonomic','psychosocial','fire','electrical','environmental'. For risk_level: 'extreme','high','medium','low','negligible'. likelihood_score and consequence_score should each be 1–5. hazards, existing_controls, and additional_controls should be arrays of short strings.",
    "Extract all risk assessments or JSA entries from this document.",
    schema,
    "extract_risk_assessments",
  );

  if (rows.length === 0) return 0;

  const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
  const svc = serviceClient();
  const records = rows.map((r) => {
    const row = r as Record<string, unknown>;
    const likelihood  = Number(row.likelihood_score)  || 2;
    const consequence = Number(row.consequence_score) || 3;
    return {
      tenant_id:          tenantId,
      title:              String(row.title || "Identified Risk"),
      description:        String(row.description || ""),
      category:           String(row.category || "physical"),
      activity:           String(row.activity || ""),
      hazards:            Array.isArray(row.hazards) ? row.hazards : [],
      existing_controls:  Array.isArray(row.existing_controls) ? row.existing_controls : [],
      additional_controls:Array.isArray(row.additional_controls) ? row.additional_controls : [],
      likelihood_score:   likelihood,
      consequence_score:  consequence,
      risk_score:         likelihood * consequence,
      risk_level:         String(row.risk_level || "medium"),
      review_date:        nextYear,
      status:             "active",
    };
  });

  const { error } = await svc.from("risk_assessments").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] jsa insert:", error); } return 0; }
  return records.length;
}

// ── Emergency Response Plan processor ────────────────────────────────────────
// Reads ERP documents → documents (emergency_procedure) + training_courses

async function processERP(files: UploadedFile[], tenantId: string) {
  if (files.length === 0) return { documents: 0, training: 0 };

  const today    = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
  const svc = serviceClient();
  let docCount = 0;
  let trainingCount = 0;

  for (const file of files) {
    // Always store the ERP file itself as a document
    await svc.from("documents").insert({
      tenant_id:               tenantId,
      title:                   file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() || "Emergency Response Plan",
      category:                "emergency_procedure",
      version:                 "1.0",
      storage_path:            file.path,
      effective_date:          today,
      review_date:             nextYear,
      status:                  "active",
      acknowledgment_required: true,
      regulation_ref:          null,
    });
    docCount++;

    if (!hasLiveAi()) continue;

    let fileData: { text: string; base64: string; mimeType: string };
    try { fileData = await downloadFile(file.path); } catch { continue; }

    try {
      const schema: Anthropic.Tool.InputSchema = {
        type: "object", required: ["procedures", "training_courses"], additionalProperties: false,
        properties: {
          procedures: {
            type: "array",
            items: {
              type: "object", required: ["title", "category", "description"], additionalProperties: false,
              properties: {
                title:          { type: "string" },
                category:       { type: "string" },
                description:    { type: "string" },
                regulation_ref: { type: ["string", "null"] },
              },
            },
          },
          training_courses: {
            type: "array",
            items: {
              type: "object", required: ["title", "description", "course_type", "duration_minutes"], additionalProperties: false,
              properties: {
                title:                { type: "string" },
                description:          { type: "string" },
                course_type:          { type: "string" },
                duration_minutes:     { type: "number" },
                regulatory_ref:       { type: ["string", "null"] },
                validity_period_days: { type: ["number", "null"] },
              },
            },
          },
        },
      };

      const { anthropicKey, anthropicModel } = serverSecrets();
      const client = new Anthropic({ apiKey: anthropicKey });
      const contentBlocks: Anthropic.MessageParam["content"] = [];
      if (fileData.base64 && fileData.mimeType === "application/pdf") {
        contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData.base64 } } as Anthropic.DocumentBlockParam);
      } else {
        contentBlocks.push({ type: "text", text: `File: ${file.name}\n\n${fileData.text}` });
      }
      contentBlocks.push({
        type: "text",
        text: "Extract: (1) each emergency procedure section (fire, spill, evacuation, medical, etc.) as a separate procedure entry — category should be one of: emergency_procedure, sop, policy; (2) any training requirements mentioned (drills, certifications, refresher periods). For course_type use: emergency-response, safety, regulatory, general.",
      });

      const resp = await client.messages.create({
        model: anthropicModel, max_tokens: 4096,
        system: "You are an EHS emergency response specialist. Extract structured procedure and training data from Emergency Response Plans.",
        messages: [{ role: "user", content: contentBlocks }],
        tools: [{ name: "extract_erp", description: "Return extracted ERP data.", input_schema: schema }],
        tool_choice: { type: "tool", name: "extract_erp" },
      });

      const block = resp.content.find((b) => b.type === "tool_use");
      if (block?.type !== "tool_use") continue;
      const extracted = block.input as { procedures: Record<string, unknown>[]; training_courses: Record<string, unknown>[] };

      // Sub-procedure documents (beyond the file-level record already created)
      if (extracted.procedures?.length > 0) {
        const subDocs = extracted.procedures.map((p) => ({
          tenant_id:               tenantId,
          title:                   String(p.title || "Emergency Procedure"),
          category:                String(p.category || "emergency_procedure"),
          version:                 "1.0",
          storage_path:            file.path,
          effective_date:          today,
          review_date:             nextYear,
          status:                  "active",
          acknowledgment_required: true,
          regulation_ref:          p.regulation_ref ? String(p.regulation_ref) : null,
        }));
        const { error } = await svc.from("documents").insert(subDocs);
        if (!error) docCount += subDocs.length;
      }

      // Training courses
      if (extracted.training_courses?.length > 0) {
        const courses = extracted.training_courses.map((r) => ({
          tenant_id:            tenantId,
          title:                String(r.title || "Emergency Response Training"),
          description:          String(r.description || ""),
          course_type:          String(r.course_type || "emergency-response"),
          duration_minutes:     Number(r.duration_minutes) || 60,
          regulatory_ref:       r.regulatory_ref ? String(r.regulatory_ref) : null,
          validity_period_days: r.validity_period_days ? Number(r.validity_period_days) : 365,
          required_roles:       [],
          active:               true,
        }));
        const { error } = await svc.from("training_courses").insert(courses);
        if (!error) trainingCount += courses.length;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") { console.error(`[onboarding] ERP processing failed for ${file.name}:`, err); }
    }
  }

  return { documents: docCount, training: trainingCount };
}

// ── Environmental Permits & Licences processor ────────────────────────────────
// Parses permit documents → legal_requirements (with expiry dates) + documents

async function processPermits(files: UploadedFile[], tenantId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["items"], additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "regulation_ref", "jurisdiction", "category"],
          additionalProperties: false,
          properties: {
            title:          { type: "string" },
            regulation_ref: { type: "string" },
            permit_number:  { type: ["string", "null"] },
            jurisdiction:   { type: "string" },
            category:       { type: "string" },
            expiry_date:    { type: ["string", "null"] },
            description:    { type: "string" },
          },
        },
      },
    },
  };

  const today    = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
  const svc = serviceClient();
  let legalCount = 0;
  let docCount   = 0;

  // Store each file as a reference document
  for (const file of files) {
    await svc.from("documents").insert({
      tenant_id:               tenantId,
      title:                   file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() || "Environmental Permit",
      category:                "permit",
      version:                 "1.0",
      storage_path:            file.path,
      effective_date:          today,
      review_date:             nextYear,
      status:                  "active",
      acknowledgment_required: false,
      regulation_ref:          null,
    });
    docCount++;
  }

  const rows = await extractWithAI(
    files,
    "You are an EHS regulatory compliance specialist. Extract every permit, licence, or regulatory approval from this document. For category use: 'environmental','air','water','waste','chemical','fire','building','operational'. expiry_date must be ISO format YYYY-MM-DD. regulation_ref should be the specific regulation or permit number/type (e.g. 'EPA Title V Air Permit', 'RCRA Hazardous Waste Generator Permit'). jurisdiction should be the issuing authority (e.g. 'US EPA', 'California Air Resources Board', 'State of Texas').",
    "Extract all permits, licences, and regulatory approvals from this document.",
    schema,
    "extract_permits",
  );

  if (rows.length > 0) {
    const records = rows.map((r) => {
      const row = r as Record<string, unknown>;
      const expiryDate  = row.expiry_date ? String(row.expiry_date) : nextYear;
      const title       = row.permit_number
        ? `${String(row.title)} — ${String(row.permit_number)}`
        : String(row.title || "Environmental Permit");
      return {
        tenant_id:             tenantId,
        title,
        regulation_ref:        String(row.regulation_ref || ""),
        jurisdiction:          String(row.jurisdiction || ""),
        category:              String(row.category || "environmental"),
        description:           String(row.description || ""),
        applicable_sectors:    [],
        review_frequency_days: 365,
        next_review_date:      expiryDate,
        status:                "compliant",
      };
    });
    const { error } = await svc.from("legal_requirements").insert(records);
    if (!error) legalCount += records.length;
  }

  return { legal: legalCount, documents: docCount };
}

// ── Biosafety Inventory processor ─────────────────────────────────────────────
// Reads lab inventory documents → biosafety_labs + biohazard_agents

async function processBiosafetyInventory(files: UploadedFile[], tenantId: string) {
  if (files.length === 0) return { labs: 0, agents: 0 };
  if (!hasLiveAi()) return { labs: 0, agents: 0 };

  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["labs", "agents"], additionalProperties: false,
    properties: {
      labs: {
        type: "array",
        items: {
          type: "object",
          required: ["lab_code", "name", "bsl_level", "personnel_count"],
          additionalProperties: false,
          properties: {
            lab_code:         { type: "string" },
            name:             { type: "string" },
            bsl_level:        { type: "string" },
            personnel_count:  { type: "number" },
            next_inspection:  { type: ["string", "null"] },
            notes:            { type: ["string", "null"] },
          },
        },
      },
      agents: {
        type: "array",
        items: {
          type: "object",
          required: ["agent_code", "agent_name", "risk_class", "storage_location", "quantity"],
          additionalProperties: false,
          properties: {
            agent_code:       { type: "string" },
            agent_name:       { type: "string" },
            risk_class:       { type: "string" },
            storage_location: { type: "string" },
            quantity:         { type: "string" },
            notes:            { type: ["string", "null"] },
          },
        },
      },
    },
  };

  const { anthropicKey, anthropicModel } = serverSecrets();
  const client = new Anthropic({ apiKey: anthropicKey });
  const svc = serviceClient();
  const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
  let labCount = 0;
  let agentCount = 0;

  for (const file of files) {
    let fileData: { text: string; base64: string; mimeType: string };
    try { fileData = await downloadFile(file.path); } catch { continue; }

    try {
      const contentBlocks: Anthropic.MessageParam["content"] = [];
      if (fileData.base64 && fileData.mimeType === "application/pdf") {
        contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData.base64 } } as Anthropic.DocumentBlockParam);
      } else {
        contentBlocks.push({ type: "text", text: `File: ${file.name}\n\n${fileData.text}` });
      }
      contentBlocks.push({
        type: "text",
        text: "Extract all biosafety labs and biohazard agents from this inventory. For bsl_level use exactly: 'BSL-1', 'BSL-2', 'BSL-3', or 'BSL-4'. For risk_class use exactly: 'Risk Group 1', 'Risk Group 2', 'Risk Group 3', or 'Risk Group 4'. quantity should be a string like '50 mL' or '100 vials'. next_inspection must be YYYY-MM-DD.",
      });

      const resp = await client.messages.create({
        model: anthropicModel, max_tokens: 4096,
        system: "You are a biosafety officer and laboratory safety specialist. Extract structured biosafety lab and biohazard agent inventory data from lab registers and inventory documents.",
        messages: [{ role: "user", content: contentBlocks }],
        tools: [{ name: "extract_biosafety", description: "Return extracted biosafety data.", input_schema: schema }],
        tool_choice: { type: "tool", name: "extract_biosafety" },
      });

      const block = resp.content.find((b) => b.type === "tool_use");
      if (block?.type !== "tool_use") continue;
      const extracted = block.input as { labs: Record<string, unknown>[]; agents: Record<string, unknown>[] };

      if (extracted.labs?.length > 0) {
        const labRecords = extracted.labs.map((l) => ({
          tenant_id:        tenantId,
          lab_code:         String(l.lab_code || `LAB-${Math.random().toString(36).slice(2, 6).toUpperCase()}`),
          name:             String(l.name || "Lab"),
          bsl_level:        String(l.bsl_level || "BSL-1"),
          personnel_count:  Number(l.personnel_count) || 0,
          next_inspection:  l.next_inspection ? String(l.next_inspection) : nextYear,
          status:           "compliant",
          open_findings:    0,
          notes:            l.notes ? String(l.notes) : null,
        }));
        const { error } = await svc.from("biosafety_labs").insert(labRecords);
        if (!error) labCount += labRecords.length;
      }

      if (extracted.agents?.length > 0) {
        const agentRecords = extracted.agents.map((a) => ({
          tenant_id:        tenantId,
          agent_code:       String(a.agent_code || `AGT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`),
          agent_name:       String(a.agent_name || "Biohazard Agent"),
          risk_class:       String(a.risk_class || "Risk Group 1"),
          storage_location: String(a.storage_location || ""),
          quantity:         String(a.quantity || "0 units"),
          status:           "registered",
          notes:            a.notes ? String(a.notes) : null,
        }));
        const { error } = await svc.from("biohazard_agents").insert(agentRecords);
        if (!error) agentCount += agentRecords.length;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") { console.error(`[onboarding] biosafety inventory processing failed for ${file.name}:`, err); }
    }
  }

  return { labs: labCount, agents: agentCount };
}

// ── IH / Air & Noise Monitoring processor ────────────────────────────────────
// Parses industrial hygiene monitoring reports → documents + risk_assessments for exceedances

async function processIHMonitoring(files: UploadedFile[], tenantId: string) {
  if (files.length === 0) return { documents: 0, risks: 0 };

  const today    = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
  const svc = serviceClient();
  let docCount  = 0;
  let riskCount = 0;

  // Store each monitoring report as a document
  for (const file of files) {
    await svc.from("documents").insert({
      tenant_id:               tenantId,
      title:                   file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() || "IH Monitoring Report",
      category:                "monitoring_report",
      version:                 "1.0",
      storage_path:            file.path,
      effective_date:          today,
      review_date:             nextYear,
      status:                  "active",
      acknowledgment_required: false,
      regulation_ref:          null,
    });
    docCount++;
  }

  if (!hasLiveAi()) return { documents: docCount, risks: 0 };

  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["items"], additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["monitoring_type", "location", "exceeds_limit"],
          additionalProperties: false,
          properties: {
            monitoring_type: { type: "string" },
            location:        { type: "string" },
            sample_date:     { type: ["string", "null"] },
            value:           { type: ["number", "null"] },
            unit:            { type: ["string", "null"] },
            exposure_limit:  { type: ["number", "null"] },
            exceeds_limit:   { type: "boolean" },
            notes:           { type: ["string", "null"] },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an industrial hygienist. Extract all monitoring results from this report. monitoring_type should be: 'air_quality', 'noise', 'dust', 'chemical_vapor', 'temperature', 'radiation', 'biological'. exceeds_limit is true if the measured value exceeds the regulatory exposure limit (PEL, TLV, AL, etc.).",
    "Extract all monitoring results from this IH/sampling report.",
    schema,
    "extract_ih_monitoring",
  );

  // Create risk assessments only for exceedances
  const exceedances = rows.filter((r) => Boolean((r as Record<string, unknown>).exceeds_limit));
  if (exceedances.length > 0) {
    const riskRecords = exceedances.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        tenant_id:          tenantId,
        title:              `${String(row.monitoring_type || "Exposure")} Exceedance — ${String(row.location || "Unknown Location")}`,
        description:        row.notes ? String(row.notes) : `${String(row.monitoring_type)} level of ${row.value ?? "unknown"} ${row.unit ?? ""} exceeds regulatory limit of ${row.exposure_limit ?? "unknown"} ${row.unit ?? ""}.`,
        category:           row.monitoring_type === "noise" ? "physical" : "chemical",
        activity:           `${String(row.monitoring_type || "Monitoring")} at ${String(row.location || "")}`,
        hazards:            [`${String(row.monitoring_type || "exposure")} above regulatory limit`],
        existing_controls:  [],
        additional_controls:[],
        likelihood_score:   4,
        consequence_score:  4,
        risk_score:         16,
        risk_level:         "high",
        review_date:        nextYear,
        status:             "active",
      };
    });
    const { error } = await svc.from("risk_assessments").insert(riskRecords);
    if (!error) riskCount += riskRecords.length;
  }

  return { documents: docCount, risks: riskCount };
}

// ── Near-Miss / First-Aid Log processor ──────────────────────────────────────
// Parses historical near-miss and first-aid logs → incidents table

async function processNearMissLog(files: UploadedFile[], tenantId: string, siteId: string | null, userId: string) {
  const schema: Anthropic.Tool.InputSchema = {
    type: "object", required: ["items"], additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "incident_type", "occurred_date", "location"],
          additionalProperties: false,
          properties: {
            title:             { type: "string" },
            description:       { type: "string" },
            incident_type:     { type: "string" },
            occurred_date:     { type: "string" },
            location:          { type: "string" },
            injured_party:     { type: ["string", "null"] },
            immediate_actions: { type: ["string", "null"] },
          },
        },
      },
    },
  };

  const rows = await extractWithAI(
    files,
    "You are an EHS data specialist. Extract every near-miss and first-aid incident from this log. For incident_type use only: 'near_miss' or 'first_aid'. occurred_date must be ISO format YYYY-MM-DD.",
    "Extract all near-miss and first-aid incidents from this log.",
    schema,
    "extract_near_miss",
  );

  if (rows.length === 0) return 0;

  const svc = serviceClient();
  const records = rows.map((r) => {
    const row = r as Record<string, unknown>;
    const dateStr = String(row.occurred_date || "");
    const occurredAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
    return {
      tenant_id:                 tenantId,
      site_id:                   siteId,
      title:                     String(row.title || "Near-Miss / First Aid"),
      description:               String(row.description || ""),
      incident_type:             String(row.incident_type || "near_miss"),
      severity:                  row.incident_type === "first_aid" ? "low" : "medium",
      occurred_at:               occurredAt,
      location:                  String(row.location || ""),
      injured_party:             row.injured_party ? String(row.injured_party) : null,
      immediate_actions:         row.immediate_actions ? String(row.immediate_actions) : null,
      medical_treatment_required:row.incident_type === "first_aid",
      regulatory_reportable:     false,
      reported_by:               userId,
      status:                    "closed",
    };
  });

  const { error } = await svc.from("incidents").insert(records);
  if (error) { if (process.env.NODE_ENV !== "production") { console.error("[onboarding] near_miss insert:", error); } return 0; }
  return records.length;
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface UploadMap { [docId: string]: UploadedFile[] }

export async function POST(req: NextRequest) {
  // Verify auth
  const sessionClient = await createSupabaseServerClient();
  if (!sessionClient) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: profile } = await sessionClient.from("profiles").select("tenant_id, default_site_id").eq("id", user.id).single();
  if (!profile?.tenant_id) return NextResponse.json({ error: "no_tenant" }, { status: 403 });

  const tenantId = profile.tenant_id as string;
  const siteId   = (profile.default_site_id as string | null) ?? null;
  const userId   = user.id;

  let uploads: UploadMap;
  try {
    const body = await req.json();
    uploads = body.uploads ?? {};
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // SECURITY: the service-role client below bypasses Storage RLS, so we must
  // verify every supplied path lives under THIS tenant's prefix — otherwise a
  // user could pass another tenant's path and have its file extracted into theirs.
  for (const files of Object.values(uploads)) {
    for (const f of files) {
      if (!f?.path || !f.path.startsWith(`${tenantId}/`)) {
        return NextResponse.json({ error: "invalid_path" }, { status: 403 });
      }
    }
  }

  // Seeding + AI extraction both run with the service-role key. Without it we
  // can't seed anything, so skip processing but let the user finish onboarding
  // cleanly (no crash — onboarding just completes with nothing auto-imported).
  const { serviceRoleKey: svcKey } = serverSecrets();
  if (!svcKey) {
    if (process.env.NODE_ENV !== "production") { console.warn("[onboarding] SUPABASE_SERVICE_ROLE_KEY missing — skipping document extraction"); }
    return NextResponse.json({ ok: true, seeded: {}, total: 0, note: "no_service_key" });
  }

  // Pre-scan: flag uploaded files that are genuinely empty (a near-zero-byte PDF,
  // or a text file with no content). NOTE: file SIZE is only a rough signal — small
  // PDFs (~2-4KB) routinely contain a thin but valid text layer the AI reads fine,
  // so the threshold is deliberately low to avoid false "nothing imported" alarms.
  const warnings: string[] = [];
  for (const [docId, files] of Object.entries(uploads)) {
    for (const f of files) {
      try {
        const fd = await downloadFile(f.path);
        const approxBytes = fd.base64 ? fd.base64.length * 0.75 : 0;
        const empty = fd.mimeType === "application/pdf"
          ? approxBytes < 1800
          : (fd.text ?? "").trim().length < 40;
        if (empty) warnings.push(`${docId}/${f.name} — appears empty or unreadable; if its data is missing, re-upload a text-based version.`);
      } catch {
        warnings.push(`${docId}/${f.name} — could not be read.`);
      }
    }
  }

  const seeded: Record<string, number> = {};

  // Process all categories in parallel. Each processor is internally fault-
  // tolerant; this try is a final backstop so one failure can't crash the route.
  try {
  const [
    chemCount, wasteCount, empCount, trainingCount, sdsCount,
    manualResult, sopResult,
    oshaCount, orgCount, equipCount,
    auditResult, jsaCount, erpResult, permitsResult,
    biosafetyResult, ihResult, nearMissCount,
    coiCount, emrCount,
  ] = await Promise.all([
    // Existing processors
    processChemicals(uploads.chemicals ?? [], tenantId, userId),
    processWasteStreams(uploads.hazard_waste ?? [], tenantId, userId),
    processEmployees(uploads.employees ?? [], tenantId),
    processTrainingCourses(uploads.training_req ?? [], tenantId),
    processSDS(uploads.sds ?? [], tenantId),
    processSafetyManual(uploads.safety_manual ?? [], tenantId),
    processSOPs(uploads.sop ?? [], tenantId),
    // New processors
    processOshaLogs(uploads.osha_logs ?? [], tenantId, siteId, userId),
    processOrgChart(uploads.org_chart ?? [], tenantId),
    processEquipmentRegister(uploads.equipment_register ?? [], tenantId, siteId),
    processAuditReports(uploads.audit_reports ?? [], tenantId, siteId, userId),
    processJSAs(uploads.jsa ?? [], tenantId),
    processERP(uploads.erp ?? [], tenantId),
    processPermits(uploads.permits ?? [], tenantId),
    processBiosafetyInventory(uploads.biosafety_inventory ?? [], tenantId),
    processIHMonitoring(uploads.ih_monitoring ?? [], tenantId),
    processNearMissLog(uploads.near_miss_log ?? [], tenantId, siteId, userId),
    processReferenceDocs(uploads.coi ?? [], tenantId, "insurance"),
    processReferenceDocs(uploads.emr_letter ?? [], tenantId, "insurance"),
  ]);

  seeded.chemicals          = chemCount;
  seeded.waste_streams      = wasteCount;
  seeded.employees          = empCount;
  seeded.training_courses   = trainingCount + manualResult.training + erpResult.training;
  seeded.sds                = sdsCount;
  seeded.legal_requirements = manualResult.legal + sopResult.legal + permitsResult.legal;
  seeded.risk_assessments   = manualResult.risks + jsaCount + ihResult.risks;
  seeded.sop_documents      = sopResult.documents + erpResult.documents + ihResult.documents + permitsResult.documents;
  seeded.incidents          = oshaCount + nearMissCount;
  seeded.org_roles          = orgCount;
  seeded.equipment          = equipCount;
  seeded.audits             = auditResult.audits;
  seeded.audit_findings     = auditResult.findings;
  seeded.biosafety_labs     = biosafetyResult.labs;
  seeded.biohazard_agents   = biosafetyResult.agents;
  seeded.reference_documents = coiCount + emrCount;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") { console.error("[onboarding] document processing failed:", err); }
    // Return whatever was seeded rather than crashing — onboarding still completes.
    return NextResponse.json({
      ok: true,
      seeded,
      total: Object.values(seeded).reduce((a, b) => a + b, 0),
      warnings,
      note: "processing_error",
    });
  }

  const total = Object.values(seeded).reduce((a, b) => a + b, 0);

  // Persist seeded counts into onboarding_data so the dashboard welcome banner can read them
  try {
    const svc = serviceClient();
    const { data: tenantRow } = await svc.from("tenants").select("onboarding_data").eq("id", tenantId).single();
    const existingObd = (tenantRow?.onboarding_data as Record<string, unknown>) ?? {};
    await svc.from("tenants").update({ onboarding_data: { ...existingObd, seeded_counts: seeded } }).eq("id", tenantId);
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, seeded, total, warnings });
}

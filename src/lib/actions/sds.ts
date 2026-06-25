"use server";

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { serverSecrets } from "@/lib/env";
import { getServerTenantId, getServerProfileId } from "@/lib/auth/session";
import type { SdsExtracted } from "@/lib/types";

function svc() {
  const { serviceRoleKey } = serverSecrets();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const SDS_EXTRACTION_SCHEMA = {
  type: "object",
  required: [
    "product_name", "chemical_name", "cas_number", "manufacturer",
    "supplier_name", "supplier_phone", "emergency_phone", "sds_revision_date",
    "signal_word", "ghs_pictogram_codes",
    "hazard_statements", "hazard_statement_texts",
    "precautionary_statements", "precautionary_statement_texts",
    "hazard_classes", "recommended_ppe", "storage_requirements",
    "disposal_guidance", "is_mixture", "physical_state",
    "flash_point", "recommended_use", "confidence_score",
  ],
  properties: {
    product_name:                { type: "string", description: "Full product/trade name (SDS Section 1)" },
    chemical_name:               { type: "string", description: "IUPAC or common chemical name, empty string if not found" },
    cas_number:                  { type: "string", description: "CAS Registry Number, empty string if not found" },
    manufacturer:                { type: "string", description: "Manufacturer name from Section 1" },
    supplier_name:               { type: "string", description: "Supplier/distributor name" },
    supplier_phone:              { type: "string", description: "Supplier phone number" },
    emergency_phone:             { type: "string", description: "Emergency contact phone (Section 1)" },
    sds_revision_date:           { type: "string", description: "SDS revision date YYYY-MM-DD, empty if not found" },
    signal_word:                 { type: "string", description: "GHS signal word: Danger, Warning, or empty string" },
    ghs_pictogram_codes:         { type: "array", items: { type: "string" }, description: "GHS pictogram codes (e.g. GHS02, GHS05)" },
    hazard_statements:           { type: "array", items: { type: "string" }, description: "H-code numbers only (e.g. H225, H319)" },
    hazard_statement_texts:      { type: "array", items: { type: "string" }, description: "Full text of each H-statement, same order" },
    precautionary_statements:    { type: "array", items: { type: "string" }, description: "P-code numbers only (e.g. P210, P233)" },
    precautionary_statement_texts: { type: "array", items: { type: "string" }, description: "Full text of each P-statement, same order" },
    hazard_classes:              { type: "array", items: { type: "string" }, description: "GHS hazard classification names" },
    recommended_ppe:             { type: "array", items: { type: "string" }, description: "PPE items from Section 8" },
    storage_requirements:        { type: "array", items: { type: "string" }, description: "Storage requirements from Section 7" },
    disposal_guidance:           { type: "string", description: "Disposal guidance from Section 13" },
    is_mixture:                  { type: "boolean", description: "True if mixture, false if pure substance" },
    physical_state:              { type: "string", description: "solid, liquid, gas, or empty string" },
    flash_point:                 { type: "string", description: "Flash point with units from Section 9" },
    recommended_use:             { type: "string", description: "Recommended use from Section 1" },
    confidence_score:            { type: "number", description: "Confidence 0-100. Lower if SDS was unclear or data missing." },
  },
};

// ── 1. Upload PDF to storage and create the SDS document record ──────────────

export async function uploadSdsDocument(
  formData: FormData,
): Promise<{ ok: true; docId: string } | { ok: false; error: string }> {
  const tenantId = await getServerTenantId();
  const profileId = await getServerProfileId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") return { ok: false, error: "Please upload a PDF file" };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "PDF must be under 20 MB" };

  const db = svc();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${tenantId}/sds/${timestamp}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await db.storage
    .from("client-documents")
    .upload(filePath, arrayBuffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` };

  const { data: inserted, error: insertError } = await db
    .from("sds_documents")
    .insert({
      tenant_id:            tenantId,
      file_name:            file.name,
      file_path:            filePath,
      uploaded_by:          profileId,
      ai_extraction_status: "pending",
      approval_status:      "draft",
    })
    .select("id")
    .single();

  if (insertError || !inserted) return { ok: false, error: insertError?.message ?? "Failed to create record" };
  return { ok: true, docId: inserted.id };
}

// ── 2. Run AI extraction on a stored PDF ────────────────────────────────────

export async function extractSdsData(
  docId: string,
): Promise<{ ok: true; extracted: SdsExtracted } | { ok: false; error: string }> {
  const tenantId = await getServerTenantId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const { anthropicKey, anthropicModel } = serverSecrets();
  if (!anthropicKey) return { ok: false, error: "ANTHROPIC_API_KEY not configured" };

  const db = svc();

  const { data: doc, error: fetchError } = await db
    .from("sds_documents")
    .select("*")
    .eq("id", docId)
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError || !doc) return { ok: false, error: "Document not found" };

  await db.from("sds_documents").update({ ai_extraction_status: "processing" }).eq("id", docId);

  try {
    const { data: fileBlob, error: downloadError } = await db.storage
      .from("client-documents")
      .download(doc.file_path);

    if (downloadError || !fileBlob) {
      await db.from("sds_documents").update({ ai_extraction_status: "failed" }).eq("id", docId);
      return { ok: false, error: "Failed to download PDF" };
    }

    const base64 = Buffer.from(await fileBlob.arrayBuffer()).toString("base64");

    const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 90_000 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await anthropic.messages.create({
      model: anthropicModel || "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as never,
          {
            type: "text",
            text: `You are an expert GHS/OSHA SDS data extractor. Extract ALL GHS safety information from this Safety Data Sheet. Read every section carefully.

Key extraction rules:
- Section 1: product name, manufacturer, supplier, emergency phone, recommended use
- Section 2: signal word, GHS pictogram codes (GHS01–GHS09), hazard statements (H-codes), precautionary statements (P-codes), hazard classifications
- Section 3: CAS number, mixture vs pure substance
- Section 7: storage requirements
- Section 8: PPE requirements
- Section 9: physical state, flash point
- Section 13: disposal guidance

For any field not found, use empty string or empty array. GHS pictogram codes should be in format GHS01, GHS02, etc. H-codes and P-codes should be just the code (e.g. H225, P210).

Rate confidence 0–100 based on SDS readability and completeness.`,
          },
        ],
      }],
      tools: [{
        name: "extract_sds_data",
        description: "Return all structured GHS data extracted from this SDS document.",
        input_schema: SDS_EXTRACTION_SCHEMA as Anthropic.Tool["input_schema"],
      }],
      tool_choice: { type: "tool", name: "extract_sds_data" },
    });

    const toolBlock = resp.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      await db.from("sds_documents").update({ ai_extraction_status: "failed" }).eq("id", docId);
      return { ok: false, error: "AI did not return structured data" };
    }

    const extracted = toolBlock.input as SdsExtracted;

    await db.from("sds_documents").update({
      ai_extraction_status: "completed",
      ai_extraction_json:   extracted,
      ai_confidence_score:  extracted.confidence_score ?? 0,
      approval_status:      "ai_extracted",
      manufacturer:         extracted.manufacturer || null,
      product_identifier:   extracted.product_name || null,
      sds_revision_date:    extracted.sds_revision_date || null,
    }).eq("id", docId);

    return { ok: true, extracted };
  } catch (err) {
    await db.from("sds_documents").update({ ai_extraction_status: "failed" }).eq("id", docId);
    return { ok: false, error: String(err) };
  }
}

// ── 3. Approve extraction → create chemical_inventory record ────────────────

export async function approveSdsExtraction(
  docId: string,
  overrides: Partial<SdsExtracted>,
  notes: string,
): Promise<{ ok: true; chemicalId: string } | { ok: false; error: string }> {
  const tenantId = await getServerTenantId();
  const profileId = await getServerProfileId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const db = svc();

  const { data: doc } = await db
    .from("sds_documents")
    .select("*")
    .eq("id", docId)
    .eq("tenant_id", tenantId)
    .single();

  if (!doc) return { ok: false, error: "Document not found" };
  if (!doc.ai_extraction_json) return { ok: false, error: "No extraction data available — try re-uploading the document" };

  const ext: SdsExtracted = { ...(doc.ai_extraction_json as SdsExtracted), ...overrides };

  const { data: sites } = await db.from("sites").select("id").eq("tenant_id", tenantId).limit(1);
  const siteId = sites?.[0]?.id ?? null;

  const { data: chemical, error: chemError } = await db
    .from("chemical_inventory")
    .insert({
      tenant_id:               tenantId,
      site_id:                 siteId,
      name:                    ext.product_name,
      cas_number:              ext.cas_number || null,
      chemical_formula:        null,
      ghs_classes:             ext.hazard_statements,
      quantity:                0,
      unit:                    "L",
      storage_location:        "",
      sds_url:                 doc.file_path ?? null,
      sds_expiry:              null,
      hazard_statements:       ext.hazard_statements,
      precautionary_statements: ext.precautionary_statements,
      is_scheduled:            false,
      supplier:                ext.supplier_name || null,
      status:                  "active",
      created_by:              profileId,
      sds_document_id:         docId,
    })
    .select("id")
    .single();

  if (chemError) return { ok: false, error: chemError.message };

  await db.from("sds_documents").update({
    approval_status: "approved",
    chemical_id:     chemical.id,
    reviewed_by:     profileId,
    reviewed_at:     new Date().toISOString(),
    review_notes:    notes || null,
  }).eq("id", docId);

  return { ok: true, chemicalId: chemical.id };
}

// ── 4. Reject extraction ─────────────────────────────────────────────────────

export async function rejectSdsExtraction(
  docId: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantId = await getServerTenantId();
  const profileId = await getServerProfileId();
  if (!tenantId) return { ok: false, error: "Not authenticated" };

  const { error } = await svc()
    .from("sds_documents")
    .update({
      approval_status: "rejected",
      reviewed_by:     profileId,
      reviewed_at:     new Date().toISOString(),
      review_notes:    notes || null,
    })
    .eq("id", docId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

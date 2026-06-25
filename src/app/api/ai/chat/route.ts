/**
 * POST /api/ai/chat
 *
 * Live LLM chat for the SafetyIQ AI assistant. The chat page builds a compact
 * `contextSummary` of the tenant's live EHS data (chemical/incident/CAPA counts,
 * key facts) and posts it together with the running conversation. We answer with
 * Anthropic (the same client + key + model the rest of the platform uses).
 *
 * Authenticated users only (401 otherwise). When no AI key is configured
 * (hasLiveAi() === false) — or anything goes wrong — we return { reply: null }
 * so the client can fall back to its local, deterministic response engine.
 */
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverSecrets, hasLiveAi, MOCK_MODE } from "@/lib/env";

interface IncomingMessage {
  role: "user" | "assistant";
  text: string;
}

interface ChatBody {
  messages?: IncomingMessage[];
  contextSummary?: string;
}

const SYSTEM_PROMPT =
  "You are SafetyIQ AI, an EHS compliance assistant. Answer using ONLY the " +
  "provided live EHS data context; be concise and cite numbers. If data is " +
  "insufficient, say so.";

const MAX_MESSAGES = 20;

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  // In mock mode there is no Supabase client; the page still runs and should
  // simply fall back to the local engine, so we surface { reply: null } rather
  // than 401 (which would look like an auth bug in the offline demo).
  if (!MOCK_MODE) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ reply: null });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── No live AI key → let the client fall back to its local response engine ─
  if (!hasLiveAi()) return NextResponse.json({ reply: null });

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  const contextSummary = typeof body.contextSummary === "string" ? body.contextSummary : "";

  // Keep only the most recent turns, drop empty entries, and map any non-user
  // role onto the Anthropic "assistant" role.
  const messages: Anthropic.MessageParam[] = history
    .filter((m) => m && typeof m.text === "string" && m.text.trim().length > 0)
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "No user message to answer" }, { status: 400 });
  }

  // The live EHS data context is given to the model as a system suffix so it is
  // never confused with conversational content.
  const system = contextSummary
    ? `${SYSTEM_PROMPT}\n\nLIVE EHS DATA CONTEXT:\n${contextSummary}`
    : SYSTEM_PROMPT;

  // ── Call the model ────────────────────────────────────────────────────────
  try {
    const { anthropicKey, anthropicModel } = serverSecrets();
    const client = new Anthropic({ apiKey: anthropicKey });
    const resp = await client.messages.create({
      model: anthropicModel,
      max_tokens: 1024,
      system,
      messages,
    });
    const reply = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Empty completion → fall back rather than render a blank bubble.
    return NextResponse.json({ reply: reply || null });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") { console.error("[ai/chat] completion failed:", err); }
    // Never throw to the user — fall back to the local engine.
    return NextResponse.json({ reply: null });
  }
}

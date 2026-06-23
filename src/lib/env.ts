/**
 * Centralized environment access. SafetyIQ runs in one of two modes:
 *   • live  — real Supabase + AI provider keys present
 *   • mock  — deterministic in-memory fixtures so every screen works offline
 *
 * Mock mode is selected when NEXT_PUBLIC_SAFETYIQ_MOCK=true, or whenever the
 * Supabase public env vars are missing. This keeps every module fully
 * explorable with zero configuration (demo: BioStar Research / Sarah Chen).
 */

export const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Public origin of the app, used to build absolute auth-redirect URLs
 *  (invite magic-links, password resets). Falls back to localhost for dev. */
export const APP_URL =
  process.env.SAFETYIQ_APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

const explicitMock = process.env.NEXT_PUBLIC_SAFETYIQ_MOCK === "true";
const hasSupabase  = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** True when SafetyIQ should serve fixtures instead of hitting Supabase. */
export const MOCK_MODE = explicitMock || !hasSupabase;

/** Server-only secrets — never imported into client components. */
export function serverSecrets() {
  return {
    serviceRoleKey:  process.env.SUPABASE_SERVICE_ROLE_KEY    ?? "",
    openaiKey:       process.env.OPENAI_API_KEY               ?? "",
    aiModel:         process.env.SAFETYIQ_AI_MODEL            ?? "gpt-4o-mini",
    anthropicKey:    process.env.ANTHROPIC_API_KEY            ?? "",
    anthropicModel:  process.env.SAFETYIQ_ANTHROPIC_MODEL     ?? "claude-sonnet-4-6",
  };
}

export type AiProvider = "openai" | "anthropic";

/**
 * Which LLM provider the Predictability Engine uses. Set SAFETYIQ_AI_PROVIDER
 * to force one; otherwise inferred — prefer Anthropic when only its key is
 * present (claude-sonnet-4-6 provides better regulatory reasoning quality).
 */
export function aiProvider(): AiProvider {
  const explicit = process.env.SAFETYIQ_AI_PROVIDER;
  if (explicit === "anthropic" || explicit === "openai") return explicit;
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return "anthropic";
  return "openai";
}

/** True when the active provider has an API key configured. */
export function hasLiveAi(): boolean {
  return aiProvider() === "anthropic"
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

export const PROMPT_VERSION = "amaya-causality-2026-06-09";

/**
 * Guard coverage for the event_embeddings call site (src/lib/ai/embeddings.ts).
 * public.event_embeddings ships in supabase/migrations/20260706000000_event_embeddings.sql.
 * These tests assert the guarded functions fail soft (never throw) both when
 * EVENT_EMBEDDINGS_ENABLED is off and when Postgres reports the table missing
 * (42P01), matching the Platform Review finding scan:ghost-table:event_embeddings.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fx from "@/lib/data/mock";

const saved: Record<string, string | undefined> = {};
const ENV_KEYS = ["EVENT_EMBEDDINGS_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
  vi.doUnmock("@supabase/supabase-js");
});

describe("event_embeddings guard — feature flag off", () => {
  it("embedAndStoreEvents returns a safe empty-ish result and does not throw", async () => {
    vi.resetModules();
    delete process.env.EVENT_EMBEDDINGS_ENABLED;
    const { embedAndStoreEvents } = await import("@/lib/ai/embeddings");
    const events = [fx.EVENT_CELLS[0]];
    const result = await embedAndStoreEvents(events);
    expect(result).toEqual({ embedded: 0, skipped: events.length });
    expect(console.warn).toHaveBeenCalled();
  });

  it("getSimilarEventIdsByVector returns [] and does not throw", async () => {
    vi.resetModules();
    delete process.env.EVENT_EMBEDDINGS_ENABLED;
    const { getSimilarEventIdsByVector } = await import("@/lib/ai/embeddings");
    const result = await getSimilarEventIdsByVector(fx.EVENT_CELLS[0]);
    expect(result).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("event_embeddings guard — table missing (42P01) with flag on", () => {
  it("embedAndStoreEvents fails soft when the read hits an undefined_table error", async () => {
    vi.resetModules();
    process.env.EVENT_EMBEDDINGS_ENABLED = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            in: () =>
              Promise.resolve({
                data: null,
                error: { code: "42P01", message: 'relation "public.event_embeddings" does not exist' },
              }),
          }),
        }),
      }),
    }));

    const { embedAndStoreEvents } = await import("@/lib/ai/embeddings");
    const events = [fx.EVENT_CELLS[0]];
    const result = await embedAndStoreEvents(events);
    expect(result).toEqual({ embedded: 0, skipped: events.length });
    expect(console.error).toHaveBeenCalled();
  });

  it("getSimilarEventIdsByVector fails soft when match_events reports an undefined_table error", async () => {
    vi.resetModules();
    process.env.EVENT_EMBEDDINGS_ENABLED = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { code: "42P01", message: 'relation "public.event_embeddings" does not exist' },
          }),
      }),
    }));
    vi.doMock("openai", () => ({
      default: class {
        embeddings = { create: async () => ({ data: [{ index: 0, embedding: new Array(1536).fill(0) }] }) };
      },
    }));

    const { getSimilarEventIdsByVector } = await import("@/lib/ai/embeddings");
    const result = await getSimilarEventIdsByVector(fx.EVENT_CELLS[0]);
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});

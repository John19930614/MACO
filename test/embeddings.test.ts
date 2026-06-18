import { describe, it, expect, afterEach } from "vitest";
import { buildEventText } from "@/lib/ai/embeddings";
import { POST as reindexPOST } from "@/app/api/embeddings/reindex/route";
import { setSessionUser } from "@/lib/data/store";
import * as fx from "@/lib/data/mock";

afterEach(() => setSessionUser("u_admin"));

describe("buildEventText", () => {
  it("includes the title, kind, and severity", () => {
    const text = buildEventText(fx.EVENT_CELLS[0]);
    expect(text).toContain(fx.EVENT_CELLS[0].title);
    expect(text).toContain(`kind: ${fx.EVENT_CELLS[0].kind}`);
    expect(text).toContain(`severity: ${fx.EVENT_CELLS[0].severity}`);
  });
});

describe("POST /api/embeddings/reindex (guards)", () => {
  it("rejects a non-admin with 403", async () => {
    setSessionUser("u_sup"); // supervisor, not admin
    const res = await reindexPOST();
    expect(res.status).toBe(403);
  });

  it("returns 503 in mock mode (no live embeddings backend)", async () => {
    setSessionUser("u_admin");
    const res = await reindexPOST();
    expect(res.status).toBe(503); // mock mode → embeddings unavailable
  });
});

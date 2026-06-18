import { describe, it, expect } from "vitest";
import { getComments, createComment, getAudit } from "@/lib/data/repo";

describe("comments (collaboration)", () => {
  it("lists fixture comments for a cell, oldest first", async () => {
    const c = await getComments("cell_001");
    expect(c.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < c.length; i++) {
      expect(c[i - 1].created_at <= c[i].created_at).toBe(true);
    }
  });

  it("creates a comment, stamps tenant from the cell, and audits it", async () => {
    const before = (await getComments("cell_001")).length;
    const cm = await createComment("cell_001", "Test thread message", "u_sup");
    expect(cm).not.toBeNull();
    expect(cm!.tenant_id).toBe("tenant_pacific");
    expect((await getComments("cell_001")).length).toBe(before + 1);
    const audit = await getAudit();
    expect(audit.some((a) => a.action === "comment.create" && a.entity_id === cm!.id)).toBe(true);
  });

  it("returns null for a comment on a non-existent cell", async () => {
    expect(await createComment("nope", "x", "u_sup")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { rawAuditNotesSchema } from "@/lib/validation/auditNotes";

// Covers the Zod schema that replaced the `p: any` in
// AuditConductForm.tsx's parseSavedAudit() — must accept every shape that
// function used to accept via untyped `any` access, and reject the same
// non-object inputs its old `!p || typeof p !== "object"` guard rejected.
describe("rawAuditNotesSchema", () => {
  it("parses a legacy flat items-array notes blob", () => {
    const raw = {
      conductedBy: "Jane Doe",
      conductedDate: "2026-07-01",
      score: 92,
      items: [{ id: "osha-0-0", section: "General", text: "Check", result: "pass", notes: "" }],
    };
    const result = rawAuditNotesSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.items)).toBe(true);
      expect(result.data.conductedBy).toBe("Jane Doe");
    }
  });

  it("parses a nested { items: { items, oshaStandard } } notes blob", () => {
    const raw = {
      overallNotes: "Looks good",
      items: {
        items: [{ id: "osha-0-0", section: "General", text: "Check", result: "fail", notes: "leak" }],
        oshaStandard: { code: "1910.106", title: "Flammable liquids", cfr: "29 CFR 1910.106" },
      },
    };
    const result = rawAuditNotesSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      const nested = result.data.items as { items: unknown[]; oshaStandard?: unknown };
      expect(nested.items).toHaveLength(1);
      expect(nested.oshaStandard).toMatchObject({ code: "1910.106" });
    }
  });

  it("parses an empty object (default when audit.notes is null/empty)", () => {
    const result = rawAuditNotesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects non-object JSON values, matching the old typeof guard", () => {
    expect(rawAuditNotesSchema.safeParse(null).success).toBe(false);
    expect(rawAuditNotesSchema.safeParse("a string").success).toBe(false);
    expect(rawAuditNotesSchema.safeParse(42).success).toBe(false);
    expect(rawAuditNotesSchema.safeParse([1, 2, 3]).success).toBe(false);
  });
});

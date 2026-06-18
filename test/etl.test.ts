import { describe, it, expect } from "vitest";
import { parseCsv, mapRowsToCells, type EtlMapping } from "@/lib/etl/import";

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const rows = parseCsv("a,b\n1,2\n3,4\n");
    expect(rows).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
  });
  it("handles quoted fields with embedded commas and quotes", () => {
    const rows = parseCsv('name,note\n"Smith, J","said ""hi"""\n');
    expect(rows[0]).toEqual({ name: "Smith, J", note: 'said "hi"' });
  });
  it("skips blank lines", () => {
    expect(parseCsv("a\n1\n\n2\n")).toHaveLength(2);
  });
});

const mapping: EtlMapping = {
  fields: {
    title: "Title", description: "Desc", task: "Activity", severity: "Sev", likelihood: "Like",
    energySource: "Energy", exposureType: "Exposure", trigger: "Trigger", controlGap: "Gap",
    site_id: "Site", location_id: "Location",
  },
  valueMaps: { severity: { "2": "medium", "4": "critical" } },
  legacyIdColumn: "Ref",
};

describe("mapRowsToCells", () => {
  it("maps + validates rows, applies value maps, and keeps legacy ids", () => {
    const rows = [
      { Ref: "INC-1", Title: "Trip hazard", Desc: "loose cable", Activity: "Gate ops", Sev: "high", Like: "3", Energy: "motion", Exposure: "fall", Trigger: "housekeeping", Gap: "missing", Site: "s1", Location: "l1" },
      { Ref: "INC-2", Title: "Unsecured load", Desc: "not strapped", Activity: "Unloading", Sev: "2", Like: "4", Energy: "motion", Exposure: "struck_by", Trigger: "rushing", Gap: "weak", Site: "s1", Location: "l2" },
    ];
    const r = mapRowsToCells(rows, mapping);
    expect(r.report).toEqual({ read: 2, valid: 2, invalid: 0 });
    expect(r.inputs[0].severity).toBe("high");
    expect(r.inputs[1].severity).toBe("medium"); // "2" mapped
    expect(r.inputs[1].likelihood).toBe(4);
    expect(r.legacyIds).toEqual(["INC-1", "INC-2"]);
    expect(r.inputs[0].hazard_genome.controlGap).toBe("missing");
  });

  it("rejects invalid rows with field-level issues, not silently", () => {
    const rows = [
      { Ref: "BAD-1", Title: "", Desc: "no title/task", Activity: "", Sev: "low", Like: "1", Energy: "motion", Exposure: "fall", Trigger: "x", Gap: "missing", Site: "s1", Location: "l1" },
    ];
    const r = mapRowsToCells(rows, mapping);
    expect(r.report.valid).toBe(0);
    expect(r.report.invalid).toBe(1);
    expect(r.rejected[0].legacyId).toBe("BAD-1");
    expect(r.rejected[0].issues.join(" ")).toMatch(/title/i);
  });

  it("falls back to defaults and row index when legacy id is absent", () => {
    const m: EtlMapping = { ...mapping, legacyIdColumn: undefined, defaults: { status: "open" } };
    const r = mapRowsToCells([{ Title: "Trip hazard", Desc: "d", Activity: "a", Sev: "low", Like: "2", Energy: "motion", Exposure: "fall", Trigger: "t", Gap: "missing", Site: "s", Location: "l" }], m);
    expect(r.legacyIds[0]).toBe("row-1");
    expect(r.inputs[0].status).toBe("open");
  });
});

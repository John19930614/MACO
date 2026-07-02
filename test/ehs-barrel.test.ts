// Structural guard for the src/lib/actions/ehs.ts re-export barrel.
// The original monolithic action file was split into ehs-records / ehs-compliance /
// ehs-waste / ehs-ai; every caller still imports from "@/lib/actions/ehs". This
// test imports through the barrel and asserts representative actions from each
// split module resolve to functions — if a module drops out of the barrel (or a
// split module fails to load), this catches it before any page does.

import { describe, it, expect } from "vitest";
import * as ehs from "../src/lib/actions/ehs";

const EXPECTED: Record<string, (keyof typeof ehs)[]> = {
  "ehs-records": ["addCapa", "updateIncident", "addChemical", "submitAuditConduct", "addRisk", "createTriggeredCapaActions"],
  "ehs-compliance": ["addEquipment", "updateLegalRequirement", "addTrainingRecord", "addDocument", "acknowledgeDocument", "saveSettings", "saveReport"],
  "ehs-waste": ["addWasteStream", "scheduleWastePickup", "draftWasteProfile", "transitionWasteProfile", "submitWasteProfileFromWizard"],
  "ehs-ai": ["runPredictabilityScan", "buildProgramFromDocs", "stageDocumentImport", "approveStagedRow", "rejectStagedRow"],
};

describe("ehs actions barrel", () => {
  for (const [module, names] of Object.entries(EXPECTED)) {
    it(`re-exports ${module} actions`, () => {
      for (const name of names) {
        expect(typeof ehs[name], `${name} should be a function exported via the barrel`).toBe("function");
      }
    });
  }

  it("does not re-export the private getCtx session helper", () => {
    expect((ehs as Record<string, unknown>).getCtx).toBeUndefined();
  });
});

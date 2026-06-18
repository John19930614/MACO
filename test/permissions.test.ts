import { describe, it, expect } from "vitest";
import { canWrite, canCreateEvents, canCreateActions, WRITE_ROLES, SUPERVISOR_ROLES } from "@/lib/constants";

// These helpers are the single source of truth the UI uses to gate write
// controls. They must stay aligned with the server-side role tiers in repo.ts
// (assertCanWrite) so a control is never shown enabled when the API would 403.
describe("write-permission helpers", () => {
  it("canWrite mirrors WRITE_ROLES (contributor and up)", () => {
    expect(canWrite("viewer")).toBe(false);
    expect(canWrite("contributor")).toBe(true);
    expect(canWrite("admin")).toBe(true);
    expect(WRITE_ROLES).toContain("contributor");
    expect(WRITE_ROLES).not.toContain("viewer");
  });

  it("event/action creation requires supervisor and up", () => {
    expect(canCreateEvents("contributor")).toBe(false);
    expect(canCreateEvents("supervisor")).toBe(true);
    expect(canCreateActions("contributor")).toBe(false);
    expect(canCreateActions("safety_manager")).toBe(true);
    expect(SUPERVISOR_ROLES).not.toContain("contributor");
  });
});

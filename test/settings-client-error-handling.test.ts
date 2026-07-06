import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { formatSaveError } from "@/app/(app)/settings/SettingsClient";

const SETTINGS_CLIENT_PATH = fileURLToPath(
  new URL("../src/app/(app)/settings/SettingsClient.tsx", import.meta.url),
);

describe("SettingsClient error handling (no more silent empty catch blocks)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs and returns a friendly message when a settings save fails", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("quota exceeded");

    const message = formatSaveError(err);

    expect(message).toBe("Couldn't save your changes. Please try again.");
    expect(spy).toHaveBeenCalledTimes(1);
    const [prefix, loggedErr] = spy.mock.calls[0];
    expect(String(prefix)).toContain("[SettingsClient:save]");
    expect(loggedErr).toBe(err);
  });

  it("leaves no bare empty catch blocks in the source", () => {
    const source = readFileSync(SETTINGS_CLIENT_PATH, "utf8");
    // Matches `catch {}`, `catch (e) {}`, or a catch body that is only whitespace —
    // i.e. a catch with no statements and no explanatory comment.
    const bareEmptyCatch = /catch\s*(\([^)]*\))?\s*\{\s*\}/g;
    expect(source.match(bareEmptyCatch)).toBeNull();
  });

  it("documents why the two non-critical catches are intentionally safe to ignore", () => {
    const source = readFileSync(SETTINGS_CLIENT_PATH, "utf8");
    expect(source).toContain("Safe to ignore: `soundsMuted` UI state is already updated above");
    expect(source).toContain("Safe to ignore: the settings already saved successfully server-side");
  });
});

import { describe, it, expect } from "vitest";
// Imported from the React-free pure module. LeftNav re-exports the same symbols,
// but importing the lib file directly keeps this test in a plain Node context
// (no "use client" component tree, no Next.js/Supabase runtime to boot).
import { getActiveKey } from "@/lib/nav/activeKey";
import type { NavItem } from "@/lib/nav/activeKey";

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------
const navItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "chemicals", label: "Chemicals", href: "/chemicals" },
  {
    key: "training",
    label: "Training",
    href: "/training",
    children: [
      { key: "training-courses", label: "Courses", href: "/training/courses" },
      { key: "training-records", label: "Records", href: "/training/records" },
    ],
  },
  { key: "settings", label: "Settings", href: "/settings" },
  { key: "settings-legal", label: "Legal", href: "/settings/legal" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("getActiveKey — pure route-matching helper", () => {
  it("exact match: returns the key for a top-level pathname", () => {
    expect(getActiveKey("/chemicals", navItems)).toBe("chemicals");
  });

  it("root match: returns 'dashboard' only when pathname is exactly '/'", () => {
    expect(getActiveKey("/", navItems)).toBe("dashboard");
  });

  it("root exclusion: '/' is NOT matched as a prefix for other paths", () => {
    // Without the root-exclusion rule, every pathname would match 'dashboard'.
    expect(getActiveKey("/chemicals", navItems)).not.toBe("dashboard");
  });

  it("nested exact: returns the child key for an exact nested pathname", () => {
    expect(getActiveKey("/training/courses", navItems)).toBe("training-courses");
  });

  it("nested exact: returns a different child key", () => {
    expect(getActiveKey("/training/records", navItems)).toBe("training-records");
  });

  it("longest prefix: returns parent when no child matches the tail", () => {
    // '/training/unknown' — no child matches, but '/training' is a valid prefix.
    expect(getActiveKey("/training/unknown", navItems)).toBe("training");
  });

  it("longest prefix: selects deeper prefix over shallower one", () => {
    // '/settings/legal/gdpr' — both '/settings' and '/settings/legal' are
    // prefixes; '/settings/legal' is longer and should win.
    expect(getActiveKey("/settings/legal/gdpr", navItems)).toBe(
      "settings-legal"
    );
  });

  it("no match: returns null for a completely unrecognised pathname", () => {
    expect(getActiveKey("/completely/unknown/path", navItems)).toBeNull();
  });

  it("empty list: returns null without throwing", () => {
    expect(getActiveKey("/chemicals", [])).toBeNull();
  });
});

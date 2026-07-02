// Guards the Zod schemas that validate Dev Command Center payloads: the
// generate-implementation request body, the implementation-brief tool output,
// and the import-notes task-extraction tool output. Each schema gets a
// happy-path parse and rejection cases so a schema edit that loosens or breaks
// validation is caught here before an API route ships it.

import { describe, it, expect } from "vitest";
import {
  TaskIdBodySchema,
  GeneratedFileSchema,
  ImplementationBriefSchema,
  ProposedTaskSchema,
  ImportResultSchema,
} from "../src/lib/devcenter/schemas";

// Drop one key from a valid payload to build a rejection case.
function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...obj };
  delete copy[key];
  return copy as Omit<T, K>;
}

const VALID_FILE = {
  path: "src/app/(app)/incidents/page.tsx",
  operation: "edit",
  description: "Add an Export CSV button to the toolbar.",
  content: "export default function Page() { return null; }",
};

const VALID_BRIEF = {
  summary: "Adds CSV export to the Incidents page.",
  files: [VALID_FILE],
  dbMigration: null,
  testingNotes: "Click Export on /incidents and confirm a CSV downloads.",
  deployCommand: "vercel --prod --yes",
};

const VALID_TASK = {
  title: "Add CSV export to Incidents page",
  business_goal: "Save safety managers time pulling reports",
  description: "Add an Export button that downloads a spreadsheet.",
  module_affected: "Incidents",
  who_uses_it: "Safety managers",
  priority: "medium",
  risk_level: "low",
  success_criteria: "Clicking Export downloads a CSV with all incidents.",
  notes: "",
};

describe("TaskIdBodySchema", () => {
  it("accepts a valid body", () => {
    expect(TaskIdBodySchema.safeParse({ taskId: "task-123" }).success).toBe(true);
  });

  it("rejects a missing taskId", () => {
    expect(TaskIdBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty taskId", () => {
    expect(TaskIdBodySchema.safeParse({ taskId: "" }).success).toBe(false);
  });

  it("rejects a non-string taskId", () => {
    expect(TaskIdBodySchema.safeParse({ taskId: 42 }).success).toBe(false);
  });
});

describe("GeneratedFileSchema", () => {
  it("accepts a valid file entry", () => {
    expect(GeneratedFileSchema.safeParse(VALID_FILE).success).toBe(true);
  });

  it("rejects an unknown operation", () => {
    expect(GeneratedFileSchema.safeParse({ ...VALID_FILE, operation: "upsert" }).success).toBe(false);
  });

  it("rejects a missing path", () => {
    expect(GeneratedFileSchema.safeParse(omit(VALID_FILE, "path")).success).toBe(false);
  });
});

describe("ImplementationBriefSchema", () => {
  it("accepts a valid brief", () => {
    const result = ImplementationBriefSchema.safeParse(VALID_BRIEF);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.files).toHaveLength(1);
  });

  it("accepts a string dbMigration", () => {
    const result = ImplementationBriefSchema.safeParse({
      ...VALID_BRIEF,
      dbMigration: "alter table incidents add column exported_at timestamptz;",
    });
    expect(result.success).toBe(true);
  });

  it("defaults dbMigration to null when omitted", () => {
    const result = ImplementationBriefSchema.safeParse(omit(VALID_BRIEF, "dbMigration"));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dbMigration).toBeNull();
  });

  it("accepts an empty files array", () => {
    expect(ImplementationBriefSchema.safeParse({ ...VALID_BRIEF, files: [] }).success).toBe(true);
  });

  it("rejects a missing summary", () => {
    expect(ImplementationBriefSchema.safeParse(omit(VALID_BRIEF, "summary")).success).toBe(false);
  });

  it("rejects a brief with an invalid file entry", () => {
    const result = ImplementationBriefSchema.safeParse({
      ...VALID_BRIEF,
      files: [{ ...VALID_FILE, content: 42 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(ImplementationBriefSchema.safeParse("not a brief").success).toBe(false);
    expect(ImplementationBriefSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("ProposedTaskSchema", () => {
  it("accepts a valid task", () => {
    expect(ProposedTaskSchema.safeParse(VALID_TASK).success).toBe(true);
  });

  it("rejects an unknown priority", () => {
    expect(ProposedTaskSchema.safeParse({ ...VALID_TASK, priority: "someday" }).success).toBe(false);
  });

  it("rejects an unknown risk_level", () => {
    expect(ProposedTaskSchema.safeParse({ ...VALID_TASK, risk_level: "extreme" }).success).toBe(false);
  });

  it("rejects a missing success_criteria", () => {
    expect(ProposedTaskSchema.safeParse(omit(VALID_TASK, "success_criteria")).success).toBe(false);
  });
});

describe("ImportResultSchema", () => {
  it("accepts a valid result", () => {
    const result = ImportResultSchema.safeParse({
      tasks: [VALID_TASK],
      rawSummary: "Notes covered one export feature request.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty tasks array", () => {
    expect(ImportResultSchema.safeParse({ tasks: [], rawSummary: "Nothing actionable." }).success).toBe(true);
  });

  it("rejects a missing rawSummary", () => {
    expect(ImportResultSchema.safeParse({ tasks: [VALID_TASK] }).success).toBe(false);
  });

  it("rejects a result whose task has an invalid enum", () => {
    const result = ImportResultSchema.safeParse({
      tasks: [{ ...VALID_TASK, priority: "critical" }],
      rawSummary: "One task.",
    });
    expect(result.success).toBe(false);
  });
});

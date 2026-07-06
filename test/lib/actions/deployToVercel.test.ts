// Proves triggerVercelDeploy's one service-role write (dev_audit_log) never
// carries a tenant_id — the table has no such column and the only caller
// (DeployButton.tsx under admin/dev-command) is superadmin-gated by
// middleware + requireDevCommandAccess(). See
// docs/security/deployToVercel-tenant-ownership.md for the full justification.
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const insertMock = vi.hoisted(() => vi.fn(async (_row: Record<string, unknown>) => ({ error: null })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ insert: insertMock })));
const createServiceRoleClientMock = vi.hoisted(() => vi.fn(() => ({ from: fromMock })));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  MOCK_MODE: false,
}));

const originalFetch = global.fetch;
const originalHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

import { triggerVercelDeploy } from "@/lib/actions/deployToVercel";

describe("triggerVercelDeploy", () => {
  beforeEach(() => {
    insertMock.mockClear();
    fromMock.mockClear();
    createServiceRoleClientMock.mockClear();
    process.env.VERCEL_DEPLOY_HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/mock";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.VERCEL_DEPLOY_HOOK_URL = originalHookUrl;
  });

  test("returns a structured error, not a raw exception, when the deploy hook is not configured", async () => {
    delete process.env.VERCEL_DEPLOY_HOOK_URL;

    const result = await triggerVercelDeploy("task-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/deploy hook/i);
    expect(createServiceRoleClientMock).not.toHaveBeenCalled();
  });

  test("the dev_audit_log write never includes a tenant_id, regardless of taskId supplied", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ job: { id: "job-123" } }),
    })) as unknown as typeof fetch;

    const result = await triggerVercelDeploy("task-from-any-caller");

    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("dev_audit_log");
    expect(insertMock).toHaveBeenCalledTimes(1);

    const insertedRow = insertMock.mock.calls[0][0];
    expect(insertedRow).not.toHaveProperty("tenant_id");
    expect(insertedRow).toMatchObject({
      task_id: "task-from-any-caller",
      actor: "system",
      action: "production_deploy_triggered",
    });
  });

  test("skips the service-role write entirely when no taskId is supplied", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ job: { id: "job-456" } }),
    })) as unknown as typeof fetch;

    const result = await triggerVercelDeploy();

    expect(result.ok).toBe(true);
    expect(createServiceRoleClientMock).not.toHaveBeenCalled();
  });
});

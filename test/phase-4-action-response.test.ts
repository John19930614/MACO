import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Phase 4 — Action & Response: server-action tests ────────────────────────
// Force LIVE mode so role resolution goes through getServerUser (not mock
// profiles), then stub session, next/cache, and the service-role Supabase client
// with a small in-memory store. The vitest config only picks up test/**/*.test.ts,
// so this lives here (a file under src/lib/**/__tests__ would silently never run).

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  MOCK_MODE: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = vi.hoisted(() => {
  class TenantMismatchError extends Error {}
  return {
    getServerUser: vi.fn(async () => ({ role: "ehs_manager" as string })),
    getServerProfileId: vi.fn(async () => "mgr-1"),
    getEffectiveTenantId: vi.fn(async () => "tenant-A"),
    isSuperadmin: vi.fn(async () => false),
    assertTenantOwnership: vi.fn(async (t: string) => t),
    NIL_UUID: "00000000-0000-0000-0000-000000000000",
    TenantMismatchError,
  };
});
vi.mock("@/lib/auth/session", () => session);

// ── In-memory Supabase stand-in ─────────────────────────────────────────────
// Supports the exact chains the action uses: insert(.select().single()),
// update().eq(), select().eq()…(.maybeSingle()|.single()|await array), order/limit.
const store = vi.hoisted(() => ({ tables: new Map<string, Array<Record<string, unknown>>>(), seq: 0 }));

function makeClient() {
  class QB {
    table: string;
    filters: Array<[string, unknown]> = [];
    op: "select" | "insert" | "insert_select" | "update" = "select";
    payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
    constructor(table: string) { this.table = table; }
    private arr() {
      if (!store.tables.has(this.table)) store.tables.set(this.table, []);
      return store.tables.get(this.table)!;
    }
    insert(payload: Record<string, unknown> | Record<string, unknown>[]) { this.op = "insert"; this.payload = payload; return this; }
    update(patch: Record<string, unknown>) { this.op = "update"; this.payload = patch; return this; }
    select() { if (this.op === "insert") this.op = "insert_select"; return this; }
    eq(col: string, val: unknown) { this.filters.push([col, val]); return this; }
    order() { return this; }
    limit() { return this; }
    private matched() {
      let rows = this.arr();
      for (const [c, v] of this.filters) rows = rows.filter((r) => r[c] === v);
      return rows;
    }
    private run(): { data: unknown; error: null } {
      if (this.op === "insert" || this.op === "insert_select") {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload as Record<string, unknown>];
        const inserted = payloads.map((p) => {
          const uid = `00000000-0000-4000-8000-${(++store.seq).toString(16).padStart(12, "0")}`;
          const row = { id: p.id ?? uid, ...p };
          this.arr().push(row);
          return row;
        });
        return { data: this.op === "insert_select" ? inserted : null, error: null };
      }
      if (this.op === "update") {
        this.matched().forEach((r) => Object.assign(r, this.payload));
        return { data: null, error: null };
      }
      return { data: this.matched(), error: null };
    }
    async single() {
      const { data } = this.run();
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
    }
    async maybeSingle() {
      const { data } = this.run();
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
    }
    then(resolve: (v: { data: unknown; error: null }) => void) { resolve(this.run()); }
  }
  return { from: (table: string) => new QB(table) };
}
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => makeClient() }));

import {
  evaluateRiskEscalation,
  confirmEscalation,
  dismissEscalation,
  getEscalationQueue,
} from "@/lib/actions/phase-4-action-response";
import { PAGING_ENABLED } from "@/lib/predictive-risk-engine/paging";

const RED_SCORE_ID = "11111111-1111-1111-1111-111111111111";
const GREEN_SCORE_ID = "22222222-2222-2222-2222-222222222222";
const SITE_ID = "33333333-3333-3333-3333-333333333333";

function seed() {
  store.tables.clear();
  store.seq = 0;
  store.tables.set("site_risk_scores", [
    { id: RED_SCORE_ID, tenant_id: "tenant-A", site_id: SITE_ID, band_key: "red", explanation_text: "Risk rose because 4 inspections are overdue and 1 SDS has expired." },
    { id: GREEN_SCORE_ID, tenant_id: "tenant-A", site_id: SITE_ID, band_key: "green", explanation_text: "Risk is low." },
  ]);
  store.tables.set("sites", [{ id: SITE_ID, name: "Main Plant", safety_lead: "Sarah Chen" }]);
  store.tables.set("risk_escalations", []);
  store.tables.set("capa_records", []);
}

const escalations = () => store.tables.get("risk_escalations") ?? [];
const capas = () => store.tables.get("capa_records") ?? [];

describe("Phase 4 — Action & Response: Predictive Risk Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.getServerUser.mockResolvedValue({ role: "ehs_manager" });
    session.isSuperadmin.mockResolvedValue(false);
    session.getEffectiveTenantId.mockResolvedValue("tenant-A");
    session.getServerProfileId.mockResolvedValue("mgr-1");
    session.assertTenantOwnership.mockImplementation(async (t: string) => t);
    seed();
  });

  it("creates exactly one escalation + draft CAPA when a score crosses the Red threshold (idempotent on re-run)", async () => {
    const first = await evaluateRiskEscalation(RED_SCORE_ID);
    expect(first.ok).toBe(true);
    expect(first).toMatchObject({ created: true, reason: "red" });
    expect(escalations()).toHaveLength(1);
    expect(capas()).toHaveLength(1);

    // Re-evaluating the SAME score row must not duplicate anything.
    const second = await evaluateRiskEscalation(RED_SCORE_ID);
    expect(second.ok).toBe(true);
    expect(second).toMatchObject({ created: false, reason: "already_exists" });
    expect(escalations()).toHaveLength(1);
    expect(capas()).toHaveLength(1);
  });

  it("does not create an escalation when the score is below threshold", async () => {
    const res = await evaluateRiskEscalation(GREEN_SCORE_ID);
    expect(res.ok).toBe(true);
    expect(res).toMatchObject({ created: false, reason: "no_escalation_needed" });
    expect(escalations()).toHaveLength(0);
    expect(capas()).toHaveLength(0);
  });

  it("draft CAPA has source_type 'risk_score_escalation' and links back to the triggering risk score", async () => {
    await evaluateRiskEscalation(RED_SCORE_ID);
    const capa = capas()[0];
    expect(capa.source_type).toBe("risk_score_escalation");
    expect(capa.source_id).toBe(RED_SCORE_ID);
    expect(capa.kind).toBe("corrective");
    expect(capa.status).toBe("open");
    // Escalation links to the CAPA it drafted.
    expect(escalations()[0].capa_record_id).toBe(capa.id);
  });

  it("sends NO notification on evaluate — notification_sent_at stays null until confirm", async () => {
    await evaluateRiskEscalation(RED_SCORE_ID);
    expect(escalations()[0].notification_sent_at ?? null).toBeNull();
    expect(escalations()[0].status).toBe("needs_review");
  });

  it("confirmEscalation sends an in-app notification only — never external paging (PAGING_ENABLED is false)", async () => {
    // Structural guarantee: the flag is off and there is no external dispatcher.
    expect(PAGING_ENABLED).toBe(false);

    await evaluateRiskEscalation(RED_SCORE_ID);
    const esc = escalations()[0];
    const res = await confirmEscalation({ escalationId: esc.id as string, recipients: ["Sarah Chen"], description: "Edited corrective task." });
    expect(res.ok).toBe(true);

    const after = escalations()[0];
    expect(after.status).toBe("confirmed");
    expect(after.notification_sent_at).toBeTruthy();
    expect(after.notified_recipient).toBe("Sarah Chen");
    expect(after.reviewed_by).toBe("mgr-1");
    // The manager's edited text was saved onto the linked CAPA.
    expect(capas()[0].description).toBe("Edited corrective task.");
  });

  it("dismissEscalation marks dismissed, closes the draft CAPA, and creates no notification", async () => {
    await evaluateRiskEscalation(RED_SCORE_ID);
    const esc = escalations()[0];
    const res = await dismissEscalation(esc.id as string);
    expect(res.ok).toBe(true);

    const after = escalations()[0];
    expect(after.status).toBe("dismissed");
    expect(after.notification_sent_at ?? null).toBeNull();
    expect(capas()[0].status).toBe("closed");
  });

  it("blocks non-manager roles from viewing the queue or confirming/dismissing (throws)", async () => {
    // Seed one escalation first while still a manager…
    await evaluateRiskEscalation(RED_SCORE_ID);
    const escId = escalations()[0].id as string;

    // …then drop to a site supervisor / field officer.
    session.getServerUser.mockResolvedValue({ role: "field_officer" });

    await expect(getEscalationQueue()).rejects.toThrow(/not authorized/i);
    await expect(confirmEscalation({ escalationId: escId, recipients: ["x"] })).rejects.toThrow(/not authorized/i);
    await expect(dismissEscalation(escId)).rejects.toThrow(/not authorized/i);
  });

  it("shows only pending escalations as review cards, with correct counts", async () => {
    await evaluateRiskEscalation(RED_SCORE_ID);
    const queue = await getEscalationQueue();
    expect(queue.counts.pending).toBe(1);
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0].capaId).toBeTruthy();
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * LIVE RLS PROOF for the AI Gateway staging + exception-log tables (0007).
 * Runs against the real local Supabase Postgres. Verifies that staged_records
 * and gateway_rejects enforce the same tenant isolation + role gating as the
 * rest of the schema: tenant-scoped reads, contributor+ may stage / log, only
 * supervisors+ may remove (approve/reject) or update.
 *
 * Skipped unless LIVE_SUPABASE_URL + keys are present (scripts/live-rls-test.sh).
 */
const URL = process.env.LIVE_SUPABASE_URL;
const ANON = process.env.LIVE_ANON_KEY;
const SERVICE = process.env.LIVE_SERVICE_ROLE_KEY;
const ready = Boolean(URL && ANON && SERVICE);

const PACIFIC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SUMMIT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const suite = ready ? describe : describe.skip;

suite("LIVE: RLS on staged_records + gateway_rejects", () => {
  let admin: SupabaseClient;
  let sup: User; // Pacific supervisor
  let contrib: User; // Pacific contributor
  let sumSup: User; // Summit supervisor
  const pwd = "Test-Passw0rd!";
  const supEmail = `gw.sup.${Date.now()}@example.com`;
  const contribEmail = `gw.contrib.${Date.now()}@example.com`;
  const sumEmail = `gw.sum.${Date.now()}@example.com`;
  let pacStagedId: string;
  let sumStagedId: string;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } });
    const mk = async (email: string) => {
      const r = await admin.auth.admin.createUser({ email, password: pwd, email_confirm: true });
      if (r.error) throw r.error;
      return r.data.user!;
    };
    sup = await mk(supEmail);
    contrib = await mk(contribEmail);
    sumSup = await mk(sumEmail);
    const prof = await admin.from("profiles").insert([
      { id: sup.id, display_name: "GW Sup", role: "supervisor", tenant_id: PACIFIC },
      { id: contrib.id, display_name: "GW Contrib", role: "contributor", tenant_id: PACIFIC },
      { id: sumSup.id, display_name: "GW Sum", role: "supervisor", tenant_id: SUMMIT },
    ]);
    if (prof.error) throw prof.error;

    // Seed one staged record per tenant with the service role (bypasses RLS).
    const ins = await admin.from("staged_records").insert([
      { tenant_id: PACIFIC, kind: "safety_cell", title: "pac staged", submitted_by: sup.id, payload: {} },
      { tenant_id: SUMMIT, kind: "safety_cell", title: "sum staged", submitted_by: sumSup.id, payload: {} },
    ]).select("id, tenant_id");
    if (ins.error) throw ins.error;
    pacStagedId = ins.data!.find((r) => r.tenant_id === PACIFIC)!.id;
    sumStagedId = ins.data!.find((r) => r.tenant_id === SUMMIT)!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("staged_records").delete().in("id", [pacStagedId, sumStagedId].filter(Boolean));
    await admin.from("gateway_rejects").delete().eq("tenant_id", PACIFIC);
    await admin.from("profiles").delete().in("id", [sup?.id, contrib?.id, sumSup?.id].filter(Boolean));
    for (const u of [sup, contrib, sumSup]) if (u) await admin.auth.admin.deleteUser(u.id);
  });

  async function asUser(email: string): Promise<SupabaseClient> {
    const c = createClient(URL!, ANON!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password: pwd });
    if (error) throw error;
    return c;
  }

  it("a Pacific user reads only Pacific staged records", async () => {
    const c = await asUser(supEmail);
    const { data, error } = await c.from("staged_records").select("id, tenant_id");
    expect(error).toBeNull();
    expect(data!.every((r) => r.tenant_id === PACIFIC)).toBe(true);
    expect(data!.some((r) => r.id === pacStagedId)).toBe(true);
    expect(data!.some((r) => r.id === sumStagedId)).toBe(false);
  });

  it("a contributor may stage into their tenant but not another", async () => {
    const c = await asUser(contribEmail);
    const ok = await c.from("staged_records").insert({ tenant_id: PACIFIC, kind: "safety_cell", title: "contrib stage", submitted_by: contrib.id, payload: {} });
    expect(ok.error).toBeNull();
    const cross = await c.from("staged_records").insert({ tenant_id: SUMMIT, kind: "safety_cell", title: "cross", submitted_by: contrib.id, payload: {} });
    expect(cross.error).not.toBeNull(); // WITH CHECK blocks cross-tenant
  });

  it("only a supervisor+ may remove (approve/reject) a staged record", async () => {
    // contributor delete is hidden by RLS → 0 rows removed, row survives
    const cc = await asUser(contribEmail);
    await cc.from("staged_records").delete().eq("id", pacStagedId);
    const stillThere = await admin.from("staged_records").select("id").eq("id", pacStagedId);
    expect(stillThere.data!.length).toBe(1);
    // supervisor delete succeeds
    const sc = await asUser(supEmail);
    await sc.from("staged_records").delete().eq("id", pacStagedId);
    const gone = await admin.from("staged_records").select("id").eq("id", pacStagedId);
    expect(gone.data!.length).toBe(0);
  });

  it("gateway_rejects are tenant-scoped and supervisor-updatable", async () => {
    const c = await asUser(supEmail);
    const ins = await c.from("gateway_rejects").insert({ tenant_id: PACIFIC, kind: "safety_cell", summary: "s", category: "Gateway 2 · Duplicate", reason: "dup", actor_id: sup.id }).select("id");
    expect(ins.error).toBeNull();
    const id = ins.data![0].id;
    const upd = await c.from("gateway_rejects").update({ status: "resolved" }).eq("id", id);
    expect(upd.error).toBeNull();
    // a Summit user cannot see the Pacific reject
    const s = await asUser(sumEmail);
    const cross = await s.from("gateway_rejects").select("id").eq("id", id);
    expect(cross.data ?? []).toHaveLength(0);
  });
});

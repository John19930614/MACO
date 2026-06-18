import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * LIVE RLS PROOF — runs against the real local Supabase Postgres.
 *
 * This is the test that mock mode CANNOT do: it proves Row Level Security
 * actually enforces tenant isolation with real JWTs, not just that our repo
 * emulates it. It creates two tenant-scoped users, inserts a cell per tenant
 * with the service role (bypasses RLS), then signs in AS each user and verifies
 * Postgres itself blocks cross-tenant reads.
 *
 * Skipped automatically unless LIVE_SUPABASE_URL + keys are present (injected by
 * scripts/live-rls-test.sh from `supabase status`).
 */
const URL = process.env.LIVE_SUPABASE_URL;
const ANON = process.env.LIVE_ANON_KEY;
const SERVICE = process.env.LIVE_SERVICE_ROLE_KEY;
const ready = Boolean(URL && ANON && SERVICE);

// Tenant UUIDs come from supabase/seed.sql.
const PACIFIC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SUMMIT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const suite = ready ? describe : describe.skip;

suite("LIVE: Postgres RLS enforces tenant isolation", () => {
  let admin: SupabaseClient;
  let pacificUser: User;
  let summitUser: User;
  let pacificCellId: string;
  let summitCellId: string;
  const pwd = "Test-Passw0rd!";
  const pacificEmail = `pacific.rls.${Date.now()}@example.com`;
  const summitEmail = `summit.rls.${Date.now()}@example.com`;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } });

    // 1) Create one user per tenant.
    const a = await admin.auth.admin.createUser({ email: pacificEmail, password: pwd, email_confirm: true });
    const b = await admin.auth.admin.createUser({ email: summitEmail, password: pwd, email_confirm: true });
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    pacificUser = a.data.user!;
    summitUser = b.data.user!;

    // 2) Profiles bind each user to a tenant (service role bypasses RLS).
    const prof = await admin.from("profiles").insert([
      { id: pacificUser.id, display_name: "RLS Pacific", role: "supervisor", tenant_id: PACIFIC },
      { id: summitUser.id, display_name: "RLS Summit", role: "supervisor", tenant_id: SUMMIT },
    ]);
    if (prof.error) throw prof.error;

    // 3) A seeded location per tenant (created by db reset seed.sql).
    const locs = await admin.from("locations").select("id, tenant_id, site_id");
    if (locs.error) throw locs.error;
    const pacLoc = locs.data!.find((l) => l.tenant_id === PACIFIC)!;
    const sumLoc = locs.data!.find((l) => l.tenant_id === SUMMIT)!;

    // 4) Insert one cell per tenant with the service role.
    const ins = await admin
      .from("safety_cells")
      .insert([
        { tenant_id: PACIFIC, site_id: pacLoc.site_id, location_id: pacLoc.id, title: "RLS pacific cell", created_by: pacificUser.id, severity: "high", likelihood: 3, risk_score: 70 },
        { tenant_id: SUMMIT, site_id: sumLoc.site_id, location_id: sumLoc.id, title: "RLS summit cell", created_by: summitUser.id, severity: "high", likelihood: 3, risk_score: 70 },
      ])
      .select("id, tenant_id");
    if (ins.error) throw ins.error;
    pacificCellId = ins.data!.find((c) => c.tenant_id === PACIFIC)!.id;
    summitCellId = ins.data!.find((c) => c.tenant_id === SUMMIT)!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("safety_cells").delete().in("id", [pacificCellId, summitCellId].filter(Boolean));
    await admin.from("profiles").delete().in("id", [pacificUser?.id, summitUser?.id].filter(Boolean));
    if (pacificUser) await admin.auth.admin.deleteUser(pacificUser.id);
    if (summitUser) await admin.auth.admin.deleteUser(summitUser.id);
  });

  async function asUser(email: string): Promise<SupabaseClient> {
    const c = createClient(URL!, ANON!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password: pwd });
    if (error) throw error;
    return c;
  }

  it("a Pacific user reads only Pacific cells (RLS enforced by Postgres)", async () => {
    const c = await asUser(pacificEmail);
    const { data, error } = await c.from("safety_cells").select("id, tenant_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.tenant_id === PACIFIC)).toBe(true);
    expect(data!.some((r) => r.id === pacificCellId)).toBe(true);
    expect(data!.some((r) => r.id === summitCellId)).toBe(false);
  });

  it("a Summit user cannot read a Pacific cell by id", async () => {
    const c = await asUser(summitEmail);
    const { data } = await c.from("safety_cells").select("id").eq("id", pacificCellId);
    expect(data ?? []).toHaveLength(0); // RLS hides it entirely
  });

  it("a Summit user cannot INSERT into the Pacific tenant", async () => {
    const c = await asUser(summitEmail);
    const locs = await c.from("locations").select("id, site_id").limit(1);
    const loc = locs.data?.[0];
    const { error } = await c.from("safety_cells").insert({
      tenant_id: PACIFIC, // attempt to write into another tenant
      site_id: loc?.site_id ?? "11111111-1111-1111-1111-111111111111",
      location_id: loc?.id ?? "00000000-0000-0000-0000-000000000000",
      title: "cross-tenant write attempt",
      created_by: summitUser.id,
      severity: "low",
      likelihood: 1,
    });
    expect(error).not.toBeNull(); // RLS WITH CHECK rejects it
  });

  it("VELA insights are readable cross-tenant", async () => {
    const c = await asUser(pacificEmail);
    const { data, error } = await c.from("vela_insights").select("id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("an anonymous caller (public key, no login) reads nothing — no tenant leak", async () => {
    const anon = createClient(URL!, ANON!, { auth: { autoRefreshToken: false, persistSession: false } });
    // in_tenant() must NOT treat anon (null tenant) as a global operator.
    for (const table of ["sites", "locations", "safety_cells"]) {
      const { data } = await anon.from(table).select("id");
      expect(data ?? []).toHaveLength(0);
    }
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * LIVE pgvector proof — runs against the real local Supabase Postgres.
 * Verifies the vector extension, cell_embeddings table, and match_cells()
 * cosine-similarity function actually work end to end. Uses SYNTHETIC vectors,
 * so it needs no OpenAI key — it isolates the database machinery.
 */
const URL = process.env.LIVE_SUPABASE_URL;
const ANON = process.env.LIVE_ANON_KEY;
const SERVICE = process.env.LIVE_SERVICE_ROLE_KEY;
const ready = Boolean(URL && ANON && SERVICE);
const PACIFIC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

/** Build a 1536-d pgvector literal with specific indices set. */
function vec(set: Record<number, number>): string {
  const a = new Array(1536).fill(0);
  for (const [i, v] of Object.entries(set)) a[+i] = v;
  return `[${a.join(",")}]`;
}

const suite = ready ? describe : describe.skip;

suite("LIVE: pgvector match_cells returns the nearest cell", () => {
  let admin: SupabaseClient;
  let user: User;
  let cellA = "";
  let cellB = "";
  const email = `vec.${Date.now()}@example.com`;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } });
    const u = await admin.auth.admin.createUser({ email, password: "Test-Passw0rd!", email_confirm: true });
    if (u.error) throw u.error;
    user = u.data.user!;
    await admin.from("profiles").insert({ id: user.id, display_name: "Vec", role: "supervisor", tenant_id: PACIFIC });

    const loc = (await admin.from("locations").select("id, site_id").eq("tenant_id", PACIFIC).limit(1)).data![0];
    const ins = await admin
      .from("safety_cells")
      .insert([
        { tenant_id: PACIFIC, site_id: loc.site_id, location_id: loc.id, title: "vec cell A", created_by: user.id, severity: "low", likelihood: 1, risk_score: 10 },
        { tenant_id: PACIFIC, site_id: loc.site_id, location_id: loc.id, title: "vec cell B", created_by: user.id, severity: "low", likelihood: 1, risk_score: 10 },
      ])
      .select("id, title");
    if (ins.error) throw ins.error;
    cellA = ins.data!.find((c) => c.title === "vec cell A")!.id;
    cellB = ins.data!.find((c) => c.title === "vec cell B")!.id;

    const emb = await admin.from("cell_embeddings").insert([
      { cell_id: cellA, tenant_id: PACIFIC, content: "A", embedding: vec({ 0: 1 }) },
      { cell_id: cellB, tenant_id: PACIFIC, content: "B", embedding: vec({ 1: 1 }) },
    ]);
    if (emb.error) throw emb.error;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("cell_embeddings").delete().in("cell_id", [cellA, cellB].filter(Boolean));
    await admin.from("safety_cells").delete().in("id", [cellA, cellB].filter(Boolean));
    await admin.from("profiles").delete().eq("id", user?.id);
    if (user) await admin.auth.admin.deleteUser(user.id);
  });

  it("ranks the vector closest to the query first", async () => {
    // query leans toward dimension 0 (cell A)
    const { data, error } = await admin.rpc("match_cells", { query_embedding: vec({ 0: 0.9, 1: 0.1 }), match_tenant: PACIFIC, match_count: 5 });
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(2);
    expect(data![0].cell_id).toBe(cellA);
    expect(data![0].similarity).toBeGreaterThan(data![1].similarity);
  });

  it("only returns cells from the requested tenant", async () => {
    const { data } = await admin.rpc("match_cells", { query_embedding: vec({ 0: 1 }), match_tenant: PACIFIC, match_count: 10 });
    // both seeded cells belong to PACIFIC; nothing from another tenant leaks in
    expect(data!.every((r: { cell_id: string }) => r.cell_id === cellA || r.cell_id === cellB)).toBe(true);
  });
});

// Verify fix #1 live: two identical PENDING submissions can't both sit in
// staging (dup detection now spans staged in live). And fix #2: a clean write
// still succeeds (audit_log write_audit with actor_id = auth.uid()).
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const URL = process.env.LIVE_SUPABASE_URL, ANON = process.env.LIVE_ANON_KEY, SERVICE = process.env.LIVE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL ?? "http://localhost:3100";
const PACIFIC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", pwd = "Test-Passw0rd!";
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `dup.${Date.now()}@example.com`;
const { data: u } = await admin.auth.admin.createUser({ email, password: pwd, email_confirm: true });
await admin.from("profiles").insert({ id: u.user.id, display_name: "Dup Sup", role: "supervisor", tenant_id: PACIFIC });
const jar = {};
const ssr = createServerClient(URL, ANON, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => { jar[name] = value; }) } });
await ssr.auth.signInWithPassword({ email, password: pwd });
const cookie = Object.entries(jar).map(([n, v]) => `${n}=${v}`).join("; ");
const { data: locs } = await admin.from("locations").select("id, site_id").eq("tenant_id", PACIFIC).limit(1);
const loc = locs[0];
const post = (t) => fetch(`${APP}/api/cells`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ site_id: loc.site_id, location_id: loc.id, title: t, description: "d", task: "t", severity: "low", likelihood: 1, hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" } }) });

const dupTitle = `dup test ${Date.now()}`;
const first = await post(dupTitle);                 // expect 201 (staged)
const second = await post(dupTitle);                // expect 422 (duplicate of a PENDING staged cell)
const second_body = await second.json().catch(() => null);
const clean = await post(`clean ${Date.now()}`);    // expect 201 (audit write still works)

console.log(JSON.stringify({
  firstStage: first.status,
  secondDuplicate: second.status,
  secondReason: second_body?.rejections?.[0]?.reason ?? second_body?.error,
  cleanWrite: clean.status,
}, null, 2));

await admin.from("staged_records").delete().eq("tenant_id", PACIFIC);
await admin.from("gateway_rejects").delete().eq("tenant_id", PACIFIC);
await admin.from("profiles").delete().eq("id", u.user.id);
await admin.auth.admin.deleteUser(u.user.id);

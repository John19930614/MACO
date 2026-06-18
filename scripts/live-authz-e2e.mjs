// Verify app-layer authorization in LIVE mode: assertCanWrite now gates on the
// real authenticated user. Contributor may create cells (contributor+) but NOT
// log events (supervisor+); supervisor may do both.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const URL = process.env.LIVE_SUPABASE_URL;
const ANON = process.env.LIVE_ANON_KEY;
const SERVICE = process.env.LIVE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL ?? "http://localhost:3100";
const PACIFIC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const pwd = "Test-Passw0rd!";
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

async function mkUser(role) {
  const email = `authz.${role}.${Date.now()}.${Math.floor(performance.now())}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: pwd, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").insert({ id: data.user.id, display_name: `authz ${role}`, role, tenant_id: PACIFIC });
  return { id: data.user.id, email };
}

async function cookieFor(email) {
  const jar = {};
  const ssr = createServerClient(URL, ANON, {
    cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => { jar[name] = value; }) },
  });
  const { error } = await ssr.auth.signInWithPassword({ email, password: pwd });
  if (error) throw error;
  return Object.entries(jar).map(([n, v]) => `${n}=${v}`).join("; ");
}

const post = (path, cookie, body) => fetch(`${APP}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });

const sup = await mkUser("supervisor");
const con = await mkUser("contributor");
const supCookie = await cookieFor(sup.email);
const conCookie = await cookieFor(con.email);

const { data: locs } = await admin.from("locations").select("id, site_id").eq("tenant_id", PACIFIC).limit(1);
const loc = locs[0];
const cell = (t) => ({ site_id: loc.site_id, location_id: loc.id, title: t, description: "d", task: "t", severity: "low", likelihood: 1, hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" } });
const evt = (t) => ({ site_id: loc.site_id, kind: "near_miss", severity: "medium", title: t });

const r1 = await post("/api/events", conCookie, evt("contrib event attempt")); // supervisor+ → expect 403
const r1b = await r1.json().catch(() => null);
const r2 = await post("/api/cells", conCookie, cell(`contrib cell ${Date.now()}`)); // contributor+ → expect 201
const r3 = await post("/api/events", supCookie, evt(`sup event ${Date.now()}`)); // supervisor → expect 201

console.log(JSON.stringify({
  contributorLogEvent: { status: r1.status, detail: r1b?.detail ?? r1b?.error },
  contributorCreateCell: r2.status,
  supervisorLogEvent: r3.status,
}, null, 2));

// cleanup
await admin.from("staged_records").delete().eq("tenant_id", PACIFIC);
await admin.from("gateway_rejects").delete().eq("tenant_id", PACIFIC);
for (const u of [sup, con]) { await admin.from("profiles").delete().eq("id", u.id); await admin.auth.admin.deleteUser(u.id); }

// Verify LIVE error surfacing: a write that fails at the DB (FK violation) must
// surface as an error, not a silent no-op + false success. A cell staged with a
// bogus owner_id passes staging (jsonb), but approval's safety_cells insert
// FK-violates → approveStaged must throw (route !2xx) and NOT drop the staged row.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const URL = process.env.LIVE_SUPABASE_URL, ANON = process.env.LIVE_ANON_KEY, SERVICE = process.env.LIVE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL ?? "http://localhost:3100";
const PACIFIC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const pwd = "Test-Passw0rd!";
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const email = `dberr.${Date.now()}@example.com`;
const { data: u } = await admin.auth.admin.createUser({ email, password: pwd, email_confirm: true });
await admin.from("profiles").insert({ id: u.user.id, display_name: "DBErr Sup", role: "supervisor", tenant_id: PACIFIC });
const jar = {};
const ssr = createServerClient(URL, ANON, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => { jar[name] = value; }) } });
await ssr.auth.signInWithPassword({ email, password: pwd });
const cookie = Object.entries(jar).map(([n, v]) => `${n}=${v}`).join("; ");
const { data: locs } = await admin.from("locations").select("id, site_id").eq("tenant_id", PACIFIC).limit(1);
const loc = locs[0];

const title = `dberr cell ${Date.now()}`;
const post = (b) => fetch(`${APP}/api/cells`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(b) });
// owner_id is a well-formed uuid that is NOT a real profile → FK violation on approval
const r = await post({ site_id: loc.site_id, location_id: loc.id, title, description: "d", task: "t", severity: "low", likelihood: 1, owner_id: "dddddddd-dddd-dddd-dddd-dddddddddddd", hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" } });

const { data: staged } = await admin.from("staged_records").select("id").eq("title", title);
const stagedId = staged?.[0]?.id;
const approve = await fetch(`${APP}/api/staged`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ id: stagedId, action: "approve" }) });

const { data: inCells } = await admin.from("safety_cells").select("id").eq("title", title);
const { data: stillStaged } = await admin.from("staged_records").select("id").eq("title", title);

// Control: a CLEAN cell (no bogus owner) must stage AND approve cleanly — proves
// the full flow works now that audit_log inserts are allowed in live.
const okTitle = `clean cell ${Date.now()}`;
const rc = await post({ site_id: loc.site_id, location_id: loc.id, title: okTitle, description: "d", task: "t", severity: "low", likelihood: 1, hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" } });
const { data: cleanStaged } = await admin.from("staged_records").select("id").eq("title", okTitle);
const ra = await fetch(`${APP}/api/staged`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ id: cleanStaged?.[0]?.id, action: "approve" }) });
const { data: cleanInCells } = await admin.from("safety_cells").select("id").eq("title", okTitle);

console.log(JSON.stringify({
  stageStatus: r.status,                       // expect 201
  approveStatus: approve.status,               // expect NOT 2xx (error surfaced)
  cellInDatabase: (inCells?.length ?? 0) > 0,  // expect false (FK rejected → not persisted)
  stagedRowPreserved: (stillStaged?.length ?? 0) > 0, // expect true (no data loss on failure)
  cleanStage: rc.status,                       // expect 201 (audit_log insert now allowed)
  cleanApprove: ra.status,                     // expect 200
  cleanCellInDatabase: (cleanInCells?.length ?? 0) > 0, // expect true (admitted to live DB)
}, null, 2));
await admin.from("staged_records").delete().eq("title", okTitle);
await admin.from("safety_cells").delete().eq("title", okTitle);

// cleanup
await admin.from("staged_records").delete().eq("title", title);
await admin.from("safety_cells").delete().eq("title", title);
await admin.from("profiles").delete().eq("id", u.user.id);
await admin.auth.admin.deleteUser(u.user.id);

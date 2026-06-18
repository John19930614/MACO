// One-off: drive a REAL authenticated write through the live app (port 3100)
// against local Postgres, proving route → getSessionUser → createCell → staged_records.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const URL = process.env.LIVE_SUPABASE_URL;
const ANON = process.env.LIVE_ANON_KEY;
const SERVICE = process.env.LIVE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL ?? "http://localhost:3100";
const PACIFIC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const email = `e2e.${Date.now()}@example.com`;
const pwd = "Test-Passw0rd!";

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) real auth user + Pacific supervisor profile
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: pwd, email_confirm: true });
if (ue) throw ue;
const userId = u.user.id;
const { error: pe } = await admin.from("profiles").insert({ id: userId, display_name: "E2E Sup", role: "supervisor", tenant_id: PACIFIC });
if (pe) throw pe;

// 2) a real Pacific location
const { data: locs, error: le } = await admin.from("locations").select("id, site_id").eq("tenant_id", PACIFIC).limit(1);
if (le) throw le;
const loc = locs[0];

// 3) sign in via @supabase/ssr so the cookie jar holds the EXACT format the app reads
const jar = {};
const ssr = createServerClient(URL, ANON, {
  cookies: {
    getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
    setAll: (cs) => cs.forEach(({ name, value }) => { jar[name] = value; }),
  },
});
const { error: se } = await ssr.auth.signInWithPassword({ email, password: pwd });
if (se) throw se;
const { data: who } = await ssr.auth.getUser();
console.log("DIAG jar cookies:", Object.keys(jar).map((k) => `${k}(${jar[k].length})`).join(", "));
console.log("DIAG ssr.getUser:", who?.user?.id ?? "none");
const { data: vs, error: vse } = await ssr.from("sites").select("id, tenant_id");
console.log("DIAG sites visible to user:", JSON.stringify(vs), vse?.message ?? "");
const { data: vp, error: vpe } = await ssr.from("profiles").select("id, role, tenant_id").eq("id", userId);
console.log("DIAG own profile via RLS:", JSON.stringify(vp), vpe?.message ?? "");
const cookieHeader = Object.entries(jar).map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

// 4) authenticated POST /api/cells → should stage (201, pending:true)
const title = `live e2e ${Date.now()}`;
const res = await fetch(`${APP}/api/cells`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookieHeader },
  body: JSON.stringify({
    site_id: loc.site_id, location_id: loc.id, title, description: "d", task: "t",
    severity: "high", likelihood: 4,
    hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" },
  }),
});
const body = await res.json().catch(() => null);
console.log("DIAG post body:", JSON.stringify(body));
// Does the cookie authenticate a READ? (whoami via a route that echoes the user)
const rawHeader = Object.entries(jar).map(([n, v]) => `${n}=${v}`).join("; ");
const r2 = await fetch(`${APP}/api/cells`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: rawHeader }, body: JSON.stringify({ site_id: loc.site_id, location_id: loc.id, title: title + " raw", description: "d", task: "t", severity: "low", likelihood: 1, hazard_genome: { energySource: "electrical", exposureType: "contact", trigger: "t", controlGap: "missing" } }) });
console.log("DIAG raw-cookie post status:", r2.status);

// 5) confirm it landed in staged_records (and NOT in safety_cells) via service role
const { data: staged } = await admin.from("staged_records").select("id, title, kind, submitted_by, tenant_id").eq("title", title);
const { data: live } = await admin.from("safety_cells").select("id").eq("title", title);

console.log(JSON.stringify({
  postStatus: res.status,
  pending: body?.pending,
  stagedCount: staged?.length ?? 0,
  stagedRow: staged?.[0] ?? null,
  stampedRealUser: staged?.[0]?.submitted_by === userId,
  inLiveCells: (live?.length ?? 0) > 0,
}, null, 2));

// cleanup
if (staged?.length) await admin.from("staged_records").delete().eq("title", title);
await admin.from("profiles").delete().eq("id", userId);
await admin.auth.admin.deleteUser(userId);

// System Test — hit every navigation route and confirm it renders without a
// server-side error. Run against a dev/preview server in MOCK mode, where
// middleware passes through and every page SSR-renders (AuthGuard is
// client-side), so a healthy page returns HTTP 200 and a broken one 500.
//
// Usage:
//   1) start the app in mock mode on a port, e.g.:
//        NEXT_PUBLIC_SAFETYIQ_MOCK=true npx next dev -p 3210
//   2) node scripts/system-test.mjs            (defaults to http://localhost:3210)
//      SYSTEM_TEST_BASE=http://localhost:3000 node scripts/system-test.mjs
//
// Exit code is non-zero if any route fails — usable as a release gate (SOP-06).
//
// The route list mirrors the nav in src/components/layout/LeftNav.tsx. When a
// nav destination is added/removed there, update ROUTES here too (SOP-06 §maint).

const BASE = process.env.SYSTEM_TEST_BASE || "http://localhost:3210";

const ROUTES = {
  "Company (Overview / Compliance / Operations / Insights / Admin)": [
    "/dashboard", "/workspace", "/legal", "/risk", "/audits", "/capa", "/osha",
    "/training", "/documents", "/chemicals", "/biosafety", "/waste", "/ergonomics",
    "/monitoring", "/incidents", "/ai", "/reports", "/team", "/settings",
  ],
  "Reliance Internal (SA)": [
    "/sa/modules", "/sa/companies", "/sa/impl", "/sa/globallegal", "/sa/templates",
    "/sa/ai", "/sa/gateway", "/sa/validation", "/sa/standup", "/sa/guardrails",
    "/sa/predictive", "/sa/imports", "/sa/analytics", "/sa/support", "/sa/history",
    "/sa/security", "/sa/billing", "/sa/wiring",
  ],
  "Operate + ARC": [
    "/arc/map", "/cells", "/arc/proof", "/arc/review", "/arc/activity", "/arc/causality",
    "/arc/graph", "/arc/framework", "/arc/rdash", "/arc/trends", "/arc/reports",
    "/arc/data", "/arc/gateway", "/arc/forecast", "/arc/intake", "/arc/method",
    "/arc/hsl", "/arc/intelligence", "/arc/verticals",
  ],
};

const results = [];
for (const [group, routes] of Object.entries(ROUTES)) {
  for (const route of routes) {
    const t0 = Date.now();
    let status = 0, note = "";
    try {
      const res = await fetch(BASE + route, { redirect: "manual" });
      status = res.status;
      const body = await res.text();
      if (status >= 500 &&
          /__next_error__|Application error: a server-side exception|Internal Server Error/i.test(body)) {
        note = "server exception";
      }
    } catch (e) {
      status = -1;
      note = e.message;
    }
    results.push({ group, route, status, ms: Date.now() - t0, note });
  }
}

let pass = 0, redir = 0, fail = 0, lastGroup = "";
for (const r of results) {
  if (r.group !== lastGroup) { console.log("\n### " + r.group); lastGroup = r.group; }
  const ok = r.status >= 200 && r.status < 300;
  const isRedir = r.status >= 300 && r.status < 400;
  const verdict = ok ? "PASS" : isRedir ? "REDIR" : "FAIL";
  if (ok) pass++; else if (isRedir) redir++; else fail++;
  console.log(
    `${verdict.padEnd(5)} ${String(r.status).padStart(4)}  ${String(r.ms).padStart(5)}ms  ${r.route}` +
    (r.note ? `  <${r.note}>` : "")
  );
}

console.log(`\nTOTAL ${results.length}  PASS ${pass}  REDIR ${redir}  FAIL ${fail}`);

// In mock mode a REDIR means a route unexpectedly bounced (e.g. middleware not
// in mock mode) — treat as a non-pass. Any FAIL or REDIR fails the gate.
if (fail > 0 || redir > 0) {
  console.error(`\n✗ System test FAILED — ${fail} failing, ${redir} redirecting route(s).`);
  process.exit(1);
}
console.log("\n✓ System test PASSED — every nav route rendered (HTTP 200).");

import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { History, GitBranch, Package, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const BUILD_LOG = [
  { version: "v0.9.0", date: "2026-06-17", type: "minor", deployed: true,  note: "Live Supabase reads — CAPA, Incidents, Chemicals, Audits, Risk, Waste, Equipment, Training", author: "Build System" },
  { version: "v0.8.0", date: "2026-06-17", type: "minor", deployed: true,  note: "Login screen with demo user picker, AuthGuard, sign-out",  author: "Build System" },
  { version: "v0.7.0", date: "2026-06-17", type: "minor", deployed: true,  note: "Live forms & modals for CAPA, incidents, audits",          author: "Build System" },
  { version: "v0.6.4", date: "2026-06-17", type: "patch", deployed: true,  note: "Three-tier navigation, missing SA pages built",            author: "Build System" },
  { version: "v0.6.3", date: "2026-06-14", type: "minor", deployed: true,  note: "Enhanced KPI cards with strips, icons, trend indicators",  author: "Build System" },
  { version: "v0.6.2", date: "2026-06-10", type: "patch", deployed: true,  note: "TopBar refactored to full-width, brand removed from nav",  author: "Build System" },
  { version: "v0.6.1", date: "2026-06-05", type: "patch", deployed: true,  note: "Fixed Severity / RiskLevel / CapaStatus type mismatches",  author: "Build System" },
  { version: "v0.6.0", date: "2026-05-28", type: "minor", deployed: true,  note: "Maco Platform adaptation from Amaya — EHS module suite",   author: "Build System" },
  { version: "v0.5.2", date: "2026-05-15", type: "patch", deployed: true,  note: "Waste & Monitoring pages, Chemical Management complete",   author: "Build System" },
  { version: "v0.5.1", date: "2026-05-08", type: "patch", deployed: true,  note: "P-Engine AI integration, AI Findings page",                author: "Build System" },
  { version: "v0.5.0", date: "2026-04-30", type: "major", deployed: true,  note: "Multi-tenant architecture, BioStar demo environment",      author: "Build System" },
  { version: "v0.4.0", date: "2026-04-10", type: "major", deployed: false, note: "SA admin suite — Companies, Templates, Implementation",    author: "Build System" },
];

const UPCOMING = [
  { version: "v1.0.0", eta: "2026-08-15", scope: "Production deploy, first client onboarding" },
];

function typeColor(t: string) {
  if (t === "major") return "bg-blue-100 text-blue-700";
  if (t === "minor") return "bg-teal-100 text-teal-700";
  return "bg-slate-100 text-slate-600";
}

export default function BuildHistoryPage() {
  return (
    <div className="flex flex-col overflow-hidden h-full">
      <PageHeader
        title="Build History"
        subtitle="Platform version log, deployment status, and upcoming release roadmap"
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Current Version", value: "v0.9.0", sub: "Deployed Jun 17",   color: "text-blue-700",    bg: "bg-blue-50 border-blue-100" },
            { label: "Releases (2026)", value: "12",     sub: "All stable",         color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
            { label: "Next Release",    value: "v1.0",   sub: "ETA Aug 15",         color: "text-purple-700",  bg: "bg-purple-50 border-purple-100" },
            { label: "Launch Target",   value: "v1.0",   sub: "Aug 15, 2026",       color: "text-amber-700",   bg: "bg-amber-50 border-amber-100" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <Card>
              <CardHeader title="Build History" subtitle="All platform releases" right={<GitBranch className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Version", "Date", "Type", "Status", "Release Notes", "Author"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {BUILD_LOG.map((b) => (
                      <tr key={b.version} className={`hover:bg-slate-50/60 ${b.version === "v0.9.0" ? "bg-blue-50/40" : ""}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-mono text-[12px] font-bold text-slate-800">{b.version}</span>
                            {b.version === "v0.9.0" && <Pill className="bg-blue-600 text-white" style={{ fontSize: "9px" }}>CURRENT</Pill>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{b.date}</td>
                        <td className="px-4 py-2.5"><Pill className={typeColor(b.type)}>{b.type}</Pill></td>
                        <td className="px-4 py-2.5">
                          {b.deployed
                            ? <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Deployed</span>
                            : <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Clock className="h-3.5 w-3.5" /> Not deployed</span>}
                        </td>
                        <td className="px-4 py-2.5 max-w-[220px]">
                          <div className="truncate text-xs text-slate-700">{b.note}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{b.author}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader title="Release Roadmap" subtitle="Upcoming builds" right={<History className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-slate-50">
                {UPCOMING.map((u) => (
                  <div key={u.version} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-slate-800">{u.version}</span>
                      <span className="text-[10.5px] font-semibold text-blue-600">ETA {u.eta}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 leading-relaxed">{u.scope}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Build Status" subtitle="Current environment" />
              <div className="divide-y divide-slate-50">
                {[
                  { label: "Dev server", status: "Running", ok: true },
                  { label: "Live Supabase data", status: "Active", ok: true },
                  { label: "Auth (login screen)", status: "Active", ok: true },
                  { label: "TypeScript errors", status: "0", ok: true },
                  { label: "Next.js version", status: "15.1.3", ok: true },
                  { label: "Production deploy", status: "Target v1.0", ok: null },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 px-4 py-2.5">
                    {item.ok === true  && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                    {item.ok === null  && <Clock className="h-4 w-4 shrink-0 text-amber-500" />}
                    {item.ok === false && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
                    <div className="flex-1 text-xs text-slate-700">{item.label}</div>
                    <div className={`text-[11px] font-semibold ${item.ok === true ? "text-emerald-600" : "text-amber-500"}`}>{item.status}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

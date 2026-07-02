import { DarkPageHeader, DarkCard, DarkCardHeader, Pill } from "@/components/ui/primitives";
import { History, GitBranch, Package, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { MOCK_MODE } from "@/lib/env";

const MOCK_BUILD_LOG = [
  { version: "v0.9.0", date: "2026-06-17", type: "minor", deployed: true,  note: "Live Supabase reads — CAPA, Incidents, Chemicals, Audits, Risk, Waste, Equipment, Training", author: "Build System" },
  { version: "v0.8.0", date: "2026-06-17", type: "minor", deployed: true,  note: "Login screen with demo user picker, AuthGuard, sign-out",  author: "Build System" },
  { version: "v0.7.0", date: "2026-06-17", type: "minor", deployed: true,  note: "Live forms & modals for CAPA, incidents, audits",          author: "Build System" },
  { version: "v0.6.4", date: "2026-06-17", type: "patch", deployed: true,  note: "Three-tier navigation, missing SA pages built",            author: "Build System" },
  { version: "v0.6.3", date: "2026-06-14", type: "minor", deployed: true,  note: "Enhanced KPI cards with strips, icons, trend indicators",  author: "Build System" },
  { version: "v0.6.2", date: "2026-06-10", type: "patch", deployed: true,  note: "TopBar refactored to full-width, brand removed from nav",  author: "Build System" },
  { version: "v0.6.1", date: "2026-06-05", type: "patch", deployed: true,  note: "Fixed Severity / RiskLevel / CapaStatus type mismatches",  author: "Build System" },
  { version: "v0.6.0", date: "2026-05-28", type: "minor", deployed: true,  note: "Platform rebrand and EHS module suite adaptation",        author: "Build System" },
  { version: "v0.5.2", date: "2026-05-15", type: "patch", deployed: true,  note: "Waste & Monitoring pages, Chemical Management complete",   author: "Build System" },
  { version: "v0.5.1", date: "2026-05-08", type: "patch", deployed: true,  note: "P-Engine AI integration, AI Findings page",                author: "Build System" },
  { version: "v0.5.0", date: "2026-04-30", type: "major", deployed: true,  note: "Multi-tenant architecture, BioStar demo environment",      author: "Build System" },
  { version: "v0.4.0", date: "2026-04-10", type: "major", deployed: false, note: "SA admin suite — Companies, Templates, Implementation",    author: "Build System" },
];

const MOCK_UPCOMING = [
  { version: "v1.0.0", eta: "2026-08-15", scope: "Production deploy, first client onboarding" },
];

// No release-tracking backend yet — demo changelog only in MOCK_MODE; empty in prod.
const BUILD_LOG = MOCK_MODE ? MOCK_BUILD_LOG : [];
const UPCOMING  = MOCK_MODE ? MOCK_UPCOMING : [];

const currentBuild = BUILD_LOG.find(b => b.deployed) ?? null;
const nextBuild    = UPCOMING[0] ?? null;
const MOCK_BUILD_STATUS: { label: string; status: string; ok: boolean | null }[] = [
  { label: "Dev server", status: "Running", ok: true },
  { label: "Live Supabase data", status: "Active", ok: true },
  { label: "Auth (login screen)", status: "Active", ok: true },
  { label: "TypeScript errors", status: "0", ok: true },
  { label: "Next.js version", status: "15.1.3", ok: true },
  { label: "Production deploy", status: "Target v1.0", ok: null },
];
const BUILD_STATUS = MOCK_MODE ? MOCK_BUILD_STATUS : [];

const HISTORY_KPIS = [
  { label: "Current Version", value: currentBuild?.version ?? "—", sub: currentBuild ? `Deployed ${currentBuild.date}` : "No deploys recorded", color: "text-blue-400",    bg: "bg-blue-900/20 border-blue-800/50" },
  { label: "Releases Logged", value: String(BUILD_LOG.length),     sub: BUILD_LOG.length ? "All recorded" : "None yet",                       color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-800/50" },
  { label: "Next Release",    value: nextBuild?.version ?? "—",    sub: nextBuild ? `ETA ${nextBuild.eta}` : "Not scheduled",                  color: "text-purple-300",  bg: "bg-purple-900/20 border-purple-800/50" },
  { label: "Deployed",        value: String(BUILD_LOG.filter(b => b.deployed).length), sub: "Live releases",                                  color: "text-amber-400",   bg: "bg-amber-900/20 border-amber-800/50" },
];

function typeColor(t: string) {
  if (t === "major") return "bg-blue-900/50 text-blue-300";
  if (t === "minor") return "bg-emerald-900/50 text-emerald-300";
  return "bg-slate-800 text-slate-400";
}

export default function BuildHistoryPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DarkPageHeader
        title="Build History"
        subtitle="Platform version log, deployment status, and upcoming release roadmap"
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {HISTORY_KPIS.map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <DarkCard>
              <DarkCardHeader title="Build History" subtitle="All platform releases" right={<GitBranch className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/5 bg-slate-800/40">
                    <tr>
                      {["Version", "Date", "Type", "Status", "Release Notes", "Author"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {BUILD_LOG.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                          No releases logged yet — this view will populate once release tracking is connected.
                        </td>
                      </tr>
                    )}
                    {BUILD_LOG.map((b) => (
                      <tr key={b.version} className={`hover:bg-white/4 ${b.version === currentBuild?.version ? "bg-blue-900/20" : ""}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-mono text-[12px] font-bold text-white">{b.version}</span>
                            {b.version === currentBuild?.version && <Pill className="bg-blue-600 text-white" style={{ fontSize: "9px" }}>CURRENT</Pill>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-300">{b.date}</td>
                        <td className="px-4 py-2.5"><Pill className={typeColor(b.type)}>{b.type}</Pill></td>
                        <td className="px-4 py-2.5">
                          {b.deployed
                            ? <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Deployed</span>
                            : <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Clock className="h-3.5 w-3.5" /> Not deployed</span>}
                        </td>
                        <td className="px-4 py-2.5 max-w-[220px]">
                          <div className="truncate text-xs text-slate-200">{b.note}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{b.author}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DarkCard>
          </div>

          <div className="flex flex-col gap-5">
            <DarkCard>
              <DarkCardHeader title="Release Roadmap" subtitle="Upcoming builds" right={<History className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-white/5">
                {UPCOMING.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">No upcoming releases scheduled.</div>
                )}
                {UPCOMING.map((u) => (
                  <div key={u.version} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-white">{u.version}</span>
                      <span className="text-[11px] font-semibold text-blue-400">ETA {u.eta}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400 leading-relaxed">{u.scope}</div>
                  </div>
                ))}
              </div>
            </DarkCard>

            <DarkCard>
              <DarkCardHeader title="Build Status" subtitle="Current environment" />
              <div className="divide-y divide-white/5">
                {BUILD_STATUS.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    No environment status yet — this view will populate once build telemetry is connected.
                  </div>
                )}
                {BUILD_STATUS.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 px-4 py-2.5">
                    {item.ok === true  && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                    {item.ok === null  && <Clock className="h-4 w-4 shrink-0 text-amber-400" />}
                    {item.ok === false && <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />}
                    <div className="flex-1 text-xs text-slate-200">{item.label}</div>
                    <div className={`text-[11px] font-semibold ${item.ok === true ? "text-emerald-400" : "text-amber-400"}`}>{item.status}</div>
                  </div>
                ))}
              </div>
            </DarkCard>
          </div>
        </div>
      </div>
    </div>
  );
}

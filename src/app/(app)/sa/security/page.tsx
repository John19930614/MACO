import { DarkPageHeader, DarkCard, DarkCardHeader, Pill } from "@/components/ui/primitives";
import { Lock, ShieldCheck, Users, Key, AlertTriangle, CheckCircle2, Clock, Globe } from "lucide-react";
import { MOCK_MODE } from "@/lib/env";

const MOCK_AUDIT_LOG = [
  { event: "User login", user: "Sarah Chen", company: "BioStar Research Inc.", ip: "203.0.113.45", time: "2026-06-17 09:14", status: "success" },
  { event: "Document export", user: "Sarah Chen", company: "BioStar Research Inc.", ip: "203.0.113.45", time: "2026-06-17 09:02", status: "success" },
  { event: "Failed login (3x)", user: "unknown", company: "Nexgen Pharma Ltd.", ip: "198.51.100.22", time: "2026-06-16 23:41", status: "blocked" },
  { event: "Admin role assigned", user: "Maria Lopez", company: "Platform", ip: "10.0.0.5", time: "2026-06-16 15:30", status: "success" },
  { event: "Tenant data export", user: "Maria Lopez", company: "Platform", ip: "10.0.0.5", time: "2026-06-16 14:12", status: "success" },
  { event: "Password reset", user: "Dr. Kim Park", company: "BioStar Research Inc.", ip: "203.0.113.45", time: "2026-06-15 11:05", status: "success" },
];

const MOCK_TENANTS_STATUS = [
  { name: "BioStar Research Inc.", mfa: true, sso: false, last_login: "2026-06-17", users: 14, status: "active" },
  { name: "Nexgen Pharma Ltd.",    mfa: true, sso: true,  last_login: "2026-06-16", users: 22, status: "active" },
  { name: "LabCore Diagnostics",   mfa: false, sso: false, last_login: "2026-06-14", users: 8,  status: "active" },
  { name: "MedTech Solutions",     mfa: true, sso: false, last_login: "2026-06-10", users: 11, status: "active" },
];

// No security-telemetry backend yet — demo data only in MOCK_MODE; empty in prod.
const AUDIT_LOG      = MOCK_MODE ? MOCK_AUDIT_LOG : [];
const TENANTS_STATUS = MOCK_MODE ? MOCK_TENANTS_STATUS : [];

// Live KPIs are derived from the (possibly empty) telemetry above; in production
// these read 0 until a real audit/security feed is wired in.
const mfaPct        = TENANTS_STATUS.length
  ? Math.round((TENANTS_STATUS.filter(t => t.mfa).length / TENANTS_STATUS.length) * 100)
  : 0;
const ssoCount      = TENANTS_STATUS.filter(t => t.sso).length;
const blockedEvents = AUDIT_LOG.filter(e => e.status === "blocked").length;

const MOCK_SECURITY_SETTINGS: { label: string; value: string; ok: boolean | null }[] = [
  { label: "MFA enforcement",        value: "Required for admin", ok: true },
  { label: "Session timeout",         value: "8 hours",           ok: true },
  { label: "Password policy",         value: "12 char min, MFA",  ok: true },
  { label: "IP allowlisting",         value: "Disabled",          ok: null },
  { label: "Data encryption at rest", value: "AES-256",           ok: true },
  { label: "TLS version",             value: "TLS 1.3",           ok: true },
  { label: "SOC 2 audit",             value: "Due Aug 2026",      ok: null },
];
const SECURITY_SETTINGS = MOCK_MODE ? MOCK_SECURITY_SETTINGS : [];

const MOCK_API_KEYS = [
  { name: "Supabase — Main DB", status: "configured", last: "Jun 10" },
  { name: "Anthropic / AI Engine (Claude)", status: "configured", last: "Jun 5" },
  { name: "SendGrid (Email)", status: "error", last: "Jun 16" },
  { name: "AWS S3 (Documents)", status: "configured", last: "May 28" },
];
const API_KEYS = MOCK_MODE ? MOCK_API_KEYS : [];

const SECURITY_KPIS = [
  { label: "Active Tenants",      value: String(TENANTS_STATUS.length), sub: TENANTS_STATUS.length ? "All healthy" : "No data", color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-800/50" },
  { label: "MFA Enabled",         value: `${mfaPct}%`,                  sub: `${TENANTS_STATUS.filter(t => t.mfa).length} of ${TENANTS_STATUS.length} tenants`, color: "text-blue-400", bg: "bg-blue-900/20 border-blue-800/50" },
  { label: "Blocked Events",      value: String(blockedEvents),         sub: "From audit log",     color: "text-red-400",    bg: "bg-red-900/20 border-red-800/50" },
  { label: "SSO Tenants",         value: String(ssoCount),              sub: "SSO/SAML enabled",   color: "text-purple-300", bg: "bg-purple-900/20 border-purple-800/50" },
];

function eventColor(s: string) {
  if (s === "success") return "bg-emerald-900/50 text-emerald-300";
  if (s === "blocked") return "bg-red-900/50 text-red-300";
  return "bg-amber-900/50 text-amber-300";
}

export default function SecurityPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DarkPageHeader
        title="Security & System Settings"
        subtitle="Platform-wide security configuration, access logs, and tenant security posture"
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {SECURITY_KPIS.map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
              <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            {/* Audit log */}
            <DarkCard>
              <DarkCardHeader title="Security Audit Log" subtitle="Recent access and system events" right={<Globe className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/5 bg-slate-800/40">
                    <tr>
                      {["Event", "User", "Company", "IP", "Time", "Status"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {AUDIT_LOG.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                          No audit events yet — this view will populate once a security audit feed is connected.
                        </td>
                      </tr>
                    )}
                    {AUDIT_LOG.map((e, i) => (
                      <tr key={i} className="hover:bg-white/4">
                        <td className="px-4 py-2.5 text-xs font-medium text-white">{e.event}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-300">{e.user}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{e.company}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{e.ip}</td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-400">{e.time}</td>
                        <td className="px-4 py-2.5"><Pill className={eventColor(e.status)}>{e.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DarkCard>

            {/* Tenant security */}
            <DarkCard>
              <DarkCardHeader title="Tenant Security Posture" subtitle="MFA, SSO, and last activity per tenant" right={<Users className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/5 bg-slate-800/40">
                    <tr>
                      {["Company", "Users", "MFA", "SSO", "Last Login", "Status"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {TENANTS_STATUS.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                          No tenant security data yet.
                        </td>
                      </tr>
                    )}
                    {TENANTS_STATUS.map((t) => (
                      <tr key={t.name} className="hover:bg-white/4">
                        <td className="px-4 py-2.5 text-xs font-medium text-white">{t.name}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-300">{t.users}</td>
                        <td className="px-4 py-2.5">
                          {t.mfa
                            ? <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" />On</span>
                            : <span className="flex items-center gap-1 text-[11px] text-red-400 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Off</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {t.sso
                            ? <span className="flex items-center gap-1 text-[11px] text-blue-400 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" />On</span>
                            : <span className="text-[11px] text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{t.last_login}</td>
                        <td className="px-4 py-2.5"><Pill className="bg-emerald-900/50 text-emerald-300">{t.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DarkCard>
          </div>

          <div className="flex flex-col gap-5">
            <DarkCard>
              <DarkCardHeader title="Security Settings" subtitle="Platform-wide configuration" right={<Lock className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-white/5">
                {SECURITY_SETTINGS.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    No security configuration data yet — this view will populate once platform security settings are wired.
                  </div>
                )}
                {SECURITY_SETTINGS.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 px-4 py-2.5">
                    {item.ok === true  && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />}
                    {item.ok === null  && <Clock className="h-4 w-4 shrink-0 text-amber-400" />}
                    {item.ok === false && <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />}
                    <div className="flex-1 text-xs text-slate-200">{item.label}</div>
                    <div className={`text-[11px] font-semibold ${item.ok ? "text-emerald-400" : "text-amber-400"}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </DarkCard>

            <DarkCard>
              <DarkCardHeader title="API Keys" subtitle="Platform integrations" right={<Key className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-white/5">
                {API_KEYS.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    No integration status yet — this view will populate once integration health checks are connected.
                  </div>
                )}
                {API_KEYS.map((k) => (
                  <div key={k.name} className="flex items-center gap-2.5 px-3 py-2.5">
                    <Key className={`h-4 w-4 shrink-0 ${k.status === "error" ? "text-red-400" : "text-emerald-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] font-medium text-white">{k.name}</div>
                      <div className="text-[11px] text-slate-400">Last verified {k.last}</div>
                    </div>
                    <Pill className={k.status === "error" ? "bg-red-900/50 text-red-300" : "bg-emerald-900/50 text-emerald-300"}>
                      {k.status}
                    </Pill>
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

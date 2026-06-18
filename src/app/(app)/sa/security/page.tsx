import { PageHeader, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { Lock, ShieldCheck, Users, Key, AlertTriangle, CheckCircle2, Clock, Globe } from "lucide-react";

const AUDIT_LOG = [
  { event: "User login", user: "Sarah Chen", company: "BioStar Research Inc.", ip: "203.0.113.45", time: "2026-06-17 09:14", status: "success" },
  { event: "Document export", user: "Sarah Chen", company: "BioStar Research Inc.", ip: "203.0.113.45", time: "2026-06-17 09:02", status: "success" },
  { event: "Failed login (3x)", user: "unknown", company: "Nexgen Pharma Ltd.", ip: "198.51.100.22", time: "2026-06-16 23:41", status: "blocked" },
  { event: "Admin role assigned", user: "Maria Lopez", company: "Platform", ip: "10.0.0.5", time: "2026-06-16 15:30", status: "success" },
  { event: "Tenant data export", user: "Maria Lopez", company: "Platform", ip: "10.0.0.5", time: "2026-06-16 14:12", status: "success" },
  { event: "Password reset", user: "Dr. Kim Park", company: "BioStar Research Inc.", ip: "203.0.113.45", time: "2026-06-15 11:05", status: "success" },
];

const TENANTS_STATUS = [
  { name: "BioStar Research Inc.", mfa: true, sso: false, last_login: "2026-06-17", users: 14, status: "active" },
  { name: "Nexgen Pharma Ltd.",    mfa: true, sso: true,  last_login: "2026-06-16", users: 22, status: "active" },
  { name: "LabCore Diagnostics",   mfa: false, sso: false, last_login: "2026-06-14", users: 8,  status: "active" },
  { name: "MedTech Solutions",     mfa: true, sso: false, last_login: "2026-06-10", users: 11, status: "active" },
];

function eventColor(s: string) {
  if (s === "success") return "bg-emerald-100 text-emerald-700";
  if (s === "blocked") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

export default function SecurityPage() {
  return (
    <div className="flex flex-col overflow-hidden h-full">
      <PageHeader
        title="Security & System Settings"
        subtitle="Platform-wide security configuration, access logs, and tenant security posture"
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Active Tenants",      value: "4",   sub: "All healthy",         color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
            { label: "MFA Enabled",         value: "75%", sub: "3 of 4 tenants",      color: "text-blue-700",    bg: "bg-blue-50 border-blue-100" },
            { label: "Failed Logins (24h)", value: "3",   sub: "1 IP blocked",        color: "text-red-700",     bg: "bg-red-50 border-red-100" },
            { label: "SSO Tenants",         value: "1",   sub: "Nexgen Pharma",       color: "text-purple-700",  bg: "bg-purple-50 border-purple-100" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="mt-0.5 text-[10.5px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            {/* Audit log */}
            <Card>
              <CardHeader title="Security Audit Log" subtitle="Recent access and system events" right={<Globe className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Event", "User", "Company", "IP", "Time", "Status"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {AUDIT_LOG.map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{e.event}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{e.user}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{e.company}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{e.ip}</td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-500">{e.time}</td>
                        <td className="px-4 py-2.5"><Pill className={eventColor(e.status)}>{e.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Tenant security */}
            <Card>
              <CardHeader title="Tenant Security Posture" subtitle="MFA, SSO, and last activity per tenant" right={<Users className="h-4 w-4 text-slate-400" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Company", "Users", "MFA", "SSO", "Last Login", "Status"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {TENANTS_STATUS.map((t) => (
                      <tr key={t.name} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{t.name}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{t.users}</td>
                        <td className="px-4 py-2.5">
                          {t.mfa
                            ? <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" />On</span>
                            : <span className="flex items-center gap-1 text-[11px] text-red-500 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Off</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {t.sso
                            ? <span className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" />On</span>
                            : <span className="text-[11px] text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{t.last_login}</td>
                        <td className="px-4 py-2.5"><Pill className="bg-emerald-100 text-emerald-700">{t.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader title="Security Settings" subtitle="Platform-wide configuration" right={<Lock className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-slate-50">
                {[
                  { label: "MFA enforcement",        value: "Required for admin", ok: true },
                  { label: "Session timeout",         value: "8 hours",           ok: true },
                  { label: "Password policy",         value: "12 char min, MFA",  ok: true },
                  { label: "IP allowlisting",         value: "Disabled",          ok: null },
                  { label: "Data encryption at rest", value: "AES-256",           ok: true },
                  { label: "TLS version",             value: "TLS 1.3",           ok: true },
                  { label: "SOC 2 audit",             value: "Due Aug 2026",      ok: null },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 px-4 py-2.5">
                    {item.ok === true  && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />}
                    {item.ok === null  && <Clock className="h-4 w-4 shrink-0 text-amber-500" />}
                    {item.ok === false && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
                    <div className="flex-1 text-xs text-slate-700">{item.label}</div>
                    <div className={`text-[11px] font-semibold ${item.ok ? "text-emerald-600" : "text-amber-500"}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="API Keys" subtitle="Platform integrations" right={<Key className="h-4 w-4 text-slate-400" />} />
              <div className="divide-y divide-slate-50">
                {[
                  { name: "Supabase — Main DB", status: "configured", last: "Jun 10" },
                  { name: "OpenAI / AI Engine", status: "configured", last: "Jun 5" },
                  { name: "SendGrid (Email)", status: "error", last: "Jun 16" },
                  { name: "AWS S3 (Documents)", status: "configured", last: "May 28" },
                ].map((k) => (
                  <div key={k.name} className="flex items-center gap-2.5 px-3 py-2.5">
                    <Key className={`h-4 w-4 shrink-0 ${k.status === "error" ? "text-red-400" : "text-emerald-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] font-medium text-slate-800">{k.name}</div>
                      <div className="text-[10px] text-slate-400">Last verified {k.last}</div>
                    </div>
                    <Pill className={k.status === "error" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                      {k.status}
                    </Pill>
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

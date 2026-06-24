"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw, Users, MapPin, Bell, Plug, Building2, ShieldCheck, UserPlus } from "lucide-react";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { useDemoUser, DEMO_USERS } from "@/lib/context/demo-user";
import { MOCK_MODE } from "@/lib/env";
import type { Profile, Site } from "@/lib/types";

type SettingsTab = "company" | "users" | "sites" | "notifications" | "integrations";

const LS_KEY = "maco-settings-v1";

interface SettingsData {
  companyName:      string;
  industry:         string;
  primarySite:      string;
  jurisdiction:     string;
  ehsManager:       string;
  qualifiedEhs:     string;
  biosafetyOfficer: string;
  chOfficer:        string;
  emergencyCoord:   string;
  notifs: Record<string, boolean>;
}

const DEFAULT_NOTIFS: Record<string, boolean> = {
  "Overdue CAPAs":              true,
  "Audit reminders (7 days)":   true,
  "Training expiry (30 days)":  true,
  "SDS expiry (90 days)":       true,
  "P-Engine alerts":            true,
  "Equipment calibration due":  true,
  "Incident reports":           true,
  "Weekly digest":              false,
};

const DEFAULT_SETTINGS: Omit<SettingsData, "notifs"> = {
  companyName:      "Your Company",
  industry:         "",
  primarySite:      "",
  jurisdiction:     "",
  ehsManager:       "",
  qualifiedEhs:     "",
  biosafetyOfficer: "",
  chOfficer:        "",
  emergencyCoord:   "",
};

const BIOSTAR_DEFAULTS = {
  biosafetyOfficer: "Dr. Kim Park",
  chOfficer:        "Dr. Kim Park (designation pending)",
  emergencyCoord:   "Tom Reed",
};

// Platform-level configuration (true for every tenant) — not tenant-specific data.
const CONFIG_ROWS = [
  { label: "P-Engine Mode",    value: "Auto — runs daily at 02:00 UTC" },
  { label: "AI Provider",      value: "Anthropic Claude" },
  { label: "AI Model",         value: "claude-sonnet-4-6" },
  { label: "Compliance Basis", value: "Federal OSHA, EPA, NFPA, ANSI" },
  { label: "Training Cycle",   value: "Annual + role-based triggers" },
];

const INTEGRATIONS = [
  { name: "Supabase (Database)",   status: MOCK_MODE ? "Demo mode" : "Connected", color: MOCK_MODE ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700", action: false },
  { name: "Anthropic Claude API",  status: "Connected", color: "bg-emerald-100 text-emerald-700", action: false },
  { name: "SDS Management (SDS+)", status: "Not set up",color: "bg-slate-100 text-slate-500",    action: true  },
  { name: "LIMS Integration",      status: "Not set up",color: "bg-slate-100 text-slate-500",    action: true  },
  { name: "Payroll / HR System",   status: "Not set up",color: "bg-slate-100 text-slate-500",    action: true  },
  { name: "Email (SendGrid)",      status: "Not set up",color: "bg-slate-100 text-slate-500",    action: true  },
];

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <label className="w-52 shrink-0 pt-1.5 text-xs font-medium text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
      />
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", ehs_manager: "EHS Manager", ehs_coordinator: "EHS Coordinator",
  field_officer: "Field Officer", viewer: "Viewer",
};
const ROLE_COLOR: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700", ehs_manager: "bg-blue-100 text-blue-700",
  ehs_coordinator: "bg-teal-100 text-teal-700", field_officer: "bg-amber-100 text-amber-700",
  viewer: "bg-slate-100 text-slate-500",
};

const BIOSTAR_SITES = [
  {
    id: "site-main", name: "Main Campus — Building A", address: "412 Research Drive, Princeton, NJ 08540",
    bsl: "BSL-1 / BSL-2", sqft: "28,400 sq ft", contact: "Tom Reed", phone: "(609) 555-0142",
    type: "Laboratory / Office", status: "Active",
  },
  {
    id: "site-annex", name: "Annex Storage Facility", address: "418 Research Drive, Princeton, NJ 08540",
    bsl: "N/A", sqft: "4,200 sq ft", contact: "James Wu", phone: "(609) 555-0198",
    type: "Hazardous Materials Storage", status: "Active",
  },
];

export function SettingsClient({
  serverProfiles = [],
  serverSites    = [],
}: {
  serverProfiles?: Profile[];
  serverSites?:    Site[];
}) {
  const { user, setUser } = useDemoUser();
  const [tab, setTab] = useState<SettingsTab>("company");
  const [data, setData]         = useState<SettingsData>({
    ...DEFAULT_SETTINGS,
    ...(user.tenant_id === "t-biostar-001" ? BIOSTAR_DEFAULTS : {}),
    companyName:  user.company,
    primarySite:  `${user.company.split(" ")[0]} Main Campus`,
    ehsManager:   user.display_name,
    qualifiedEhs: user.display_name,
    notifs: { ...DEFAULT_NOTIFS },
  });
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [soundsMuted, setSoundsMuted] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SettingsData>;
        setData((d) => ({
          ...d,
          ...parsed,
          notifs: { ...DEFAULT_NOTIFS, ...(parsed.notifs ?? {}) },
        }));
      }
      setSoundsMuted(localStorage.getItem("safetyiq_sounds_muted") === "true");
    } catch {
      // ignore corrupt storage
    }
  }, []);

  // Re-seed company fields whenever the demo user/tenant switches
  useEffect(() => {
    const isBioStar = user.tenant_id === "t-biostar-001";
    setData((d) => ({
      ...d,
      companyName:  user.company,
      primarySite:  `${user.company.split(" ")[0]} Main Campus`,
      ehsManager:   user.display_name,
      qualifiedEhs: user.display_name,
      ...(isBioStar ? BIOSTAR_DEFAULTS : {
        biosafetyOfficer: "",
        chOfficer:        "",
        emergencyCoord:   "",
      }),
    }));
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key: keyof Omit<SettingsData, "notifs">, value: string) {
    setData((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function toggleNotif(label: string) {
    setData((d) => ({ ...d, notifs: { ...d.notifs, [label]: !d.notifs[label] } }));
    setSaved(false);
  }

  function toggleSounds() {
    const next = !soundsMuted;
    setSoundsMuted(next);
    try { localStorage.setItem("safetyiq_sounds_muted", next ? "true" : "false"); } catch {}
  }

  async function handleReset() {
    if (!confirm("Reset all demo data to its initial state? This clears any incidents, CAPAs, or documents you added during this session.")) return;
    setResetting(true);
    try {
      await fetch("/api/dev/reset", { method: "POST" });
      // Clear browser-side demo state
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem("maco-settings-v1");
      localStorage.removeItem("safetyiq_sounds_muted");
    } finally {
      setResetting(false);
      window.location.href = "/dashboard";
    }
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "company",       label: "Company",        icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: "users",         label: "Users & Roles",  icon: <Users className="h-3.5 w-3.5" /> },
    { id: "sites",         label: "Sites",          icon: <MapPin className="h-3.5 w-3.5" /> },
    { id: "notifications", label: "Notifications",  icon: <Bell className="h-3.5 w-3.5" /> },
    { id: "integrations",  label: "Integrations",   icon: <Plug className="h-3.5 w-3.5" /> },
  ];

  const visibleUsers = MOCK_MODE
    ? DEMO_USERS.filter(u => u.tenant_id === user.tenant_id)
    : serverProfiles.map(p => ({
        id:           p.id,
        display_name: p.display_name,
        email:        "",
        job_title:    p.job_title ?? "—",
        role:         p.role,
        tenant_id:    p.tenant_id ?? "",
        company:      "",
        is_reliance:  p.tenant_id === null,
      }));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Company Settings"
        subtitle="Company profile, site configuration, notifications, and integrations"
        actions={
          tab === "company" ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : saved ? (
                <><Check className="h-4 w-4" /> Saved</>
              ) : (
                "Save changes"
              )}
            </button>
          ) : tab === "users" ? (
            <button
              type="button"
              onClick={() => alert("User invitations are managed by Reliance. Contact your SA to add or remove users.")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <UserPlus className="h-4 w-4" /> Invite user
            </button>
          ) : tab === "sites" ? (
            <button
              type="button"
              onClick={() => alert("Site management is configured by Reliance. Contact your SA to add or modify sites.")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <MapPin className="h-4 w-4" /> Add site
            </button>
          ) : null
        }
      />

      {/* Tab bar */}
      <div className="flex shrink-0 gap-0 border-b border-slate-200 bg-white px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="iq-scroll flex-1 overflow-y-auto p-6">

        {/* ── Company tab ── */}
        {tab === "company" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Company Profile" subtitle="Edit and save to persist across sessions" />
              <div className="space-y-3 p-4">
                <Field label="Company Name"          value={data.companyName}      onChange={(v) => setField("companyName", v)} />
                <Field label="Industry"              value={data.industry}         onChange={(v) => setField("industry", v)} />
                <Field label="Primary Site"          value={data.primarySite}      onChange={(v) => setField("primarySite", v)} />
                <Field label="Jurisdiction"          value={data.jurisdiction}     onChange={(v) => setField("jurisdiction", v)} />
                <Field label="EHS Manager"           value={data.ehsManager}       onChange={(v) => setField("ehsManager", v)} />
                <Field label="Qualified EHS Person"  value={data.qualifiedEhs}     onChange={(v) => setField("qualifiedEhs", v)} />
                <Field label="Biosafety Officer"     value={data.biosafetyOfficer} onChange={(v) => setField("biosafetyOfficer", v)} />
                <Field label="Chemical Hygiene Officer" value={data.chOfficer}     onChange={(v) => setField("chOfficer", v)} />
                <Field label="Emergency Coordinator" value={data.emergencyCoord}   onChange={(v) => setField("emergencyCoord", v)} />
              </div>
            </Card>

            <Card>
              <CardHeader title="EHS Program Configuration" subtitle="Managed by Reliance — contact SA to change" />
              <div className="space-y-4 p-4">
                {CONFIG_ROWS.map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-44 shrink-0 text-xs font-medium text-slate-500">{label}</div>
                    <div className="rounded bg-slate-50 px-2 py-0.5 font-mono text-sm text-slate-700">{value}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Personal Preferences" subtitle="Per-user settings saved in this browser" />
              <div className="divide-y divide-slate-50 px-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm text-slate-700">Sound Effects</div>
                    <div className="text-xs text-slate-400">Completion and progress tones</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!soundsMuted}
                    onClick={toggleSounds}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                      !soundsMuted ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${!soundsMuted ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="py-3">
                  <div className="text-sm text-slate-700 mb-1.5">Active Demo User</div>
                  <div className="mb-1 text-xs text-slate-400">Switch persona to explore role-based views</div>
                  <select
                    value={user.id}
                    onChange={(e) => {
                      const found = DEMO_USERS.find((u) => u.id === e.target.value);
                      if (found) setUser(found);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                  >
                    {DEMO_USERS.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name} — {u.job_title}</option>
                    ))}
                  </select>
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                    Logged in as <strong>{user.display_name}</strong> · {user.job_title}
                    {user.is_reliance && " · Reliance Admin"}
                  </div>
                </div>
                {MOCK_MODE && (
                  <div className="py-3">
                    <div className="text-sm text-slate-700 mb-1">Reset Demo Data</div>
                    <div className="mb-2 text-xs text-slate-400">Wipe all session changes and restore initial mock data</div>
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={resetting}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      {resetting ? "Resetting…" : "Reset demo data"}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Users & Roles tab ── */}
        {tab === "users" && (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Users & Roles"
                subtitle={`${visibleUsers.length} users in ${user.company}`}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 text-left">Name</th>
                      <th className="px-4 py-2.5 text-left">Email</th>
                      <th className="px-4 py-2.5 text-left">Title</th>
                      <th className="px-4 py-2.5 text-left">Role</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {visibleUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 shrink-0">
                              {u.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="font-medium text-slate-800">{u.display_name}</span>
                            {u.id === user.id && (
                              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">You</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{u.email}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{u.job_title}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_COLOR[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => alert(`Role management for ${u.display_name} is administered by Reliance. Contact your SA to change roles.`)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
                          >
                            Manage role
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader title="Role Permissions" subtitle="Platform role definitions — managed by Reliance" />
              <div className="divide-y divide-slate-50 px-4">
                {(Object.entries(ROLE_LABEL) as [string, string][]).map(([roleKey, roleLabel]) => (
                  <div key={roleKey} className="flex items-start gap-4 py-3">
                    <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${ROLE_COLOR[roleKey]}`}>{roleLabel}</span>
                    <p className="text-xs text-slate-500">
                      {roleKey === "admin" && "Full platform access — configure settings, manage users, view all tenants."}
                      {roleKey === "ehs_manager" && "Full EHS access — verify CAPAs, approve incidents, manage compliance. Cannot change billing."}
                      {roleKey === "ehs_coordinator" && "Create and update EHS records — incidents, audits, waste entries, training records. Cannot verify CAPAs."}
                      {roleKey === "field_officer" && "Submit incidents and training records. Read-only for most modules. Cannot access settings."}
                      {roleKey === "viewer" && "Read-only access to reports and dashboards. Cannot create or edit any record."}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── Sites tab ── */}
        {tab === "sites" && (
          <div className="space-y-4">
            {(MOCK_MODE
              ? BIOSTAR_SITES.map(s => ({
                  id:      s.id,
                  name:    s.name,
                  address: s.address,
                  detail1: { label: "Type",         value: s.type    },
                  detail2: { label: "BSL Level",    value: s.bsl     },
                  detail3: { label: "Site Contact", value: s.contact },
                }))
              : serverSites.map(s => ({
                  id:      s.id,
                  name:    s.name,
                  address: s.address ?? null,
                  detail1: { label: "Sector",  value: s.sector   ?? s.vertical ?? "—" },
                  detail2: { label: "Country", value: s.country  ?? "—" },
                  detail3: { label: "State",   value: s.state    ?? "—" },
                }))
            ).map(site => (
              <Card key={site.id}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
                        <h3 className="text-base font-bold text-slate-800">{site.name}</h3>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Active</span>
                      </div>
                      {site.address && <p className="mt-0.5 ml-6 text-sm text-slate-500">{site.address}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => alert("Site editing is managed by Reliance. Contact your SA to update site details.")}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:border-blue-300 hover:text-blue-600 shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 ml-6 sm:grid-cols-4">
                    {[site.detail1, site.detail2, site.detail3].map(({ label, value }) => (
                      <div key={label}>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                        <div className="mt-0.5 text-sm text-slate-700">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
            {!MOCK_MODE && serverSites.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <ShieldCheck className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-400">No sites configured yet</p>
                <p className="text-xs text-slate-300">Sites are added during onboarding or by your SA</p>
              </div>
            )}
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
              <ShieldCheck className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-400">Additional sites are added by Reliance during onboarding</p>
              <p className="text-xs text-slate-300">Contact your SA to register a new facility</p>
            </div>
          </div>
        )}

        {/* ── Notifications tab ── */}
        {tab === "notifications" && (
          <div className="max-w-lg">
            <Card>
              <CardHeader title="Notification Preferences" subtitle="Toggle which events send alerts" />
              <div className="divide-y divide-slate-50 px-4">
                {Object.entries(data.notifs).map(([label, on]) => (
                  <div key={label} className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-700">{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleNotif(label)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        on ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : saved ? <><Check className="h-4 w-4" /> Saved</> : "Save preferences"}
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* ── Integrations tab ── */}
        {tab === "integrations" && (
          <div className="max-w-lg">
            <Card>
              <CardHeader title="Integrations" subtitle="Connect external systems to SafetyIQ" />
              <div className="divide-y divide-slate-50 px-4">
                {INTEGRATIONS.map(({ name, status, color, action }) => (
                  <div key={name} className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-700">{name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{status}</span>
                      {action && (
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
                          onClick={() => alert("Integration setup coming soon — contact Reliance to configure.")}
                        >
                          Set up
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

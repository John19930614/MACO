import { currentUser } from "@/lib/data/ehsRepo";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";

export default async function SettingsPage() {
  const user = await currentUser();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Company Settings"
        subtitle="Company profile, site configuration, notifications, and integrations"
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Company Profile */}
          <Card>
            <CardHeader title="Company Profile" subtitle="BioStar Research Inc." />
            <div className="space-y-4 p-4">
              {[
                { label: "Company Name",         value: "BioStar Research Inc."            },
                { label: "Industry",             value: "Pharmaceutical / Biotechnology"   },
                { label: "Primary Site",         value: "BioStar Main Campus"              },
                { label: "Jurisdiction",         value: "Federal US, New Jersey"           },
                { label: "EHS Manager",          value: user.display_name                  },
                { label: "Qualified EHS Person", value: "Sarah Chen, CIH"                  },
                { label: "Biosafety Officer",    value: "Dr. Kim Park"                     },
                { label: "Chemical Hygiene Officer", value: "Dr. Kim Park (designation pending)" },
                { label: "Emergency Coordinator", value: "Tom Reed"                        },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-44 shrink-0 text-xs font-medium text-slate-500">{label}</div>
                  <div className="text-sm text-slate-800">{value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* EHS Program Config */}
          <Card>
            <CardHeader title="EHS Program Configuration" />
            <div className="space-y-4 p-4">
              {[
                { label: "PROMPT_VERSION",    value: "safetyiq-ehs-2026-06-17"      },
                { label: "P-Engine Mode",     value: "Auto — runs daily at 02:00 UTC" },
                { label: "AI Provider",       value: "Anthropic Claude"               },
                { label: "AI Model",          value: "claude-sonnet-4-6"              },
                { label: "Compliance Basis",  value: "Federal OSHA, EPA, NFPA, ANSI" },
                { label: "Waste Generator",   value: "Small Quantity Generator (SQG)" },
                { label: "BSL Level",         value: "BSL-1 and BSL-2"               },
                { label: "Training Cycle",    value: "Annual + role-based triggers"   },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-44 shrink-0 text-xs font-medium text-slate-500">{label}</div>
                  <div className="text-sm font-mono text-slate-700">{value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader title="Notification Preferences" />
            <div className="divide-y divide-slate-50 p-4">
              {[
                { label: "Overdue CAPAs",           on: true  },
                { label: "Audit reminders (7 days)", on: true  },
                { label: "Training expiry (30 days)", on: true },
                { label: "SDS expiry (90 days)",     on: true  },
                { label: "P-Engine alerts",          on: true  },
                { label: "Equipment calibration due", on: true  },
                { label: "Incident reports",         on: true  },
                { label: "Weekly digest",            on: false },
              ].map(({ label, on }) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-700">{label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {on ? "On" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Integrations */}
          <Card>
            <CardHeader title="Integrations" />
            <div className="divide-y divide-slate-50 p-4">
              {[
                { name: "Supabase (Database)",  status: "Demo mode",    color: "bg-amber-100 text-amber-700"   },
                { name: "Anthropic Claude API", status: "Connected",    color: "bg-emerald-100 text-emerald-700" },
                { name: "SDS Management (SDS+)", status: "Not set up",  color: "bg-slate-100 text-slate-500"   },
                { name: "LIMS Integration",     status: "Not set up",   color: "bg-slate-100 text-slate-500"   },
                { name: "Payroll / HR System",  status: "Not set up",   color: "bg-slate-100 text-slate-500"   },
                { name: "Email (SendGrid)",     status: "Not set up",   color: "bg-slate-100 text-slate-500"   },
              ].map(({ name, status, color }) => (
                <div key={name} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-700">{name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{status}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

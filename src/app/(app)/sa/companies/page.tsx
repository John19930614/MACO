import { PageHeader, Card, Pill } from "@/components/ui/primitives";

const MOCK_COMPANIES = [
  { id: "t-001", name: "BioStar Research Inc.",   industry: "Pharma / Biotech",  plan: "Professional", users: 12, status: "active",    implStatus: "live"        },
  { id: "t-002", name: "NovaChem Solutions",      industry: "Chemical Mfg",      plan: "Enterprise",   users: 34, status: "active",    implStatus: "onboarding"  },
  { id: "t-003", name: "GenTech Biopharma",       industry: "Biotech",           plan: "Professional", users: 8,  status: "active",    implStatus: "onboarding"  },
  { id: "t-004", name: "Meridian Diagnostics",    industry: "Clinical Lab",      plan: "Starter",      users: 5,  status: "active",    implStatus: "data_import" },
  { id: "t-005", name: "PharmaLink Corp",         industry: "API Manufacturing", plan: "Enterprise",   users: 0,  status: "prospect",  implStatus: "prospect"    },
];

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  prospect: "bg-blue-100 text-blue-700",
  churned:  "bg-slate-100 text-slate-500",
};

const IMPL_STYLE: Record<string, string> = {
  live:        "bg-emerald-100 text-emerald-700",
  onboarding:  "bg-amber-100 text-amber-700",
  data_import: "bg-blue-100 text-blue-700",
  prospect:    "bg-slate-100 text-slate-500",
};

export default function SACompaniesPage() {
  const active   = MOCK_COMPANIES.filter((c) => c.status === "active").length;
  const prospect = MOCK_COMPANIES.filter((c) => c.status === "prospect").length;
  const live     = MOCK_COMPANIES.filter((c) => c.implStatus === "live").length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Companies & Tenants"
        subtitle="All client organisations using SafetyIQ"
        actions={
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            + Add Company
          </button>
        }
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mb-5 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Active Tenants</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{active}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Prospects</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">{prospect}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Live on Platform</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{live}</div>
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Company</th>
                  <th className="px-4 py-2.5 text-left">Industry</th>
                  <th className="px-4 py-2.5 text-left">Plan</th>
                  <th className="px-4 py-2.5 text-center">Users</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Implementation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {MOCK_COMPANIES.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.industry}</td>
                    <td className="px-4 py-3">
                      <Pill className="bg-blue-50 text-blue-700 text-xs">{c.plan}</Pill>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{c.users}</td>
                    <td className="px-4 py-3">
                      <Pill className={STATUS_STYLE[c.status] ?? "bg-slate-100 text-slate-600"}>
                        {c.status}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className={IMPL_STYLE[c.implStatus] ?? "bg-slate-100 text-slate-600"}>
                        {c.implStatus.replace(/_/g, " ")}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

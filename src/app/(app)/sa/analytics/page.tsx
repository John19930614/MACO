import { PageHeader, Card, CardHeader, Stat } from "@/components/ui/primitives";

export default function SAAnalyticsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Analytics & Insights"
        subtitle="Platform-wide usage, compliance trends, and Reliance performance metrics"
      />
      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* Platform KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Active Tenants"     value={4}      hint="Live on platform"       />
          <Stat label="Total Users"        value={59}     hint="Across all tenants"      />
          <Stat label="P-Engine Runs"      value={142}    hint="Last 30 days"            />
          <Stat label="Avg Compliance"     value="79%"    hint="Across all tenants"      accent="#2563eb" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Tenant compliance overview */}
          <Card>
            <CardHeader title="Compliance by Tenant" />
            <div className="divide-y divide-slate-50">
              {[
                { name: "BioStar Research Inc.", score: 79, color: "bg-amber-500" },
                { name: "Meridian Diagnostics",  score: 88, color: "bg-emerald-500" },
                { name: "NovaChem Solutions",    score: 0,  color: "bg-slate-200", note: "Onboarding" },
                { name: "GenTech Biopharma",     score: 0,  color: "bg-slate-200", note: "Onboarding" },
              ].map((t) => (
                <div key={t.name} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{t.name}</span>
                    <span className="text-sm font-bold text-slate-800">
                      {t.score > 0 ? `${t.score}%` : t.note}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-1.5 rounded-full ${t.color}`}
                      style={{ width: `${t.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Module compliance averages */}
          <Card>
            <CardHeader title="Module Compliance — Platform Average" />
            <div className="divide-y divide-slate-50">
              {[
                { module: "Incidents",  score: 90 },
                { module: "Waste",      score: 88 },
                { module: "Documents",  score: 86 },
                { module: "Audits",     score: 82 },
                { module: "Training",   score: 78 },
                { module: "Chemical",   score: 74 },
                { module: "CAPA",       score: 68 },
                { module: "Legal",      score: 63 },
              ].map((m) => (
                <div key={m.module} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-xs text-slate-500 shrink-0">{m.module}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full ${m.score >= 85 ? "bg-emerald-500" : m.score >= 75 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${m.score}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-bold text-slate-700">{m.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

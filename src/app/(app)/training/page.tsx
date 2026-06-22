import { getTrainingCourses, getTrainingRecords, getProfiles, getChemicals } from "@/lib/data/ehsRepo";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";
import { PageHeader, Card, CardHeader } from "@/components/ui/primitives";
import { AddTrainingButton } from "./AddTrainingButton";
import { TrainingExportButton } from "./TrainingExportButton";
import { TrainingDashboard } from "./TrainingDashboard";

export default async function TrainingPage() {
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;
  const [courses, records, profiles, chemicals] = await Promise.all([
    getTrainingCourses(tenantId),
    getTrainingRecords(tenantId),
    getProfiles(tenantId),
    getChemicals(tenantId),
  ]);

  // â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const activeCourses = courses.filter((c) => c.active);
  const nowMs = Date.now();

  // Pass rate per active course, sorted lowest first
  const courseStats = activeCourses
    .map((c) => {
      const recs = records.filter((r) => r.course_id === c.id);
      const passed = recs.filter((r) => r.passed).length;
      return {
        id: c.id,
        title: c.title,
        passed,
        total: recs.length,
        pct: recs.length > 0 ? Math.round((passed / recs.length) * 100) : null,
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100));

  // Certificate expiry urgency buckets
  const certBuckets = [
    {
      label: "Expired",
      count: records.filter((r) => r.passed && r.expiry_date && new Date(r.expiry_date).getTime() < nowMs).length,
      cls: "bg-red-500", txt: "text-red-700",
    },
    {
      label: "Expiring < 30d",
      count: records.filter((r) => {
        if (!r.passed || !r.expiry_date) return false;
        const ms = new Date(r.expiry_date).getTime() - nowMs;
        return ms >= 0 && ms < 30 * 86400_000;
      }).length,
      cls: "bg-amber-400", txt: "text-amber-700",
    },
    {
      label: "Expiring 30â€“90d",
      count: records.filter((r) => {
        if (!r.passed || !r.expiry_date) return false;
        const ms = new Date(r.expiry_date).getTime() - nowMs;
        return ms >= 30 * 86400_000 && ms < 90 * 86400_000;
      }).length,
      cls: "bg-yellow-300", txt: "text-yellow-700",
    },
    {
      label: "Current (> 90d)",
      count: records.filter((r) => r.passed && r.expiry_date && new Date(r.expiry_date).getTime() - nowMs >= 90 * 86400_000).length,
      cls: "bg-emerald-400", txt: "text-emerald-700",
    },
    {
      label: "No Expiry",
      count: records.filter((r) => r.passed && !r.expiry_date).length,
      cls: "bg-slate-300", txt: "text-slate-500",
    },
  ].filter((b) => b.count > 0);

  // 12-month completion trend
  const months: { label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    months.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      count: records.filter((r) => {
        const rd = new Date(r.completed_date);
        return rd.getFullYear() === yr && rd.getMonth() === mo;
      }).length,
    });
  }
  const maxMonth = Math.max(...months.map((m) => m.count), 1);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Training & Competency"
        subtitle="Role-based training matrix, chemical-triggered assignments, expiring certifications, and completion reporting"
        actions={
          <div className="flex gap-2">
            <TrainingExportButton courses={courses} records={records} profiles={profiles} />
            <AddTrainingButton courses={courses} profiles={profiles.filter((p) => p.tenant_id !== null)} />
          </div>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">

        {/* Analytics strip */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Pass rate by course */}
          <Card>
            <CardHeader title="Pass Rate by Course" subtitle="Lowest first Â· active courses" />
            <div className="space-y-2 px-4 pb-4">
              {courseStats.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <div className="w-28 shrink-0 truncate text-[10px] text-slate-500">{c.title}</div>
                  <div className="flex-1 h-3.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${(c.pct ?? 0) >= 80 ? "bg-emerald-400" : (c.pct ?? 0) >= 60 ? "bg-amber-400" : "bg-red-500"}`}
                      style={{ width: `${Math.max(c.pct ?? 0, 5)}%` }}
                    />
                  </div>
                  <div className={`w-9 text-right text-xs font-bold ${(c.pct ?? 0) >= 80 ? "text-emerald-700" : (c.pct ?? 0) >= 60 ? "text-amber-700" : "text-red-700"}`}>
                    {c.pct !== null ? `${c.pct}%` : "â€”"}
                  </div>
                </div>
              ))}
              {courseStats.length === 0 && <div className="text-xs text-slate-400">No records yet.</div>}
            </div>
          </Card>

          {/* Cert expiry urgency */}
          <Card>
            <CardHeader title="Certificate Urgency" subtitle={`${records.filter((r) => r.passed).length} valid certs tracked`} />
            <div className="space-y-2 px-4 pb-4">
              {certBuckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.cls}`} />
                  <div className="flex-1 text-xs text-slate-600">{b.label}</div>
                  <div className={`text-xs font-bold ${b.txt}`}>{b.count}</div>
                </div>
              ))}
              {certBuckets.length === 0 && <div className="text-xs text-slate-400">No certificates yet.</div>}
            </div>
          </Card>

          {/* 12-month completion trend */}
          <Card>
            <CardHeader title="Completions â€” 12 Months" subtitle={`${records.length} total training records`} />
            <div className="px-4 pb-4">
              <svg viewBox="0 0 240 56" className="w-full">
                {months.map((m, i) => {
                  const barH = Math.max((m.count / maxMonth) * 44, m.count > 0 ? 4 : 0);
                  return (
                    <g key={i}>
                      <rect x={i * 20 + 2} y={44 - barH} width={16} height={barH} rx={2} fill="#3b82f6" opacity={0.7} />
                      <text x={i * 20 + 10} y={55} textAnchor="middle" fontSize="6" fill="#94a3b8">
                        {m.label.slice(0, 1)}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-slate-400">
                {months.map((m, i) => <span key={i}>{m.count > 0 ? m.count : ""}</span>)}
              </div>
            </div>
          </Card>

        </div>

        <TrainingDashboard
          courses={courses}
          records={records}
          profiles={profiles}
          chemicals={chemicals}
        />
      </div>
    </div>
  );
}


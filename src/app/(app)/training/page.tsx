import Link from "next/link";
import { getTrainingCourses, getTrainingRecords, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Stat, Card, CardHeader, Pill } from "@/components/ui/primitives";
import { AddTrainingButton } from "./AddTrainingButton";

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isExpired(s: string | null): boolean {
  if (!s) return false;
  return new Date(s) < new Date();
}

function isExpiringSoon(s: string | null): boolean {
  if (!s) return false;
  const d = new Date(s);
  const now = new Date();
  return d > now && d.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000;
}

export default async function TrainingPage() {
  const courses = await getTrainingCourses();
  const records = await getTrainingRecords();
  const profiles = await getProfiles();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const courseMap  = Object.fromEntries(courses.map((c) => [c.id, c]));

  const passed   = records.filter((r) => r.passed).length;
  const expired  = records.filter((r) => isExpired(r.expiry_date)).length;
  const expiring = records.filter((r) => isExpiringSoon(r.expiry_date)).length;
  const overdue  = expired + records.filter((r) => !r.passed).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Training & Competency"
        subtitle="EHS training courses, completion records, and certificate expiry tracking"
        actions={<AddTrainingButton courses={courses} profiles={profiles} />}
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Active Courses"     value={courses.filter((c) => c.active).length} hint="In curriculum" />
          <Stat label="Completions"        value={passed}     hint="Passed records"       accent="#10b981" />
          <Stat label="Expiring (30 days)" value={expiring}   hint="Certificates due"     accent={expiring > 0 ? "#f59e0b" : "#10b981"} />
          <Stat label="Expired / Failed"   value={overdue}    hint="Action required"      accent={overdue > 0 ? "#dc2626" : "#10b981"} />
        </div>

        {/* Alert for expired */}
        {expired > 0 && (
          <div className="mb-5 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-900">
              {expired} Training Certificate{expired > 1 ? "s" : ""} Expired — Re-enrolment Required
            </div>
            <div className="mt-0.5 text-xs text-red-700">
              Expired training may constitute a regulatory compliance gap under OSHA training requirements.
            </div>
          </div>
        )}

        {/* Courses */}
        <Card className="mb-5">
          <CardHeader title="Course Catalogue" subtitle={`${courses.length} courses`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Course</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Duration</th>
                  <th className="px-4 py-2.5 text-left">Validity</th>
                  <th className="px-4 py-2.5 text-left">Regulatory Ref.</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {courses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{c.title}</div>
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{c.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill className="bg-blue-50 text-blue-700 text-xs capitalize">
                        {c.course_type.replace(/_/g, " ")}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.duration_minutes} min</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.validity_period_days ? `${Math.round(c.validity_period_days / 365)} year` : "No expiry"}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{c.regulatory_ref ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Pill className={c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                        {c.active ? "Active" : "Inactive"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Training records */}
        <Card>
          <CardHeader
            title="Training Records"
            subtitle={`${records.length} completions · ${expired} expired · ${expiring} expiring`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 text-left">Employee</th>
                  <th className="px-4 py-2.5 text-left">Course</th>
                  <th className="px-4 py-2.5 text-left">Completed</th>
                  <th className="px-4 py-2.5 text-left">Expires</th>
                  <th className="px-4 py-2.5 text-left">Score</th>
                  <th className="px-4 py-2.5 text-left">Method</th>
                  <th className="px-4 py-2.5 text-left">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((r) => {
                  const expired_  = isExpired(r.expiry_date);
                  const expiring_ = isExpiringSoon(r.expiry_date);
                  const course    = courseMap[r.course_id];
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {profileMap[r.profile_id] ?? r.profile_id}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-56">
                        <Link href={`/training/${r.id}`} className="font-medium text-blue-600 hover:underline">
                          {course?.title ?? r.course_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600">{fmt(r.completed_date)}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        <span className={expired_ ? "font-semibold text-red-600" : expiring_ ? "font-semibold text-amber-600" : "text-slate-600"}>
                          {fmt(r.expiry_date)}
                        </span>
                        {expired_ && <div className="text-[10px] text-red-500 font-medium">EXPIRED</div>}
                        {expiring_ && !expired_ && <div className="text-[10px] text-amber-500 font-medium">Due soon</div>}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                        {r.score != null ? `${r.score}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 capitalize">
                        {r.delivery_method.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <Pill className={r.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                          {r.passed ? "Passed" : "Failed"}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      No training records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

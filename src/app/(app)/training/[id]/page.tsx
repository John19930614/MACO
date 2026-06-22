import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Award, Calendar, CheckCircle2, Clock, UserCircle, XCircle, BookOpen, AlertTriangle } from "lucide-react";
import { getTrainingRecordById, getTrainingCourses, getProfiles } from "@/lib/data/ehsRepo";
import { Card, CardHeader, Pill } from "@/components/ui/primitives";
import { EditTrainingForm } from "./EditTrainingForm";
import { getServerTenantId } from "@/lib/auth/session";
import { MOCK_TENANT_ID } from "@/lib/data/mock";

const DELIVERY_LABEL: Record<string, string> = {
  classroom:    "Classroom / Instructor-led",
  online:       "Online / e-Learning",
  on_the_job:   "On-the-Job Training",
  toolbox_talk: "Toolbox Talk",
  simulation:   "Simulation / Practical",
  external:     "External Provider",
  self_study:   "Self Study",
};

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function daysUntil(s: string | null): number | null {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = (await getServerTenantId()) ?? MOCK_TENANT_ID;
  const [record, courses, profiles] = await Promise.all([
    getTrainingRecordById(id),
    getTrainingCourses(tenantId),
    getProfiles(tenantId),
  ]);
  if (!record) notFound();

  const courseMap  = Object.fromEntries(courses.map((c) => [c.id, c]));
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const course     = courseMap[record.course_id];
  const employee   = profileMap[record.profile_id];
  const instructor = record.instructor_id ? profileMap[record.instructor_id] : null;

  const days      = daysUntil(record.expiry_date);
  const isExpired = days !== null && days < 0;
  const isSoon    = days !== null && days >= 0 && days <= 30;

  const statusLabel = !record.passed ? "Failed"
    : isExpired ? "Expired" : isSoon ? "Expiring Soon" : "Valid";
  const statusCls = !record.passed ? "bg-red-100 text-red-700"
    : isExpired ? "bg-orange-100 text-orange-700"
    : isSoon    ? "bg-amber-100 text-amber-700"
    : "bg-emerald-100 text-emerald-700";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="iq-scroll flex-1 overflow-y-auto p-5 space-y-5">

        {/* Back + title */}
        <div>
          <Link href="/training" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Training &amp; Competency
          </Link>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <Award className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {course?.title ?? record.course_id}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <UserCircle className="h-3 w-3" />
                  {employee?.display_name ?? record.profile_id}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Completed {fmt(record.completed_date)}
                </span>
              </div>
            </div>
            <Pill className={statusCls}>{statusLabel}</Pill>
          </div>
        </div>

        {/* Pass/fail banner */}
        <div className={`flex items-center gap-4 rounded-xl border-l-4 p-4 ${record.passed ? "border-emerald-500 bg-emerald-50" : "border-red-500 bg-red-50"}`}>
          {record.passed
            ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            : <XCircle className="h-6 w-6 shrink-0 text-red-600" />
          }
          <div className="flex-1">
            <div className={`text-sm font-semibold ${record.passed ? "text-emerald-900" : "text-red-900"}`}>
              {record.passed ? "Training Passed" : "Training Not Passed — Re-enrolment Required"}
            </div>
            {record.score != null && (
              <div className={`mt-0.5 text-xs ${record.passed ? "text-emerald-700" : "text-red-700"}`}>
                Score: <strong>{record.score}%</strong>
                {course?.pass_score != null && ` · Pass threshold: ${course.pass_score}%`}
              </div>
            )}
          </div>
          {record.score != null && (
            <div className="text-right shrink-0">
              <div className={`text-3xl font-bold tabular-nums ${record.passed ? "text-emerald-700" : "text-red-700"}`}>
                {record.score}%
              </div>
              {course?.pass_score != null && (
                <div className="text-[10px] text-slate-400">Pass: {course.pass_score}%</div>
              )}
            </div>
          )}
        </div>

        {/* Expiry urgency */}
        {record.passed && record.expiry_date && (isExpired || isSoon) && (
          <div className={`flex items-start gap-3 rounded-xl border-l-4 p-4 ${isExpired ? "border-red-500 bg-red-50" : "border-amber-400 bg-amber-50"}`}>
            <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${isExpired ? "text-red-500" : "text-amber-500"}`} />
            <div>
              <div className={`text-sm font-semibold ${isExpired ? "text-red-900" : "text-amber-900"}`}>
                {isExpired
                  ? `Certificate Expired ${Math.abs(days!)} day${Math.abs(days!) !== 1 ? "s" : ""} Ago`
                  : `Certificate Expiring in ${days} day${days !== 1 ? "s" : ""}`
                }
              </div>
              <p className={`mt-0.5 text-xs ${isExpired ? "text-red-700" : "text-amber-700"}`}>
                {isExpired
                  ? "This certificate has expired. Renewal training is required to restore compliance."
                  : "Schedule renewal training before the expiry date to avoid a compliance gap."
                }
              </p>
            </div>
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="Record Details" subtitle="Completion information" />
            <div className="divide-y divide-slate-50 px-4 pb-2">
              {[
                { label: "Employee",       value: employee?.display_name ?? record.profile_id },
                { label: "Delivery",       value: DELIVERY_LABEL[record.delivery_method] ?? record.delivery_method },
                { label: "Instructor",     value: instructor?.display_name ?? (record.instructor_id ? record.instructor_id : "Self-paced") },
                { label: "Completed",      value: fmt(record.completed_date) },
                { label: "Expires",        value: record.expiry_date ? fmt(record.expiry_date) : "Does not expire" },
                {
                  label: "Time to Expiry",
                  value: record.expiry_date
                    ? days !== null && days < 0 ? `${Math.abs(days)} days overdue` : days !== null ? `${days} days remaining` : "—"
                    : "N/A",
                },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-3 py-2.5">
                  <div className="w-32 shrink-0 text-[11px] font-medium text-slate-400">{row.label}</div>
                  <div className="flex-1 text-xs text-slate-800">{row.value}</div>
                </div>
              ))}
              {record.notes && (
                <div className="py-2.5">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Notes</div>
                  <div className="text-xs text-slate-700 leading-relaxed">{record.notes}</div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Course Information" subtitle={course?.active ? "Active curriculum" : "Curriculum details"} />
            {course ? (
              <div className="divide-y divide-slate-50 px-4 pb-2">
                {[
                  { label: "Type",       value: course.course_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
                  { label: "Duration",   value: course.duration_minutes ? `${course.duration_minutes} min` : "—" },
                  { label: "Validity",   value: course.validity_period_days ? `${course.validity_period_days} days` : "Does not expire" },
                  { label: "Pass Score", value: course.pass_score != null ? `${course.pass_score}%` : "No minimum" },
                  { label: "Regulatory", value: course.regulatory_ref ?? "—" },
                  { label: "Required Roles", value: course.required_roles.length > 0 ? course.required_roles.join(", ") : "All roles" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3 py-2.5">
                    <div className="w-32 shrink-0 text-[11px] font-medium text-slate-400">{row.label}</div>
                    <div className="flex-1 text-xs text-slate-800">{row.value}</div>
                  </div>
                ))}
                {course.description && (
                  <div className="py-2.5">
                    <div className="text-[11px] font-medium text-slate-400 mb-1">Description</div>
                    <div className="text-xs text-slate-600 leading-relaxed">{course.description}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 pb-4 text-xs text-slate-400">Course not found (ID: {record.course_id})</div>
            )}
          </Card>
        </div>

        {/* Edit form */}
        <Card>
          <CardHeader title="Edit Record" subtitle="Update completion details" />
          <div className="px-6 pb-6">
            <EditTrainingForm record={record} courses={courses} profiles={profiles} />
          </div>
        </Card>

      </div>
    </div>
  );
}

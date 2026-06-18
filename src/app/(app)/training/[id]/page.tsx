import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTrainingRecordById, getTrainingCourses, getProfiles } from "@/lib/data/ehsRepo";
import { PageHeader, Pill } from "@/components/ui/primitives";
import { EditTrainingForm } from "./EditTrainingForm";

function fmt(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [record, courses, profiles] = await Promise.all([
    getTrainingRecordById(id),
    getTrainingCourses(),
    getProfiles(),
  ]);
  if (!record) notFound();

  const courseMap  = Object.fromEntries(courses.map((c) => [c.id, c]));
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const course = courseMap[record.course_id];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={course?.title ?? "Training Record"}
        subtitle={profileMap[record.profile_id] ?? record.profile_id}
        actions={
          <Link
            href="/training"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Training
          </Link>
        }
      />

      <div className="iq-scroll flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Summary */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Employee</div>
                <div className="mt-1 text-sm font-medium text-slate-800">{profileMap[record.profile_id] ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Course</div>
                <div className="mt-1 text-sm text-slate-700">{course?.title ?? record.course_id}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Result</div>
                <div className="mt-1">
                  <Pill className={record.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                    {record.passed ? "Passed" : "Failed"}
                  </Pill>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Completed</div>
                <div className="mt-1 text-sm text-slate-700">{fmt(record.completed_date)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expires</div>
                <div className="mt-1 text-sm text-slate-700">{fmt(record.expiry_date)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score</div>
                <div className="mt-1 text-sm text-slate-700">{record.score != null ? `${record.score}%` : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Delivery</div>
                <div className="mt-1 text-sm capitalize text-slate-700">{record.delivery_method.replace(/_/g, " ")}</div>
              </div>
            </div>
          </div>

          {/* Edit */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-slate-800">Edit Record</h2>
            <EditTrainingForm record={record} courses={courses} profiles={profiles} />
          </div>
        </div>
      </div>
    </div>
  );
}

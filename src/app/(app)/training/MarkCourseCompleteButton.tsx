"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { addTrainingRecord } from "@/lib/actions/ehs";
import { playCompleteSound } from "@/lib/sounds";

interface Props {
  courseId: string;
  courseTitle: string;
  profileId: string;
}

export function MarkCourseCompleteButton({ courseId, courseTitle, profileId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [score, setScore] = useState("");

  async function handleSubmit() {
    setPending(true);
    const fd = new FormData();
    fd.set("profile_id", profileId);
    fd.set("course_id", courseId);
    fd.set("completed_date", date);
    fd.set("delivery_method", "self_study");
    fd.set("passed", "true");
    if (score) fd.set("score", score);
    await addTrainingRecord(null, fd);
    playCompleteSound();
    setDone(true);
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  if (done) {
    return (
      <div className="flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold">Completed</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition"
      >
        Mark Complete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold text-slate-900">Mark Training Complete</h3>
            <p className="mb-4 text-xs text-slate-500 line-clamp-2">{courseTitle}</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Completion Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Score (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="e.g. 92"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={pending}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Confirm Complete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

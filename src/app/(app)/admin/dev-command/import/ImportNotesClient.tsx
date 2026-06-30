"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle, ChevronDown,
  ChevronUp, AlertTriangle, Sparkles, Check, X, Plus,
} from "lucide-react";
import { createDevTask } from "@/lib/actions/devcenter";
import type { ProposedTask } from "@/app/api/devcenter/import-notes/route";

type TaskState = "pending" | "approved" | "denied" | "creating" | "created" | "failed";

interface ReviewTask extends ProposedTask {
  _id: string;
  _state: TaskState;
  _expanded: boolean;
  _error?: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  low: "Whenever", medium: "Soon", high: "This week", urgent: "ASAP",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};
const RISK_COLOR: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export function ImportNotesClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rawSummary, setRawSummary] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [allDone, setAllDone] = useState(false);

  async function handleFile(file: File) {
    setParseError(null);
    setRawSummary(null);
    setTasks([]);
    setAllDone(false);
    setIsParsing(true);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/devcenter/import-notes", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) {
        setParseError(json.error ?? "Import failed.");
        return;
      }
      setRawSummary(json.rawSummary ?? null);
      setTasks(
        (json.tasks as ProposedTask[]).map((t, i) => ({
          ...t,
          _id: String(i),
          _state: "pending",
          _expanded: i === 0,
        }))
      );
    } catch {
      setParseError("Network error — please try again.");
    } finally {
      setIsParsing(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function toggle(id: string) {
    setTasks((prev) => prev.map((t) => t._id === id ? { ...t, _expanded: !t._expanded } : t));
  }

  function deny(id: string) {
    setTasks((prev) => prev.map((t) => t._id === id ? { ...t, _state: "denied" } : t));
  }

  function undeny(id: string) {
    setTasks((prev) => prev.map((t) => t._id === id ? { ...t, _state: "pending" } : t));
  }

  function approveOne(id: string) {
    startTransition(async () => {
      setTasks((prev) => prev.map((t) => t._id === id ? { ...t, _state: "creating" } : t));
      const task = tasks.find((t) => t._id === id)!;
      const fd = new FormData();
      fd.set("title", task.title);
      fd.set("business_goal", task.business_goal);
      fd.set("feature_description", task.description);
      fd.set("module_affected", task.module_affected);
      fd.set("who_uses_it", task.who_uses_it);
      fd.set("priority", task.priority);
      fd.set("risk_level", task.risk_level);
      fd.set("success_criteria", task.success_criteria);
      fd.set("notes", task.notes);

      try {
        const result = await createDevTask({}, fd);
        if (result?.error) {
          setTasks((prev) => prev.map((t) => t._id === id ? { ...t, _state: "failed", _error: result.error } : t));
        } else {
          // redirectTo means it was created — stay on page (don't follow the redirect)
          setTasks((prev) => prev.map((t) => t._id === id ? { ...t, _state: "created" } : t));
        }
      } catch {
        setTasks((prev) => prev.map((t) => t._id === id ? { ...t, _state: "failed", _error: "Unexpected error — try again." } : t));
      }

      // Check if all tasks are resolved
      setTasks((prev) => {
        const updated = prev.map((t) => t._id === id ? { ...t, _state: "created" as TaskState } : t);
        const done = updated.every((t) => t._state === "created" || t._state === "denied" || t._state === "failed");
        if (done) setAllDone(true);
        return updated;
      });
    });
  }

  async function approveAll() {
    const pending = tasks.filter((t) => t._state === "pending");
    for (const task of pending) {
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, _state: "creating" } : t));
          const fd = new FormData();
          fd.set("title", task.title);
          fd.set("business_goal", task.business_goal);
          fd.set("feature_description", task.description);
          fd.set("module_affected", task.module_affected);
          fd.set("who_uses_it", task.who_uses_it);
          fd.set("priority", task.priority);
          fd.set("risk_level", task.risk_level);
          fd.set("success_criteria", task.success_criteria);
          fd.set("notes", task.notes);
          try {
            const result = await createDevTask({}, fd);
            if (result?.error) {
              setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, _state: "failed", _error: result.error } : t));
            } else {
              setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, _state: "created" } : t));
            }
          } catch {
            setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, _state: "created" } : t));
          }
          resolve();
        });
      });
    }
    setAllDone(true);
  }

  const pendingCount = tasks.filter((t) => t._state === "pending").length;
  const createdCount = tasks.filter((t) => t._state === "created").length;
  const deniedCount  = tasks.filter((t) => t._state === "denied").length;

  if (allDone && createdCount > 0) {
    return (
      <div className="mx-auto max-w-xl mt-20 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          {createdCount} task{createdCount !== 1 ? "s" : ""} created
        </h2>
        <p className="text-slate-500 mb-6">
          {deniedCount > 0 && `${deniedCount} denied. `}
          The approved tasks are now in the Dev Command queue.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => { setTasks([]); setRawSummary(null); setAllDone(false); }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Import another file
          </button>
          <button
            onClick={() => router.push("/admin/dev-command/tasks")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            View task queue →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Upload zone ── */}
      {tasks.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed px-8 py-16 text-center transition ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
          }`}
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" onChange={onFileChange} className="hidden" />
          {isParsing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-slate-600">Reading your document and extracting tasks…</p>
              <p className="text-xs text-slate-400">This usually takes 10–30 seconds</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                <Upload className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-700">Drop your meeting notes here</p>
                <p className="mt-1 text-sm text-slate-400">or click to browse — PDF or Word (.docx)</p>
              </div>
              <p className="text-xs text-slate-400">Max 20 MB · Claude will read the document and propose tasks for your review</p>
            </div>
          )}
        </div>
      )}

      {/* ── Parse error ── */}
      {parseError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">{parseError}</p>
            <button onClick={() => { setParseError(null); fileRef.current?.click(); }} className="mt-1 text-xs text-red-600 underline">Try again</button>
          </div>
        </div>
      )}

      {/* ── Review panel ── */}
      {tasks.length > 0 && (
        <div className="space-y-4">

          {/* Summary header */}
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                <Sparkles className="h-4 w-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-violet-800">
                  Found {tasks.length} task{tasks.length !== 1 ? "s" : ""} in your document
                </p>
                {rawSummary && <p className="mt-1 text-sm text-violet-700">{rawSummary}</p>}
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">{pendingCount} pending · {createdCount} created · {deniedCount} denied</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTasks(prev => prev.map(t => t._state === "pending" ? { ...t, _state: "denied" } : t))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Deny all
              </button>
              <button
                onClick={approveAll}
                disabled={pendingCount === 0 || isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Approve all ({pendingCount})
              </button>
            </div>
          </div>

          {/* Task cards */}
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task._id}
                className={`rounded-xl border overflow-hidden transition ${
                  task._state === "created"  ? "border-emerald-200 bg-emerald-50/50 opacity-75" :
                  task._state === "denied"   ? "border-slate-200 bg-slate-50 opacity-50" :
                  task._state === "creating" ? "border-blue-200 bg-blue-50/30" :
                  task._state === "failed"   ? "border-red-200 bg-red-50/30" :
                  "border-slate-200 bg-white"
                }`}
              >
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* State icon */}
                  <div className="shrink-0">
                    {task._state === "created"  && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    {task._state === "denied"   && <XCircle className="h-5 w-5 text-slate-400" />}
                    {task._state === "creating" && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                    {task._state === "failed"   && <AlertTriangle className="h-5 w-5 text-red-500" />}
                    {task._state === "pending"  && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${task._state === "denied" ? "line-through text-slate-400" : "text-slate-800"}`}>
                      {task.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400">{task.module_affected}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLOR[task.priority]}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_COLOR[task.risk_level]}`}>
                        {task.risk_level} risk
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {task._state === "pending" && (
                      <>
                        <button
                          onClick={() => deny(task._id)}
                          title="Deny"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => approveOne(task._id)}
                          title="Approve & create task"
                          className="flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      </>
                    )}
                    {task._state === "denied" && (
                      <button onClick={() => undeny(task._id)} className="text-xs text-blue-600 hover:underline">Undo</button>
                    )}
                    {task._state === "failed" && (
                      <button onClick={() => approveOne(task._id)} className="text-xs text-red-600 hover:underline">Retry</button>
                    )}
                    <button
                      onClick={() => toggle(task._id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition"
                    >
                      {task._expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {task._expanded && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                    {task._state === "failed" && task._error && (
                      <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                        Error: {task._error}
                      </div>
                    )}
                    {[
                      { label: "Why it matters", value: task.business_goal },
                      { label: "Description", value: task.description },
                      { label: "Who uses it", value: task.who_uses_it },
                      { label: "Success criteria", value: task.success_criteria },
                      { label: "Notes", value: task.notes },
                    ].map(({ label, value }) => value ? (
                      <div key={label}>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                        <p className="mt-0.5 text-sm text-slate-700">{value}</p>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Upload another */}
          <div className="pt-2 text-center">
            <button
              onClick={() => { setTasks([]); setRawSummary(null); setAllDone(false); }}
              className="text-sm text-slate-400 hover:text-slate-600 underline"
            >
              Upload a different file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check, ChevronDown, ChevronRight, FileCode2, Database, TestTube, Loader2, RefreshCw } from "lucide-react";
import { generateImplementation } from "@/lib/actions/generateImplementation";
import type { ImplementationBrief, GeneratedFile } from "@/lib/actions/generateImplementation";

function FileBlock({ file }: { file: GeneratedFile }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const opColor = file.operation === "create"
    ? "bg-emerald-100 text-emerald-700"
    : file.operation === "delete"
    ? "bg-red-100 text-red-700"
    : "bg-blue-100 text-blue-700";

  function copy() {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition"
      >
        {open ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
        <FileCode2 className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="font-mono text-xs text-slate-700 truncate flex-1">{file.path}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${opColor}`}>{file.operation}</span>
      </button>
      {open && (
        <div className="border-t border-slate-200">
          <p className="px-4 py-2 text-xs text-slate-500 bg-white">{file.description}</p>
          <div className="relative">
            <button
              onClick={copy}
              className="absolute top-2 right-2 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium bg-slate-800/70 text-white hover:bg-slate-800 z-10"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <pre className="overflow-x-auto p-4 text-xs text-slate-800 bg-slate-900 text-slate-100 leading-relaxed max-h-96">
              <code>{file.content}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function buildClaudePrompt(taskTitle: string, brief: ImplementationBrief): string {
  const lines: string[] = [
    `Implement the following feature in the SafetyIQ platform (Next.js 15, Supabase, Tailwind, Vercel deployment).`,
    ``,
    `TASK: ${taskTitle}`,
    ``,
    `SUMMARY: ${brief.summary}`,
    ``,
    `FILES TO CHANGE (${brief.files.length}):`,
  ];

  for (const f of brief.files) {
    lines.push(``, `--- ${f.operation.toUpperCase()}: ${f.path} ---`);
    lines.push(f.description);
    lines.push("```");
    lines.push(f.content);
    lines.push("```");
  }

  if (brief.dbMigration) {
    lines.push(``, `--- DATABASE MIGRATION ---`);
    lines.push("Run this SQL in Supabase (project bjgqjpekhicqlunxbobo) via the MCP tool:");
    lines.push("```sql");
    lines.push(brief.dbMigration);
    lines.push("```");
  }

  lines.push(``, `TESTING: ${brief.testingNotes}`);
  lines.push(``, `DEPLOY: ${brief.deployCommand}`);
  lines.push(``, `Apply all file changes, run the DB migration if needed, then deploy. Do not ask clarifying questions — implement exactly as specified.`);

  return lines.join("\n");
}

interface Props {
  taskId: string;
  taskTitle: string;
  initialBrief?: ImplementationBrief | null;
}

export function GenerateImplementationPanel({ taskId, taskTitle, initialBrief }: Props) {
  const [brief, setBrief] = useState<ImplementationBrief | null>(initialBrief ?? null);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "error">(initialBrief ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setPhase("generating");
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateImplementation(taskId);
        if (result.ok && result.brief) {
          setBrief(result.brief);
          setPhase("done");
        } else {
          setError(result.error ?? "Generation failed. Try again.");
          setPhase("error");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed — please try again.");
        setPhase("error");
      }
    });
  }

  function copyPrompt() {
    if (!brief) return;
    const prompt = buildClaudePrompt(taskTitle, brief);
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-violet-900">Auto-Generate Implementation</p>
            <p className="text-xs text-violet-600">Claude reads the full task plan and writes the exact code changes</p>
          </div>
        </div>
        {phase === "idle" && (
          <button
            onClick={generate}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-60 transition"
          >
            <Sparkles className="h-4 w-4" />
            Generate now
          </button>
        )}
        {phase === "done" && brief && (
          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={isPending}
              title="Re-generate"
              className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
            <button
              onClick={copyPrompt}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 transition"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy for Claude Code"}
            </button>
          </div>
        )}
      </div>

      {/* Generating */}
      {(phase === "generating" || isPending) && (
        <div className="border-t border-violet-200 bg-white/60 px-5 py-8 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <p className="text-sm font-medium text-violet-800">Reading the task plan and writing implementation spec…</p>
          <p className="text-xs text-violet-500">This takes about 15–30 seconds</p>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="border-t border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={generate} className="text-sm font-medium text-red-700 underline hover:no-underline">Try again</button>
        </div>
      )}

      {/* Result */}
      {phase === "done" && brief && !isPending && (
        <div className="border-t border-violet-200 bg-white/80 divide-y divide-slate-100">
          {/* Copy CTA banner */}
          <div className="px-5 py-3 bg-violet-600 flex items-center justify-between gap-3">
            <p className="text-sm text-white font-medium">
              Ready. Click &apos;Copy for Claude Code&apos;, paste it into your Claude Code chat, and it will implement everything automatically.
            </p>
            <button
              onClick={copyPrompt}
              className="shrink-0 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow hover:bg-violet-50 transition"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy for Claude Code"}
            </button>
          </div>

          {/* Summary */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">What this implements</p>
            <p className="text-sm text-slate-700">{brief.summary}</p>
          </div>

          {/* Files */}
          {brief.files.length > 0 && (
            <div className="px-5 py-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <FileCode2 className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{brief.files.length} file{brief.files.length !== 1 ? "s" : ""} to change</p>
              </div>
              {brief.files.map((f, i) => <FileBlock key={i} file={f} />)}
            </div>
          )}

          {/* DB Migration */}
          {brief.dbMigration && (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Database migration needed</p>
              </div>
              <pre className="rounded-lg bg-slate-900 p-4 text-xs text-green-400 overflow-x-auto">
                <code>{brief.dbMigration}</code>
              </pre>
            </div>
          )}

          {/* Testing */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <TestTube className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">How to verify it works</p>
            </div>
            <p className="text-sm text-slate-600">{brief.testingNotes}</p>
          </div>
        </div>
      )}

      {/* Idle state — explain what this does */}
      {phase === "idle" && (
        <div className="border-t border-violet-200 px-5 py-4">
          <ul className="space-y-1.5 text-sm text-violet-700">
            <li className="flex items-start gap-2"><span className="mt-0.5 text-violet-400">→</span> Claude reads everything the AI team planned for this task</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-violet-400">→</span> Writes the exact TypeScript files, SQL migrations, and test steps</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-violet-400">→</span> Gives you a one-click button to copy it all into Claude Code</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-violet-400">→</span> Claude Code implements it — you just paste and watch</li>
          </ul>
        </div>
      )}
    </div>
  );
}

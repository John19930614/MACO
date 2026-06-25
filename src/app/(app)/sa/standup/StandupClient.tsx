"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlayCircle, ChevronDown, ChevronRight, Bot, Globe, ShieldAlert,
  CheckSquare, Sparkles, MessageSquare,
} from "lucide-react";
import { conveneAgentStandup } from "@/lib/actions/csp";
import type { CspMeeting, CspMeetingGap } from "@/lib/csp/types";

const SEVERITY_CLS: Record<CspMeetingGap["severity"], string> = {
  low: "bg-slate-700 text-slate-200",
  medium: "bg-amber-900/50 text-amber-300",
  high: "bg-red-900/50 text-red-300",
};
const PRIORITY_CLS: Record<string, string> = {
  low: "bg-slate-700 text-slate-300",
  normal: "bg-blue-900/50 text-blue-300",
  high: "bg-red-900/50 text-red-300",
};

export default function StandupClient({ meetings }: { meetings: CspMeeting[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(meetings[0]?.id ?? null);

  const convene = () =>
    start(async () => {
      const r = await conveneAgentStandup();
      setMsg(r.ok ? `Standup complete — ${r.gaps} gap(s), ${r.actions} action item(s).` : (r.error ?? "Failed."));
      router.refresh();
    });

  return (
    <div>
      {/* Convene form */}
      <div className="mb-5 rounded-2xl border border-white/8 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Convene today&apos;s standup</h3>
            <p className="text-xs text-slate-400">Pulls live data from both agents, generates the meeting, and logs the gaps + action items.</p>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-xs text-slate-300">{msg}</span>}
            <button
              onClick={convene}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {pending ? <><Sparkles className="h-4 w-4 animate-pulse" /> Convening…</> : <><PlayCircle className="h-4 w-4" /> Convene standup</>}
            </button>
          </div>
        </div>
      </div>

      {/* Meeting history */}
      {meetings.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-400">
          No standups yet. Click “Convene standup” to hold the first meeting — or wait for the daily run.
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => {
            const open = openId === m.id;
            return (
              <div key={m.id} className="rounded-2xl border border-white/8 bg-slate-900/40">
                <button onClick={() => setOpenId(open ? null : m.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{m.meeting_date} — Daily Standup</div>
                    <div className="truncate text-xs text-slate-400">{m.shared_summary}</div>
                  </div>
                  {m.gaps_found.length > 0 && <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-[11px] font-semibold text-amber-300">{m.gaps_found.length} gap(s)</span>}
                  {m.action_items.length > 0 && <span className="rounded-full bg-blue-900/50 px-2 py-0.5 text-[11px] font-semibold text-blue-300">{m.action_items.length} action(s)</span>}
                </button>

                {open && (
                  <div className="border-t border-white/8 p-4">
                    {/* Briefings */}
                    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Briefing icon={<Globe className="h-4 w-4 text-sky-300" />} who="GUS" text={m.gus_briefing} tone="sky" />
                      <Briefing icon={<Bot className="h-4 w-4 text-violet-300" />} who="EHS Validation Agent" text={m.ehs_briefing} tone="violet" />
                    </div>

                    {/* Exchange */}
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><MessageSquare className="h-3.5 w-3.5" /> Exchange</div>
                      <div className="space-y-2">
                        {m.exchange.map((e, i) => {
                          const gus = e.speaker === "GUS";
                          return (
                            <div key={i} className={`flex ${gus ? "justify-start" : "justify-end"}`}>
                              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${gus ? "rounded-tl-sm bg-sky-950/40 text-sky-100 border border-sky-900/40" : "rounded-tr-sm bg-violet-950/40 text-violet-100 border border-violet-900/40"}`}>
                                <div className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wide ${gus ? "text-sky-400" : "text-violet-400"}`}>{e.speaker}</div>
                                {e.message}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Gaps */}
                    {m.gaps_found.length > 0 && (
                      <div className="mb-4">
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><ShieldAlert className="h-3.5 w-3.5" /> Gaps surfaced</div>
                        <div className="space-y-1.5">
                          {m.gaps_found.map((g, i) => (
                            <div key={i} className="rounded-lg border border-white/8 bg-slate-900/40 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-100">{g.title}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_CLS[g.severity]}`}>{g.severity}</span>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-400">{g.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action items */}
                    {m.action_items.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><CheckSquare className="h-3.5 w-3.5" /> Action items</div>
                        <div className="space-y-1.5">
                          {m.action_items.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-lg border border-white/8 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_CLS[a.priority] ?? PRIORITY_CLS.normal}`}>{a.priority}</span>
                              <span className="flex-1">{a.item}</span>
                              <span className="text-[11px] text-slate-500">{a.owner}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 text-[11px] text-slate-500">Generated by {m.generated_by ?? "—"} · {m.model ?? "deterministic"} · {new Date(m.created_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Briefing({ icon, who, text, tone }: { icon: React.ReactNode; who: string; text: string | null; tone: "sky" | "violet" }) {
  const border = tone === "sky" ? "border-sky-900/40" : "border-violet-900/40";
  const head = tone === "sky" ? "text-sky-300" : "text-violet-300";
  return (
    <div className={`rounded-xl border ${border} bg-slate-900/60 p-3`}>
      <div className={`mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${head}`}>{icon} {who} brought</div>
      <p className="text-sm text-slate-200">{text ?? "—"}</p>
    </div>
  );
}

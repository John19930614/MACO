"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircle, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";

interface Msg { id: string; role: "user" | "assistant"; text: string; }

const QUICK_PROMPTS = [
  "What are my highest-priority open CAPAs?",
  "Are any chemicals missing updated SDS?",
  "What trainings are expiring soon?",
  "Show me overdue risk reviews",
];

function buildReply(q: string): string {
  const lc = q.toLowerCase();
  if (/capa|corrective|action/i.test(lc))
    return "Your highest-priority open CAPAs are in the **CAPA module**. Look for items flagged as overdue (red) or past their due date. For a full breakdown, head to the [CAPA page](/capa) or ask SafetyIQ AI on the AI Assistant page for specific counts and owner assignments.";
  if (/sds|safety data|chemical/i.test(lc))
    return "SDS expiry is tracked in the **Chemicals module**. Any SDS with a review date in the past or within 90 days will be flagged. Visit [Chemicals](/chemicals) for the full inventory, or check the Document Register for policy-level documents.";
  if (/train|certif|expir/i.test(lc))
    return "Training expiry alerts are in the **Training module**. Records within 30 days of expiry are highlighted amber; expired records show red. Go to [Training](/training) to see who needs recertification.";
  if (/risk|review|overdue/i.test(lc))
    return "Overdue risk reviews are surfaced in the **Risk Intelligence** dashboard under Active Risk Alerts. High and extreme risks past their review date are flagged first. Navigate to [Risk](/risk) → Alerts tab.";
  if (/waste|manifest|disposal/i.test(lc))
    return "Waste tracking is in the **Waste Management** module — container status, pickup schedule, and manifests. Go to [Waste](/waste) for the full view.";
  if (/audit/i.test(lc))
    return "Your audits and their finding status are in the [Audits module](/audits). Overdue findings are flagged red. You can also print per-audit reports from the audit detail page.";
  if (/incident/i.test(lc))
    return "Open incidents under investigation are in the [Incidents module](/incidents). High and critical severity incidents also surface in your notification bell.";
  if (/hi|hello|hey|help/i.test(lc))
    return "Hi! I'm SafetyIQ AI, your EHS co-pilot. I can help with **CAPAs, training expiry, SDS, risk reviews, audits, incidents, waste, and compliance**. Try one of the quick prompts below, or open the full AI Assistant for deeper analysis and data cards.";
  return "I can give you a quick answer here, but for deeper analysis, linked data cards, and P-Engine insights, the full **AI Assistant** page has everything. [Open SafetyIQ AI →](/ai)";
}

export function AssistantDrawer() {
  const [open, setOpen]     = useState(false);
  const [msgs, setMsgs]     = useState<Msg[]>([]);
  const [input, setInput]   = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  function send(text: string) {
    if (!text.trim()) return;
    const userMsg: Msg = { id: Date.now().toString(), role: "user", text: text.trim() };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = buildReply(text);
      setMsgs((m) => [...m, { id: (Date.now() + 1).toString(), role: "assistant", text: reply }]);
      setTyping(false);
    }, 700);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  function renderText(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      if (bold) return <strong key={i}>{bold[1]}</strong>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) return <Link key={i} href={link[2]} className="text-blue-600 underline hover:text-blue-800" onClick={() => setOpen(false)}>{link[1]}</Link>;
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open SafetyIQ AI quick-chat"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 hover:scale-105 active:scale-95 print:hidden"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 print:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 right-0 z-50 flex h-[520px] w-[360px] flex-col rounded-tl-2xl bg-white shadow-2xl transition-transform duration-200 print:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 rounded-tl-2xl bg-blue-600 px-4 py-3 text-white shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-none">SafetyIQ AI</div>
            <div className="text-[10px] text-blue-200 leading-none mt-0.5">EHS Co-Pilot · Quick Chat</div>
          </div>
          <Link
            href="/ai"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-blue-100 transition hover:bg-white/20"
          >
            Full view <ExternalLink className="h-3 w-3" />
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {msgs.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-2xl rounded-tl-sm bg-blue-50 px-3.5 py-2.5 text-sm text-slate-700 max-w-[90%]">
                Hi! Ask me anything about your EHS program, or try a quick prompt below.
              </div>
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="block w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-left text-xs text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-sm bg-blue-600 text-white"
                    : "rounded-tl-sm bg-blue-50 text-slate-700"
                }`}
              >
                {m.role === "assistant" ? renderText(m.text) : m.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm bg-blue-50 px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-slate-100 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask SafetyIQ AI…"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
            />
            <button
              type="button"
              disabled={!input.trim()}
              onClick={() => send(input)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-300">
            Quick answers only · <Link href="/ai" onClick={() => setOpen(false)} className="text-blue-400 hover:underline">Open full SafetyIQ AI</Link> for deep analysis
          </p>
        </div>
      </div>
    </>
  );
}

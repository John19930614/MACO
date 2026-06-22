"use client";

import { useState } from "react";
import { ShieldCheck, AlertTriangle, Zap, Brain, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkType  = "lifting" | "pushing_pulling" | "reaching_overhead" | "repetitive" | "other";
type Discomfort = "easy" | "somewhat" | "very" | "extremely";
type BodyPart  = "back" | "shoulders" | "neck" | "arms" | "hands_wrists" | "legs" | "none";
type Frequency = "rarely" | "sometimes" | "often" | "all_day";

interface ScreeningState {
  workType:   WorkType | null;
  discomfort: Discomfort | null;
  bodyParts:  BodyPart[];
  frequency:  Frequency | null;
}

// ── Risk engine ───────────────────────────────────────────────────────────────

const WT_SCORE: Record<WorkType, number>   = { lifting: 2, pushing_pulling: 2, reaching_overhead: 3, repetitive: 2, other: 1 };
const DC_SCORE: Record<Discomfort, number> = { easy: 0, somewhat: 1, very: 3, extremely: 5 };
const FQ_SCORE: Record<Frequency, number>  = { rarely: 0, sometimes: 1, often: 2, all_day: 3 };

function calcRisk(s: ScreeningState) {
  const wt = s.workType  ? WT_SCORE[s.workType]  : 0;
  const dc = s.discomfort ? DC_SCORE[s.discomfort] : 0;
  const bp = s.bodyParts.includes("none") || s.bodyParts.length === 0 ? 0 : Math.min(s.bodyParts.length, 4);
  const fq = s.frequency ? FQ_SCORE[s.frequency] : 0;
  return wt + dc + bp + fq;
}

function riskLevel(score: number): { label: string; color: string; bg: string; border: string; icon: string } {
  if (score <= 2)  return { label: "Low Risk",      color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: "🟢" };
  if (score <= 5)  return { label: "Moderate Risk",  color: "text-amber-700",  bg: "bg-amber-50",    border: "border-amber-200",   icon: "🟡" };
  if (score <= 9)  return { label: "High Risk",      color: "text-orange-700", bg: "bg-orange-50",   border: "border-orange-200",  icon: "🟠" };
  return              { label: "Severe Risk",     color: "text-red-700",    bg: "bg-red-50",      border: "border-red-200",     icon: "🔴" };
}

function riskDrivers(s: ScreeningState): string[] {
  const drivers: string[] = [];
  if (!s.workType && !s.discomfort && s.bodyParts.length === 0 && !s.frequency)
    return ["Complete the screening to see risk drivers."];
  if (s.workType === "reaching_overhead") drivers.push("Overhead reaching elevates shoulder and neck load");
  if (s.workType === "lifting")           drivers.push("Manual lifting introduces spine and shoulder risk");
  if (s.workType === "repetitive")        drivers.push("Repetitive motion increases cumulative MSD exposure");
  if (s.discomfort === "very" || s.discomfort === "extremely") drivers.push("Reported discomfort indicates active strain — immediate review recommended");
  if (s.bodyParts.includes("back"))        drivers.push("Back involvement suggests spinal loading concern");
  if (s.bodyParts.includes("shoulders"))   drivers.push("Shoulder strain common with overhead / lift tasks");
  if (s.bodyParts.includes("hands_wrists")) drivers.push("Hand/wrist involvement points to repetitive strain risk");
  if (s.frequency === "all_day" || s.frequency === "often") drivers.push("High-frequency exposure amplifies cumulative MSD risk");
  if (drivers.length === 0) drivers.push("Low discomfort, low frequency, and no body strain selected.");
  return drivers;
}

function nextSteps(score: number): { text: string; level2: boolean }[] {
  if (score <= 2)  return [{ text: "Continue work and monitor comfort.", level2: false }];
  if (score <= 5)  return [
    { text: "Review task setup with your supervisor.", level2: false },
    { text: "Use available ergonomic aids and supports.", level2: false },
    { text: "Request a Level 2 assessment if symptoms persist.", level2: true },
  ];
  if (score <= 9)  return [
    { text: "Stop or reduce the activity if pain increases.", level2: false },
    { text: "Request a Level 2 formal ergonomic assessment.", level2: true },
    { text: "Report any MSD symptoms via Incident Reporting.", level2: false },
  ];
  return [
    { text: "Immediately stop the activity and notify your supervisor.", level2: false },
    { text: "A Level 2 ergonomic assessment is required before resuming.", level2: true },
    { text: "Log a safety incident and seek medical evaluation if needed.", level2: false },
  ];
}

function aiInsight(s: ScreeningState, score: number): { headline: string; body: string; bullets: string[] } {
  if (score <= 2) return {
    headline: "Pattern signal",
    body: "Even without measurements, this screening provides important ergonomic risk signals. SafetyIQ uses this information to identify patterns, connect similar discomfort reports, recommend controls, and determine when a higher-level ergonomic review is needed.",
    bullets: ["Identify patterns and trends across your workforce", "Connect similar tasks and discomfort reports", "Determine when higher-level ergonomic review is needed"],
  };
  if (score <= 5) return {
    headline: "Emerging pattern detected",
    body: "Moderate risk factors are present. SafetyIQ will flag this alongside similar reports from your team to detect emerging MSD trends before they result in injuries.",
    bullets: ["Compare against similar task reports in your facility", "Trigger supervisor review workflow automatically", "Recommend engineering controls from the MACO library"],
  };
  return {
    headline: "High-priority signal",
    body: "This screening indicates significant ergonomic risk. SafetyIQ is flagging this for your EHS Manager. A Level 2 assessment should be scheduled promptly to prevent injury.",
    bullets: ["Automatically alert EHS Manager via dashboard", "Schedule Level 2 assessment in Audit module", "Log incident if discomfort meets recordable threshold"],
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="mb-3 font-semibold text-slate-800 text-[13px]">
      <span className="text-blue-600 font-bold">{n}. </span>{text}
    </div>
  );
}

function OptionCard({
  selected, onClick, icon, label, sub, accent,
}: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub?: string; accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition-all hover:shadow-sm ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className={`text-[11.5px] font-semibold leading-tight ${selected ? (accent ?? "text-blue-700") : "text-slate-700"}`}>
        {label}
      </span>
      {sub && <span className={`text-[10px] leading-tight ${selected ? "text-blue-500" : "text-slate-400"}`}>{sub}</span>}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ErgonomicsScreening() {
  const [s, setS] = useState<ScreeningState>({ workType: null, discomfort: null, bodyParts: [], frequency: null });

  const toggleBodyPart = (bp: BodyPart) => {
    setS((prev) => {
      if (bp === "none") return { ...prev, bodyParts: ["none"] };
      const next = prev.bodyParts.filter((b) => b !== "none");
      if (next.includes(bp)) return { ...prev, bodyParts: next.filter((b) => b !== bp) };
      return { ...prev, bodyParts: [...next, bp] };
    });
  };

  const score = calcRisk(s);
  const risk  = riskLevel(score);
  const drivers = riskDrivers(s);
  const steps = nextSteps(score);
  const ai = aiInsight(s, score);

  const answered = [s.workType, s.discomfort, s.bodyParts.length > 0, s.frequency].filter(Boolean).length;

  return (
    <div className="grid grid-cols-[1fr_220px_220px] gap-5 items-start">
      {/* ── Questionnaire ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-6">

        {/* Q1 — Work type */}
        <div>
          <SectionLabel n={1} text="What type of work are you doing?" />
          <div className="grid grid-cols-5 gap-2">
            {([
              { v: "lifting",           icon: "📦", label: "Lifting" },
              { v: "pushing_pulling",   icon: "🛒", label: "Pushing / Pulling" },
              { v: "reaching_overhead", icon: "⬆️", label: "Reaching / Overhead" },
              { v: "repetitive",        icon: "🔁", label: "Repetitive Work" },
              { v: "other",             icon: "···", label: "Other" },
            ] as { v: WorkType; icon: string; label: string }[]).map((opt) => (
              <OptionCard
                key={opt.v}
                selected={s.workType === opt.v}
                onClick={() => setS((p) => ({ ...p, workType: opt.v }))}
                icon={opt.icon}
                label={opt.label}
              />
            ))}
          </div>
        </div>

        {/* Q2 — Discomfort */}
        <div>
          <SectionLabel n={2} text="How does this task feel on your body?" />
          <div className="grid grid-cols-4 gap-2">
            {([
              { v: "easy",      icon: "😊", label: "Easy / No discomfort",              accent: "text-emerald-700" },
              { v: "somewhat",  icon: "😐", label: "Somewhat tiring", sub: "Minor discomfort",      accent: "text-amber-700" },
              { v: "very",      icon: "😟", label: "Very tiring",     sub: "Moderate discomfort",   accent: "text-orange-700" },
              { v: "extremely", icon: "😣", label: "Extremely tiring", sub: "Severe discomfort",    accent: "text-red-700" },
            ] as { v: Discomfort; icon: string; label: string; sub?: string; accent: string }[]).map((opt) => (
              <OptionCard
                key={opt.v}
                selected={s.discomfort === opt.v}
                onClick={() => setS((p) => ({ ...p, discomfort: opt.v }))}
                icon={opt.icon}
                label={opt.label}
                sub={opt.sub}
                accent={opt.accent}
              />
            ))}
          </div>
        </div>

        {/* Q3 — Body parts */}
        <div>
          <SectionLabel n={3} text="Which parts of your body feel the strain?" />
          <div className="grid grid-cols-4 gap-2">
            {([
              { v: "back",         icon: "🧍", label: "Back" },
              { v: "shoulders",    icon: "🤷", label: "Shoulders" },
              { v: "neck",         icon: "🫀", label: "Neck" },
              { v: "arms",         icon: "💪", label: "Arms" },
              { v: "hands_wrists", icon: "🤲", label: "Hands / Wrists" },
              { v: "legs",         icon: "🦵", label: "Legs" },
              { v: "none",         icon: "🚫", label: "None" },
            ] as { v: BodyPart; icon: string; label: string }[]).map((opt) => (
              <OptionCard
                key={opt.v}
                selected={s.bodyParts.includes(opt.v)}
                onClick={() => toggleBodyPart(opt.v)}
                icon={opt.icon}
                label={opt.label}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">Select all that apply</p>
        </div>

        {/* Q4 — Frequency */}
        <div>
          <SectionLabel n={4} text="How often do you do this task?" />
          <div className="grid grid-cols-4 gap-2">
            {([
              { v: "rarely",    icon: "📅", label: "Rarely", sub: "1–2 times/week" },
              { v: "sometimes", icon: "🔂", label: "Sometimes", sub: "A few times/day" },
              { v: "often",     icon: "⏩", label: "Often / Many", sub: "Hourly" },
              { v: "all_day",   icon: "⏰", label: "All Day", sub: "Most of shift" },
            ] as { v: Frequency; icon: string; label: string; sub: string }[]).map((opt) => (
              <OptionCard
                key={opt.v}
                selected={s.frequency === opt.v}
                onClick={() => setS((p) => ({ ...p, frequency: opt.v }))}
                icon={opt.icon}
                label={opt.label}
                sub={opt.sub}
              />
            ))}
          </div>
        </div>

        {/* Reset */}
        {answered > 0 && (
          <button
            onClick={() => setS({ workType: null, discomfort: null, bodyParts: [], frequency: null })}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            ↺ Reset screening
          </button>
        )}
      </div>

      {/* ── Your Results ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Your Results</span>
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-[17px] font-extrabold ${risk.color}`}>{risk.label}</span>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${answered >= 2 ? risk.bg : "bg-slate-100"} border ${risk.border}`}>
            {answered >= 2
              ? (score <= 2 ? <ShieldCheck className={`h-5 w-5 ${risk.color}`} /> : <AlertTriangle className={`h-5 w-5 ${risk.color}`} />)
              : <ShieldCheck className="h-5 w-5 text-slate-300" />
            }
          </div>
        </div>

        {/* Score box */}
        <div className={`rounded-xl p-4 ${risk.bg} border ${risk.border}`}>
          <p className={`text-[11px] font-bold ${risk.color} mb-1`}>{risk.label.toUpperCase()}</p>
          <div className="flex items-end gap-2">
            <span className={`text-4xl font-extrabold ${risk.color}`}>{answered >= 2 ? score : "—"}</span>
            {answered >= 2 && <span className="text-[10px] text-slate-400 mb-1">/ 17 max</span>}
          </div>
          <p className={`text-[10.5px] mt-1 ${answered >= 2 ? risk.color : "text-slate-400"} leading-snug`}>
            {answered < 2 ? "Answer at least 2 questions to see your score." :
              score <= 2 ? "This task is not showing a strong ergonomic concern from the Level 1 screening inputs." :
              score <= 5 ? "Moderate risk factors detected. Review task setup with your supervisor." :
              score <= 9 ? "High risk factors present. A Level 2 assessment is recommended." :
              "Severe risk. Stop or reduce activity and request immediate review."
            }
          </p>
        </div>

        {/* Risk drivers */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Main Risk Drivers</p>
          <ul className="space-y-1">
            {drivers.map((d, i) => (
              <li key={i} className="text-[11px] text-slate-600 leading-snug">{d}</li>
            ))}
          </ul>
        </div>

        {/* Next steps */}
        {answered >= 2 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Recommended Next Steps</p>
            <ul className="space-y-1.5">
              {steps.map((step, i) => (
                <li key={i} className={`flex items-start gap-1.5 text-[11px] leading-snug ${step.level2 ? "font-semibold text-blue-700" : "text-slate-600"}`}>
                  <span className="mt-px shrink-0">{step.level2 ? <ChevronRight className="h-3 w-3 text-blue-500" /> : "·"}</span>
                  {step.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── AI Insight ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SafetyIQ AI Insight</span>
          </div>
          <Brain className="h-4 w-4 text-slate-300" />
        </div>

        <div>
          <p className="text-[13px] font-bold text-slate-800 mb-2">{ai.headline}</p>
          <p className="text-[11.5px] text-slate-600 leading-relaxed">{ai.body}</p>
        </div>

        <ul className="space-y-2">
          {ai.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-px text-emerald-500" />
              {b}
            </li>
          ))}
        </ul>

        {/* Need deeper evaluation */}
        {score >= 4 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[10.5px] font-bold text-blue-700">Need a Deeper Evaluation?</span>
            </div>
            <p className="text-[10.5px] text-blue-600 leading-snug">
              Request a Level 2 formal ergonomic assessment through the Audit module. Your EHS Manager will be notified.
            </p>
            <a
              href="/audits"
              className="mt-2 flex items-center gap-1 text-[10.5px] font-semibold text-blue-700 hover:underline"
            >
              Schedule Level 2 Audit <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

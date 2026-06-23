"use client";
/**
 * Guided tour overlay — triggers automatically after onboarding (?onboarding=complete)
 * or when the user clicks "Take a Tour" in settings.
 * Completion stored in localStorage; never shows again once dismissed.
 */
import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

const TOUR_KEY = "safetyiq_tour_v1_done";

export function startTour() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOUR_KEY);
    window.dispatchEvent(new CustomEvent("safetyiq:start-tour"));
  }
}

interface TourStep {
  target: string | null;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: "Welcome to SafetyIQ",
    body: "You're all set. Let's take a quick 60-second tour of the platform so you can hit the ground running.",
    placement: "center",
  },
  {
    target: "left-nav",
    title: "Your EHS Modules",
    body: "All 12 EHS modules live here — Chemicals, Incidents, Training, Audits, CAPAs, Documents, and more. Click any module to open it.",
    placement: "right",
  },
  {
    target: "command-center",
    title: "Command Center",
    body: "Your real-time EHS dashboard. Compliance scores, open CAPAs, risk alerts, and P-Engine predictions all in one view.",
    placement: "bottom",
  },
  {
    target: "p-engine-btn",
    title: "P-Engine Scan",
    body: "The AI Predictability Engine analyzes your EHS data to forecast risk trends, detect compliance gaps, and surface hazards before incidents happen.",
    placement: "bottom",
  },
  {
    target: "notifications",
    title: "Alerts & Notifications",
    body: "Overdue CAPAs, expiring certifications, high-severity incidents — all surface here in real time so nothing falls through the cracks.",
    placement: "bottom",
  },
  {
    target: null,
    title: "You're ready to go",
    body: "Start by adding your first incident, chemical, or running a P-Engine scan. Your Reliance rep will reach out within 1 business day to help configure your full EHS profile.",
    placement: "center",
  },
];

interface Rect { x: number; y: number; width: number; height: number }

export function GuidedTour() {
  const [active, setActive]     = useState(false);
  const [step, setStep]         = useState(0);
  const [rect, setRect]         = useState<Rect | null>(null);
  const [vp, setVp]             = useState({ w: 1280, h: 800 });

  // Track viewport size
  useEffect(() => {
    function sync() { setVp({ w: window.innerWidth, h: window.innerHeight }); }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Activate on mount if ?onboarding=complete and tour not done
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;
    if (new URLSearchParams(window.location.search).get("onboarding") === "complete") {
      setActive(true);
    }
    function handle() { setActive(true); setStep(0); }
    window.addEventListener("safetyiq:start-tour", handle);
    return () => window.removeEventListener("safetyiq:start-tour", handle);
  }, []);

  // Measure target element whenever step changes
  useEffect(() => {
    if (!active) return;
    const target = STEPS[step]?.target;
    if (!target) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
    };
    const t = setTimeout(measure, 120);
    return () => clearTimeout(t);
  }, [active, step]);

  const dismiss = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "1");
    setActive(false);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else dismiss();
  }, [step, dismiss]);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  if (!active) return null;

  const current = STEPS[step];
  const PAD = 10;
  const rx = rect ? rect.x - PAD : 0;
  const ry = rect ? rect.y - PAD : 0;
  const rw = rect ? rect.width  + PAD * 2 : 0;
  const rh = rect ? rect.height + PAD * 2 : 0;

  return (
    <>
      {/* Click-blocker */}
      <div className="fixed inset-0 z-[9997]" onClick={dismiss} />

      {/* SVG spotlight overlay */}
      <svg
        className="pointer-events-none fixed inset-0 z-[9998] h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tsp">
            <rect width="100%" height="100%" fill="white" />
            {rect && <rect x={rx} y={ry} width={rw} height={rh} rx="10" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#tsp)" />
        {rect && (
          <rect
            x={rx} y={ry} width={rw} height={rh} rx="10"
            fill="none" stroke="#3b82f6" strokeWidth="2"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        className="fixed z-[9999] w-[320px] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        style={tooltipStyle(current, rect, vp)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress dots + close */}
        <div className="flex items-center gap-1.5 px-5 pt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-blue-500" :
                i < step   ? "w-1.5 bg-blue-800" :
                              "w-1.5 bg-slate-700"
              }`}
            />
          ))}
          <button
            onClick={dismiss}
            className="ml-auto rounded-md p-1 text-slate-500 transition hover:text-slate-200"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <div className="mb-1.5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
            <h3 className="text-sm font-bold text-white">{current.title}</h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{current.body}</p>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <button
            onClick={back}
            disabled={step === 0}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-white disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>

          <span className="text-[10px] text-slate-600">{step + 1} / {STEPS.length}</span>

          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              Let&apos;s go!
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function tooltipStyle(
  step: TourStep,
  rect: Rect | null,
  vp: { w: number; h: number },
): React.CSSProperties {
  if (!rect || step.placement === "center") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const TW = 320;
  const TH = 190;
  const GAP = 16;
  let top: number;
  let left: number;

  switch (step.placement) {
    case "right":
      top  = rect.y + rect.height / 2 - TH / 2;
      left = rect.x + rect.width + GAP;
      break;
    case "left":
      top  = rect.y + rect.height / 2 - TH / 2;
      left = rect.x - TW - GAP;
      break;
    case "top":
      top  = rect.y - TH - GAP;
      left = rect.x + rect.width / 2 - TW / 2;
      break;
    default: // bottom
      top  = rect.y + rect.height + GAP;
      left = rect.x + rect.width / 2 - TW / 2;
  }

  // Clamp within viewport
  left = Math.max(12, Math.min(left, vp.w - TW - 12));
  top  = Math.max(12, Math.min(top,  vp.h - TH - 12));

  return { top, left };
}

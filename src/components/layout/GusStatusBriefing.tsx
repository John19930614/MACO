"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoUser } from "@/lib/context/demo-user";
import { MOCK_MODE } from "@/lib/env";
import {
  Globe, Activity, AlertTriangle, Shield,
  Zap, CheckCircle2, Users, Database, Volume2, VolumeX,
} from "lucide-react";

const AUDIO_SRC = "/audio/gus-briefing.mp3";

const SPOKEN_LINES = [
  "Good evening, Administrator Lopez. GUS is online.",
  "Platform diagnostics complete. All systems nominal.",
  "Platform health is rated B — Good — at 83 percent average compliance across 2 active clients.",
  "1 corrective action is overdue and requires immediate escalation.",
  "Weakest module platform-wide: Legal compliance, at 63 percent.",
  "P-Engine is operational at Stage 3 Forecast, with 87 percent confidence.",
  "Your platform briefing is ready. All systems are standing by.",
];

const BOOT_LINES = [
  "▶  GUS v2.6 — Global Unified Safety Intelligence",
  "▶  Authenticating Reliance Platform Administrator...",
  "▶  ACCESS GRANTED — Platform: RELIANCE GLOBAL ADMIN",
  "▶  Connecting to 4 registered client environments...",
  "▶  P-Engine pulse: 2 tenants actively reporting",
  "▶  Full platform diagnostic complete — ALL SYSTEMS NOMINAL",
];

const CLIENTS = [
  { id: "t-biostar-001",  name: "BioStar Research Inc.", score: 83,   live: true  },
  { id: "t-meridian-001", name: "Meridian Diagnostics",  score: 88,   live: true  },
  { id: "t-novachem-001", name: "NovaChem Solutions",    score: null,  live: false },
  { id: "t-gentech-001",  name: "GenTech Biopharma",     score: null,  live: false },
];

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function scoreBar(s: number)  { return s >= 85 ? "bg-emerald-500" : s >= 70 ? "bg-amber-400" : "bg-red-400"; }
function scoreText(s: number) { return s >= 85 ? "text-emerald-400" : s >= 70 ? "text-amber-400" : "text-red-400"; }

// ── Web Audio helpers ─────────────────────────────────────────────────────────

function makeAudioCtx(): AudioContext | null {
  try {
    return new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch { return null; }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  vol = 0.06,
  delayMs = 0,
) {
  try {
    const t    = ctx.currentTime + delayMs / 1000;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch { /* blocked — silent */ }
}

function playBootLine(ctx: AudioContext, idx: number) {
  if (idx === BOOT_LINES.length - 1) {
    // Final "ALL SYSTEMS NOMINAL" — rising arpeggio
    [440, 554, 659, 880].forEach((f, i) => playTone(ctx, f, 0.3, "sine", 0.045, i * 90));
  } else {
    playTone(ctx, 820 + idx * 60, 0.038, "square", 0.055);
  }
}

function playStatsChord(ctx: AudioContext) {
  [261, 329, 392, 523, 659].forEach((f, i) => playTone(ctx, f, 0.55, "sine", 0.04, i * 110));
}

function playExitDown(ctx: AudioContext) {
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.65);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
  } catch { /* silent */ }
}

// ── Animated GUS robot character ──────────────────────────────────────────────

function GusCharacter({ speaking }: { speaking: boolean }) {
  return (
    <div className="gus-char flex flex-col items-center gap-3 select-none">
      <div className="gus-orb">
        <div className={`gus-head ${speaking ? "gus-speaking-head" : "gus-thinking-head"}`}>
          <div className="gus-antenna" />
          <div className="gus-face">
            <div className="gus-face-scan" />
            <div className="gus-eye gus-eye-l" />
            <div className="gus-eye gus-eye-r" />
            <div className={`gus-mouth ${speaking ? "gus-mouth-talking" : ""}`} />
          </div>
          <div className="gus-shoulders" />
        </div>
      </div>
      <div className="text-center">
        <div className="font-mono text-[11px] font-black tracking-[0.3em] text-cyan-300">GUS</div>
        <div className="font-mono text-[8px] text-slate-500 tracking-widest uppercase">Safety Intelligence</div>
      </div>
      <div className={`font-mono text-[9px] tracking-widest transition-opacity duration-300 ${speaking ? "text-cyan-400 opacity-100" : "text-slate-600 opacity-50"}`}>
        {speaking ? "● SPEAKING" : "● STANDBY"}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GusStatusBriefing() {
  const { user } = useDemoUser();

  const [visible,   setVisible]   = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [statsIn,   setStatsIn]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [exiting,   setExiting]   = useState(false);
  const [muted,     setMuted]     = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [speaking,  setSpeaking]  = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const speakSeq = useRef(0);

  function getCtx(): AudioContext | null {
    if (!audioCtx.current) audioCtx.current = makeAudioCtx();
    const ctx = audioCtx.current;
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  // Show on every login (each time the user identity switches to Maria Lopez).
  // The briefing's clients/stats are fabricated demo theater — only ever show it
  // in MOCK_MODE so production never renders fake client health/CAPA numbers.
  useEffect(() => {
    if (!MOCK_MODE || !user.is_reliance) return;
    // Clean up any in-progress audio/speech from a prior showing
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speakSeq.current++;
    // Reset all animation state so the boot sequence plays fresh
    setVisible(false);
    setDone(false);
    setExiting(false);
    setLineIndex(0);
    setStatsIn(false);
    setSpeaking(false);
    setPlaying(false);
    const t = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(t);
  }, [user.is_reliance]);

  // Try to play MP3
  useEffect(() => {
    if (!visible) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.9;
    audio.play().then(() => setPlaying(true)).catch(() => {});
    const onEnd = () => setPlaying(false);
    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, [visible]);

  // Boot line ticker + boot sounds
  useEffect(() => {
    if (!visible) return;
    if (lineIndex >= BOOT_LINES.length) {
      const t = setTimeout(() => setStatsIn(true), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (!muted) { const ctx = getCtx(); if (ctx) playBootLine(ctx, lineIndex); }
      setLineIndex((i) => i + 1);
    }, lineIndex === 0 ? 200 : 380);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- boot-line ticker is driven solely by visible/lineIndex; muted/getCtx are read imperatively and excluded to avoid re-scheduling the timer
  }, [visible, lineIndex]);

  // Stats appear: power-on chord + TTS fallback
  useEffect(() => {
    if (!statsIn) return;
    if (!muted) { const ctx = getCtx(); if (ctx) playStatsChord(ctx); }
    if (muted || playing || !("speechSynthesis" in window)) return;

    const mySeq = ++speakSeq.current;
    window.speechSynthesis.cancel();
    let idx = 0;
    setSpeaking(true);

    function next() {
      if (speakSeq.current !== mySeq || idx >= SPOKEN_LINES.length) {
        setSpeaking(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(SPOKEN_LINES[idx++]);
      const voices = window.speechSynthesis.getVoices();
      const male   = voices.find((v) =>
        /david|mark|guy|daniel|brian|alex|george|james/i.test(v.name) &&
        !/(female|woman|girl)/i.test(v.name)
      );
      if (male) { u.voice = male; u.lang = male.lang; }
      u.rate   = 0.88;
      u.pitch  = 0.72;
      u.volume = 1;
      u.onend  = next;
      u.onerror = () => { if (speakSeq.current === mySeq) setSpeaking(false); };
      window.speechSynthesis.speak(u);
    }
    const t = setTimeout(next, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when statsIn flips true; muted/playing and the speech helpers are read imperatively and excluded to avoid re-speaking
  }, [statsIn]);

  function toggleMute() {
    const next = !muted;
    if (audioRef.current) audioRef.current.muted = next;
    if (next) {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      speakSeq.current++;
      setSpeaking(false);
    }
    setMuted(next);
  }

  function acknowledge() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speakSeq.current++;
    setSpeaking(false);
    const ctx = getCtx();
    if (ctx && !muted) playExitDown(ctx);
    setExiting(true);
    setTimeout(() => setDone(true), 850);
  }

  if (!MOCK_MODE || !visible || done) return null;

  const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <>
      <style>{`
        /* ─── Orb ─── */
        .gus-orb {
          position:relative; width:168px; height:168px; border-radius:50%;
          background:radial-gradient(circle at 50% 35%,
            rgba(255,255,255,.95) 0 18%,rgba(229,244,255,.85) 19% 38%,
            rgba(85,198,255,.18) 39% 58%,rgba(11,24,42,.92) 59% 100%);
          box-shadow:0 0 48px rgba(103,216,255,.3),0 0 0 1px rgba(103,216,255,.12);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .gus-orb::before,.gus-orb::after {
          content:""; position:absolute; border-radius:50%;
          border:1px solid rgba(103,216,255,.28); inset:-12px;
          animation:gus-ring 3s ease-in-out infinite;
        }
        .gus-orb::after { inset:-26px; border-color:rgba(215,173,69,.16); animation-delay:.7s; }
        @keyframes gus-ring {
          0%,100%{transform:scale(.98);opacity:.45} 50%{transform:scale(1.04);opacity:1}
        }
        /* ─── Head ─── */
        .gus-head {
          position:relative; width:114px; height:132px;
          background:linear-gradient(180deg,#fff,#eaf6ff);
          border-radius:48% 48% 42% 42%/40% 40% 54% 54%;
          border:2.5px solid rgba(145,203,255,.5);
          box-shadow:inset 0 -10px 20px rgba(0,0,0,.08);
        }
        .gus-thinking-head{animation:gus-float 4s ease-in-out infinite}
        .gus-speaking-head {animation:gus-float-fast 1.1s ease-in-out infinite}
        @keyframes gus-float     {0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes gus-float-fast{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        /* ─── Antenna ─── */
        .gus-antenna {
          position:absolute; top:-20px; left:50%; transform:translateX(-50%);
          width:14px; height:28px; border-radius:99px;
          background:linear-gradient(180deg,#f8fcff,#b9dcff);
          border:1.5px solid rgba(145,203,255,.4);
        }
        .gus-antenna::after {
          content:""; position:absolute; top:-10px; left:50%; transform:translateX(-50%);
          width:11px; height:11px; border-radius:50%;
          background:#67d8ff; box-shadow:0 0 14px rgba(103,216,255,.95);
        }
        /* ─── Face ─── */
        .gus-face {
          position:absolute; width:82px; height:62px; top:30px; left:50%;
          transform:translateX(-50%); border-radius:20px;
          background:linear-gradient(180deg,#071a2d,#0d2c48); overflow:hidden;
        }
        .gus-face-scan {
          position:absolute; inset:0;
          background:linear-gradient(90deg,transparent,rgba(103,216,255,.14),transparent);
          animation:gus-fscan 3.6s linear infinite;
        }
        @keyframes gus-fscan{0%{transform:translateX(-110%)}50%{transform:translateX(110%)}100%{transform:translateX(110%)}}
        .gus-eye {
          position:absolute; top:22px; width:18px; height:7px; border-radius:999px;
          background:linear-gradient(90deg,#aff1ff,#4ed2ff);
          box-shadow:0 0 10px rgba(103,216,255,.9);
        }
        .gus-eye-l{left:12px} .gus-eye-r{right:12px}
        .gus-thinking-head .gus-eye{animation:gus-blink 3.4s ease-in-out infinite}
        @keyframes gus-blink{0%,92%,100%{height:7px}96%{height:2px}}
        /* ─── Mouth ─── */
        .gus-mouth {
          position:absolute; left:50%; bottom:13px; transform:translateX(-50%);
          width:24px; height:4px; border-radius:999px;
          background:rgba(103,216,255,.75); box-shadow:0 0 8px rgba(103,216,255,.65);
          transition:.2s ease;
        }
        .gus-mouth-talking{width:36px;height:9px;animation:gus-talk .42s ease-in-out infinite}
        @keyframes gus-talk{
          0%,100%{transform:translateX(-50%) scaleX(.7);opacity:.75}
          50%    {transform:translateX(-50%) scaleX(1.1);opacity:1}
        }
        /* ─── Shoulders ─── */
        .gus-shoulders {
          position:absolute; bottom:-11px; left:50%; transform:translateX(-50%);
          width:96px; height:32px; border-radius:20px;
          background:linear-gradient(180deg,#fbfdff,#ddecff);
          border:2px solid rgba(145,203,255,.32);
          box-shadow:inset 0 -6px 14px rgba(0,0,0,.07);
        }
        /* ─── Scan overlay ─── */
        @keyframes gus-scan{0%{transform:translateY(0);opacity:.6}50%{opacity:.3}100%{transform:translateY(100%);opacity:0}}
        .gus-scan{animation:gus-scan 5s linear infinite}
        /* ─── Fade-in ─── */
        @keyframes gus-fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .gus-fadein{animation:gus-fade-in .5s ease forwards}
        /* ─── Waveform ─── */
        @keyframes gus-wave{0%,100%{height:4px}50%{height:14px}}
        .gw1{animation:gus-wave .8s ease-in-out infinite}
        .gw2{animation:gus-wave .8s ease-in-out infinite .12s}
        .gw3{animation:gus-wave .8s ease-in-out infinite .24s}
        .gw4{animation:gus-wave .8s ease-in-out infinite .36s}
        .gw5{animation:gus-wave .8s ease-in-out infinite .48s}
        /* ─── EXIT ANIMATION ─── */
        @keyframes gus-exit-sweep {
          0%  {bottom:0;height:2px;opacity:0;box-shadow:0 0 0 rgba(103,216,255,0)}
          10% {opacity:1;box-shadow:0 0 28px 6px rgba(103,216,255,.9)}
          90% {bottom:100%;height:2px;opacity:1}
          100%{bottom:100%;height:2px;opacity:0}
        }
        @keyframes gus-exit-panel {
          0%  {transform:scaleY(1) translateY(0);opacity:1}
          25% {transform:scaleY(.96) translateY(-4px);opacity:.9}
          100%{transform:scaleY(0) translateY(-60px);opacity:0}
        }
        @keyframes gus-exit-flash {
          0%  {opacity:0}
          20% {opacity:.65}
          100%{opacity:0}
        }
        @keyframes gus-exit-backdrop {
          0%  {background:rgba(0,0,0,.88);backdrop-filter:blur(4px)}
          55% {background:rgba(0,18,28,.96)}
          100%{background:rgba(0,0,0,0);backdrop-filter:blur(0)}
        }
        .gus-panel-exit    {animation:gus-exit-panel .55s cubic-bezier(.4,0,.2,1) forwards;animation-delay:.13s;transform-origin:top center}
        .gus-backdrop-exit {animation:gus-exit-backdrop .85s ease forwards}
      `}</style>

      <audio ref={audioRef} src={AUDIO_SRC} preload="auto" />

      {/* ── Backdrop ── */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${exiting ? "gus-backdrop-exit" : "bg-black/88 backdrop-blur-sm"}`}>

        {/* ── Panel ── */}
        <div
          className={`relative w-full max-w-3xl rounded-lg border border-cyan-500/40 bg-slate-950 overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.2)] ${exiting ? "gus-panel-exit" : ""}`}
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(6,182,212,0.022) 27px,rgba(6,182,212,0.022) 28px)," +
              "repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(6,182,212,0.022) 27px,rgba(6,182,212,0.022) 28px)",
          }}
        >
          {/* Exit effects — sweep line + flash */}
          {exiting && (
            <>
              <div
                className="absolute inset-x-0 pointer-events-none z-20"
                style={{
                  height: 2,
                  background: "rgba(103,216,255,1)",
                  animation: "gus-exit-sweep .52s ease-in forwards",
                  animationDelay: ".13s",
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none rounded-lg z-10"
                style={{ background: "rgba(6,182,212,0.14)", animation: "gus-exit-flash .45s ease forwards" }}
              />
            </>
          )}

          {/* Passive scan line */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-36 gus-scan"
            style={{ background: "linear-gradient(to bottom,rgba(6,182,212,0.07) 0%,transparent 100%)" }}
          />

          {/* HUD corners */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-0 h-5 w-5 border-l-2 border-t-2 border-cyan-400/60" />
            <div className="absolute top-0 right-0 h-5 w-5 border-r-2 border-t-2 border-cyan-400/60" />
            <div className="absolute bottom-0 left-0 h-5 w-5 border-l-2 border-b-2 border-cyan-400/60" />
            <div className="absolute bottom-0 right-0 h-5 w-5 border-r-2 border-b-2 border-cyan-400/60" />
          </div>

          {/* ── Header ── */}
          <div className="relative flex items-center gap-3 border-b border-cyan-500/20 px-5 py-3">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px] font-bold tracking-widest text-cyan-400">
                GUS — GLOBAL UNIFIED SAFETY INTELLIGENCE
              </div>
              <div className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">
                Reliance Predictive Safety Technologies&nbsp;·&nbsp;Platform v2.6&nbsp;·&nbsp;{timeStr}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className={`flex items-center gap-0.5 h-4 transition-opacity duration-300 ${(playing || speaking) && !muted ? "opacity-100" : "opacity-20"}`}>
                {["gw1","gw2","gw3","gw4","gw5"].map((c) => (
                  <div key={c} className={`w-0.5 rounded-full bg-cyan-400 ${c}`} style={{ height: 4 }} />
                ))}
              </div>
              <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
                className="text-cyan-400/70 hover:text-cyan-300 transition-colors">
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-[9px] tracking-widest text-cyan-400/70">LIVE</span>
            </div>
          </div>

          {/* ── Body: 2 columns ── */}
          <div className="relative flex flex-col sm:flex-row">

            {/* LEFT — GUS character */}
            <div className="flex items-center justify-center border-b sm:border-b-0 sm:border-r border-cyan-500/15 px-6 py-6 sm:w-52 sm:py-8">
              <GusCharacter speaking={(playing || speaking) && !muted} />
            </div>

            {/* RIGHT — boot + stats */}
            <div className="flex-1 min-w-0 flex flex-col">

              {/* Boot terminal */}
              <div className="px-5 pt-5 pb-3">
                <div className="space-y-1 font-mono text-xs">
                  {BOOT_LINES.slice(0, lineIndex).map((line, i) => (
                    <div key={i} className={i === lineIndex - 1 ? "text-slate-300" : "text-slate-500"}>
                      {line}
                    </div>
                  ))}
                  {lineIndex < BOOT_LINES.length && (
                    <div className="text-cyan-300">
                      {BOOT_LINES[lineIndex]}
                      <span className="ml-0.5 inline-block h-3 w-0.5 bg-cyan-400 animate-pulse align-text-bottom" />
                    </div>
                  )}
                </div>
                {lineIndex >= BOOT_LINES.length && (
                  <div className="mt-3 border-t border-cyan-500/20 pt-3 gus-fadein">
                    <p className="font-mono text-sm">
                      <span className="text-white font-semibold">{getGreeting()}, Administrator Lopez.</span>
                      <span className="ml-2 text-cyan-400">Your platform briefing is ready.</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div
                className="px-5 pb-5 flex flex-col gap-3 transition-all duration-700"
                style={{ opacity: statsIn ? 1 : 0, transform: statsIn ? "translateY(0)" : "translateY(14px)" }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Active Clients",  value: "2 / 4", Icon: Globe,         color: "text-cyan-300"  },
                    { label: "Avg Compliance",  value: "83%",   Icon: Activity,      color: "text-amber-400" },
                    { label: "Critical Alerts", value: "2",     Icon: AlertTriangle, color: "text-red-400"   },
                    { label: "Open CAPAs",      value: "18",    Icon: Shield,        color: "text-amber-400" },
                  ].map(({ label, value, Icon, color }) => (
                    <div key={label} className="rounded border border-slate-700/50 bg-slate-900/80 p-2.5">
                      <Icon className={`h-3 w-3 ${color} mb-1.5`} />
                      <div className={`font-mono text-xl font-black leading-none ${color}`}>{value}</div>
                      <div className="font-mono text-[8px] tracking-wider text-slate-500 mt-0.5 uppercase">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded border border-slate-700/50 bg-slate-900/60 p-2.5">
                  <div className="mb-2 font-mono text-[8px] font-bold tracking-widest text-slate-400 uppercase">Client Health</div>
                  <div className="space-y-2">
                    {CLIENTS.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${c.live ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                        <span className="font-mono text-[10px] text-slate-300 w-36 flex-shrink-0 truncate">{c.name}</span>
                        {c.live && c.score !== null ? (
                          <>
                            <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 delay-300 ${scoreBar(c.score)}`}
                                style={{ width: statsIn ? `${c.score}%` : "0%" }} />
                            </div>
                            <span className={`font-mono text-xs font-bold flex-shrink-0 ${scoreText(c.score)}`}>{c.score}%</span>
                          </>
                        ) : (
                          <span className="font-mono text-[9px] text-slate-600 tracking-wider">— PENDING ONBOARD</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-slate-700/50 bg-slate-900/60 p-2.5">
                    <div className="font-mono text-[8px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">P-Engine</div>
                    <div className="flex items-center gap-1 mb-1">
                      <Zap className="h-3 w-3 text-cyan-400" />
                      <span className="font-mono text-xs font-bold text-cyan-300">OPERATIONAL</span>
                    </div>
                    <div className="font-mono text-[8px] text-slate-500 mb-1.5">Stage 3 · 87% confidence</div>
                    <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-500 transition-all duration-1000 delay-500"
                        style={{ width: statsIn ? "87%" : "0%" }} />
                    </div>
                  </div>
                  <div className="rounded border border-slate-700/50 bg-slate-900/60 p-2.5">
                    <div className="font-mono text-[8px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">Platform Security</div>
                    <div className="space-y-1">
                      {[
                        { label: "Data Integrity",   Icon: Database },
                        { label: "AI Queue",          Icon: Shield   },
                        { label: "Auth Systems",      Icon: Shield   },
                        { label: "Tenant Isolation",  Icon: Users    },
                      ].map(({ label, Icon }) => (
                        <div key={label} className="flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 flex-shrink-0" />
                          <span className="font-mono text-[9px] text-slate-400">{label}</span>
                          <span className="font-mono text-[8px] text-emerald-400/60 ml-auto">OK</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={acknowledge}
                  disabled={exiting}
                  className="w-full rounded border border-cyan-500/50 bg-cyan-500/10 py-3 font-mono text-sm font-bold tracking-widest text-cyan-300 transition-all duration-200 hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-white hover:shadow-[0_0_24px_rgba(6,182,212,0.35)] active:scale-[0.99] disabled:opacity-50"
                >
                  ▶&nbsp;&nbsp;ACKNOWLEDGED — ENTER PLATFORM
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

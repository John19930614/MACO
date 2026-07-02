"use client";

/**
 * Login — "hero" design (ported from John's safetyiq-login-hero.html mockup).
 * The visual shell is decorative; ALL auth behavior is unchanged from the
 * previous page: mock-mode credential map + cookies/localStorage, live-mode
 * Supabase password sign-in, neutral-wording password reset, and the
 * demo-credentials accordion (mock mode only).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_USERS } from "@/lib/context/demo-user";
import { MOCK_MODE } from "@/lib/env";
import { MOCK_CREDENTIALS, DEMO_CREDENTIAL_HINTS } from "@/lib/auth/mockCredentials";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";
import "./login-hero.css";

const LS_KEY = "maco-demo-user";
const LOGGED_IN_KEY = "maco-logged-in";

const BOOT_STEPS = ["Initializing SafetyIQ", "Loading site telemetry", "Verifying zone coverage", "Workspace ready"];

// Deliberately capability-language, not fabricated live events — the login
// screen must never imply data that doesn't exist (see shell/mock cleanup).
const TICKER_MSGS = [
  "<b>PERMITS</b> · Hot-work, confined space, LOTO — tracked end to end",
  "<b>INSPECTIONS</b> · Documented with a full audit trail",
  "<b>JSA</b> · Field-ready job safety analyses",
  "<b>HAZARD AI</b> · Findings grounded in your site's real data",
  "<b>COVERAGE</b> · Every zone, every shift",
  "<b>DOCUMENTS</b> · EHS programs generated and version-controlled",
];

function Counter({ target, suffix, ready }: { target: number; suffix: string; ready: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = 1600;
    const step = (now: number) => {
      let p = Math.min((now - t0) / dur, 1);
      p = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ready, target]);
  return <b>{val.toLocaleString()}{suffix}</b>;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetting, setResetting] = useState(false);

  const [ready, setReady] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const [clock, setClock] = useState("--:--:--");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const auroraRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  // ── Redirect if already logged in (unchanged) ──────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (MOCK_MODE && localStorage.getItem(LOGGED_IN_KEY) === "1") {
        router.replace("/dashboard");
      } else if (!MOCK_MODE) {
        const supabase = createClient();
        supabase?.auth.getSession().then(({ data }) => {
          if (data.session) router.replace("/dashboard");
        });
        localStorage.removeItem(LOGGED_IN_KEY);
      }
    }
  }, [router]);

  // ── Boot sequence + reveal ─────────────────────────────────────────────────
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReady(true);
      return;
    }
    const stepInt = setInterval(() => setBootStep((s) => Math.min(s + 1, BOOT_STEPS.length - 1)), 420);
    const go = setTimeout(() => {
      clearInterval(stepInt);
      setReady(true);
    }, 1650);
    return () => {
      clearInterval(stepInt);
      clearTimeout(go);
    };
  }, []);

  // ── Ticker clock ───────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(17, 25) + " UTC");
    tick();
    const int = setInterval(tick, 1000);
    return () => clearInterval(int);
  }, []);

  // ── Space canvas + parallax (decorative; fully cleaned up on unmount) ──────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    type Star = { x: number; y: number; z: number; r: number; tw: number; spd: number };
    type Mote = { x: number; y: number; r: number; vx: number; vy: number; hue: string; a: number };
    type Comet = { x: number; y: number; vx: number; vy: number; life: number; max: number; len: number };
    let W = 0, H = 0, DPR = 1;
    let stars: Star[] = [], motes: Mote[] = [], comets: Comet[] = [];
    let t = 0, mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
    let raf = 0;

    const build = () => {
      stars = [];
      const count = Math.floor((W * H) / 9000);
      for (let i = 0; i < count; i++)
        stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.8 + 0.2, r: Math.random() * 1.4 + 0.2, tw: Math.random() * 6.28, spd: Math.random() * 0.4 + 0.1 });
      motes = [];
      for (let i = 0; i < 26; i++)
        motes.push({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 120 + 60) * DPR, vx: (Math.random() - 0.5) * 0.15 * DPR, vy: (Math.random() - 0.5) * 0.12 * DPR, hue: Math.random() < 0.5 ? "40,230,255" : "43,123,255", a: Math.random() * 0.05 + 0.02 });
    };
    const resize = () => {
      DPR = Math.min(devicePixelRatio || 1, 2);
      W = canvas.width = innerWidth * DPR;
      H = canvas.height = innerHeight * DPR;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      build();
    };
    const onMove = (e: MouseEvent) => {
      tmx = e.clientX / innerWidth;
      tmy = e.clientY / innerHeight;
    };
    const spawnComet = () =>
      comets.push({ x: Math.random() * W * 0.6, y: -20 * DPR + Math.random() * H * 0.35, vx: (2.6 + Math.random() * 2.2) * DPR, vy: (1.4 + Math.random() * 1.4) * DPR, life: 0, max: 90 + Math.random() * 40, len: (90 + Math.random() * 80) * DPR });

    const drawGrid = () => {
      const horizon = H * 0.66, vanishX = W * (0.3 + (mx - 0.5) * 0.05);
      ctx.save();
      ctx.lineWidth = 1 * DPR;
      ctx.strokeStyle = "rgba(40,230,255,0.10)";
      for (let i = 0; i <= 26; i++) {
        const fx = (i / 26) * W * 2 - W * 0.5;
        ctx.beginPath(); ctx.moveTo(vanishX, horizon); ctx.lineTo(fx, H); ctx.stroke();
      }
      for (let i = 1; i <= 16; i++) {
        let f = i / 16; f = f * f;
        const scroll = (t * 0.00035) % (1 / 16);
        const yy = horizon + (H - horizon) * (f + scroll);
        if (yy > H) continue;
        ctx.strokeStyle = "rgba(40,230,255," + 0.13 * (1 - f * 0.7) + ")";
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }
      const grd = ctx.createLinearGradient(0, horizon - 40 * DPR, 0, horizon + 2);
      grd.addColorStop(0, "rgba(40,230,255,0)");
      grd.addColorStop(1, "rgba(40,230,255,0.25)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, horizon - 40 * DPR, W, 42 * DPR);
      ctx.restore();
    };

    const loop = () => {
      t += 16;
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#03060f";
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "lighter";
      for (const m of motes) {
        m.x += m.vx; m.y += m.vy;
        if (m.x < -m.r) m.x = W + m.r; if (m.x > W + m.r) m.x = -m.r;
        if (m.y < -m.r) m.y = H + m.r; if (m.y > H + m.r) m.y = -m.r;
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        g.addColorStop(0, "rgba(" + m.hue + "," + m.a + ")");
        g.addColorStop(1, "rgba(" + m.hue + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28); ctx.fill();
      }

      const px = (mx - 0.5) * 30 * DPR, py = (my - 0.5) * 30 * DPR;
      for (const s of stars) {
        s.tw += 0.02 * s.spd;
        const tw = 0.55 + Math.sin(s.tw) * 0.45;
        const x = s.x - px * s.z, y = s.y - py * s.z;
        ctx.fillStyle = "rgba(200,238,255," + tw * s.z + ")";
        ctx.beginPath(); ctx.arc(x, y, s.r * s.z * DPR, 0, 6.28); ctx.fill();
        if (s.r > 1.1) {
          ctx.fillStyle = "rgba(120,220,255," + tw * 0.12 + ")";
          ctx.beginPath(); ctx.arc(x, y, s.r * 3 * s.z * DPR, 0, 6.28); ctx.fill();
        }
      }

      if (!reduce && Math.random() < 0.012 && comets.length < 3) spawnComet();
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.x += c.vx; c.y += c.vy; c.life++;
        const fade = 1 - c.life / c.max;
        if (fade <= 0 || c.x > W + 50 || c.y > H + 50) { comets.splice(i, 1); continue; }
        const h = Math.hypot(c.vx, c.vy), tx = c.x - (c.vx / h) * c.len, ty = c.y - (c.vy / h) * c.len;
        const g = ctx.createLinearGradient(c.x, c.y, tx, ty);
        g.addColorStop(0, "rgba(191,246,255," + fade + ")");
        g.addColorStop(1, "rgba(40,230,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 2 * DPR; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255," + fade + ")";
        ctx.beginPath(); ctx.arc(c.x, c.y, 1.8 * DPR, 0, 6.28); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      drawGrid();

      if (auroraRef.current)
        auroraRef.current.style.transform = "translate(" + tmx * innerWidth + "px," + tmy * innerHeight + "px)";
      const rx = (my - 0.5) * -8, ry = (mx - 0.5) * 10;
      if (coreRef.current)
        coreRef.current.style.transform = "translate(-50%,-50%) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateZ(0)";
      if (chipsRef.current)
        chipsRef.current.style.transform = "rotateX(" + rx * 0.6 + "deg) rotateY(" + ry * 0.6 + "deg)";
      raf = requestAnimationFrame(loop);
    };

    addEventListener("resize", resize);
    addEventListener("mousemove", onMove);
    resize();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      removeEventListener("mousemove", onMove);
    };
  }, []);

  // ── Sign in (unchanged behavior) ───────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    if (MOCK_MODE) {
      const key = email.trim().toLowerCase();
      const cred = MOCK_CREDENTIALS[key];
      if (!cred || cred.password !== password) {
        setAuthError("Invalid email or password.");
        setLoading(false);
        return;
      }
      const profile = DEMO_USERS.find((u) => u.id === cred.profileId);
      if (!profile) {
        setAuthError("Profile not found — contact your administrator.");
        setLoading(false);
        return;
      }
      const tenantId = profile.tenant_id ?? "t-biostar-001";
      document.cookie = `maco-mock-tenant=${tenantId}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `maco-mock-profile=${profile.id}; path=/; max-age=86400; SameSite=Lax`;
      localStorage.setItem(LS_KEY, profile.id);
      localStorage.setItem(LOGGED_IN_KEY, "1");
      router.push("/dashboard");
    } else {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setAuthError(error.message);
      } else {
        // Hard navigation so the auth cookie is committed before the middleware
        // checks the session on the next request (router.push races the cookie)
        window.location.href = "/dashboard";
      }
    }
  }

  // ── Password reset (unchanged behavior) ────────────────────────────────────
  async function handleForgotPassword() {
    setAuthError("");
    setResetMsg("");
    const target = email.trim().toLowerCase();
    if (!target) {
      setAuthError("Enter your work email above, then choose “Forgot password.”");
      return;
    }
    setResetting(true);
    const supabase = createClient();
    if (!supabase) { setResetting(false); return; }
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo });
    setResetting(false);
    // Always show a neutral confirmation — never reveal whether an account exists.
    setResetMsg(
      error
        ? "If an account exists for that email, a reset link is on its way."
        : "Check your inbox — we sent a password reset link to that email.",
    );
  }

  return (
    <div className={`lh${ready ? " ready" : ""}`}>
      {/* BOOT OVERLAY */}
      <div className={`boot${ready ? " done" : ""}`} aria-hidden="true">
        <svg className="bl" viewBox="0 0 100 100" fill="none">
          <path d="M50 6 L86 22 V50 C86 74 70 88 50 95 C30 88 14 74 14 50 V22 Z" stroke="#28e6ff" strokeWidth="4" fill="rgba(40,230,255,.06)" />
          <path d="M36 51 l10 11 20 -24" stroke="#6ff3ff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="btxt">{BOOT_STEPS[bootStep]}</div>
        <div className="bbar"><i /></div>
      </div>

      <div className="stage">
        <canvas ref={canvasRef} className="space" />
        <div ref={auroraRef} className="aurora" />
        <div className="atmos" />
        <div className="scan" />

        {/* ORBITAL CORE */}
        <div ref={coreRef} className="core-wrap" aria-hidden="true">
          <svg viewBox="0 0 400 400">
            <defs>
              <radialGradient id="coreG" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#bff6ff" /><stop offset="45%" stopColor="#28e6ff" /><stop offset="100%" stopColor="#2b7bff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6ff3ff" /><stop offset="1" stopColor="#2b7bff" /></linearGradient>
              <linearGradient id="sweepG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#28e6ff" stopOpacity="0" /><stop offset="100%" stopColor="#28e6ff" stopOpacity=".35" /></linearGradient>
              <linearGradient id="beamG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#28e6ff" stopOpacity=".22" /><stop offset="1" stopColor="#28e6ff" stopOpacity="0" /></linearGradient>
            </defs>
            <g className="beam">
              <path d="M200 200 L176 -40 L224 -40 Z" fill="url(#beamG)" />
              <path d="M200 200 L440 176 L440 224 Z" fill="url(#beamG)" opacity=".7" />
            </g>
            <g className="radar"><path d="M200 200 L200 40 A160 160 0 0 1 320 120 Z" fill="url(#sweepG)" /></g>
            <g fill="none" stroke="url(#ringG)">
              <circle className="spin-slow dash" cx="200" cy="200" r="185" strokeWidth="1" strokeOpacity=".35" />
              <circle cx="200" cy="200" r="185" strokeWidth="1" strokeOpacity=".18" />
              <ellipse className="spin-mid" cx="200" cy="200" rx="150" ry="60" strokeWidth="1.2" strokeOpacity=".5" />
              <ellipse className="spin-slow" cx="200" cy="200" rx="60" ry="150" strokeWidth="1.2" strokeOpacity=".4" />
              <circle className="spin-fast" cx="200" cy="200" r="120" strokeWidth="1" strokeOpacity=".3" strokeDasharray="2 10" />
              <circle cx="200" cy="200" r="95" strokeWidth="1" strokeOpacity=".25" />
            </g>
            <g stroke="none">
              <g className="n1"><circle cx="200" cy="15" r="5" fill="#6ff3ff" /><circle cx="200" cy="15" r="10" fill="#6ff3ff" opacity=".2" /></g>
              <g className="n2"><circle cx="200" cy="50" r="4" fill="#3dff9e" /><circle cx="200" cy="50" r="9" fill="#3dff9e" opacity=".2" /></g>
              <g className="n3"><circle cx="200" cy="80" r="3.5" fill="#2b7bff" /></g>
            </g>
            <g className="core-pulse">
              <circle cx="200" cy="200" r="55" fill="url(#coreG)" />
              <path d="M200 168 l26 11 v18 c0 17 -12 30 -26 36 c-14 -6 -26 -19 -26 -36 v-18 z" fill="rgba(3,10,26,.55)" stroke="#bff6ff" strokeWidth="2.2" />
              <path d="M189 200 l7 8 15 -18" fill="none" stroke="#bff6ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
        </div>

        {/* FLOATING CHIPS — capability labels, not fabricated live data */}
        <div ref={chipsRef} className="chips" aria-hidden="true">
          <div className="chip c1"><span className="dot" />Site coverage · <small>Live</small></div>
          <div className="chip wave c2">
            <svg viewBox="0 0 56 20"><path className="ekg" d="M0 10 H10 l3 -7 4 14 3 -7 H30 l3 5 3 -10 3 5 H56" /></svg>
            Monitoring <small>Real-time</small>
          </div>
          <div className="chip c3">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" stroke="#3dff9e" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            Permits &amp; JSAs <small>Tracked</small>
          </div>
          <div className="chip c4"><span className="dot" />Hazard AI <small>Live</small></div>
        </div>

        <div className="vignette" />

        {/* HERO */}
        <section className="hero">
          <div className="brand reveal d1">
            <svg className="mark" viewBox="0 0 100 100" fill="none">
              <defs><linearGradient id="markG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6ff3ff" /><stop offset="1" stopColor="#2b7bff" /></linearGradient></defs>
              <path d="M50 6 L86 22 V50 C86 74 70 88 50 95 C30 88 14 74 14 50 V22 Z" stroke="url(#markG)" strokeWidth="4" fill="rgba(40,230,255,.06)" />
              <path d="M36 51 l10 11 20 -24" stroke="url(#markG)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <div className="brand-name">Safety<b>IQ</b><span>Predictive Safety Intelligence</span></div>
          </div>

          <span className="eyebrow reveal d2"><i />Predictive Safety Platform</span>

          <h1 className="reveal d2">Catch hazards early.<br /><span className="accent">Prove</span> every control.</h1>

          <p className="sub reveal d3">
            Real-time site coverage, permits and JSAs, documented inspections, and AI-flagged
            hazards — with the audit trail to back it up. Built for the field, ready for review.
          </p>

          <div className="stats reveal d4">
            <div className="stat"><div className="n"><Counter target={100} suffix="%" ready={ready} /></div><div className="l">Audit-Ready</div></div>
            <div className="stat"><div className="n"><b>24/7</b></div><div className="l">Site Coverage</div></div>
            <div className="stat"><div className="n"><Counter target={19} suffix="" ready={ready} /></div><div className="l">Industry Verticals</div></div>
          </div>
        </section>

        {/* LOGIN */}
        <section className="panel">
          <form className="card reveal" onSubmit={handleSignIn}>
            <span className="tick tl" /><span className="tick tr" /><span className="tick bl" /><span className="tick br" />
            <h2>Sign in to SafetyIQ</h2>
            <p className="lead">Access your site&apos;s safety workspace.</p>

            <div className="field">
              <label htmlFor="email">Work Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input
                id="pw"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {!MOCK_MODE && (
              <div className="row">
                <button type="button" className="link" onClick={handleForgotPassword} disabled={resetting}>
                  {resetting ? "Sending…" : "Forgot password?"}
                </button>
              </div>
            )}

            {authError && <div className="msg err">{authError}</div>}
            {resetMsg && <div className="msg info">{resetMsg}</div>}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Enter Platform →"}
            </button>

            <div className="secure">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" stroke="#8ea6c8" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              End-to-end encrypted · Enterprise-grade security
            </div>
          </form>

          {/* Demo credentials accordion — only in mock mode (unchanged behavior) */}
          {MOCK_MODE && (
            <div className="demo">
              <button type="button" onClick={() => setHintsOpen((o) => !o)}>
                <span>
                  <span className="dh">Demo access</span>
                  <span className="ds" style={{ display: "block" }}>Click to view demo account credentials</span>
                </span>
                <ChevronDown
                  style={{ width: 16, height: 16, color: "var(--muted)", transition: "transform .2s", transform: hintsOpen ? "rotate(180deg)" : "none" }}
                />
              </button>
              {hintsOpen && (
                <div className="body">
                  {DEMO_CREDENTIAL_HINTS.map((group) => (
                    <div key={group.company} className="grp">
                      <div className="gt"><b>{group.company}</b><i>{group.note}</i></div>
                      {group.users.map((u) => (
                        <button
                          key={u.email}
                          type="button"
                          className="u"
                          onClick={() => {
                            setEmail(u.email);
                            setPassword(u.password);
                            setHintsOpen(false);
                          }}
                        >
                          <span className="av">{u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span className="nm" style={{ display: "block" }}>{u.name}</span>
                            <span className="rl" style={{ display: "block" }}>{u.role}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="pw">
                    Password for BioStar &amp; NovaBio: <code>SafetyIQ2026!</code> · Reliance admin: <code>Reliance@2026!</code>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* COMMAND TICKER */}
        <div className="ticker" aria-hidden="true">
          <span className="sysdot" /><span>SYS</span><span className="clock">{clock}</span>
          <div className="feed">
            <div className="run" dangerouslySetInnerHTML={{ __html: [...TICKER_MSGS, ...TICKER_MSGS].map((m) => `<span>${m}</span>`).join("") }} />
          </div>
        </div>
      </div>
    </div>
  );
}

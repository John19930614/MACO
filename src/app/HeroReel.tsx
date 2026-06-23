"use client";

/*
  RELIANCE PREDICTIVE SAFETY TECHNOLOGIES — Landing Page Hero Reel
  React/Next.js port of reliance-hero-reel.html. Five-slide auto-advancing
  carousel: PROMISE · PREDICT · AI · CONSOLIDATE · ENFORCE.
*/

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import "./hero-reel.css";

const DURATION = 6800;
const SLIDES = 5;

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}

/* Cubic-ease count-up that resets to 0 and replays each time its slide
   becomes active (run flips to true). */
function CountUp({ value, run, reduce }: { value: number; run: boolean; reduce: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) { setN(0); return; }
    if (reduce) { setN(value); return; }
    let raf = 0;
    let start: number | null = null;
    const dur = 1200;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / dur, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else setN(value);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, value, reduce]);
  return <>{n}</>;
}

export default function HeroReel() {
  const [active, setActive] = useState(0);
  const reduce = usePrefersReducedMotion();

  const go = (n: number) => setActive(((n % SLIDES) + SLIDES) % SLIDES);

  // Auto-advance continuously. Manual nav (dots/arrows/keys) just resets the
  // timer via the `active` dependency — it never stops the reel. Honors the
  // reduced-motion preference.
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % SLIDES), DURATION);
    return () => clearTimeout(t);
  }, [active, reduce]);

  const slideClass = (i: number, base: string) =>
    `rps-slide ${base}${i === active ? " is-active" : ""}`;

  return (
    <div className="rps-landing">
      {/* Brand fonts — React hoists these into <head> and de-dupes them. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
        rel="stylesheet"
      />

      <section
        className="rps-hero"
        aria-roledescription="carousel"
        aria-label="Reliance Predictive Safety Technologies highlights"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(active + 1);
          else if (e.key === "ArrowLeft") go(active - 1);
        }}
      >
        <div className="rps-brand">
          <svg className="mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
              d="M24 3 6 9.5V21c0 11 7.7 18.4 18 23 10.3-4.6 18-12 18-23V9.5L24 3Z"
              stroke="#e6b647"
              strokeWidth="2.4"
              fill="rgba(230,182,71,.07)"
            />
            <path
              d="M13 27c4-9 6-9 7.5-2.5S24 33 26 25s3.5-10 9-10"
              stroke="#4b8cff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M31 13h6v6"
              stroke="#4b8cff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div className="name">RELIANCE</div>
            <div className="tag">Predictive Safety Technologies</div>
          </div>
        </div>

        <div className="rps-track">
          {/* ===== 1 · PROMISE ===== */}
          <article className={slideClass(0, "bg-1 solo")} data-i="0">
            <div className="lifeline-bg">
              <svg
                className="lifeline"
                viewBox="0 0 1000 300"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                <path
                  className="trace"
                  d="M0 150 H250 l26 0 22 -82 30 164 26 -126 24 88 18 -44 H560 l26 0 22 -82 30 164 26 -126 24 88 18 -44 H1000"
                />
              </svg>
            </div>
            <div className="rps-scrim" />
            <div className="rps-inner">
              <div className="rps-copy">
                <span className="rps-eyebrow">
                  <span className="dot" />All sites — coverage active
                </span>
                <h1 className="rps-h1">
                  Everyone<br />goes <span className="gold">home.</span>
                </h1>
                <p className="rps-sub">
                  The mission behind every dashboard, permit, and forecast we build. Reliance keeps
                  the line steady so the work stays safe and your crew goes home.
                </p>
                <div className="rps-cta">
                  <Link className="btn btn-primary" href="/login">Request a pilot</Link>
                  <Link className="btn btn-ghost" href="/login">See the platform</Link>
                </div>
                <div className="rps-rule" />
              </div>
            </div>
          </article>

          {/* ===== 2 · PREDICT ===== */}
          <article className={slideClass(1, "bg-2")} data-i="1">
            <div className="rps-scrim" />
            <div className="rps-inner">
              <div className="rps-copy">
                <span className="rps-eyebrow">
                  <span className="dot" />Predictive safety · forecasting
                </span>
                <h1 className="rps-h1">
                  Predict it<br />before it <span className="gold">happens.</span>
                </h1>
                <p className="rps-sub">
                  Leading indicators are scored continuously and projected forward. Reliance flags
                  the rising-risk window early — so you act on the forecast, not the incident report.
                </p>
                <div className="rps-cta">
                  <Link className="btn btn-primary" href="/login">Request a pilot</Link>
                  <Link className="btn btn-ghost" href="/login">How forecasting works</Link>
                </div>
                <div className="rps-rule" />
              </div>
              <div className="rps-stage">
                <div className="forecast">
                  <svg viewBox="0 0 460 300" aria-hidden="true">
                    <rect className="fc-band" x="250" y="20" width="200" height="240" rx="6" />
                    <line className="fc-now" x1="250" y1="20" x2="250" y2="260" />
                    <text x="256" y="36" fill="#9bb0d3" fontFamily="IBM Plex Mono, monospace" fontSize="11" letterSpacing="2">FORECAST</text>
                    <text x="244" y="36" fill="#9bb0d3" fontFamily="IBM Plex Mono, monospace" fontSize="11" letterSpacing="2" textAnchor="end">NOW</text>
                    <path className="fc-hist" d="M14 214 C70 206 100 222 140 206 S210 186 250 190" />
                    <path className="fc-pred fc-pred-draw" d="M250 190 C300 184 330 150 370 110 S430 70 446 64" />
                    <circle className="fc-alert" cx="446" cy="64" r="6" />
                    <circle className="fc-ring" cx="446" cy="64" r="6" />
                    <g className="fc-flag">
                      <rect x="330" y="40" width="118" height="26" rx="5" fill="rgba(239,68,68,.16)" stroke="rgba(239,68,68,.5)" />
                      <text x="389" y="57" fill="#ff7a7a" fontFamily="IBM Plex Mono, monospace" fontSize="11" fontWeight="600" letterSpacing="1" textAnchor="middle">RISK ↑ 72H AHEAD</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </article>

          {/* ===== 3 · AI INTELLIGENCE ===== */}
          <article className={slideClass(2, "bg-3")} data-i="2">
            <div className="rps-scrim" />
            <div className="rps-inner">
              <div className="rps-copy">
                <span className="rps-eyebrow blue">
                  <span className="dot" />AI safety intelligence
                </span>
                <h1 className="rps-h1">
                  Intelligence on<br />every <span className="blue">report.</span>
                </h1>
                <p className="rps-sub">
                  Our AI core reads every permit, JSA, audit, and field report as it comes in —
                  surfacing the risk flags, coverage gaps, and corrective actions a person would
                  miss at scale.
                </p>
                <div className="rps-cta">
                  <Link className="btn btn-primary" href="/login">Request a pilot</Link>
                  <Link className="btn btn-ghost" href="/login">Meet the AI core</Link>
                </div>
                <div className="rps-rule" />
              </div>
              <div className="rps-stage">
                <div className="ai">
                  <svg className="ai-svg" viewBox="0 0 480 330" preserveAspectRatio="none" aria-hidden="true">
                    <path className="ai-conn" d="M70 40 C150 60 180 130 230 165" />
                    <path className="ai-conn" d="M70 165 C150 165 180 165 230 165" />
                    <path className="ai-conn" d="M70 290 C150 270 180 200 230 165" />
                    <path className="ai-conn" d="M250 165 C300 130 330 70 410 52" />
                    <path className="ai-conn" d="M250 165 C300 165 330 165 410 165" />
                    <path className="ai-conn" d="M250 165 C300 200 330 262 410 280" />
                    <circle className="ai-dot" r="3"><animateMotion dur="2.2s" repeatCount="indefinite" path="M70 40 C150 60 180 130 230 165" /></circle>
                    <circle className="ai-dot" r="3"><animateMotion dur="2.2s" begin="0.7s" repeatCount="indefinite" path="M70 165 C150 165 180 165 230 165" /></circle>
                    <circle className="ai-dot" r="3"><animateMotion dur="2.2s" begin="1.4s" repeatCount="indefinite" path="M70 290 C150 270 180 200 230 165" /></circle>
                    <circle className="ai-dot" r="3" fill="#e6b647"><animateMotion dur="2.2s" begin="1.1s" repeatCount="indefinite" path="M250 165 C300 130 330 70 410 52" /></circle>
                    <circle className="ai-dot" r="3" fill="#2bd46b"><animateMotion dur="2.2s" begin="1.8s" repeatCount="indefinite" path="M250 165 C300 200 330 262 410 280" /></circle>
                  </svg>
                  <div className="ai-core">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
                        stroke="#eaf1ff"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <circle cx="12" cy="12" r="4.4" stroke="#eaf1ff" strokeWidth="1.8" />
                    </svg>
                  </div>
                  <div className="ai-chip i1">Permits</div>
                  <div className="ai-chip i2">JSAs / DAPs</div>
                  <div className="ai-chip i3">Audits &amp; field reports</div>
                  <div className="ai-chip out o1 gold">Risk flags</div>
                  <div className="ai-chip out o2">Coverage gaps</div>
                  <div className="ai-chip out o3 safe">Corrective actions</div>
                </div>
              </div>
            </div>
          </article>

          {/* ===== 4 · CONSOLIDATE ===== */}
          <article className={slideClass(3, "bg-4")} data-i="3">
            <div className="rps-scrim" />
            <div className="rps-inner">
              <div className="rps-copy">
                <span className="rps-eyebrow">
                  <span className="dot" />One source of truth
                </span>
                <h1 className="rps-h1">
                  One board.<br />Every <span className="gold">site.</span>
                </h1>
                <p className="rps-sub">
                  Permits, JSAs, audits, coverage, and certifications — live, in one place. Know
                  your status across every jobsite before anyone has to ask for it.
                </p>
                <div className="rps-cta">
                  <Link className="btn btn-primary" href="/login">Request a pilot</Link>
                  <Link className="btn btn-ghost" href="/login">View a demo board</Link>
                </div>
                <div className="rps-rule" />
              </div>
              <div className="rps-stage">
                <div className="board">
                  <div className="tile good">
                    <div className="k">Days w/o incident</div>
                    <div className="v"><CountUp value={247} run={active === 3} reduce={reduce} /></div>
                    <div className="bar"><i style={{ "--w": "92%" } as CSSProperties} /></div>
                  </div>
                  <div className="tile">
                    <div className="k">JSAs verified today</div>
                    <div className="v"><CountUp value={38} run={active === 3} reduce={reduce} /></div>
                    <div className="bar"><i style={{ "--w": "78%" } as CSSProperties} /></div>
                  </div>
                  <div className="tile warn">
                    <div className="k">Open permits</div>
                    <div className="v"><CountUp value={6} run={active === 3} reduce={reduce} /></div>
                    <div className="bar"><i style={{ "--w": "40%", background: "var(--gold)" } as CSSProperties} /></div>
                  </div>
                  <div className="tile good">
                    <div className="k">Coverage</div>
                    <div className="v">100<small>%</small></div>
                    <div className="bar"><i style={{ "--w": "100%", background: "var(--safe)" } as CSSProperties} /></div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* ===== 5 · ENFORCE ===== */}
          <article className={slideClass(4, "bg-5")} data-i="4">
            <div className="rps-scrim" />
            <div className="rps-inner">
              <div className="rps-copy">
                <span className="rps-eyebrow blue">
                  <span className="dot" />Controls shall be implemented
                </span>
                <h1 className="rps-h1">
                  Nothing starts<br /><span className="blue">unverified.</span>
                </h1>
                <p className="rps-sub">
                  Field verification, competent-person sign-off, and stop-work authority are built
                  into every workflow — required prior to starting work, not stapled on after the
                  fact.
                </p>
                <div className="rps-cta">
                  <Link className="btn btn-primary" href="/login">Request a pilot</Link>
                  <Link className="btn btn-ghost" href="/login">See the workflow</Link>
                </div>
                <div className="rps-rule" />
              </div>
              <div className="rps-stage">
                <div className="checklist">
                  {[
                    ["Permit issued", "prior to starting work"],
                    ["JSA reviewed with crew", "field verification complete"],
                    ["Competent person on site", "certification current"],
                    ["Stop-work authority active", "every worker, every shift"],
                  ].map(([title, sub]) => (
                    <div className="row" key={title}>
                      <div className="chk">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="txt">{title}<span>{sub}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="rps-dots" role="tablist" aria-label="Choose slide">
          {Array.from({ length: SLIDES }).map((_, idx) => (
            <button
              key={idx}
              role="tab"
              aria-label={`Slide ${idx + 1}`}
              aria-selected={active === idx}
              className={active === idx ? "active" : ""}
              style={{ "--dur": `${DURATION}ms` } as CSSProperties}
              onClick={() => go(idx)}
            >
              <span className="prog" />
            </button>
          ))}
        </div>

        <div className="rps-arrows">
          <button aria-label="Previous slide" onClick={() => go(active - 1)}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button aria-label="Next slide" onClick={() => go(active + 1)}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </section>
    </div>
  );
}

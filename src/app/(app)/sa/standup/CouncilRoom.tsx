"use client";

/**
 * 3D AI Agent Council Room — the visual front-end for the daily GUS × EHS
 * standup, adapted from John's council-room concept and wired to our REAL
 * meeting data (CspMeeting). Gus and the EHS Agent take the two active seats and
 * "speak" the actual exchange; eight shell seats preview future agents. The
 * presentation screen shows live metrics, and the side tabs render the real
 * briefings, gaps, and action items.
 *
 * Scoped under .cr so its styles never leak into the rest of the app.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conveneAgentStandup } from "@/lib/actions/csp";
import type { CspMeeting } from "@/lib/csp/types";

interface Seat {
  key: string; name: string; sub: string; cls: string; active?: boolean;
  role: string; desc: string;
}

const SEATS: Seat[] = [
  { key: "gus", name: "Gus", sub: "Active", cls: "gus", active: true,
    role: "AI Safety Coach / Platform Intelligence", desc: "Gus brings the platform picture — compliance health, P-Engine forecast, module weakness, overdue actions, and emerging risk signals." },
  { key: "ehs", name: "EHS Agent", sub: "Active", cls: "hse", active: true,
    role: "CSP-informed EHS Records Validation Agent", desc: "Reviews records for completeness, evidence, and regulatory triggers; routes high-stakes cases to human review; learns from sign-offs." },
  { key: "gateway", name: "AI Gateway", sub: "Shell", cls: "gateway", role: "Future AI Action Control Agent", desc: "Will approve, block, log, or escalate AI actions before they affect the platform." },
  { key: "verity", name: "Verity", sub: "Shell", cls: "verity", role: "Future Quality Management Agent", desc: "Will review quality documents, evidence completeness, CAPA strength, and audit readiness." },
  { key: "compliance", name: "Compliance", sub: "Shell", cls: "compliance", role: "Future Compliance Register Agent", desc: "Will map findings to approved regulatory, client, and site requirements." },
  { key: "capa", name: "CAPA", sub: "Shell", cls: "capa", role: "Future Corrective Action Agent", desc: "Will assign actions, track deadlines, collect proof, and verify effectiveness." },
  { key: "doc", name: "Doc Control", sub: "Shell", cls: "doc", role: "Future Document Control Agent", desc: "Will verify revisions, approvals, effective dates, and retention." },
  { key: "contractor", name: "Contractor", sub: "Shell", cls: "contractor", role: "Future Contractor Readiness Agent", desc: "Will review onboarding, insurance, qualifications, and readiness." },
  { key: "prediction", name: "Risk Prediction", sub: "Shell", cls: "prediction", role: "Future Predictive Risk Agent", desc: "Will forecast where risk is likely to increase from trends and exposures." },
  { key: "training", name: "Training", sub: "Shell", cls: "training", role: "Future Training Compliance Agent", desc: "Will compare roles, tasks, qualifications, and expirations." },
];

type Metrics = { ehs?: Record<string, number>; platform?: Record<string, number | null> };

export default function CouncilRoom({ meetings }: { meetings: CspMeeting[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(meetings[0]?.id ?? null);
  const meeting = useMemo(() => meetings.find((m) => m.id === selectedId) ?? meetings[0] ?? null, [meetings, selectedId]);

  const [step, setStep] = useState(0);            // index into exchange; -1 = idle
  const [playing, setPlaying] = useState(false);
  const [convening, setConvening] = useState(false);
  const [tab, setTab] = useState<"agenda" | "transcript" | "findings" | "actions" | "reflections" | "agents">("agenda");
  const [modal, setModal] = useState<Seat | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exchange = meeting?.exchange ?? [];
  const current = step >= 0 && step < exchange.length ? exchange[step] : null;
  const activeSpeaker = current?.speaker ?? null;

  // playback loop
  useEffect(() => {
    if (!playing) return;
    if (step >= exchange.length - 1) { setPlaying(false); return; }
    timer.current = setTimeout(() => setStep((s) => s + 1), 2600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, step, exchange.length]);

  // reset playback when the selected meeting changes
  useEffect(() => { setStep(exchange.length ? 0 : -1); setPlaying(false); /* eslint-disable-next-line */ }, [selectedId]);

  const m = (meeting?.metrics ?? {}) as Metrics;
  const ehs = m.ehs ?? {};
  const platform = m.platform ?? {};
  const highRisks = (meeting?.gaps_found ?? []).filter((g) => g.severity === "high").length;
  const metrics = [
    { v: `${platform.avgCompliance ?? "—"}${platform.avgCompliance != null ? "%" : ""}`, l: "Platform Health" },
    { v: String(highRisks), l: "High Gaps" },
    { v: String(meeting?.action_items.length ?? 0), l: "Actions Ready" },
    { v: String(ehs.pendingReviews ?? 0), l: "Review Items" },
    { v: String(ehs.autoAccepted ?? 0), l: "Auto-Accepted" },
  ];
  const progress = exchange.length ? Math.round(((step + 1) / exchange.length) * 100) : 0;
  const topRisk = highRisks > 0 ? "High" : (meeting?.gaps_found.length ?? 0) > 0 ? "Medium" : "Low";
  const agenda = meeting?.agenda ?? [];
  const coveredCount = agenda.filter((a) => a.covered).length;

  const convene = async () => {
    setConvening(true);
    await conveneAgentStandup();
    setConvening(false);
    router.refresh();
  };

  return (
    <div className="cr">
      <CouncilStyles />

      {/* Controls */}
      <div className="cr-controls">
        <span className="cr-pill"><span className="cr-dot" />{meeting ? `Meeting ${meeting.meeting_date}` : "No meeting yet"}</span>
        {meetings.length > 1 && (
          <select className="cr-select" value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
            {meetings.map((mt) => <option key={mt.id} value={mt.id}>{mt.meeting_date} — {mt.gaps_found.length} gap(s)</option>)}
          </select>
        )}
        <button className="cr-btn primary" onClick={convene} disabled={convening}>{convening ? "Convening…" : "▶ Convene & Brief"}</button>
        <button className="cr-btn" onClick={() => setPlaying((p) => !p)} disabled={!exchange.length}>{playing ? "Ⅱ Pause" : "▶ Play"}</button>
        <button className="cr-btn" onClick={() => setStep((s) => Math.min(exchange.length - 1, s + 1))} disabled={!exchange.length}>→ Step</button>
        <button className="cr-btn" onClick={() => { setStep(0); setPlaying(false); }} disabled={!exchange.length}>↻ Reset</button>
      </div>

      <div className="cr-grid">
        {/* Stage */}
        <div className="cr-stage">
          <div className="cr-hud">
            <span className="cr-chip">Active: Gus + EHS Agent</span>
            <span className="cr-chip">Shells: 8 preview only</span>
            <span className="cr-chip cr-chip-id">{meeting ? `Agenda ${coveredCount}/${agenda.length} · Gaps ${meeting.gaps_found.length}` : "—"}</span>
          </div>

          {/* presentation screen */}
          <section className="cr-screen">
            <div className="cr-screen-top">
              <span className="cr-kicker">Daily Agent Council</span>
              <div>
                <span className={`cr-state ${topRisk.toLowerCase()}`}>Risk: {topRisk}</span>
                <span className="cr-state good">{meeting ? "Consensus: Confirmed" : "Pending"}</span>
              </div>
            </div>
            <h2 className="cr-screen-title">{meeting?.title ?? "Daily Council Review"}</h2>
            <p className="cr-screen-summary">{current ? `${current.speaker}: ${current.message}` : (meeting?.shared_summary ?? "Convene the council to generate today’s brief.")}</p>
            <div className="cr-metrics">
              {metrics.map((mt) => <div className="cr-metric" key={mt.l}><b>{mt.v}</b><span>{mt.l}</span></div>)}
            </div>
            <div className="cr-decisions">
              <div className="cr-dec"><small>Current speaker</small><b>{activeSpeaker ?? "None"}</b></div>
              <div className="cr-dec"><small>Step</small><b>{exchange.length ? `${step + 1} / ${exchange.length}` : "—"}</b></div>
              <div className="cr-dec cr-dec-wide"><small>Output</small><b>{meeting?.shared_summary?.slice(0, 60) ?? "Waiting"}</b></div>
            </div>
            <div className="cr-progress"><div className="cr-progress-bar" style={{ width: `${progress}%` }} /></div>
          </section>

          <div className="cr-floor" />
          <div className="cr-table-wrap"><div className="cr-table-glow" /><div className="cr-table" /></div>

          {/* seats */}
          {SEATS.map((s) => {
            const speaking = (s.key === "gus" && activeSpeaker === "GUS") || (s.key === "ehs" && activeSpeaker && activeSpeaker !== "GUS");
            return (
              <div key={s.key} className={`cr-seat ${s.cls} ${s.active ? "active" : "shell"} ${speaking ? "speaking" : ""}`} onClick={() => setModal(s)}>
                <div className="cr-halo" />
                <div className="cr-chair" />
                <div className="cr-bot">
                  <div className="cr-head"><span className="cr-eye l" /><span className="cr-eye r" /></div>
                  <div className="cr-body" />
                  <span className="cr-arm left" /><span className="cr-arm right" />
                  <span className="cr-status" />
                </div>
                <div className="cr-label">{s.name}<small>{s.sub}</small></div>
              </div>
            );
          })}
        </div>

        {/* Side panel */}
        <aside className="cr-aside">
          <div className="cr-aside-head"><h2>Council Decision Panel</h2></div>
          <div className="cr-tabs">
            {(["agenda", "transcript", "findings", "actions", "reflections", "agents"] as const).map((t) => (
              <button key={t} className={`cr-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t === "agenda" ? "Agenda" : t === "transcript" ? "Transcript" : t === "findings" ? "Findings" : t === "actions" ? "Actions" : t === "reflections" ? "Open Thoughts" : "Agents"}
              </button>
            ))}
          </div>
          <div className="cr-panel">
            {!meeting ? (
              <div className="cr-empty">No standup yet. Click <b>Convene &amp; Brief</b> to hold the first meeting.</div>
            ) : tab === "agenda" ? (
              <div className="cr-list">
                {agenda.map((a, i) => (
                  <div key={i} className={`cr-agitem ${a.covered ? "done" : "todo"}`}>
                    <span className="cr-check">{a.covered ? "✓" : "○"}</span>
                    <div><b>{a.title}</b><p>{a.note}</p></div>
                  </div>
                ))}
                {agenda.length === 0 && <div className="cr-empty">No agenda recorded — re-run “Convene &amp; Brief” to generate it.</div>}
              </div>
            ) : tab === "transcript" ? (
              <div className="cr-log">
                {exchange.map((e, i) => (
                  <div key={i} className={`cr-logitem ${e.speaker === "GUS" ? "gus" : "ehs"} ${i === step ? "now" : ""}`}>
                    <div className="cr-av">{e.speaker === "GUS" ? "GUS" : "EHS"}</div>
                    <div><div className="cr-logmeta">{e.speaker}</div><div className="cr-logbody">{e.message}</div></div>
                  </div>
                ))}
                {exchange.length === 0 && <div className="cr-empty">No exchange recorded.</div>}
              </div>
            ) : tab === "findings" ? (
              <div className="cr-list">
                {meeting.gaps_found.map((g, i) => (
                  <div key={i} className="cr-card"><div className="cr-cardtop"><b>{g.title}</b><span className={`cr-risk ${g.severity}`}>{g.severity}</span></div><p>{g.detail}</p></div>
                ))}
                {meeting.gaps_found.length === 0 && <div className="cr-empty">No gaps surfaced — both agents within tolerance.</div>}
              </div>
            ) : tab === "actions" ? (
              <div className="cr-list">
                {meeting.action_items.map((a, i) => (
                  <div key={i} className="cr-action"><span className={`cr-pri ${a.priority}`}>{a.priority}</span><span className="cr-actitem">{a.item}</span><span className="cr-owner">{a.owner}</span></div>
                ))}
                {meeting.action_items.length === 0 && <div className="cr-empty">No action items.</div>}
              </div>
            ) : tab === "reflections" ? (
              <div className="cr-list">
                {meeting.reflections.map((r, i) => (
                  <div key={i} className={`cr-reflect ${r.speaker === "GUS" ? "gus" : "ehs"}`}>
                    <b>{r.speaker === "GUS" ? "Gus" : "EHS Agent"} — open thought</b>
                    <p>{r.thought}</p>
                  </div>
                ))}
                {meeting.reflections.length === 0 && <div className="cr-empty">No reflections recorded for this meeting.</div>}
              </div>
            ) : (
              <div className="cr-list">
                <div className="cr-card"><b>Gus — Active</b><p>{SEATS[0].desc}</p></div>
                <div className="cr-card"><b>EHS Agent — Active</b><p>{SEATS[1].desc}</p></div>
                <div className="cr-rosterhead">Future shells (8)</div>
                <div className="cr-shells">
                  {SEATS.slice(2).map((s) => <div key={s.key} className="cr-shellcard"><b>{s.name}</b><span>{s.desc}</span></div>)}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {modal && (
        <div className="cr-modal" onClick={() => setModal(null)}>
          <div className="cr-modalbox" onClick={(e) => e.stopPropagation()}>
            <button className="cr-close" onClick={() => setModal(null)}>×</button>
            <h2>{modal.name}</h2>
            <p className="cr-modalrole">{modal.role}</p>
            <p className="cr-modaldesc">{modal.desc}</p>
            <span className={`cr-badge ${modal.active ? "active" : "shell"}`}>{modal.active ? "Active" : "Shell — future build"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scoped styles (adapted from the council-room concept) ─────────────────────
function CouncilStyles() {
  return (
    <style>{`
.cr{--cyan:#67e8f9;--cyan2:#b8f7ff;--muted:#a7bad3;--green:#4ade80;--amber:#fbbf24;--red:#fb7185;--violet:#a78bfa;color:#eef7ff}
.cr-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.cr-pill,.cr-btn,.cr-select{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:9px 12px;font-size:12px;font-weight:700;color:#dff7ff;background:rgba(255,255,255,.06)}
.cr-btn{cursor:pointer;background:linear-gradient(180deg,rgba(59,130,246,.31),rgba(59,130,246,.10));border-color:rgba(103,232,249,.28);transition:.2s}
.cr-btn:hover{transform:translateY(-1px);box-shadow:0 0 20px rgba(103,232,249,.2);border-color:rgba(103,232,249,.6)}
.cr-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.cr-btn.primary{background:linear-gradient(180deg,rgba(14,165,233,.45),rgba(37,99,235,.22));border-color:rgba(103,232,249,.6)}
.cr-select{appearance:none;cursor:pointer}
.cr-dot{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 13px var(--green);display:inline-block;margin-right:7px}
.cr-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px}
@media(max-width:1100px){.cr-grid{grid-template-columns:1fr}}
.cr-stage{position:relative;min-height:560px;border:1px solid rgba(255,255,255,.12);border-radius:24px;overflow:hidden;background:radial-gradient(circle at 18% -8%,rgba(59,130,246,.28),transparent 38%),linear-gradient(180deg,#081b35 0%,#061226 44%,#030713 100%);box-shadow:0 28px 90px rgba(0,0,0,.5);perspective:1300px}
.cr-hud{position:absolute;left:18px;top:16px;right:18px;z-index:8;display:flex;gap:7px;flex-wrap:wrap}
.cr-chip{padding:6px 9px;border-radius:999px;background:rgba(3,7,17,.7);border:1px solid rgba(103,232,249,.22);font-size:10px;color:#d5ecff;font-weight:700}
.cr-chip-id{margin-left:auto;color:#ffe8a3;border-color:rgba(251,191,36,.3)}
.cr-screen{position:absolute;left:50%;top:62px;transform:translateX(-50%);width:min(720px,76%);border-radius:20px;background:linear-gradient(135deg,rgba(2,8,23,.97),rgba(13,42,86,.97));border:1px solid rgba(103,232,249,.45);box-shadow:0 0 50px rgba(59,130,246,.16),inset 0 0 36px rgba(103,232,249,.06);padding:14px 16px;z-index:3}
.cr-screen-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.cr-kicker{color:var(--cyan);font-size:9px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase}
.cr-state{font-size:8.5px;font-weight:900;text-transform:uppercase;padding:4px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.06);color:#d8e9ff;margin-left:5px}
.cr-state.good{border-color:rgba(74,222,128,.35);color:#bcffd8;background:rgba(74,222,128,.1)}
.cr-state.high{border-color:rgba(251,113,133,.38);color:#ffd0d8;background:rgba(251,113,133,.1)}
.cr-state.medium{border-color:rgba(251,191,36,.38);color:#ffedb0;background:rgba(251,191,36,.1)}
.cr-state.low{border-color:rgba(74,222,128,.3);color:#bcffd8;background:rgba(74,222,128,.08)}
.cr-screen-title{margin:6px 0 4px;font-size:16px}
.cr-screen-summary{margin:0 0 10px;color:#b7cae0;font-size:11.5px;line-height:1.4;min-height:46px}
.cr-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.cr-metric{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.11);border-radius:12px;padding:8px;text-align:center}
.cr-metric b{font-size:17px;display:block;color:var(--cyan2)}.cr-metric span{font-size:8px;color:var(--muted);display:block;margin-top:3px;text-transform:uppercase;font-weight:800;line-height:1.2}
.cr-decisions{display:grid;grid-template-columns:1fr 1fr 2fr;gap:6px;margin-top:8px}
.cr-dec{padding:6px 8px;border-radius:10px;background:rgba(3,7,17,.48);border:1px solid rgba(255,255,255,.09);min-width:0}
.cr-dec small{display:block;color:#8fa7c4;font-size:7.5px;text-transform:uppercase;letter-spacing:.5px;font-weight:900}
.cr-dec b{display:block;font-size:10px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cr-progress{margin-top:10px;height:6px;border-radius:999px;background:rgba(3,7,17,.7);border:1px solid rgba(255,255,255,.08);overflow:hidden}
.cr-progress-bar{height:100%;background:linear-gradient(90deg,#3b82f6,var(--cyan));box-shadow:0 0 16px rgba(103,232,249,.5);transition:width .4s ease}
.cr-floor{position:absolute;left:2%;right:2%;bottom:-7%;height:55%;clip-path:polygon(6% 0,94% 0,100% 100%,0 100%);background:linear-gradient(180deg,rgba(27,74,134,.6),rgba(4,9,20,.98));border-top:2px solid rgba(103,232,249,.2)}
.cr-table-wrap{position:absolute;left:50%;top:58%;width:min(560px,62%);height:170px;transform:translateX(-50%);transform-style:preserve-3d;z-index:4}
.cr-table{position:absolute;inset:0;transform:rotateX(62deg);transform-origin:center;border-radius:50%;background:radial-gradient(ellipse at 50% 40%,#245b9e 0%,#112d59 42%,#061225 75%);border:2px solid rgba(103,232,249,.4);box-shadow:0 42px 85px rgba(0,0,0,.68),inset 0 0 48px rgba(103,232,249,.13)}
.cr-table:before{content:"DAILY AI AGENT COUNCIL";position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);color:rgba(255,255,255,.8);font-weight:900;letter-spacing:1.8px;font-size:13px;white-space:nowrap}
.cr-table-glow{position:absolute;left:50%;top:50%;width:58%;height:38%;transform:translate(-50%,-50%) rotateX(62deg);border-radius:50%;background:radial-gradient(ellipse,rgba(103,232,249,.28),transparent 65%);filter:blur(16px)}
.cr-seat{position:absolute;width:92px;height:140px;cursor:pointer;z-index:5;filter:drop-shadow(0 18px 18px rgba(0,0,0,.45));transition:transform .25s}
.cr-seat:hover{transform:translateY(-4px)}
.cr-seat.shell{scale:.8;opacity:.7}
.cr-chair{position:absolute;left:14px;top:48px;width:64px;height:72px;border-radius:18px 18px 28px 28px;background:linear-gradient(180deg,#1d4f94,#0b1932);border:1px solid rgba(255,255,255,.17)}
.cr-bot{position:absolute;left:18px;top:18px;width:58px;height:96px}
.cr-head{position:absolute;left:11px;top:0;width:36px;height:34px;border-radius:14px 14px 13px 13px;background:linear-gradient(145deg,#effbff,#8db6dc 55%,#2f557a);border:1px solid rgba(255,255,255,.8);box-shadow:0 0 18px rgba(103,232,249,.13)}
.cr-eye{position:absolute;top:15px;width:5px;height:5px;border-radius:50%;background:var(--cyan);box-shadow:0 0 9px var(--cyan)}
.cr-eye.l{left:9px}.cr-eye.r{right:9px}
.cr-body{position:absolute;left:5px;top:31px;width:48px;height:55px;border-radius:14px 14px 18px 18px;background:linear-gradient(160deg,#dceefe,#37699b 46%,#0a1b35 92%);border:1px solid rgba(255,255,255,.42)}
.cr-body:before{content:"";position:absolute;left:19px;top:12px;width:9px;height:9px;border-radius:50%;background:var(--cyan);box-shadow:0 0 13px var(--cyan)}
.cr-arm{position:absolute;top:40px;width:12px;height:42px;border-radius:8px;background:linear-gradient(180deg,#b9d6ed,#315d87);border:1px solid rgba(255,255,255,.28)}
.cr-arm.left{left:-2px;transform:rotate(10deg)}.cr-arm.right{right:-2px;transform:rotate(-10deg)}
.cr-status{position:absolute;right:0;top:2px;width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green)}
.cr-seat.shell .cr-head,.cr-seat.shell .cr-body,.cr-seat.shell .cr-arm{filter:saturate(.18);opacity:.72}
.cr-seat.shell .cr-status{background:#77869c;box-shadow:none}
.cr-halo{position:absolute;left:6px;top:4px;width:80px;height:116px;border-radius:50%;border:1px solid rgba(103,232,249,.46);opacity:0;box-shadow:0 0 28px rgba(103,232,249,.18);transition:.2s}
.cr-label{position:absolute;left:50%;top:118px;transform:translateX(-50%);min-width:84px;padding:5px 8px;border-radius:11px;background:rgba(2,7,17,.88);border:1px solid rgba(103,232,249,.22);font-size:9.5px;font-weight:800;text-align:center;white-space:nowrap}
.cr-label small{display:block;color:var(--green);font-size:7.5px;margin-top:1px}
.cr-seat.shell .cr-label small{color:#9aa8bb}
.cr-seat.speaking .cr-bot{animation:cr-speak 1.05s ease-in-out infinite}
.cr-seat.speaking .cr-halo{opacity:1;transform:scale(1.05)}
.cr-seat.speaking .cr-label{border-color:rgba(103,232,249,.8);box-shadow:0 0 20px rgba(103,232,249,.24)}
@keyframes cr-speak{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.cr-bubble{position:absolute;left:50%;bottom:138px;width:200px;transform:translateX(-50%);background:rgba(244,250,255,.98);color:#081326;border-radius:15px;padding:10px 11px;font-size:10.5px;line-height:1.32;border:1px solid rgba(103,232,249,.55);box-shadow:0 18px 34px rgba(0,0,0,.28);z-index:9}
.cr-bubble:after{content:"";position:absolute;left:50%;bottom:-9px;border:9px solid transparent;border-top-color:rgba(244,250,255,.98);transform:translateX(-50%)}
.gus{left:14%;top:40%}.hse{right:14%;top:40%}
.gateway{left:46%;top:30%}.verity{left:2%;top:55%}.compliance{right:2%;top:55%}
.capa{left:16%;top:66%}.doc{right:16%;top:66%}.contractor{left:30%;top:74%}.prediction{right:30%;top:74%}.training{left:46%;top:78%}
.cr-aside{border:1px solid rgba(255,255,255,.12);border-radius:22px;background:linear-gradient(180deg,rgba(14,35,67,.96),rgba(5,13,28,.98));box-shadow:0 28px 90px rgba(0,0,0,.5);overflow:hidden;display:flex;flex-direction:column;max-height:620px}
.cr-aside-head{padding:14px 16px 10px}.cr-aside-head h2{font-size:15px;margin:0}
.cr-tabs{display:flex;gap:5px;padding:0 12px 10px;flex-wrap:wrap}
.cr-tab{padding:7px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#aebfd4;font-size:10px;font-weight:800;cursor:pointer}
.cr-tab.active{color:#eaffff;border-color:rgba(103,232,249,.48);background:rgba(103,232,249,.12)}
.cr-panel{overflow:auto;padding:0 12px 14px;flex:1}
.cr-empty{padding:20px 12px;text-align:center;color:#8398b3;font-size:11px;line-height:1.5;border:1px dashed rgba(255,255,255,.12);border-radius:14px}
.cr-log{display:grid;gap:8px}
.cr-logitem{display:grid;grid-template-columns:34px 1fr;gap:9px;padding:9px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}
.cr-logitem.gus{border-color:rgba(103,232,249,.25)}.cr-logitem.ehs{border-color:rgba(167,139,250,.25)}
.cr-logitem.now{box-shadow:0 0 0 1px rgba(103,232,249,.5);background:rgba(103,232,249,.07)}
.cr-av{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(59,130,246,.34),rgba(103,232,249,.1));border:1px solid rgba(103,232,249,.27);font-size:8.5px;font-weight:900}
.cr-logmeta{font-size:10px;font-weight:800;color:#cfe2f6}.cr-logbody{font-size:10.5px;line-height:1.42;color:#dbe8f6;margin-top:2px}
.cr-list{display:grid;gap:8px}
.cr-agitem{display:grid;grid-template-columns:24px 1fr;gap:9px;padding:10px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}
.cr-agitem.done{border-color:rgba(74,222,128,.28)}
.cr-agitem.todo{border-color:rgba(251,191,36,.25)}
.cr-check{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:12px;background:rgba(74,222,128,.12);color:#baffd5;border:1px solid rgba(74,222,128,.35)}
.cr-agitem.todo .cr-check{background:rgba(251,191,36,.1);color:#ffe9a7;border-color:rgba(251,191,36,.32)}
.cr-agitem b{font-size:11px}.cr-agitem p{font-size:10px;line-height:1.4;color:#b8c8db;margin:4px 0 0}
.cr-reflect{padding:11px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}
.cr-reflect.gus{border-color:rgba(103,232,249,.3);background:rgba(103,232,249,.05)}
.cr-reflect.ehs{border-color:rgba(167,139,250,.3);background:rgba(167,139,250,.05)}
.cr-reflect b{font-size:10.5px;color:#cfe2f6}.cr-reflect p{font-size:11px;line-height:1.5;color:#dbe8f6;margin:6px 0 0;font-style:italic}
.cr-card{padding:10px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}
.cr-cardtop{display:flex;justify-content:space-between;gap:8px;align-items:center}.cr-card b{font-size:11px}.cr-card p{font-size:10px;line-height:1.4;color:#b8c8db;margin:5px 0 0}
.cr-risk{padding:3px 6px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase}
.cr-risk.high{background:rgba(251,113,133,.12);color:#ffd1da;border:1px solid rgba(251,113,133,.28)}
.cr-risk.medium{background:rgba(251,191,36,.1);color:#ffeca6;border:1px solid rgba(251,191,36,.28)}
.cr-risk.low{background:rgba(74,222,128,.1);color:#bdffd6;border:1px solid rgba(74,222,128,.26)}
.cr-action{display:flex;gap:8px;align-items:center;padding:9px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);font-size:10.5px}
.cr-pri{padding:3px 6px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase}
.cr-pri.high{background:rgba(251,113,133,.12);color:#ffd1da}.cr-pri.normal{background:rgba(59,130,246,.14);color:#bcd6ff}.cr-pri.low{background:rgba(255,255,255,.08);color:#cdd7e3}
.cr-actitem{flex:1;color:#dce9f7}.cr-owner{font-size:9px;color:#869bb5}
.cr-rosterhead{font-size:10px;color:#8197b3;font-weight:800;margin:4px 0 2px}
.cr-shells{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.cr-shellcard{padding:8px;border-radius:11px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.cr-shellcard b{font-size:9.5px}.cr-shellcard span{display:block;color:#8fa3bd;font-size:8.5px;line-height:1.3;margin-top:3px}
.cr-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(1,4,10,.78);backdrop-filter:blur(10px);z-index:60}
.cr-modalbox{width:min(480px,100%);border-radius:20px;padding:20px;background:linear-gradient(180deg,#10284d,#071327);border:1px solid rgba(103,232,249,.35);box-shadow:0 32px 90px rgba(0,0,0,.65);position:relative}
.cr-modalbox h2{margin:0 0 6px}.cr-modalrole{color:var(--cyan2);font-size:12px;margin:0 0 8px}.cr-modaldesc{color:#b4c7dc;font-size:12px;line-height:1.5}
.cr-close{position:absolute;right:12px;top:8px;border:0;background:transparent;color:#d9edff;font-size:24px;cursor:pointer}
.cr-badge{display:inline-block;margin-top:10px;padding:5px 9px;border-radius:999px;font-size:9px;text-transform:uppercase;letter-spacing:.6px;font-weight:900;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06)}
.cr-badge.active{color:#baffd4;border-color:rgba(74,222,128,.32);background:rgba(74,222,128,.1)}
@media(prefers-reduced-motion:reduce){.cr-seat.speaking .cr-bot{animation:none}}
`}</style>
  );
}

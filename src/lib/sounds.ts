// ── SafetyIQ Web Audio sound effects ─────────────────────────────────────────
// Uses the Web Audio API — no files required, no external deps.
// Same architecture as GusStatusBriefing.tsx.

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx) return _ctx;
  try {
    _ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return _ctx;
  } catch { return null; }
}

function tone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  vol = 0.05,
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
  } catch { /* blocked or restricted — silent */ }
}

/**
 * Quick rising 3-note chime played when a new record is created.
 * G4 → B4 → D5 (G major triad, staggered)
 */
function isMuted(): boolean {
  try { return localStorage.getItem("safetyiq_sounds_muted") === "true"; } catch { return false; }
}

export function playCreateSound() {
  const ctx = getCtx();
  if (!ctx || isMuted()) return;
  [392, 494, 587].forEach((f, i) => tone(ctx, f, 0.22, "sine", 0.055, i * 75));
}

/**
 * Satisfying 4-note completion chord — mirrors Gus's "ALL SYSTEMS NOMINAL"
 * arpeggio. Played when a task/CAPA is closed or a record is completed.
 * C5 → E5 → G5 → C6 (C major, staggered)
 */
export function playCompleteSound() {
  const ctx = getCtx();
  if (!ctx || isMuted()) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, 0.4, "sine", 0.055, i * 70));
}

/**
 * Gentle two-tone confirm — played on status advances (not full close).
 * E5 → G5
 */
export function playAdvanceSound() {
  const ctx = getCtx();
  if (!ctx || isMuted()) return;
  [659, 784].forEach((f, i) => tone(ctx, f, 0.22, "sine", 0.05, i * 80));
}

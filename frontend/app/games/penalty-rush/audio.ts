/* ──────────────────────────────────────────────────────────
   Penalty Rush — Web Audio Sound Manager
   Procedural sounds — zero external assets.
   ────────────────────────────────────────────────────────── */

let ctx: AudioContext | null = null;
let muted = false;

export function initAudio(): void {
  if (ctx) return;
  ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
}

export function toggleMute(): boolean { muted = !muted; return muted; }
export function isMuted(): boolean { return muted; }

/* ── helpers ───────────────────────────────────────────── */

function osc(type: OscillatorType, freq: number, dur: number, vol: number, ramp?: number): void {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, now);
  if (ramp) o.frequency.exponentialRampToValueAtTime(ramp, now + dur);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.start(now); o.stop(now + dur);
}

function noise(dur: number, vol: number): void {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const len = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf; src.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.start(now);
}

/* ── public sounds ─────────────────────────────────────── */

/** Punchy kick impact */
export function playKick(): void {
  osc("triangle", 160, 0.15, 0.7, 50);
  noise(0.04, 0.4);
}

/** Goal celebration — ascending ping + harmonic */
export function playGoal(): void {
  osc("sine", 660, 0.4, 0.3, 1320);
  setTimeout(() => osc("sine", 990, 0.3, 0.2, 1760), 50);
}

/** Extra sparkle for PERFECT timing */
export function playPerfect(): void {
  osc("sine", 2200, 0.2, 0.15, 3300);
  setTimeout(() => osc("sine", 1760, 0.22, 0.12), 20);
}

/** Keeper block — descending saw + thud */
export function playSave(): void {
  osc("sawtooth", 220, 0.2, 0.25, 70);
  osc("triangle", 80, 0.12, 0.35, 40);
}

/** Soft whiff — off-target */
export function playMiss(): void {
  osc("sine", 400, 0.3, 0.15, 150);
}

/** Two-tone referee whistle — game over */
export function playWhistle(): void {
  if (!ctx || muted) return;
  const now = ctx.currentTime;

  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.connect(g1); g1.connect(ctx.destination);
  o1.type = "sine"; o1.frequency.setValueAtTime(2800, now);
  g1.gain.setValueAtTime(0.22, now); g1.gain.setValueAtTime(0, now + 0.15);
  o1.start(now); o1.stop(now + 0.16);

  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "sine"; o2.frequency.setValueAtTime(2800, now + 0.2);
  o2.frequency.linearRampToValueAtTime(2400, now + 0.7);
  g2.gain.setValueAtTime(0.22, now + 0.2);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  o2.start(now + 0.2); o2.stop(now + 0.8);
}

/** Subtle UI click */
export function playClick(): void {
  osc("sine", 800, 0.05, 0.08);
}

/** Heartbeat thump — tension during charge */
export function playHeartbeat(): void {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  // Double thump (lub-dub)
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.connect(g1); g1.connect(ctx.destination);
  o1.type = "sine"; o1.frequency.setValueAtTime(50, now);
  o1.frequency.exponentialRampToValueAtTime(30, now + 0.08);
  g1.gain.setValueAtTime(0.25, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  o1.start(now); o1.stop(now + 0.12);

  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "sine"; o2.frequency.setValueAtTime(45, now + 0.14);
  o2.frequency.exponentialRampToValueAtTime(25, now + 0.22);
  g2.gain.setValueAtTime(0.18, now + 0.14);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
  o2.start(now + 0.14); o2.stop(now + 0.26);
}

/* ──────────────────────────────────────────────────────────
   Penalty Rush — Tunable Configuration
   Tweak values here — never hardcode elsewhere.
   ────────────────────────────────────────────────────────── */

export const CFG = {
  /* ── Layout (fraction of canvas height) ──────────────── */
  layout: {
    hudHeight: 0.105,
    goalTop: 0.12,
    goalBottom: 0.55,
    timingBarY: 0.58,
    ballY: 0.66,
    directionsY: 0.76,
    shootZoneTop: 0.85,
  },

  /* ── Goal ────────────────────────────────────────────── */
  goal: {
    widthRatio: 0.72,
    postWidth: 6,
    crossbarHeight: 6,
    netSpacing: 18,
  },

  /* ── Goalkeeper ──────────────────────────────────────── */
  gk: {
    widthRatio: 0.13,
    heightRatio: 0.65,
    baseSpeed: 1.2,
    baseAmplitude: 0.72,
    /** Distance from target where GK can save */
    saveRange: { perfect: 0.15, good: 0.35 },
  },

  /* ── Timing bar ──────────────────────────────────────── */
  timing: {
    barWidthRatio: 0.55,
    barHeight: 10,
    indicatorRadius: 8,
    baseSpeed: 2.5,
    /** Distance from 0.5 centre (in 0‑0.5 range) */
    zones: { perfect: 0.08, good: 0.22 },
  },

  /* ── Ball ────────────────────────────────────────────── */
  ball: { radius: 18 },

  /* ── Lane positions (normalised -1 … 1) ──────────────── */
  lanes: { left: -0.65, center: 0, right: 0.65 } as Record<string, number>,

  /* ── Scoring ─────────────────────────────────────────── */
  scoring: {
    goal: { perfect: 200, good: 100 },
    streakBonus: 25,
    maxStreak: 20,
  },

  /* ── Game rules ──────────────────────────────────────── */
  lives: 3,
  goalsPerLevel: 5,

  /* ── Animation durations (ms) ────────────────────────── */
  anim: {
    shotFlight: 220,            // faster ball flight
    resultDisplay: 550,
    slowMoDuration: 200,        // slightly longer slow-mo on perfect
    slowMoScale: 0.25,          // slower slow-mo
    cameraZoomMax: 0.04,        // max zoom during charge
    cameraZoomSpeed: 0.08,      // how fast zoom builds
  },

  /* ── Pixel-art scale — how many CSS px per sprite pixel ─ */
  pixelScale: 3,

  /* ── GK animation ────────────────────────────────────── */
  gkAnim: {
    idleFrames: [0, 1, 0, 4, 0, 1] as number[],  // wider cycle with taunt
    idleFps: 3,
    diveLeftFrame: 2,
    diveRightFrame: 3,
    celebrateFrame: 5,
    sadFrame: 6,
  },

  /* ── Colours — Arcade palette ────────────────────────── */
  colors: {
    bg: "#0a0e17",
    bgLight: "#111827",
    surface: "#1F2937",
    red: "#E11D2E",
    redDark: "#B8162A",
    white: "#F9FAFB",
    muted: "#6B7280",
    green: "#22C55E",
    greenDark: "#16a34a",
    yellow: "#EAB308",
    gold: "#FFD700",
    cyan: "#06b6d4",
    post: "#e8e8ec",
    postShadow: "#9ca3af",
    net: "rgba(255,255,255,0.10)",
    netHighlight: "rgba(255,255,255,0.18)",
    grass: "#1a5c2e",
    grassDark: "#145024",
    skin: "#F5D0B0",
    stadiumDark: "#08090f",
    stadiumMid: "#0d1020",
    crowdTint: "rgba(0,0,0,0.35)",
    vignette: "rgba(0,0,0,0.6)",
  },
} as const;

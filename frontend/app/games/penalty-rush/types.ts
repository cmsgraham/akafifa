/* ──────────────────────────────────────────────────────────
   Penalty Rush — Shared Types
   ────────────────────────────────────────────────────────── */

export type Lane = "left" | "center" | "right";
export type TimingQuality = "perfect" | "good" | "miss";
export type ShotResult = "goal" | "save" | "miss";

export type GamePhase =
  | "ready"      // waiting for direction selection, GK moving
  | "aiming"     // direction selected, waiting for hold
  | "charging"   // holding shoot, timing bar oscillating
  | "shooting"   // ball in flight
  | "result"     // brief feedback display
  | "gameover";

export interface GameState {
  phase: GamePhase;
  score: number;
  lives: number;
  level: number;
  streak: number;
  bestStreak: number;
  goals: number;
  attempts: number;
  selectedLane: Lane | null;

  // Timing bar
  timingValue: number;       // 0‑1; 0.5 = center = perfect
  timingDirection: 1 | -1;
  timingFrozen: boolean;
  timingQuality: TimingQuality | null;

  // Goalkeeper
  gkPosition: number;        // -1 (left) to 1 (right)
  gkTime: number;
  gkPauseTimer: number;
  gkAnimTimer: number;       // accumulator for idle animation
  gkAnimFrame: number;       // current sprite frame index

  // Shot animation
  shotProgress: number;       // 0‑1 during flight
  shotResult: ShotResult | null;

  // Result display
  resultTimer: number;

  // Effects
  screenShake: number;
  slowMotion: number;         // remaining slow-mo ms
  particles: Particle[];
  textPopups: TextPopup[];
  netRipple: number;
  cameraZoom: number;         // 0 = none, grows during charging
  chargeTime: number;         // seconds holding shoot
  gkAnticipation: number;     // small bounce/lean during charge

  // Meta
  startTime: number;
}

export interface Particle {
  x: number;  y: number;   // normalized 0-1
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
}

export interface TextPopup {
  text: string;
  x: number; y: number;      // normalized 0-1
  vy: number;
  life: number; maxLife: number;
  color: string;
  fontSize: number;
}

/* ── Future-ready interfaces (not wired yet) ───────────── */

export interface GameSession {
  id: string;
  userId: string;
  startedAt: number;
  endedAt?: number;
  finalScore: number;
  finalLevel: number;
  shots: ShotRecord[];
}

export interface ShotRecord {
  lane: Lane;
  timing: TimingQuality;
  result: ShotResult;
  points: number;
  timestamp: number;
}

export interface GameScore {
  score: number;
  bestStreak: number;
  accuracyPct: number;
  durationSecs: number;
  levelReached: number;
}

export interface ChallengeConfig {
  id: string;
  type: "time_attack" | "accuracy" | "streak";
  target: number;
  timeLimit?: number;
}

/* ──────────────────────────────────────────────────────────
   Penalty Rush — Game Engine (state machine + update loop)
   Pure logic — no canvas / DOM / audio imports here.
   Audio & analytics calls are embedded where needed.
   ────────────────────────────────────────────────────────── */

import { CFG } from "./config";
import type {
  GameState,
  Lane,
  ShotResult,
  Particle,
  TextPopup,
} from "./types";
import { getTimingQuality, advanceTiming } from "./timing";
import { calculateScore, nextLevel } from "./scoring";
import { getDifficulty } from "./difficulty";
import { updateGk, canGkSave } from "./goalkeeper";
import {
  playKick,
  playGoal,
  playPerfect,
  playSave,
  playMiss,
  playClick,
  playWhistle,
  playHeartbeat,
} from "./audio";
import { emit } from "./analytics";

/* ═══════════════════════════════════════════════════════════
   Create fresh game
   ═══════════════════════════════════════════════════════════ */

export function createGame(): GameState {
  return {
    phase: "ready",
    score: 0,
    lives: CFG.lives,
    level: 1,
    streak: 0,
    bestStreak: 0,
    goals: 0,
    attempts: 0,
    selectedLane: null,

    timingValue: 0.5,
    timingDirection: 1,
    timingFrozen: false,
    timingQuality: null,

    gkPosition: 0,
    gkTime: 0,
    gkPauseTimer: 0,
    gkAnimTimer: 0,
    gkAnimFrame: 0,

    shotProgress: 0,
    shotResult: null,

    resultTimer: 0,

    screenShake: 0,
    slowMotion: 0,
    particles: [],
    textPopups: [],
    netRipple: 0,
    cameraZoom: 0,
    chargeTime: 0,
    gkAnticipation: 0,

    startTime: Date.now(),
  };
}

/* ═══════════════════════════════════════════════════════════
   Player actions
   ═══════════════════════════════════════════════════════════ */

export function selectDirection(state: GameState, lane: Lane): void {
  if (state.phase !== "ready" && state.phase !== "aiming") return;
  state.selectedLane = lane;
  state.phase = "aiming";
  playClick();
}

export function startCharging(state: GameState): void {
  if (state.phase !== "aiming" || !state.selectedLane) return;
  state.phase = "charging";
  state.timingValue = 0;
  state.timingDirection = 1;
  state.timingFrozen = false;
  state.timingQuality = null;
  state.chargeTime = 0;
  state.cameraZoom = 0;
  state.gkAnticipation = 0;
}

export function releaseShot(state: GameState): void {
  if (state.phase !== "charging") return;

  // Freeze timing
  state.timingFrozen = true;
  state.timingQuality = getTimingQuality(state.timingValue, state.level);

  state.phase = "shooting";
  state.shotProgress = 0;
  state.attempts++;
  state.screenShake = 3; // kick impact shake

  playKick();
  emit("shot_taken", {
    lane: state.selectedLane,
    timing: state.timingQuality,
    gkPos: state.gkPosition,
  });

  // Slow-motion on perfect
  if (state.timingQuality === "perfect") {
    state.slowMotion = CFG.anim.slowMoDuration;
    state.screenShake = 5;
    playPerfect();
  }
}

/* ═══════════════════════════════════════════════════════════
   Frame update — call once per rAF, pass raw seconds dt
   ═══════════════════════════════════════════════════════════ */

export function update(state: GameState, rawDt: number): void {
  // Clamp dt to avoid spiral-of-death on tab switch
  const cappedDt = Math.min(rawDt, 0.1);

  // Slow-motion
  let dt = cappedDt;
  if (state.slowMotion > 0) {
    state.slowMotion -= cappedDt * 1000;
    dt = cappedDt * CFG.anim.slowMoScale;
    if (state.slowMotion <= 0) state.slowMotion = 0;
  }

  // Decay effects
  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - cappedDt * 20);
  if (state.netRipple > 0) state.netRipple = Math.max(0, state.netRipple - cappedDt * 4);

  // Camera zoom — ramp up during charge, snap back on release
  if (state.phase === "charging") {
    state.cameraZoom = Math.min(CFG.anim.cameraZoomMax, state.cameraZoom + cappedDt * CFG.anim.cameraZoomSpeed);
    state.chargeTime += cappedDt;
    state.gkAnticipation = Math.sin(state.chargeTime * 8) * 0.3; // nervous bounce
    // Heartbeat every ~0.6s
    if (Math.floor(state.chargeTime / 0.6) !== Math.floor((state.chargeTime - cappedDt) / 0.6)) {
      playHeartbeat();
    }
  } else if (state.cameraZoom > 0) {
    state.cameraZoom = Math.max(0, state.cameraZoom - cappedDt * 0.3);
  }

  // Particles & popups (always raw)
  tickParticles(state.particles, cappedDt);
  tickPopups(state.textPopups, cappedDt);

  // GK continuous movement (except gameover)
  if (state.phase !== "gameover") {
    const gk = updateGk(state.gkPosition, state.gkTime, state.gkPauseTimer, dt, state.level);
    state.gkPosition = gk.position;
    state.gkTime = gk.time;
    state.gkPauseTimer = gk.pauseTimer;

    // GK idle animation
    state.gkAnimTimer += cappedDt;
    const idleFps = CFG.gkAnim.idleFps;
    const idleFrames = CFG.gkAnim.idleFrames;
    const frameIdx = Math.floor(state.gkAnimTimer * idleFps) % idleFrames.length;
    state.gkAnimFrame = idleFrames[frameIdx];
  }

  // Timing bar oscillation
  if (state.phase === "charging") {
    const res = advanceTiming(state.timingValue, state.timingDirection, dt, state.level);
    state.timingValue = res.value;
    state.timingDirection = res.direction;
  }

  // Shot in flight
  if (state.phase === "shooting") {
    state.shotProgress += (dt * 1000) / CFG.anim.shotFlight;
    if (state.shotProgress >= 1) {
      state.shotProgress = 1;
      resolveShot(state);
    }
  }

  // Result display timer
  if (state.phase === "result") {
    state.resultTimer += cappedDt * 1000;
    if (state.resultTimer >= CFG.anim.resultDisplay) {
      resetShot(state);
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   Shot resolution (internal)
   ═══════════════════════════════════════════════════════════ */

function resolveShot(state: GameState): void {
  const quality = state.timingQuality!;
  const lane = state.selectedLane!;

  let result: ShotResult;

  if (quality === "miss") {
    result = "miss";
  } else if (canGkSave(state.gkPosition, lane, quality, state.level)) {
    result = "save";
  } else {
    result = "goal";
  }

  state.shotResult = result;
  state.phase = "result";
  state.resultTimer = 0;

  if (result === "goal") {
    const { total } = calculateScore(quality, state.streak);
    state.score += total;
    state.streak++;
    state.goals++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    state.level = nextLevel(state.goals);
    state.netRipple = 1.5;
    state.screenShake = quality === "perfect" ? 8 : 5;

    playGoal();
    emit("goal_scored", { quality, points: total, streak: state.streak });

    addPopup(
      state,
      quality === "perfect" ? "PERFECT!" : "GOAL!",
      quality === "perfect" ? CFG.colors.gold : CFG.colors.green,
      quality === "perfect" ? 42 : 34,
    );
    spawnParticles(
      state, 0.5, 0.3,
      quality === "perfect" ? 28 : 16,
      quality === "perfect" ? CFG.colors.gold : CFG.colors.green,
    );
    // Extra white flash particles on perfect
    if (quality === "perfect") {
      spawnParticles(state, 0.5, 0.25, 10, "#FFFFFF");
    }
  } else if (result === "save") {
    state.lives--;
    state.streak = 0;
    state.screenShake = 6;

    playSave();
    emit("saved", { quality, gkPos: state.gkPosition });
    addPopup(state, "SAVED!", CFG.colors.red, 30);
    spawnParticles(state, 0.5, 0.3, 10, CFG.colors.yellow);

    if (state.lives <= 0) { gameOver(state); return; }
  } else {
    // miss / off-target
    state.lives--;
    state.streak = 0;
    state.screenShake = 3;

    playMiss();
    emit("missed", { quality });
    addPopup(state, "OFF TARGET", CFG.colors.muted, 24);

    if (state.lives <= 0) { gameOver(state); return; }
  }
}

function gameOver(state: GameState): void {
  state.phase = "gameover";
  playWhistle();
  emit("game_finished", {
    score: state.score,
    bestStreak: state.bestStreak,
    goals: state.goals,
    attempts: state.attempts,
    level: state.level,
    durationSecs: Math.round((Date.now() - state.startTime) / 1000),
  });
}

/* ═══════════════════════════════════════════════════════════
   Reset for next shot
   ═══════════════════════════════════════════════════════════ */

function resetShot(state: GameState): void {
  state.phase = "ready";
  state.selectedLane = null;
  state.timingValue = 0.5;
  state.timingFrozen = false;
  state.timingQuality = null;
  state.shotResult = null;
  state.shotProgress = 0;
  state.cameraZoom = 0;
  state.chargeTime = 0;
  state.gkAnticipation = 0;
}

/* ═══════════════════════════════════════════════════════════
   FX helpers
   ═══════════════════════════════════════════════════════════ */

function addPopup(
  state: GameState,
  text: string,
  color: string,
  fontSize: number,
) {
  state.textPopups.push({
    text,
    x: 0.5,
    y: 0.45,
    vy: -0.08,
    life: 1,
    maxLife: 1,
    color,
    fontSize,
  });
}

function spawnParticles(
  state: GameState,
  nx: number,
  ny: number,
  count: number,
  color: string,
) {
  for (let i = 0; i < count; i++) {
    const ml = 0.6 + Math.random() * 0.4;
    state.particles.push({
      x: nx + (Math.random() - 0.5) * 0.05,
      y: ny + (Math.random() - 0.5) * 0.03,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.4 - 0.1,
      life: ml,
      maxLife: ml,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

function tickParticles(arr: Particle[], dt: number) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += dt * 0.3; // gravity
    p.life -= dt;
    if (p.life <= 0) arr.splice(i, 1);
  }
}

function tickPopups(arr: TextPopup[], dt: number) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.y += p.vy * dt;
    p.life -= dt * 1.2;
    if (p.life <= 0) arr.splice(i, 1);
  }
}

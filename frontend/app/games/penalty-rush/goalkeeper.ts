/* ──────────────────────────────────────────────────────────
   Penalty Rush — Goalkeeper System
   Smooth continuous movement. Readable, fair, learnable.
   ────────────────────────────────────────────────────────── */

import { CFG } from "./config";
import type { Lane, TimingQuality } from "./types";
import { getDifficulty } from "./difficulty";

/** Advance GK position. Mutates in-place values. */
export function updateGk(
  pos: number,
  time: number,
  pauseTimer: number,
  dt: number,
  level: number,
): { position: number; time: number; pauseTimer: number } {
  const diff = getDifficulty(level);

  // Micro-pause — GK hesitates at extremes
  if (diff.gkVariation && pauseTimer > 0) {
    return { position: pos, time, pauseTimer: pauseTimer - dt };
  }

  const t = time + dt * diff.gkSpeed;

  // Base sinusoidal sweep
  let p = Math.sin(t * Math.PI) * diff.gkAmplitude;

  // Subtle secondary wobble after L4
  if (diff.gkVariation) {
    p += Math.sin(t * 2.7) * 0.08;
  }

  p = Math.max(-1, Math.min(1, p));

  // Trigger occasional micro-pause at extremes
  let newPause = 0;
  if (diff.gkVariation && Math.abs(p) > 0.5 && Math.random() < dt * 0.2) {
    newPause = 0.08 + Math.random() * 0.12;
  }

  return { position: p, time: t, pauseTimer: newPause };
}

/** Can the GK save given its current position? */
export function canGkSave(
  gkPosition: number,
  lane: Lane,
  quality: TimingQuality,
  level: number,
): boolean {
  if (quality === "miss") return false; // off-target, GK irrelevant
  const diff = getDifficulty(level);
  const target = CFG.lanes[lane];
  const dist = Math.abs(gkPosition - target);
  const range = quality === "perfect"
    ? CFG.gk.saveRange.perfect
    : CFG.gk.saveRange.good + diff.gkSaveBonus;
  return dist <= range;
}

/** Map GK normalised position to canvas-X. */
export function gkCanvasX(gkPos: number, goalX: number, goalW: number): number {
  return goalX + goalW * ((gkPos + 1) / 2);
}

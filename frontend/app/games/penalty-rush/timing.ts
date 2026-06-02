/* ──────────────────────────────────────────────────────────
   Penalty Rush — Timing System
   Horizontal oscillating bar. Centre = PERFECT.
   ────────────────────────────────────────────────────────── */

import { CFG } from "./config";
import type { TimingQuality } from "./types";

const Z = CFG.timing.zones;

/** Map bar value (0‑1, centre 0.5) to quality. */
export function getTimingQuality(value: number, level: number): TimingQuality {
  const dist = Math.abs(value - 0.5);
  const pz = getPerfectZone(level);
  if (dist <= pz) return "perfect";
  if (dist <= getGoodZone(level)) return "good";
  return "miss";
}

/** Oscillation speed (cycles / second). */
export function getTimingSpeed(level: number): number {
  return CFG.timing.baseSpeed + (level - 1) * 0.15;
}

/** Perfect zone half-width (shrinks with level). */
export function getPerfectZone(level: number): number {
  return Math.max(0.03, Z.perfect - (level - 1) * 0.002);
}

/** Good zone half-width. */
export function getGoodZone(level: number): number {
  return Math.max(0.12, Z.good - (level - 1) * 0.005);
}

/** Advance the oscillating indicator. Returns new value + direction. */
export function advanceTiming(
  value: number,
  direction: 1 | -1,
  dt: number,
  level: number,
): { value: number; direction: 1 | -1 } {
  const speed = getTimingSpeed(level);
  let v = value + direction * speed * dt;
  let d = direction;
  if (v >= 1) { v = 1; d = -1; }
  if (v <= 0) { v = 0; d = 1; }
  return { value: v, direction: d as 1 | -1 };
}

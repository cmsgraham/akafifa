/* ──────────────────────────────────────────────────────────
   Penalty Rush — Difficulty Scaling
   Returns level‑dependent tuning parameters.
   ────────────────────────────────────────────────────────── */

import { CFG } from "./config";

export interface DifficultyParams {
  gkSpeed: number;
  gkAmplitude: number;
  timingSpeed: number;
  perfectZone: number;
  goodZone: number;
  gkSaveBonus: number;
  gkVariation: boolean;
}

export function getDifficulty(level: number): DifficultyParams {
  const l = level - 1;
  return {
    gkSpeed: CFG.gk.baseSpeed + l * 0.12,
    gkAmplitude: Math.min(0.85, CFG.gk.baseAmplitude + l * 0.01),
    timingSpeed: CFG.timing.baseSpeed + l * 0.15,
    perfectZone: Math.max(0.03, CFG.timing.zones.perfect - l * 0.002),
    goodZone: Math.max(0.12, CFG.timing.zones.good - l * 0.005),
    gkSaveBonus: Math.min(0.1, l * 0.008),
    gkVariation: level >= 4,
  };
}

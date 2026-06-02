/* ──────────────────────────────────────────────────────────
   Penalty Rush — Scoring System
   ────────────────────────────────────────────────────────── */

import { CFG } from "./config";
import type { TimingQuality } from "./types";

export interface ScoreResult {
  base: number;
  streakBonus: number;
  total: number;
}

export function calculateScore(quality: TimingQuality, streak: number): ScoreResult {
  const base = quality === "perfect"
    ? CFG.scoring.goal.perfect
    : CFG.scoring.goal.good;
  const streakBonus = Math.min(streak, CFG.scoring.maxStreak) * CFG.scoring.streakBonus;
  return { base, streakBonus, total: base + streakBonus };
}

export function nextLevel(goals: number): number {
  return Math.floor(goals / CFG.goalsPerLevel) + 1;
}

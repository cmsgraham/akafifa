"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface OutcomeBucket {
  count: number;
  percentage: number;
}

interface TopScore {
  home_score: number;
  away_score: number;
  count: number;
  percentage: number;
}

interface CommunityOddsResponse {
  enabled: boolean;
  available: boolean;
  reason?: string;
  total_predictions: number;
  threshold: number;
  outcomes?: {
    home_win: OutcomeBucket;
    draw: OutcomeBucket;
    away_win: OutcomeBucket;
  };
  averages?: { home_score: number; away_score: number };
  top_scores?: TopScore[];
}

interface Props {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
}

export function CommunityOdds({ matchId, homeTeam, awayTeam }: Props) {
  const [data, setData] = useState<CommunityOddsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<CommunityOddsResponse>(`/matches/${matchId}/community-odds`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Hide entirely when feature is disabled — admins control via toggle.
  if (loading || !data || !data.enabled) return null;

  if (!data.available) {
    // Below threshold — show a small teaser so users know it's coming.
    return (
      <div className="bg-rz-surface rounded-xl border border-rz-border p-5 mb-6">
        <h2 className="font-bold text-lg mb-1">Community Predictions</h2>
        <p className="text-sm text-rz-text-muted">
          {data.total_predictions} of {data.threshold} predictions needed before
          community insight unlocks for this match.
        </p>
        <div className="mt-3 h-2 w-full rounded-full bg-rz-surface-2 overflow-hidden">
          <div
            className="h-full bg-rz-red transition-all"
            style={{
              width: `${Math.min(
                100,
                (data.total_predictions / data.threshold) * 100,
              )}%`,
            }}
          />
        </div>
      </div>
    );
  }

  const o = data.outcomes!;
  const avg = data.averages!;
  const top = data.top_scores || [];

  return (
    <div className="bg-rz-surface rounded-xl border border-rz-border p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-bold text-lg">Community Predictions</h2>
        <span className="text-xs text-rz-text-muted">
          {data.total_predictions} prediction{data.total_predictions === 1 ? "" : "s"}
        </span>
      </div>

      {/* Outcome distribution bar */}
      <div>
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-rz-surface-2">
          <div
            className="bg-rz-red transition-all"
            style={{ width: `${o.home_win.percentage}%` }}
            title={`${homeTeam} wins`}
          />
          <div
            className="bg-rz-text-muted/60 transition-all"
            style={{ width: `${o.draw.percentage}%` }}
            title="Draw"
          />
          <div
            className="bg-blue-500 transition-all"
            style={{ width: `${o.away_win.percentage}%` }}
            title={`${awayTeam} wins`}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rz-text-muted truncate">
              {homeTeam}
            </p>
            <p className="text-base font-bold text-rz-red">
              {o.home_win.percentage}%
            </p>
            <p className="text-[10px] text-rz-text-muted">{o.home_win.count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rz-text-muted">
              Draw
            </p>
            <p className="text-base font-bold text-rz-text">
              {o.draw.percentage}%
            </p>
            <p className="text-[10px] text-rz-text-muted">{o.draw.count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rz-text-muted truncate">
              {awayTeam}
            </p>
            <p className="text-base font-bold text-blue-400">
              {o.away_win.percentage}%
            </p>
            <p className="text-[10px] text-rz-text-muted">{o.away_win.count}</p>
          </div>
        </div>
      </div>

      {/* Average predicted score */}
      <div className="mt-4 pt-4 border-t border-rz-border flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-rz-text-muted">
          Avg. predicted score
        </span>
        <span className="font-mono font-bold text-rz-text">
          {avg.home_score.toFixed(1)} – {avg.away_score.toFixed(1)}
        </span>
      </div>

      {/* Top predicted exact scores */}
      {top.length > 0 && (
        <div className="mt-4 pt-4 border-t border-rz-border">
          <p className="text-xs uppercase tracking-wider text-rz-text-muted mb-2">
            Most-picked scores
          </p>
          <div className="flex flex-wrap gap-2">
            {top.map((s, i) => (
              <div
                key={`${s.home_score}-${s.away_score}`}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
                  i === 0
                    ? "bg-rz-red/10 border border-rz-red/40 text-rz-text"
                    : "bg-rz-surface-2 border border-rz-border text-rz-text-secondary"
                }`}
              >
                <span className="font-mono font-bold">
                  {s.home_score}–{s.away_score}
                </span>
                <span className="text-rz-text-muted">{s.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

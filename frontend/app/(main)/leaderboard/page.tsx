"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/lib/avatar";
import { Loader } from "@/lib/loader";

/* ── types ─────────────────────────────────────────────────── */

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  country?: string | null;
  points: number;
  prediction_points?: number;
  challenge_points?: number;
  duel_points_balance?: number;
  exact_count: number;
  outcome_count: number;
  duel_wins?: number;
  duel_losses?: number;
  duel_draws?: number;
}

interface LeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  pagination: { offset: number; limit: number; has_more: boolean };
}

const COUNTRIES = ["Argentina", "Brazil", "Colombia", "Costa Rica", "Mexico", "USA"] as const;
type Country = typeof COUNTRIES[number];
type View = "global" | Country;

const COUNTRY_FLAGS: Record<string, string> = {
  "Argentina": "\u{1F1E6}\u{1F1F7}",
  "Brazil": "\u{1F1E7}\u{1F1F7}",
  "Colombia": "\u{1F1E8}\u{1F1F4}",
  "Costa Rica": "\u{1F1E8}\u{1F1F7}",
  "Mexico": "\u{1F1F2}\u{1F1FD}",
  "USA": "\u{1F1FA}\u{1F1F8}",
};

/* ── component ─────────────────────────────────────────────── */

export default function LeaderboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("global");
  const [total, setTotal] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const url = view === "global"
        ? "/leaderboards/global"
        : `/leaderboards/global?country=${encodeURIComponent(view)}`;
      const res = await apiFetch<LeaderboardResponse>(url);
      setEntries(res.data);
      setTotal(res.total);
    } catch { setEntries([]); }
    setLoading(false);
  }, [view]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  /* ── helpers ──────────────────────────────────────────────── */

  /** Rank badge for positions 1-3 */
  const RankCell = ({ rank }: { rank: number }) => (
    <span className="text-[12px] text-rz-text-muted font-semibold tabular-nums">{rank}</span>
  );

  /* ── column definitions ──────────────────────────────────── */
  const columns = [
    { key: "rank",    label: "#",   align: "center" as const },
    { key: "player",  label: "Player", align: "left" as const },
    { key: "exact",   label: "E",   align: "center" as const },
    { key: "outcome", label: "O",   align: "center" as const },
    { key: "dw",      label: "DW",  align: "center" as const },
    { key: "ch",      label: "CH",  align: "center" as const },
    { key: "pts",     label: "Pts", align: "right" as const },
  ];

  /* ── render ──────────────────────────────────────────────── */

  return (
    <div className="max-w-3xl mx-auto">
      {/* ─── Header ─── */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-black tracking-tight uppercase">Table</h1>
          {total > 0 && (
            <p className="text-[11px] text-rz-text-muted mt-0.5">{total} players competing</p>
          )}
        </div>
      </div>

      {/* ─── View switcher — pill style ─── */}
      <div className="flex items-center gap-1 p-1 bg-rz-surface rounded-lg mb-4 overflow-x-auto">
        {(["global", ...COUNTRIES] as const).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={`px-3.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              view === t
                ? "bg-rz-red text-white shadow-sm shadow-red-900/40"
                : "text-rz-text-muted hover:text-rz-text-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ─── Loading ─── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-rz-text-muted">
          <p className="text-sm font-medium">No standings yet</p>
          <p className="text-xs mt-1 text-rz-text-muted">
            {view === "global"
              ? "Predict matches to join the table."
              : `No players from ${view} yet.`}
          </p>
        </div>
      ) : (
        /* ─── Standings table ─── */
        <div className="rounded-xl bg-rz-surface border border-rz-border overflow-hidden">
          {/* Scrollable container for mobile */}
          <div>
            <table className="w-full">
              {/* ── Header ── */}
              <thead>
                <tr className="border-b border-rz-border">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`py-2.5 px-1.5 first:pl-3 last:pr-3 sm:px-2 sm:first:pl-4 sm:last:pr-4 text-[10px] font-bold uppercase tracking-widest text-rz-text-muted
                        ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                        ${col.key === "pts" ? "bg-rz-red/[0.03]" : ""}
                        ${col.key === "rank" ? "w-8 sm:w-12" : ""}
                        ${col.key === "player" ? "w-auto" : ""}
                        ${col.key !== "player" && col.key !== "rank" ? "w-10 sm:w-14" : ""}
                      `}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ── Body ── */}
              <tbody>
                {entries.map((entry) => {
                  const isMe = user?.id === entry.user_id;

                  return (
                    <tr
                      key={entry.user_id}
                      onClick={() => router.push(`/users/${entry.user_id}`)}
                      className={`
                        group cursor-pointer transition-colors duration-100
                        ${isMe
                          ? "bg-rz-red/[0.07] hover:bg-rz-red/[0.12]"
                          : "hover:bg-white/[0.03]"
                        }
                        border-b border-rz-border/50 last:border-b-0
                      `}
                    >
                      {/* # */}
                      <td className="py-2.5 px-1.5 pl-3 sm:px-2 sm:pl-4 text-center">
                        <RankCell rank={entry.rank} />
                      </td>

                      {/* Player */}
                      <td className="py-2.5 px-1.5 sm:px-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar src={entry.avatar_url} name={entry.display_name} size="sm" />
                          <span className={`text-[13px] font-semibold truncate max-w-[100px] sm:max-w-[180px] ${
                            isMe ? "text-rz-red" : "text-rz-text group-hover:text-white"
                          } transition-colors`}>
                            {entry.country && COUNTRY_FLAGS[entry.country] && (
                              <span
                                className="mr-1.5 text-[14px] align-middle"
                                title={entry.country}
                                aria-label={entry.country}
                              >
                                {COUNTRY_FLAGS[entry.country]}
                              </span>
                            )}
                            {entry.display_name}
                            {isMe && (
                              <span className="ml-1.5 text-[9px] font-bold uppercase text-rz-red/70">you</span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* E — Exact */}
                      <td className="py-2.5 px-1.5 sm:px-2 text-center text-[12px] tabular-nums text-rz-text-secondary font-medium">
                        {entry.exact_count}
                      </td>

                      {/* O — Outcome */}
                      <td className="py-2.5 px-1.5 sm:px-2 text-center text-[12px] tabular-nums text-rz-text-secondary font-medium">
                        {entry.outcome_count}
                      </td>

                      {/* DW — Duel Wins */}
                      <td className="py-2.5 px-1.5 sm:px-2 text-center text-[12px] tabular-nums text-rz-text-muted">
                        {entry.duel_wins ?? 0}
                      </td>

                      {/* CH — Challenge Pts */}
                      <td className="py-2.5 px-1.5 sm:px-2 text-center text-[12px] tabular-nums text-rz-text-muted">
                        {entry.challenge_points ?? 0}
                      </td>

                      {/* Pts */}
                      <td className="py-2.5 px-1.5 sm:px-2 pr-3 sm:pr-4 text-right bg-rz-red/[0.03]">
                        <span className="text-[14px] font-black tabular-nums text-rz-text">
                          {entry.points}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Legend bar ── */}
          <div className="border-t border-rz-border/50 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-rz-text-muted uppercase tracking-wider font-medium">
            <span>E = Exact Score</span>
            <span>O = Correct Outcome</span>
            <span>DW = Duel Wins</span>
            <span>CH = Challenge Pts</span>
            <span>Pts = Total Points</span>
          </div>
        </div>
      )}
    </div>
  );
}

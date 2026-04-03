"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { LEADERBOARD } from "@/constants/strings";

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  points: number;
  exact_count: number;
  outcome_count: number;
}

interface LeaderboardResponse {
  data: LeaderboardEntry[];
  pagination: { next_cursor: string | null; has_more: boolean };
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"global" | "tournament">("global");

  useEffect(() => {
    setLoading(true);
    apiFetch<LeaderboardResponse>("/leaderboards/global")
      .then((res) => setEntries(res.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{LEADERBOARD.title}</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["global", "tournament"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t
                ? "bg-green-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {t === "global" ? LEADERBOARD.global : "By Tournament"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No leaderboard data yet</p>
          <p className="text-sm">Make predictions to start earning points!</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 w-16">{LEADERBOARD.rank}</th>
                <th className="px-4 py-3 font-medium text-gray-500">{LEADERBOARD.player}</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">{LEADERBOARD.points}</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right hidden sm:table-cell">{LEADERBOARD.exact}</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right hidden sm:table-cell">{LEADERBOARD.outcome}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="px-4 py-3 font-bold text-green-600">{entry.rank}</td>
                  <td className="px-4 py-3 font-medium">{entry.display_name}</td>
                  <td className="px-4 py-3 text-right font-bold">{entry.points}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">{entry.exact_count}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">{entry.outcome_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

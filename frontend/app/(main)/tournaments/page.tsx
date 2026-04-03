"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface MyPrediction {
  id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
  result_type: string | null;
  submitted_at: string;
}

export default function TournamentsPage() {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<MyPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: MyPrediction[] }>("/me/predictions")
      .then((res) => setPredictions(res.data))
      .catch(() => setPredictions([]))
      .finally(() => setLoading(false));
  }, []);

  const totalPoints = predictions.reduce((sum, p) => sum + (p.points || 0), 0);
  const exactCount = predictions.filter((p) => p.result_type === "exact").length;

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s your tournament overview</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{predictions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Predictions</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalPoints}</p>
          <p className="text-xs text-gray-500 mt-1">Total Points</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{exactCount}</p>
          <p className="text-xs text-gray-500 mt-1">Exact Scores</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
          <p className="text-2xl font-bold text-green-600">—</p>
          <p className="text-xs text-gray-500 mt-1">Rank</p>
        </div>
      </div>

      {/* Tournament card — FIFA World Cup 2026 */}
      <h2 className="text-lg font-bold mb-4">Tournaments</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/tournaments/1"
          className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:ring-2 hover:ring-green-500 transition block"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h3 className="font-bold text-lg">FIFA World Cup 2026</h3>
              <p className="text-xs text-gray-400">USA • Mexico • Canada</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>48 teams</span>
            <span>104 matches</span>
            <span className="text-green-600 font-medium">Active</span>
          </div>
        </Link>
      </div>

      {/* Quick links */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/leaderboard"
          className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:ring-2 hover:ring-green-500 transition"
        >
          <span className="text-xl">📊</span>
          <span className="text-sm font-medium">Leaderboard</span>
        </Link>
        <Link
          href="/duels"
          className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:ring-2 hover:ring-green-500 transition"
        >
          <span className="text-xl">⚔️</span>
          <span className="text-sm font-medium">Duels</span>
        </Link>
        <Link
          href="/challenges"
          className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:ring-2 hover:ring-green-500 transition"
        >
          <span className="text-xl">⚡</span>
          <span className="text-sm font-medium">Challenges</span>
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:ring-2 hover:ring-green-500 transition"
        >
          <span className="text-xl">👤</span>
          <span className="text-sm font-medium">Profile</span>
        </Link>
      </div>

      {/* Recent predictions */}
      {!loading && predictions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4">Recent Predictions</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Match</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-center">Your Score</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 5).map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="px-4 py-3">
                      <Link href={`/matches/${p.match_id}`} className="text-green-600 hover:underline">
                        Match {p.match_id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold">
                      {p.home_score} - {p.away_score}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{p.points ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

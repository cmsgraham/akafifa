"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Profile {
  display_name: string;
  avatar_url: string | null;
  bio: string;
}

interface MyPrediction {
  id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
  result_type: string | null;
  submitted_at: string;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [predictions, setPredictions] = useState<MyPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Profile>("/me/profile").catch(() => null),
      apiFetch<{ data: MyPrediction[] }>("/me/predictions").catch(() => ({ data: [] })),
    ]).then(([p, pred]) => {
      setProfile(p);
      setPredictions(pred?.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {/* Profile card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-2xl">
            {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-bold text-lg">{profile?.display_name || "User"}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
              {user?.role}
            </span>
          </div>
        </div>
        {profile?.bio && <p className="text-sm text-gray-600 dark:text-gray-400">{profile.bio}</p>}
      </div>

      {/* Predictions summary */}
      <h2 className="text-lg font-bold mb-3">My Predictions</h2>
      {predictions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No predictions yet. Head to a match to submit your first prediction!</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Match</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-center">Score</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">Points</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right hidden sm:table-cell">Result</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="px-4 py-3 text-gray-500">Match {p.match_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold">
                    {p.home_score} - {p.away_score}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">
                    {p.points ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        p.result_type === "exact"
                          ? "bg-green-100 text-green-700"
                          : p.result_type === "outcome"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.result_type || "pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={() => logout()}
        className="mt-8 px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm transition"
      >
        Sign Out
      </button>
    </div>
  );
}

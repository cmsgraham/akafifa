"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Challenge {
  id: string;
  question: string;
  options: { id: string; label: string }[];
  expires_at: string;
  points: number;
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Challenge[] }>("/challenges/active")
      .then((res) => setChallenges(res.data))
      .catch(() => setChallenges([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Flash Challenges</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">⚡</p>
          <p className="text-lg text-gray-500 mb-2">No active challenges</p>
          <p className="text-sm text-gray-400">
            Flash challenges appear during matches. Check back during live games!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {challenges.map((c) => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded">
                  +{c.points} pts
                </span>
                <span className="text-xs text-gray-400">
                  Expires {new Date(c.expires_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="font-medium mb-4">{c.question}</p>
              <div className="space-y-2">
                {c.options.map((opt) => (
                  <button
                    key={opt.id}
                    className="w-full text-left px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 text-sm transition"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

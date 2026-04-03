"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Duel {
  id: string;
  opponent_name: string;
  match_summary: string;
  status: string;
  created_at: string;
}

export default function DuelsPage() {
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Duel[] }>("/me/duels")
      .then((res) => setDuels(res.data))
      .catch(() => setDuels([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Duel Center</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : duels.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">⚔️</p>
          <p className="text-lg text-gray-500 mb-2">No active duels</p>
          <p className="text-sm text-gray-400">
            Challenge a friend from any match page to start a prediction duel!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {duels.map((duel) => (
            <div
              key={duel.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{duel.opponent_name}</p>
                <p className="text-sm text-gray-500">{duel.match_summary}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  duel.status === "pending"
                    ? "bg-yellow-100 text-yellow-700"
                    : duel.status === "accepted"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {duel.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

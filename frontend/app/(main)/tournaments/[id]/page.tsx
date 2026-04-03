"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kick_off: string;
  status: string;
  stage_name: string;
}

export default function TournamentPage({
  params,
}: {
  params: { id: string };
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Match[] }>(`/tournaments/${params.id}/matches`)
      .then((res) => setMatches(res.data))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tournament Matches</h1>
        <Link
          href="/tournaments"
          className="text-sm text-green-600 hover:underline"
        >
          ← Back to tournaments
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No matches scheduled yet</p>
          <p className="text-sm">Check back when the tournament draw is complete.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <Link
              key={m.id}
              href={`/matches/${m.id}`}
              className="block bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:ring-2 hover:ring-green-500 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{m.stage_name}</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    m.status === "live"
                      ? "bg-red-100 text-red-600 animate-pulse"
                      : m.status === "finished"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {m.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.home_team}</span>
                <span className="font-mono font-bold text-lg">
                  {m.home_score ?? "?"} - {m.away_score ?? "?"}
                </span>
                <span className="font-medium">{m.away_team}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(m.kick_off).toLocaleDateString()} at{" "}
                {new Date(m.kick_off).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

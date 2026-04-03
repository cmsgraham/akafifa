"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PREDICTION } from "@/constants/strings";

interface MatchDetail {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kick_off: string;
  status: string;
  stage_name: string;
  lock_at: string;
}

export default function MatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [predError, setPredError] = useState("");
  const [predSuccess, setPredSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<MatchDetail>(`/matches/${params.id}`)
      .then(setMatch)
      .catch(() => setMatch(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  const isLocked = match ? new Date(match.lock_at) <= new Date() : true;

  const handlePredict = async (e: FormEvent) => {
    e.preventDefault();
    setPredError("");
    setPredSuccess("");
    setSubmitting(true);
    try {
      await apiFetch(`/matches/${params.id}/prediction`, {
        method: "POST",
        body: JSON.stringify({
          home_score: parseInt(homeScore),
          away_score: parseInt(awayScore),
        }),
      });
      setPredSuccess("Prediction submitted!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit";
      if (msg.includes("already")) {
        try {
          await apiFetch(`/matches/${params.id}/prediction`, {
            method: "PUT",
            body: JSON.stringify({
              home_score: parseInt(homeScore),
              away_score: parseInt(awayScore),
            }),
          });
          setPredSuccess("Prediction updated!");
        } catch (err2: unknown) {
          setPredError(err2 instanceof Error ? err2.message : "Failed to update");
        }
      } else {
        setPredError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Match not found</p>
        <Link href="/tournaments" className="text-green-600 hover:underline text-sm mt-2 inline-block">
          ← Back to tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Match header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6 text-center">
        <p className="text-xs text-gray-400 mb-3">{match.stage_name}</p>
        <div className="flex items-center justify-center gap-6 mb-3">
          <div className="text-center">
            <p className="font-bold text-lg">{match.home_team}</p>
          </div>
          <div className="text-3xl font-mono font-bold">
            {match.home_score ?? "?"} - {match.away_score ?? "?"}
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{match.away_team}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 text-sm">
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold ${
              match.status === "live"
                ? "bg-red-100 text-red-600 animate-pulse"
                : match.status === "finished"
                ? "bg-gray-100 text-gray-500"
                : "bg-green-100 text-green-600"
            }`}
          >
            {match.status}
          </span>
          <span className="text-gray-400">
            {new Date(match.kick_off).toLocaleDateString()} at{" "}
            {new Date(match.kick_off).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Prediction form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Your Prediction</h2>

        {isLocked ? (
          <p className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            {PREDICTION.locked}
          </p>
        ) : (
          <form onSubmit={handlePredict} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">{match.home_team}</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <span className="text-xl font-bold text-gray-400 pt-5">-</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">{match.away_team}</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {predError && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{predError}</p>
            )}
            {predSuccess && (
              <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg p-2">{predSuccess}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
            >
              {submitting ? "Submitting…" : PREDICTION.submit}
            </button>
          </form>
        )}
      </div>

      {/* Match Lounge link */}
      <Link
        href={`/matches/${params.id}/lounge`}
        className="block text-center text-sm text-green-600 hover:underline"
      >
        💬 Go to Match Lounge
      </Link>
    </div>
  );
}

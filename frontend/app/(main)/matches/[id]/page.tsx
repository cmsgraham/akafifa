"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PREDICTION } from "@/constants/strings";
import { MobilePageHeader } from "../../MobilePageHeader";
import { useTimezone } from "@/lib/timezone-context";
import { StarIcon } from "@/lib/icons";
import { Loader } from "@/lib/loader";
import { CommunityOdds } from "@/components/match/CommunityOdds";

interface MatchDetail {
  id: string;
  tournament_id: string;
  home_team: string;
  away_team: string;
  home_team_code: string | null;
  away_team_code: string | null;
  home_score: number | null;
  away_score: number | null;
  kick_off: string;
  lock_at: string;
  status: string;
  stage_name: string;
  venue: string | null;
  notes: string | null;
}

/* ── Prediction lock countdown ── */
function PredictionCountdown({ lockAt, status }: { lockAt: string; status: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (status === "finished" || status === "confirmed") {
      setExpired(true);
      return;
    }
    const update = () => {
      const diff = new Date(lockAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Closed"); setExpired(true); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
      setExpired(false);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [lockAt, status]);

  if (status === "finished" || status === "confirmed") return null;
  if (expired) {
    return (
      <div className="bg-red-900/20 rounded-xl p-3 text-center">
        <p className="text-sm font-semibold text-red-400">🔒 Predictions Closed</p>
      </div>
    );
  }
  return (
    <div className="bg-amber-900/20 rounded-xl p-3 text-center">
      <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider mb-1">Predictions close in</p>
      <p className="text-lg font-mono font-bold text-amber-400">{timeLeft}</p>
    </div>
  );
}

export default function MatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { formatDate, formatTime } = useTimezone();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [predError, setPredError] = useState("");
  const [predSuccess, setPredSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasPrediction, setHasPrediction] = useState(false);
  const [showNumpad, setShowNumpad] = useState(false);
  const [scoreField, setScoreField] = useState<"home" | "away">("home");
  const [isFav, setIsFav] = useState(false);
  const [calendarSending, setCalendarSending] = useState(false);

  useEffect(() => {
    apiFetch<MatchDetail>(`/matches/${params.id}`)
      .then((m) => {
        setMatch(m);
      })
      .catch(() => setMatch(null))
      .finally(() => setLoading(false));

    apiFetch<{ data: { home_score: number; away_score: number } | null }>(`/matches/${params.id}/prediction`)
      .then((res) => {
        if (res.data) {
          setHomeScore(String(res.data.home_score));
          setAwayScore(String(res.data.away_score));
          setHasPrediction(true);
        }
      })
      .catch(() => {});
  }, [params.id]);

  // Load favorite state
  useEffect(() => {
    try {
      const stored = localStorage.getItem("favorite_matches");
      if (stored) {
        const favs = JSON.parse(stored);
        setIsFav(!!favs[params.id]);
      }
    } catch {}
  }, [params.id]);

  const toggleFavorite = useCallback(() => {
    setIsFav((prev) => {
      const next = !prev;
      try {
        const stored = localStorage.getItem("favorite_matches");
        const favs = stored ? JSON.parse(stored) : {};
        if (next) favs[params.id] = true; else delete favs[params.id];
        localStorage.setItem("favorite_matches", JSON.stringify(favs));
      } catch {}
      return next;
    });
  }, [params.id]);

  const handleDownloadCalendar = useCallback(() => {
    if (!match) return;
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const start = new Date(match.kick_off);
    const end = new Date(start.getTime() + 7200000);
    const lock = new Date(match.lock_at);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${match.home_team} vs ${match.away_team}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `${match.stage_name}\nPredictions close: ${lock.toLocaleString()}\nPredict: https://redzone-soccer.com/matches/${match.id}`,
      location: match.venue || "TBD",
    });
    window.open(`https://calendar.google.com/calendar/render?${params}`, "_blank");
  }, [match]);

  const handleSendCalendar = useCallback(async () => {
    if (!match) return;
    setCalendarSending(true);
    try {
      const res = await apiFetch<{ message: string }>(`/matches/${match.id}/send-calendar`, { method: "POST" });
      alert(res.message);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send");
    }
    setCalendarSending(false);
  }, [match]);

  const isLocked = match ? new Date(match.lock_at) <= new Date() : true;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-12 text-rz-text-muted">
        <p className="text-lg">Match not found</p>
        <Link href="/home" className="text-rz-red hover:underline text-sm mt-2 inline-block">
          ← Back to tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <MobilePageHeader title="Match Detail" backLabel="Back" />
      {/* Desktop back button */}
      <button
        onClick={() => window.history.back()}
        className="hidden sm:block mb-4 text-sm text-rz-red hover:underline"
      >
        ← Back
      </button>

      {/* Match header */}
      <div className="bg-rz-surface rounded-xl border border-rz-border p-6 mb-4 text-center relative">
        {/* Favorite + Calendar buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button onClick={toggleFavorite}
            className="hover:scale-125 transition-transform" title="Toggle favorite">
            <StarIcon className={`w-5 h-5 ${isFav ? "text-yellow-400" : "text-rz-text-muted"}`} filled={isFav} />
          </button>
          <button onClick={handleDownloadCalendar}
            className="text-rz-text-muted hover:text-rz-text transition opacity-60 hover:opacity-100" title="Add to calendar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          <button onClick={handleSendCalendar} disabled={calendarSending}
            className="text-xs text-rz-text-muted hover:text-rz-text transition opacity-60 hover:opacity-100 disabled:opacity-30" title="Email calendar event">
            {calendarSending ? "..." : "Email"}
          </button>
        </div>

        <p className="text-xs text-rz-text-muted mb-3">{match.stage_name}</p>
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
                ? "bg-red-900/30 text-red-400 animate-pulse"
                : match.status === "finished"
                ? "bg-rz-surface-2 text-rz-text-muted"
                : "bg-rz-red/10 text-rz-red"
            }`}
          >
            {match.status}
          </span>
          <span className="text-rz-text-muted">
            {formatDate(match.kick_off)} at{" "}
            {formatTime(match.kick_off)}
          </span>
        </div>
        {match.venue && (
          <p className="text-xs text-rz-text-muted mt-2">📍 {match.venue}</p>
        )}
      </div>

      {/* Prediction countdown */}
      <div className="mb-4">
        <PredictionCountdown lockAt={match.lock_at} status={match.status} />
      </div>

      {/* Match Notes */}
      {match.notes && (
        <div className="bg-rz-surface rounded-xl border border-rz-border p-5 mb-6">
          <h2 className="font-bold text-sm text-rz-text-muted mb-2">Match Notes</h2>
          <p className="text-sm text-rz-text-secondary whitespace-pre-line">{match.notes}</p>
        </div>
      )}

      {/* Prediction form */}
      <div className="bg-rz-surface rounded-xl border border-rz-border p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Your Prediction</h2>

        {isLocked ? (
          <p className="text-sm text-rz-warning bg-yellow-900/20 rounded-lg p-3">
            {PREDICTION.locked}
          </p>
        ) : (
          <>
            {/* Score display – tap to open numpad */}
            <div className="flex items-center justify-center gap-4 mb-4 cursor-pointer"
              onClick={() => { setScoreField("home"); setShowNumpad(true); }}>
              <div className="text-center">
                <p className="text-xs text-rz-text-muted mb-1">{match.home_team}</p>
                <div className="w-16 h-14 flex items-center justify-center font-mono font-black text-3xl rounded-xl bg-rz-surface-2 text-rz-text border border-rz-border-strong">
                  {homeScore || "?"}
                </div>
              </div>
              <span className="text-rz-text-muted font-black text-2xl mt-5">:</span>
              <div className="text-center">
                <p className="text-xs text-rz-text-muted mb-1">{match.away_team}</p>
                <div className="w-16 h-14 flex items-center justify-center font-mono font-black text-3xl rounded-xl bg-rz-surface-2 text-rz-text border border-rz-border-strong">
                  {awayScore || "?"}
                </div>
              </div>
            </div>

            {predError && (
              <p className="text-sm text-red-400 bg-red-900/20 rounded-lg p-2 mb-3">{predError}</p>
            )}
            {predSuccess && (
              <p className="text-sm text-rz-success bg-green-900/20 rounded-lg p-2 mb-3">{predSuccess}</p>
            )}

            <button
              onClick={() => { setScoreField("home"); setShowNumpad(true); }}
              className="w-full rounded-lg bg-rz-red px-4 py-2 text-sm font-semibold text-white hover:bg-rz-red-hover transition"
            >
              {hasPrediction ? "Update Prediction" : PREDICTION.submit}
            </button>
          </>
        )}
      </div>

      {/* Community odds */}
      <CommunityOdds
        matchId={match.id}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
      />

      {/* ═══ PREDICTION NUMPAD MODAL ═══ */}
      {showNumpad && match && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowNumpad(false)}>
          <div className="bg-rz-bg w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl border border-rz-border/50 overflow-hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} onClick={e => e.stopPropagation()}>
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-[10px] font-semibold text-rz-text-muted uppercase tracking-widest">{match.stage_name}</span>
              <button onClick={() => setShowNumpad(false)} className="text-rz-text-muted hover:text-rz-text text-lg leading-none">&times;</button>
            </div>

            {/* Score display */}
            <div className="px-5 pb-4">
              <div className="flex items-center justify-center gap-5">
                <div className="flex-1 text-center">
                  <p className="text-[11px] font-medium text-rz-text-muted mb-2 truncate">{match.home_team}</p>
                  <button onClick={() => setScoreField("home")}
                    className={`w-full aspect-square max-w-[72px] mx-auto flex items-center justify-center font-mono font-black text-4xl rounded-2xl transition-all ${
                      scoreField === "home"
                        ? "bg-rz-red text-white shadow-lg shadow-rz-red/25 scale-105"
                        : "bg-rz-surface text-rz-text border border-rz-border hover:border-rz-text-muted"
                    }`}>
                    {homeScore || "0"}
                  </button>
                </div>
                <span className="text-rz-text-muted/40 font-light text-3xl mt-6">:</span>
                <div className="flex-1 text-center">
                  <p className="text-[11px] font-medium text-rz-text-muted mb-2 truncate">{match.away_team}</p>
                  <button onClick={() => setScoreField("away")}
                    className={`w-full aspect-square max-w-[72px] mx-auto flex items-center justify-center font-mono font-black text-4xl rounded-2xl transition-all ${
                      scoreField === "away"
                        ? "bg-rz-red text-white shadow-lg shadow-rz-red/25 scale-105"
                        : "bg-rz-surface text-rz-text border border-rz-border hover:border-rz-text-muted"
                    }`}>
                    {awayScore || "0"}
                  </button>
                </div>
              </div>
            </div>

            {/* Keypad */}
            <div className="bg-rz-surface border-t border-rz-border px-4 pt-3 pb-2">
              <div className="grid grid-cols-3 gap-[6px] max-w-[260px] mx-auto">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => {
                    if (scoreField === "home") { setHomeScore(String(n)); setScoreField("away"); }
                    else { setAwayScore(String(n)); }
                  }}
                    className="h-11 rounded-xl bg-rz-bg text-rz-text font-mono font-semibold text-lg hover:bg-rz-surface-2 active:scale-95 transition-all">
                    {n}
                  </button>
                ))}
                <button onClick={() => {
                  if (scoreField === "home") { setHomeScore(""); }
                  else { setAwayScore(""); }
                }}
                  className="h-11 rounded-xl text-rz-text-muted font-medium text-xs hover:bg-rz-surface-2 active:scale-95 transition-all">
                  CLR
                </button>
                <button onClick={() => {
                  if (scoreField === "home") { setHomeScore("0"); setScoreField("away"); }
                  else { setAwayScore("0"); }
                }}
                  className="h-11 rounded-xl bg-rz-bg text-rz-text font-mono font-semibold text-lg hover:bg-rz-surface-2 active:scale-95 transition-all">
                  0
                </button>
                <button onClick={() => setScoreField(scoreField === "home" ? "away" : "home")}
                  className="h-11 rounded-xl text-rz-text-muted font-medium text-xs hover:bg-rz-surface-2 active:scale-95 transition-all">
                  {scoreField === "home" ? "AWAY →" : "← HOME"}
                </button>
              </div>
            </div>

            {/* Confirm */}
            <div className="px-4 pt-2 pb-5 bg-rz-surface">
              {predError && (
                <p className="text-xs text-red-400 text-center mb-2">{predError}</p>
              )}
              <button onClick={async () => {
                if (!homeScore && homeScore !== "0" || !awayScore && awayScore !== "0") { setPredError("Enter both scores"); return; }
                setPredError(""); setPredSuccess(""); setSubmitting(true);
                const body = JSON.stringify({ home_score: parseInt(homeScore || "0"), away_score: parseInt(awayScore || "0") });
                try {
                  if (hasPrediction) {
                    await apiFetch(`/matches/${params.id}/prediction`, { method: "PUT", body });
                    setPredSuccess("Prediction updated!");
                  } else {
                    await apiFetch(`/matches/${params.id}/prediction`, { method: "POST", body });
                    setPredSuccess("Prediction submitted!");
                    setHasPrediction(true);
                  }
                  setShowNumpad(false);
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Failed to submit";
                  if (msg.includes("already")) {
                    try {
                      await apiFetch(`/matches/${params.id}/prediction`, { method: "PUT", body });
                      setPredSuccess("Prediction updated!");
                      setHasPrediction(true);
                      setShowNumpad(false);
                    } catch (err2: unknown) {
                      setPredError(err2 instanceof Error ? err2.message : "Failed to update");
                    }
                  } else { setPredError(msg); }
                } finally { setSubmitting(false); }
              }} disabled={submitting}
                className="w-full bg-rz-red text-white py-3 rounded-xl text-sm font-bold hover:bg-rz-red-hover disabled:opacity-50 active:scale-[0.98] transition-all">
                {submitting ? "Saving…" : hasPrediction ? "Update Prediction" : "Confirm Prediction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Lounge link */}
      <Link
        href={`/matches/${params.id}/lounge`}
        className="block text-center text-sm text-rz-red hover:underline"
      >
        Go to Match Lounge
      </Link>
    </div>
  );
}

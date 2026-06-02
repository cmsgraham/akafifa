"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useTimezone } from "@/lib/timezone-context";
import { MobilePageHeader } from "../../MobilePageHeader";
import { StarIcon, SearchIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from "@/lib/icons";
import { FilterCards, FilterOption } from "@/components/ui/FilterCards";
import { Loader } from "@/lib/loader";

interface Match {
  id: string;
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
}

interface MyPrediction {
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
  result_type: string | null;
}

// Country code to flag emoji
function codeToFlag(code: string | null): string {
  const flagMap: Record<string, string> = {
    ARG: "🇦🇷", BRA: "🇧🇷", GER: "🇩🇪", FRA: "🇫🇷", ESP: "🇪🇸",
    ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ITA: "🇮🇹", MEX: "🇲🇽", USA: "🇺🇸", CAN: "🇨🇦",
    JPN: "🇯🇵", KOR: "🇰🇷", AUS: "🇦🇺", NED: "🇳🇱", BEL: "🇧🇪",
    POR: "🇵🇹", CRO: "🇭🇷", URU: "🇺🇾", COL: "🇨🇴", ECU: "🇪🇨",
    MAR: "🇲🇦", SEN: "🇸🇳", TUN: "🇹🇳", GHA: "🇬🇭", EGY: "🇪🇬",
    ALG: "🇩🇿", CIV: "🇨🇮", RSA: "🇿🇦", NOR: "🇳🇴", SWE: "🇸🇪",
    SUI: "🇨🇭", AUT: "🇦🇹", CZE: "🇨🇿", TUR: "🇹🇷", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    IRN: "🇮🇷", IRQ: "🇮🇶", QAT: "🇶🇦", KSA: "🇸🇦", JOR: "🇯🇴",
    NZL: "🇳🇿", PAR: "🇵🇾", BIH: "🇧🇦", COD: "🇨🇩", CUR: "🇨🇼",
    CPV: "🇨🇻", HAI: "🇭🇹", PAN: "🇵🇦", UZB: "🇺🇿",
    // Costa Rica clubs
    LDA: "🇨🇷", SAP: "🇨🇷", HER: "🇨🇷", CAR: "🇨🇷", SCA: "🇨🇷",
    GRE: "🇨🇷", GUA: "🇨🇷", SPO: "🇨🇷", LIB: "🇨🇷", SDG: "🇨🇷",
    PFC: "🇨🇷", SAN: "🇨🇷", CRC: "🇨🇷", GFC: "🇨🇷", MPZ: "🇨🇷",
  };
  if (!code) return "🏳️";
  return flagMap[code.toUpperCase()] || "🏳️";
}

const stageColors: Record<string, string> = {
  "Group Stage": "from-emerald-500 to-teal-600",
  "Round of 16": "from-blue-500 to-indigo-600",
  "Quarterfinals": "from-purple-500 to-violet-600",
  "Semi-finals": "from-orange-500 to-red-500",
  "Final": "from-yellow-500 to-amber-600",
};

function getStageColor(stage: string): string {
  for (const [key, val] of Object.entries(stageColors)) {
    if (stage.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return "from-gray-500 to-gray-600";
}

function getStageAccent(stage: string): string {
  if (stage.toLowerCase().includes("group")) return "border-emerald-400";
  if (stage.toLowerCase().includes("16")) return "border-blue-400";
  if (stage.toLowerCase().includes("quarter")) return "border-purple-400";
  if (stage.toLowerCase().includes("semi")) return "border-orange-400";
  if (stage.toLowerCase().includes("final")) return "border-yellow-400";
  return "border-rz-border-strong";
}

/* ── Prediction countdown ── */
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
      setTimeLeft(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
      setExpired(false);
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [lockAt, status]);

  if (status === "finished" || status === "confirmed") return null;
  if (expired) return <span className="text-[9px] text-red-500 font-medium">Predictions closed</span>;
  return <span className="text-[9px] text-amber-500 font-medium">Predictions close in {timeLeft}</span>;
}

/* ── Add to Google Calendar ── */
function addToCalendar(m: Match) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = new Date(m.kick_off);
  const end = new Date(start.getTime() + 7200000);
  const lock = new Date(m.lock_at);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${m.home_team} vs ${m.away_team}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${m.stage_name}\nPredictions close: ${lock.toLocaleString()}\nPredict: https://redzone-soccer.com/matches/${m.id}`,
    location: m.venue || "TBD",
  });
  window.open(`https://calendar.google.com/calendar/render?${params}`, "_blank");
}

/* ── Inline Prediction Widget ── */
function InlinePrediction({
  match,
  prediction,
  onSaved,
  onCleared,
}: {
  match: Match;
  prediction: MyPrediction | undefined;
  onSaved: (matchId: string, pred: MyPrediction) => void;
  onCleared: (matchId: string) => void;
}) {
  const isLocked = new Date(match.lock_at).getTime() <= Date.now();
  const isFinished = match.status === "finished" || match.status === "confirmed";
  const canEdit = !isLocked && !isFinished;

  const [editing, setEditing] = useState(false);
  const [home, setHome] = useState(prediction?.home_score ?? 0);
  const [away, setAway] = useState(prediction?.away_score ?? 0);
  const [saving, setSaving] = useState(false);
  const [activeField, setActiveField] = useState<"home" | "away">("home");

  useEffect(() => {
    if (prediction) {
      setHome(prediction.home_score);
      setAway(prediction.away_score);
    }
  }, [prediction]);

  useEffect(() => {
    if (editing) {
      setActiveField("home");
    }
  }, [editing]);

  const doSave = async (h: number, a: number) => {
    setSaving(true);
    try {
      const method = prediction ? "PUT" : "POST";
      await apiFetch(`/matches/${match.id}/prediction`, {
        method,
        body: JSON.stringify({ home_score: h, away_score: a }),
      });
      onSaved(match.id, {
        match_id: match.id,
        home_score: h,
        away_score: a,
        points: prediction?.points ?? null,
        result_type: prediction?.result_type ?? null,
      });
      setEditing(false);
    } catch {
      // silently fail — user can retry
    }
    setSaving(false);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await doSave(home, away);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHome(prediction?.home_score ?? 0);
    setAway(prediction?.away_score ?? 0);
    setEditing(false);
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!prediction) return;
    setSaving(true);
    try {
      await apiFetch(`/matches/${match.id}/prediction`, { method: "DELETE" });
      onCleared(match.id);
      setHome(0);
      setAway(0);
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canEdit) setEditing(true);
  };

  const resultColor = prediction?.result_type === "exact"
    ? "border-rz-success bg-rz-success/20"
    : prediction?.result_type === "outcome"
    ? "border-yellow-400 bg-yellow-900/20"
    : prediction?.result_type === "miss"
    ? "border-red-300 bg-red-900/20"
    : "border-rz-border-strong bg-rz-surface-2";

  const pointsBadgeColor = prediction?.result_type === "exact"
    ? "bg-rz-success text-white"
    : prediction?.result_type === "outcome"
    ? "bg-yellow-500 text-white"
    : prediction?.result_type === "miss"
    ? "bg-red-400 text-white"
    : "bg-rz-red text-white";

  const numpadTap = (n: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeField === "home") {
      setHome(n);
      setActiveField("away");
    } else {
      setAway(n);
      doSave(home, n);
    }
  };

  const numpadClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeField === "home") setHome(0);
    else setAway(0);
  };

  // Editing mode
  if (editing) {
    return (
      <>
        {/* Keep inline placeholder so list doesn't shift */}
        <div className="mt-2 flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 border-2 border-dashed border-rz-red bg-rz-red/5">
          <span className="text-xs font-semibold text-rz-red">Editing…</span>
        </div>
        {/* Full-screen modal overlay */}
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => { e.stopPropagation(); handleCancel(e as unknown as React.MouseEvent); }}
        >
          <div
            className="bg-rz-bg w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl border border-rz-border/50 overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
        {/* Score row */}
        <div className="flex items-center justify-center gap-4 px-3 pt-3 pb-2">
          <div className="flex-1 text-center">
            <p className="text-[9px] font-medium text-rz-text-muted mb-1 truncate">{match.home_team}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveField("home"); }}
              className={`w-full max-w-[52px] mx-auto aspect-square flex items-center justify-center font-mono font-black text-2xl rounded-xl transition-all ${
                activeField === "home"
                  ? "bg-rz-red text-white shadow-md shadow-rz-red/20 scale-105"
                  : "bg-rz-surface text-rz-text border border-rz-border hover:border-rz-text-muted"
              }`}
            >
              {home}
            </button>
          </div>
          <span className="text-rz-text-muted/30 font-light text-xl mt-4">:</span>
          <div className="flex-1 text-center">
            <p className="text-[9px] font-medium text-rz-text-muted mb-1 truncate">{match.away_team}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveField("away"); }}
              className={`w-full max-w-[52px] mx-auto aspect-square flex items-center justify-center font-mono font-black text-2xl rounded-xl transition-all ${
                activeField === "away"
                  ? "bg-rz-red text-white shadow-md shadow-rz-red/20 scale-105"
                  : "bg-rz-surface text-rz-text border border-rz-border hover:border-rz-text-muted"
              }`}
            >
              {away}
            </button>
          </div>
        </div>
        {/* Compact keypad */}
        <div className="bg-rz-surface border-t border-rz-border px-3 pt-2 pb-1.5">
          <div className="grid grid-cols-6 gap-1 max-w-[240px] mx-auto">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={(e) => numpadTap(n, e)}
                className="h-8 rounded-lg bg-rz-bg text-rz-text font-mono font-semibold text-sm hover:bg-rz-surface-2 active:scale-90 transition-all">
                {n}
              </button>
            ))}
            <button onClick={(e) => numpadTap(0, e)}
              className="h-8 rounded-lg bg-rz-bg text-rz-text font-mono font-semibold text-sm hover:bg-rz-surface-2 active:scale-90 transition-all">
              0
            </button>
            <button onClick={numpadClear}
              className="h-8 rounded-lg text-rz-text-muted font-medium text-[10px] hover:bg-rz-surface-2 active:scale-90 transition-all">
              CLR
            </button>
            <button onClick={handleCancel}
              className="h-8 rounded-lg text-rz-text-muted font-medium text-[10px] hover:bg-rz-surface-2 active:scale-90 transition-all">
              ESC
            </button>
          </div>
        </div>
        {prediction && (
          <div className="border-t border-rz-border bg-rz-surface">
            <button onClick={handleClear} disabled={saving}
              className="w-full py-1.5 text-[10px] font-medium text-rz-text-muted hover:text-red-400 disabled:opacity-30 transition">
              Remove prediction
            </button>
          </div>
        )}
          </div>
        </div>
      </>
    );
  }

  // Display mode — has prediction
  if (prediction) {
    return (
      <div
        className={`mt-2 flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 border ${resultColor} ${canEdit ? "cursor-pointer hover:shadow-md transition" : ""}`}
        onClick={canEdit ? startEditing : undefined}
        title={canEdit ? "Tap to edit prediction" : undefined}
      >
        <span className="text-[10px] text-rz-red font-bold uppercase tracking-wide">Your Pick</span>
        <span className="font-mono font-black text-base text-rz-text">
          {prediction.home_score} - {prediction.away_score}
        </span>
        {prediction.points != null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pointsBadgeColor}`}>
            {prediction.points}pts
          </span>
        )}
        {canEdit && <span className="text-[10px] text-rz-text-muted">Edit</span>}
      </div>
    );
  }

  // No prediction yet
  if (canEdit) {
    return (
      <div
        className="mt-2 flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 border-2 border-dashed border-rz-border-strong bg-rz-surface-2/50 cursor-pointer hover:border-rz-red hover:bg-rz-red/5 transition"
        onClick={startEditing}
      >
        <span className="text-xs font-semibold text-rz-red">Make Prediction</span>
      </div>
    );
  }

  return null;
}

export default function TournamentPage({
  params,
}: {
  params: { id: string };
}) {
  const { formatDate, formatTime, timezone } = useTimezone();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, MyPrediction>>({});
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [hideFinished, setHideFinished] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tournamentName, setTournamentName] = useState("Tournament");
  const [activeDateIdx, setActiveDateIdx] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [odds, setOdds] = useState<Record<string, { available: boolean; total_predictions: number; home_win_pct?: number; draw_pct?: number; away_win_pct?: number }>>({});
  const [oddsThreshold, setOddsThreshold] = useState(5);
  const [oddsEnabled, setOddsEnabled] = useState(false);
  const router = useRouter();

  const dateScrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollingToRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handlePredictionSaved = useCallback((matchId: string, pred: MyPrediction) => {
    setPredictions((prev) => ({ ...prev, [matchId]: pred }));
  }, []);

  const handlePredictionCleared = useCallback((matchId: string) => {
    setPredictions((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Match[] }>(`/tournaments/${params.id}/matches`)
        .then((res) => setMatches(res.data))
        .catch(() => setMatches([])),
      apiFetch<{ data: MyPrediction[] }>("/me/predictions")
        .then((res) => {
          const map: Record<string, MyPrediction> = {};
          for (const p of res.data) map[p.match_id] = p;
          setPredictions(map);
        })
        .catch(() => setPredictions({})),
      apiFetch<{ data: { id: string; name: string; season: string }[] }>("/tournaments")
        .then((res) => {
          const t = res.data.find((t) => t.id === params.id);
          if (t) setTournamentName(`${t.name} — ${t.season}`);
        })
        .catch(() => {}),
      apiFetch<{
        enabled: boolean;
        threshold: number;
        data: Record<string, { available: boolean; total_predictions: number; home_win_pct?: number; draw_pct?: number; away_win_pct?: number }>;
      }>(`/tournaments/${params.id}/community-odds`)
        .then((res) => {
          setOddsEnabled(res.enabled);
          setOddsThreshold(res.threshold);
          setOdds(res.data);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [params.id]);

  // Load favorites + hideFinished from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("favorite_matches");
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
    try {
      const h = localStorage.getItem(`hide_finished_${params.id}`);
      if (h === "true") setHideFinished(true);
    } catch {}
  }, [params.id]);

  const toggleFavorite = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      localStorage.setItem("favorite_matches", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleDownloadCalendar = useCallback((e: React.MouseEvent, m: Match) => {
    e.preventDefault();
    e.stopPropagation();
    addToCalendar(m);
  }, []);

  const [calSending, setCalSending] = useState<string | null>(null);
  const handleEmailCalendar = useCallback(async (e: React.MouseEvent, m: Match) => {
    e.preventDefault();
    e.stopPropagation();
    setCalSending(m.id);
    try {
      const res = await apiFetch<{ message: string }>(`/matches/${m.id}/send-calendar`, { method: "POST" });
      alert(res.message);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send");
    }
    setCalSending(null);
  }, []);

  const handleMatchClick = useCallback((e: React.MouseEvent, matchId: string) => {
    e.preventDefault();
    sessionStorage.setItem(`scroll_tournament_${params.id}`, String(window.scrollY));
    router.push(`/matches/${matchId}`);
  }, [params.id, router]);

  const toggleHideFinished = useCallback(() => {
    setHideFinished((prev) => {
      const next = !prev;
      localStorage.setItem(`hide_finished_${params.id}`, String(next));
      return next;
    });
  }, [params.id]);

  // ── Derive date-grouped data ──
  const { matchesByDate, dateKeys, dateObjects } = useMemo(() => {
    let visibleMatches = showFavoritesOnly
      ? matches.filter((m) => favorites[m.id])
      : [...matches];
    if (hideFinished)
      visibleMatches = visibleMatches.filter(
        (m) => m.status !== "finished" && m.status !== "confirmed"
      );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      visibleMatches = visibleMatches.filter(
        (m) =>
          m.home_team.toLowerCase().includes(q) ||
          m.away_team.toLowerCase().includes(q) ||
          m.stage_name.toLowerCase().includes(q) ||
          (m.venue && m.venue.toLowerCase().includes(q))
      );
    }

    // Apply visual filter card selection
    if (activeFilter !== "all") {
      if (activeFilter.startsWith("stage:")) {
        const stage = activeFilter.replace("stage:", "");
        visibleMatches = visibleMatches.filter(
          (m) => m.stage_name === stage
        );
      } else if (activeFilter.startsWith("country:")) {
        const country = activeFilter.replace("country:", "");
        visibleMatches = visibleMatches.filter(
          (m) => m.venue && m.venue.endsWith(`, ${country}`)
        );
      }
    }

    const grouped = visibleMatches.reduce<Record<string, Match[]>>((acc, m) => {
      const d = new Date(m.kick_off);
      // Use a stable sortable key: YYYY-MM-DD in user's timezone
      const parts = d.toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA gives YYYY-MM-DD
      if (!acc[parts]) acc[parts] = [];
      acc[parts].push(m);
      return acc;
    }, {});

    const keys = Object.keys(grouped).sort();

    const objects = keys.map((k) => {
      // k is "YYYY-MM-DD", safe to parse
      const d = new Date(k + "T12:00:00");
      return {
        key: k,
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        full: d.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        iso: k,
      };
    });

    return { matchesByDate: grouped, dateKeys: keys, dateObjects: objects };
  }, [matches, favorites, showFavoritesOnly, hideFinished, searchQuery, activeFilter, timezone]);

  // ── Build filter options from match data ──
  const filterOptions: FilterOption[] = useMemo(() => {
    const stageOrder = [
      "Group Stage", "Round of 32", "Round of 16",
      "Quarterfinals", "Semifinals", "Third Place Match", "Final",
    ];
    const stageLabels: Record<string, string> = {
      "Round of 32": "R32", "Round of 16": "R16",
      "Third Place Match": "3rd Place",
    };

    const stageCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    for (const m of matches) {
      stageCounts[m.stage_name] = (stageCounts[m.stage_name] || 0) + 1;
      if (m.venue) {
        const parts = m.venue.split(", ");
        const country = parts[parts.length - 1];
        if (country && country !== "Unknown") {
          countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
      }
    }

    const opts: FilterOption[] = [
      { id: "all", label: "All Matches", count: matches.length },
    ];

    for (const stage of stageOrder) {
      if (stageCounts[stage]) {
        opts.push({
          id: `stage:${stage}`,
          label: stageLabels[stage] || stage,
          count: stageCounts[stage],
        });
      }
    }

    const countryOrder = ["USA", "Mexico", "Canada"];
    for (const country of countryOrder) {
      if (countryCounts[country]) {
        opts.push({
          id: `country:${country}`,
          label: country,
          count: countryCounts[country],
        });
      }
    }

    return opts;
  }, [matches]);

  // ── Find today's index ──
  const todayIdx = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
    const idx = dateKeys.indexOf(today);
    if (idx >= 0) return idx;
    // Find nearest future date
    const now = Date.now();
    for (let i = 0; i < dateKeys.length; i++) {
      if (new Date(dateKeys[i]).getTime() >= now) return i;
    }
    return 0;
  }, [dateKeys, timezone]);

  // ── Initialize active date to today on mount ──
  useEffect(() => {
    if (!loading && dateKeys.length > 0) {
      // Check for saved scroll position first
      const saved = sessionStorage.getItem(`scroll_tournament_${params.id}`);
      if (saved) {
        requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
        sessionStorage.removeItem(`scroll_tournament_${params.id}`);
      } else {
        setActiveDateIdx(todayIdx);
        // Scroll to today's section
        setTimeout(() => scrollToDate(todayIdx), 100);
      }
    }
  }, [loading, dateKeys.length, todayIdx, params.id]);

  // ── IntersectionObserver to sync active date with scroll ──
  useEffect(() => {
    if (loading || dateKeys.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (scrollingToRef.current) return;
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) {
          const key = topEntry.target.getAttribute("data-date-key");
          const idx = dateKeys.indexOf(key || "");
          if (idx >= 0) {
            setActiveDateIdx(idx);
            scrollDatePillIntoView(idx);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    for (const key of dateKeys) {
      const el = sectionRefs.current[key];
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [loading, dateKeys]);

  // ── Show scroll-to-top button when scrolled down ──
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Desktop: convert vertical wheel → horizontal scroll on date row ──
  useEffect(() => {
    const el = dateScrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  });

  // ── Scroll helpers ──
  const scrollDatePillIntoView = useCallback((idx: number) => {
    const container = dateScrollRef.current;
    if (!container) return;
    const pill = container.children[idx] as HTMLElement | undefined;
    if (!pill) return;
    const left = pill.offsetLeft - container.offsetWidth / 2 + pill.offsetWidth / 2;
    container.scrollTo({ left, behavior: "smooth" });
  }, []);

  const scrollToDate = useCallback(
    (idx: number) => {
      const key = dateKeys[idx];
      if (!key) return;
      setActiveDateIdx(idx);
      scrollDatePillIntoView(idx);
      const el = sectionRefs.current[key];
      if (el) {
        scrollingToRef.current = true;
        const top = el.getBoundingClientRect().top + window.scrollY - 130;
        window.scrollTo({ top, behavior: "smooth" });
        setTimeout(() => {
          scrollingToRef.current = false;
        }, 800);
      }
    },
    [dateKeys, scrollDatePillIntoView]
  );

  const scrollToToday = useCallback(() => {
    scrollToDate(todayIdx);
  }, [todayIdx, scrollToDate]);

  const finishedCount = matches.filter(
    (m) => m.status === "finished" || m.status === "confirmed"
  ).length;
  const favCount = Object.keys(favorites).length;
  const visibleCount = dateKeys.reduce(
    (sum, k) => sum + (matchesByDate[k]?.length || 0),
    0
  );

  const activeDate = dateObjects[activeDateIdx];

  return (
    <div>
      <MobilePageHeader
        title={tournamentName || "Tournament"}
        backHref="/home"
        backLabel="Home"
      />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tournamentName}</h1>
          <p className="text-sm text-rz-text-muted mt-1">
            {matches.length} matches · {dateKeys.length} match days
            {favCount > 0 && <span className="ml-2">· {favCount} favorites</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {finishedCount > 0 && (
            <button
              onClick={toggleHideFinished}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                hideFinished
                  ? "bg-rz-red/10 border-rz-red text-rz-red"
                  : "bg-rz-surface border-rz-border text-rz-text-muted"
              }`}
            >
              {hideFinished
                ? `${finishedCount} Ended Hidden`
                : `Hide Ended (${finishedCount})`}
            </button>
          )}
          {favCount > 0 && (
            <button
              onClick={() => setShowFavoritesOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                showFavoritesOnly
                  ? "bg-yellow-900/20 border-yellow-400 text-yellow-400"
                  : "bg-rz-surface border-rz-border text-rz-text-muted"
              }`}
            >
              {showFavoritesOnly ? "Showing Favorites" : "Favorites"}
            </button>
          )}
        </div>
      </div>

      {/* ── Search + Date Picker Row ── */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`relative transition-all ${searchOpen ? "flex-1" : "w-auto"}`}>
          {searchOpen ? (
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rz-text-muted" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team, stage, or venue…"
                className="w-full rounded-xl border border-rz-border bg-rz-surface px-4 py-2 pl-9 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red transition"
              />
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-rz-text-muted hover:text-rz-text text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg border border-rz-border bg-rz-surface hover:bg-rz-surface-2 transition"
              title="Search"
            >
              <SearchIcon className="w-4 h-4 text-rz-text-muted" />
            </button>
          )}
        </div>
        {!searchOpen && (
          <>
            <button
              onClick={scrollToToday}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-rz-red text-white hover:bg-rz-red-hover transition whitespace-nowrap"
            >
              Today
            </button>
            <button
              onClick={() => setShowDatePicker((v) => !v)}
              className="p-2 rounded-lg border border-rz-border bg-rz-surface hover:bg-rz-surface-2 transition"
              title="Jump to date"
            >
              <CalendarIcon className="w-4 h-4 text-rz-text-muted" />
            </button>
          </>
        )}
      </div>

      {/* ── Visual Filter Cards ── */}
      {!loading && matches.length > 0 && (
        <div className="mb-3 -mx-4 px-4 sm:-mx-0 sm:px-0">
          <FilterCards
            options={filterOptions}
            selected={activeFilter}
            onChange={(id) => setActiveFilter(id)}
          />
        </div>
      )}

      {/* ── Date Picker Dropdown ── */}
      {showDatePicker && (
        <div className="mb-3 p-3 rounded-xl border border-rz-border bg-rz-surface shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rz-text-secondary">Jump to date</span>
            <button
              onClick={() => setShowDatePicker(false)}
              className="text-xs text-rz-text-muted hover:text-rz-text"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto">
            {dateObjects.map((d, i) => (
              <button
                key={d.key}
                onClick={() => {
                  scrollToDate(i);
                  setShowDatePicker(false);
                }}
                className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-center transition ${
                  i === activeDateIdx
                    ? "bg-rz-red text-white"
                    : i === todayIdx
                    ? "bg-rz-red/10 text-rz-red border border-rz-red/30"
                    : "hover:bg-rz-surface-2 text-rz-text-muted"
                }`}
              >
                <span className="text-[10px] font-medium">{d.day}</span>
                <span className="text-xs font-bold">{d.date}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Horizontal Date Selector (sticky) ── */}
      {!loading && dateKeys.length > 0 && (
        <div className="sticky top-0 z-30 bg-rz-bg/95 backdrop-blur-sm border-b border-rz-border pb-2 pt-1 -mx-4 px-4 sm:-mx-0 sm:px-0">
          <div className="relative group">
            {/* Left arrow – desktop only */}
            <button
              onClick={() => {
                const c = dateScrollRef.current;
                if (c) c.scrollBy({ left: -200, behavior: "smooth" });
              }}
              className="hidden md:flex absolute left-0 top-0 bottom-0 z-10 items-center justify-center w-8 bg-gradient-to-r from-rz-bg via-rz-bg/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Scroll dates left"
            >
              <ChevronLeftIcon className="w-4 h-4 text-rz-text-secondary" />
            </button>
            {/* Right arrow – desktop only */}
            <button
              onClick={() => {
                const c = dateScrollRef.current;
                if (c) c.scrollBy({ left: 200, behavior: "smooth" });
              }}
              className="hidden md:flex absolute right-0 top-0 bottom-0 z-10 items-center justify-center w-8 bg-gradient-to-l from-rz-bg via-rz-bg/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Scroll dates right"
            >
              <ChevronRightIcon className="w-4 h-4 text-rz-text-secondary" />
            </button>
            <div
              ref={dateScrollRef}
              className="flex gap-1 overflow-x-auto scrollbar-hide scroll-smooth md:px-8 md:cursor-grab md:active:cursor-grabbing"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              onMouseDown={(e) => {
                // Drag-to-scroll on desktop
                const el = dateScrollRef.current;
                if (!el || e.button !== 0) return;
                const startX = e.pageX;
                const startScroll = el.scrollLeft;
                let dragged = false;
                const onMove = (ev: MouseEvent) => {
                  const dx = ev.pageX - startX;
                  if (Math.abs(dx) > 3) dragged = true;
                  el.scrollLeft = startScroll - dx;
                };
                const onUp = () => {
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                  if (dragged) {
                    // Prevent the next click from firing on pills
                    const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
                    el.addEventListener("click", stop, { capture: true, once: true });
                  }
                };
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
            >
              {dateObjects.map((d, i) => {
                const isActive = i === activeDateIdx;
                const isToday = i === todayIdx;
                const dayMatches = matchesByDate[d.key] || [];
                const hasLive = dayMatches.some((m) => m.status === "live");
                return (
                  <button
                    key={d.key}
                    onClick={() => scrollToDate(i)}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg transition-all relative select-none ${
                      isActive
                        ? "bg-rz-red text-white shadow-md"
                        : isToday
                        ? "bg-rz-red/10 text-rz-red"
                        : "text-rz-text-muted hover:bg-rz-surface-2"
                    }`}
                  >
                    <span className="text-[10px] font-medium leading-tight">{d.day}</span>
                    <span className="text-xs font-bold leading-tight">{d.date}</span>
                    <span
                      className={`text-[8px] leading-tight ${
                        isActive ? "text-white/70" : "text-rz-text-muted"
                      }`}
                    >
                      {dayMatches.length}
                    </span>
                    {hasLive && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader size="lg" />
        </div>
      ) : visibleCount === 0 ? (
        <div className="text-center py-16 text-rz-text-muted">
          <p className="text-lg font-medium mb-1">
            {showFavoritesOnly
              ? "No favorite matches yet"
              : hideFinished
              ? "All matches have ended"
              : searchQuery
              ? "No matches found"
              : "No matches scheduled yet"}
          </p>
          <p className="text-sm">
            {showFavoritesOnly
              ? "Tap the star on any match to add it to your favorites."
              : hideFinished
              ? "Turn off the filter to see finished matches."
              : searchQuery
              ? "Try a different search term."
              : "Check back when the tournament draw is complete."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-0">
          {dateKeys.map((dateKey, dateIdx) => {
            const dayMatches = matchesByDate[dateKey];
            const d = dateObjects[dateIdx];
            if (!d) return null;
            const stages = Array.from(new Set(dayMatches.map((m) => m.stage_name)));
            return (
              <div
                key={dateKey}
                ref={(el) => {
                  sectionRefs.current[dateKey] = el;
                }}
                data-date-key={dateKey}
                className="scroll-mt-[130px]"
              >
                {/* ── Sticky Date Header ── */}
                <div className="sticky top-[72px] z-20 bg-rz-bg/90 backdrop-blur-sm py-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-px flex-1 bg-gradient-to-r ${getStageColor(
                        stages[0]
                      )} opacity-40`}
                    />
                    <span className="text-xs font-bold text-rz-text-secondary tracking-wide whitespace-nowrap">
                      {d.full}
                    </span>
                    <span className="text-[10px] text-rz-text-muted">
                      {dayMatches.length} match{dayMatches.length !== 1 ? "es" : ""}
                    </span>
                    <div
                      className={`h-px flex-1 bg-gradient-to-r ${getStageColor(
                        stages[0]
                      )} opacity-40`}
                    />
                  </div>
                </div>

                {/* ── Match Cards ── */}
                <div className="space-y-2 pb-4">
                  {dayMatches.map((m) => {
                    const pred = predictions[m.id];
                    const isLive = m.status === "live";
                    const isFinished =
                      m.status === "finished" || m.status === "confirmed";
                    const isFav = !!favorites[m.id];
                    return (
                      <div
                        key={m.id}
                        onClick={(e) => handleMatchClick(e, m.id)}
                        className={`bg-rz-surface rounded-xl border border-rz-border px-4 py-3 cursor-pointer hover:bg-rz-surface-2/50 transition ${
                          isLive ? "ring-1 ring-red-500/30 bg-red-900/5" : ""
                        } ${isFav ? "ring-1 ring-yellow-300/50" : ""}`}
                      >
                        {/* Stage + time + star */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStageAccent(
                              m.stage_name
                            )} bg-rz-surface`}
                          >
                            {m.stage_name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => toggleFavorite(e, m.id)}
                              className="hover:scale-125 transition-transform"
                              title="Toggle favorite"
                            >
                              <StarIcon
                                className={`w-4 h-4 ${
                                  isFav ? "text-yellow-400" : "text-rz-text-muted"
                                }`}
                                filled={isFav}
                              />
                            </button>
                            <button
                              onClick={(e) => handleDownloadCalendar(e, m)}
                              className="text-rz-text-muted hover:text-rz-text transition opacity-50 hover:opacity-100"
                              title="Add to calendar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                            <button
                              onClick={(e) => handleEmailCalendar(e, m)}
                              disabled={calSending === m.id}
                              className="text-rz-text-muted hover:text-rz-text transition opacity-50 hover:opacity-100 disabled:opacity-30"
                              title="Email calendar event"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </button>
                            {isLive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                            <span
                              className={`text-[10px] font-medium ${
                                isLive ? "text-red-500" : "text-rz-text-muted"
                              }`}
                            >
                              {formatTime(m.kick_off)}
                            </span>
                          </div>
                        </div>

                        {/* Teams Row */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-xl">{codeToFlag(m.home_team_code)}</span>
                            <div>
                              <p
                                className={`font-semibold text-sm ${
                                  isFinished &&
                                  m.home_score != null &&
                                  m.away_score != null &&
                                  m.home_score > m.away_score
                                    ? "text-rz-success"
                                    : ""
                                }`}
                              >
                                {m.home_team}
                              </p>
                              <p className="text-[9px] text-rz-text-muted uppercase tracking-wider">
                                {m.home_team_code || ""}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-center min-w-[56px]">
                            {isFinished || isLive ? (
                              <div
                                className={`font-mono font-black text-lg ${
                                  isLive ? "text-red-500" : ""
                                }`}
                              >
                                {m.home_score ?? 0}{" "}
                                <span className="text-rz-text-muted text-sm">-</span>{" "}
                                {m.away_score ?? 0}
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-rz-text-muted">
                                VS
                              </div>
                            )}
                          </div>

                          <div className="flex-1 flex items-center gap-2 justify-end text-right">
                            <div>
                              <p
                                className={`font-semibold text-sm ${
                                  isFinished &&
                                  m.home_score != null &&
                                  m.away_score != null &&
                                  m.away_score > m.home_score
                                    ? "text-rz-success"
                                    : ""
                                }`}
                              >
                                {m.away_team}
                              </p>
                              <p className="text-[9px] text-rz-text-muted uppercase tracking-wider">
                                {m.away_team_code || ""}
                              </p>
                            </div>
                            <span className="text-xl">{codeToFlag(m.away_team_code)}</span>
                          </div>
                        </div>

                        {/* Community odds bar */}
                        {oddsEnabled && odds[m.id] && (() => {
                          const o = odds[m.id];
                          if (!o.available) {
                            return (
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full bg-rz-surface-2 overflow-hidden">
                                  <div
                                    className="h-full bg-rz-text-muted/40"
                                    style={{ width: `${Math.min(100, (o.total_predictions / oddsThreshold) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-rz-text-muted">
                                  {o.total_predictions}/{oddsThreshold} preds
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-1.5">
                              <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-rz-surface-2">
                                <div className="bg-rz-red" style={{ width: `${o.home_win_pct}%` }} />
                                <div className="bg-rz-text-muted/60" style={{ width: `${o.draw_pct}%` }} />
                                <div className="bg-blue-500" style={{ width: `${o.away_win_pct}%` }} />
                              </div>
                              <div className="flex items-center justify-between mt-0.5 text-[9px] font-medium">
                                <span className="text-rz-red">{o.home_win_pct}%</span>
                                <span className="text-rz-text-muted">
                                  {o.draw_pct}% draw · {o.total_predictions} pred{o.total_predictions === 1 ? "" : "s"}
                                </span>
                                <span className="text-blue-400">{o.away_win_pct}%</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Prediction widget */}
                        <InlinePrediction
                          match={m}
                          prediction={pred}
                          onSaved={handlePredictionSaved}
                          onCleared={handlePredictionCleared}
                        />

                        {/* Venue + Prediction countdown */}
                        <div className="flex items-center justify-between mt-1.5">
                          {m.venue ? (
                            <p className="text-[9px] text-rz-text-muted">{m.venue}</p>
                          ) : (
                            <span />
                          )}
                          <PredictionCountdown lockAt={m.lock_at} status={m.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scroll to top ── */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-20 right-4 z-40 w-10 h-10 rounded-full bg-rz-surface border border-rz-border shadow-lg flex items-center justify-center text-rz-text-secondary hover:text-rz-text hover:border-rz-border-strong active:scale-95 transition-all"
          aria-label="Scroll to top"
        >
          <ChevronUpIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { Loader } from "@/lib/loader";

/* ── constants ─────────────────────────────────────────────── */

const KICKOFF_DATE = new Date("2026-06-11T19:00:00Z");
const FIFA_POSTER_URL =
  "https://us-mia-1.linodeobjects.com/qrengagement/assets/fifa_wc2026_poster.jpg";

/* ── types ─────────────────────────────────────────────────── */

interface TournamentInfo {
  id: string;
  name: string;
  season: string;
  status: string;
  match_count: number;
}

interface FeedItem {
  id: string;
  body: string;
  display_name: string;
  avatar_url: string | null;
  user_id: string | null;
  created_at: string;
  reactions: Record<string, number>;
  reply_count: number;
  activity_type: string | null;
  activity_title: string | null;
}

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: string;
  participation_cost: number;
  reward_points: number;
  close_at: string;
  match: { id: string; home_team: string; away_team: string } | null;
  answered: boolean;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  exact_count: number;
  outcome_count: number;
}

interface Duel {
  id: string;
  match_summary: string;
  other_name: string;
  other_avatar: string | null;
  status: string;
  stake_points: number;
  result: string | null;
  is_challenger: boolean;
  created_at: string;
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  summary: string;
  image_url: string | null;
}

interface LiveScore {
  league: string;
  home: string;
  away: string;
  home_score: string;
  away_score: string;
  state: string; // "pre" | "in" | "post"
  detail: string;
  clock: string;
}

interface MyPrediction {
  id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
  result_type: string | null;
}

/* ── helpers ───────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function totalReactions(reactions: Record<string, number>): number {
  return Object.values(reactions).reduce((a, b) => a + b, 0);
}

function closesIn(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Closed";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}

function duelStatusLabel(d: Duel): { text: string; cls: string } {
  if (d.status === "completed") {
    if (d.result === "won") return { text: "Won", cls: "bg-emerald-500/15 text-emerald-400" };
    if (d.result === "lost") return { text: "Lost", cls: "bg-red-500/15 text-red-400" };
    return { text: "Draw", cls: "bg-rz-surface-2 text-rz-text-muted" };
  }
  if (d.status === "pending") return { text: "Pending", cls: "bg-amber-500/15 text-amber-400" };
  if (d.status === "active") return { text: "Active", cls: "bg-blue-500/15 text-blue-400" };
  return { text: d.status, cls: "bg-rz-surface-2 text-rz-text-muted" };
}

/* ── main component ────────────────────────────────────────── */

export default function TournamentsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [predictions, setPredictions] = useState<MyPrediction[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [heroReady, setHeroReady] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0, started: false });
  const [prBest, setPrBest] = useState<{ best_score: number; best_streak: number } | null>(null);
  const [prTop, setPrTop] = useState<{ display_name: string; best_score: number } | null>(null);

  /* ── fast data (hero + table) ── */
  useEffect(() => {
    Promise.all([
      apiFetch<{ data: TournamentInfo[] }>("/tournaments").then((r) => setTournaments(r.data)).catch(() => {}),
      apiFetch<{ data: MyPrediction[] }>("/me/predictions").then((r) => setPredictions(r.data)).catch(() => {}),
      apiFetch<{ data: LeaderboardEntry[] }>("/leaderboards/global?limit=5").then((r) => setLeaderboard(r.data)).catch(() => {}),
    ]).finally(() => setHeroReady(true));
  }, []);

  /* ── secondary data (fire-and-forget, sections appear as they arrive) ── */
  useEffect(() => {
    apiFetch<{ data: (FeedItem & { media_url?: string | null })[] }>("/feed?limit=8").then((r) => setFeed((r.data || []).filter((f) => f.body && f.body.trim().length > 0 && !f.media_url).slice(0, 4))).catch(() => {});
    apiFetch<{ data: Challenge[] }>("/challenges/active").then((r) => setChallenges(r.data?.slice(0, 3) || [])).catch(() => {});
    apiFetch<{ data: Duel[] }>("/me/duels").then((r) => setDuels(r.data?.slice(0, 3) || [])).catch(() => {});
    apiFetch<{ data: NewsItem[] }>("/news").then((r) => setNews(r.data?.slice(0, 8) || [])).catch(() => {});
    apiFetch<{ data: LiveScore[] }>("/scores").then((r) => setScores(r.data || [])).catch(() => {});
    apiFetch<{ best_score: number; best_streak: number }>("/me/penalty-rush/best").then((r) => setPrBest(r)).catch(() => {});
    apiFetch<{ entries: { display_name: string; best_score: number }[] }>("/penalty-rush/leaderboard?limit=1").then((r) => { if (r.entries?.[0]) setPrTop(r.entries[0]); }).catch(() => {});
  }, []);

  useEffect(() => {
    function tick() {
      const diff = KICKOFF_DATE.getTime() - Date.now();
      if (diff <= 0) { setCountdown({ days: 0, hours: 0, mins: 0, secs: 0, started: true }); return; }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
        started: false,
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const totalPoints = useMemo(() => predictions.reduce((s, p) => s + (p.points || 0), 0), [predictions]);
  const exactCount = useMemo(() => predictions.filter((p) => p.result_type === "exact").length, [predictions]);
  const tournamentId = tournaments[0]?.id;

  if (!heroReady) {
    return (
      <div className="flex justify-center py-24">
        <Loader />
      </div>
    );
  }

  return (
    <div className="pb-12 -mt-4 sm:-mt-6">

      {/* ═══════════════════════════════════════════════════════
          HERO — World Cup Poster Card (preserved & refined)
         ═══════════════════════════════════════════════════════ */}
      <section className="relative -mx-4 sm:-mx-6 mb-12 overflow-hidden rounded-b-3xl">
        {/* Poster artwork — visible, not just a faint bg */}
        <div className="flex flex-col sm:flex-row">
          {/* Poster image side */}
          <div className="relative sm:w-[45%] flex-shrink-0">
            <img
              src={FIFA_POSTER_URL}
              alt="FIFA World Cup 2026"
              className="w-full h-64 sm:h-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0B0F14] hidden sm:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/40 to-transparent sm:hidden" />
          </div>

          {/* Content side */}
          <div className="relative flex-1 bg-[#0B0F14] px-5 sm:px-8 py-6 sm:py-8 flex flex-col justify-center -mt-16 sm:mt-0">
            <p className="text-[11px] text-white/40 tracking-widest uppercase font-semibold mb-1">
              FIFA World Cup 2026
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mb-5 leading-tight">
              {user?.display_name ? `Welcome, ${user.display_name}` : "Welcome to REDZONE"}
            </h1>

            {/* Countdown */}
            {!countdown.started ? (
              <div className="mb-5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">
                  Kickoff in
                </p>
                <div className="flex items-baseline gap-0.5">
                  {([
                    { val: countdown.days, label: "d" },
                    { val: countdown.hours, label: "h" },
                    { val: countdown.mins, label: "m" },
                    { val: countdown.secs, label: "s" },
                  ] as const).map((u, i) => (
                    <span key={u.label} className="flex items-baseline">
                      {i > 0 && <span className="text-white/15 text-base mx-0.5">:</span>}
                      <span className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
                        {String(u.val).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] text-white/25 font-semibold ml-0.5">{u.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <span className="inline-block bg-rz-red text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider animate-pulse">
                  Live Now
                </span>
              </div>
            )}

            {/* Inline stats */}
            <div className="flex items-center gap-5 mb-5">
              {[
                { val: predictions.length, label: "Predictions" },
                { val: totalPoints, label: "Points" },
                { val: exactCount, label: "Exact" },
              ].map((s) => (
                <div key={s.label}>
                  <span className="text-lg sm:text-xl font-black text-white tabular-nums">{s.val}</span>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            {tournamentId && (
              <div>
                <Link
                  href={`/tournaments/${tournamentId}`}
                  className="inline-flex items-center gap-2 bg-rz-red hover:bg-red-600 active:scale-[0.97] text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-red-900/40"
                >
                  Enter Matches
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          LIVE SCORES TICKER — endless scrolling marquee
         ═══════════════════════════════════════════════════════ */}
      {scores.length > 0 && (
        <div className="mb-10 -mx-4 sm:-mx-6 overflow-hidden relative bg-rz-surface/50 border-y border-rz-border/50">
          {/* fade edges */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-8 z-10 bg-gradient-to-r from-rz-bg to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-8 z-10 bg-gradient-to-l from-rz-bg to-transparent" />
          <div className="flex animate-ticker whitespace-nowrap py-2.5">
            {[...scores, ...scores, ...scores].map((g, i) => {
              const isLive = g.state === "in";
              const isDone = g.state === "post";
              return (
                <span key={i} className="inline-flex items-center gap-1.5 mx-4 text-xs shrink-0">
                  <span className="text-[10px] text-rz-text-muted font-medium uppercase">{g.league}</span>
                  <span className="text-rz-text-secondary font-medium">{g.home}</span>
                  <span className={`font-bold tabular-nums px-1 ${isLive ? "text-rz-red" : isDone ? "text-rz-text-secondary" : "text-rz-text-muted"}`}>
                    {g.state === "pre" ? "vs" : `${g.home_score}-${g.away_score}`}
                  </span>
                  <span className="text-rz-text-secondary font-medium">{g.away}</span>
                  {isLive && <span className="ml-1 text-[9px] text-rz-red font-bold animate-pulse">LIVE</span>}
                  {isDone && <span className="ml-1 text-[9px] text-rz-text-muted">FT</span>}
                  {g.state === "pre" && <span className="ml-1 text-[9px] text-rz-text-muted">{g.detail}</span>}
                  <span className="text-rz-border ml-2">│</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          LIVE ACTIVITY — compact preview strip
         ═══════════════════════════════════════════════════════ */}
      {feed.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">Live Activity</h2>
            <Link href="/feed" className="text-xs font-bold text-rz-red hover:text-red-500 transition">
              Go to Arena
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {feed.map((item) => (
              <Link
                key={item.id}
                href="/feed"
                className="group flex items-start gap-3 rounded-2xl bg-rz-surface p-4 hover:bg-rz-surface-2 hover:translate-y-[-1px] transition-all duration-150"
              >
                <Avatar src={item.avatar_url} name={item.display_name || "?"} size="base" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold truncate">{item.display_name}</span>
                    <span className="text-[10px] text-rz-text-muted flex-shrink-0">{timeAgo(item.created_at)}</span>
                  </div>
                  <p className="text-xs text-rz-text-secondary mt-0.5 line-clamp-2 leading-relaxed">
                    {item.activity_title || item.body}
                  </p>
                  {item.reply_count > 0 && (
                    <p className="mt-1.5 text-[10px] text-rz-text-muted">{item.reply_count} replies</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          FLASH CHALLENGES — motivating action cards
         ═══════════════════════════════════════════════════════ */}
      {challenges.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">Flash Challenges</h2>
            <Link href="/challenges" className="text-xs font-bold text-rz-red hover:text-red-500 transition">
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {challenges.map((c) => (
              <Link
                key={c.id}
                href="/challenges"
                className="group relative rounded-2xl bg-rz-surface p-5 overflow-hidden hover:translate-y-[-2px] hover:shadow-lg hover:shadow-black/20 transition-all duration-200"
              >
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-rz-red via-rz-red/50 to-transparent" />

                <h3 className="text-[15px] font-bold leading-snug mb-1">{c.title}</h3>
                {c.match && (
                  <p className="text-[11px] text-rz-text-muted mb-4">
                    {c.match.home_team} vs {c.match.away_team}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-rz-text-muted">
                      Cost <span className="text-rz-text font-bold">{c.participation_cost}</span>
                    </span>
                    <span className="text-rz-text-muted">
                      Reward <span className="text-rz-red font-black">+{c.reward_points}</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-rz-text-muted">{closesIn(c.close_at)}</span>
                </div>

                {!c.answered && (
                  <div className="mt-3 pt-3 border-t border-rz-border/50">
                    <span className="text-xs font-bold text-rz-red group-hover:text-red-400 transition">
                      Join Challenge
                    </span>
                  </div>
                )}
                {c.answered && (
                  <div className="mt-3 pt-3 border-t border-rz-border/50">
                    <span className="text-xs text-rz-text-muted">Answered</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          GAMES
         ═══════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Games</h2>
        </div>
        <Link
          href="/games/penalty-rush"
          className="block relative overflow-hidden rounded-xl border border-gray-200 dark:border-[#FFD700]/20 bg-white dark:bg-transparent shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(225,29,46,0.2)] hover:border-gray-300 dark:hover:border-[#FFD700]/50 hover:translate-y-[-1px] transition-all duration-300 group"
        >
          {/* Dark-mode gradient background */}
          <div className="absolute inset-0 hidden dark:block" style={{ background: "linear-gradient(135deg, #0d1117 0%, #1a0a0e 40%, #0d1117 100%)" }} />
          {/* Light-mode subtle gradient */}
          <div className="absolute inset-0 dark:hidden" style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafafa 50%, #f5f5f5 100%)" }} />
          {/* Scanlines (dark only) */}
          <div className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-[0.03]" style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)",
          }} />
          {/* Ambient glow (dark only) */}
          <div className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-30 dark:group-hover:opacity-60 transition-opacity duration-500" style={{
            background: "radial-gradient(ellipse 50% 80% at 30% 50%, rgba(225,29,46,0.12) 0%, transparent 70%)",
          }} />

          <div className="relative flex items-center gap-4 px-4 py-3">
            {/* ── Pixel-art scene (goal + GK + ball) — stays dark in both modes ── */}
            <div className="flex-shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden relative shadow-[inset_0_0_8px_rgba(0,0,0,0.5)]" style={{
              background: "linear-gradient(180deg, #0a1628 0%, #1a3a2a 35%, #2d5a1e 65%, #1e4a14 100%)",
              imageRendering: "pixelated",
            }}>
              {/* Goal frame */}
              <div className="absolute" style={{ top: 4, left: "50%", transform: "translateX(-50%)", width: 44, height: 22 }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#fff", borderRadius: 1 }} />
                <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: "100%", background: "#fff", borderRadius: 1 }} />
                <div style={{ position: "absolute", top: 0, right: 0, width: 2, height: "100%", background: "#fff", borderRadius: 1 }} />
                <div className="absolute inset-0 opacity-10" style={{ top: 2, left: 2, right: 2, backgroundImage: "repeating-linear-gradient(90deg, #fff 0px, transparent 1px, transparent 4px), repeating-linear-gradient(0deg, #fff 0px, transparent 1px, transparent 4px)" }} />
              </div>
              {/* GK — pixel art matching game colors */}
              <div className="absolute transition-transform duration-500 group-hover:translate-x-1" style={{ top: 10, left: "50%", transform: "translateX(-50%)", width: 14, height: 22 }}>
                <div style={{ position: "absolute", top: 0, left: 2, width: 10, height: 5, background: "#2a1a0a", borderRadius: "3px 3px 0 0" }} />
                <div style={{ position: "absolute", top: 3, left: 3, width: 8, height: 6, background: "#F5D0B0", borderRadius: "2px" }} />
                <div style={{ position: "absolute", top: 4, left: 4, width: 2, height: 2, background: "#111", borderRadius: "50%" }} />
                <div style={{ position: "absolute", top: 4, right: 4, width: 2, height: 2, background: "#111", borderRadius: "50%" }} />
                <div style={{ position: "absolute", top: 7, left: 4, width: 6, height: 1, background: "#3d2200" }} />
                <div style={{ position: "absolute", top: 9, left: 2, width: 10, height: 6, background: "#E11D2E", borderRadius: "1px" }} />
                <div style={{ position: "absolute", top: 11, left: -2, width: 4, height: 3, background: "#22C55E", borderRadius: "1px" }} />
                <div style={{ position: "absolute", top: 11, right: -2, width: 4, height: 3, background: "#22C55E", borderRadius: "1px" }} />
                <div style={{ position: "absolute", top: 15, left: 3, width: 8, height: 3, background: "#1a1a2e" }} />
                <div style={{ position: "absolute", top: 18, left: 4, width: 2, height: 4, background: "#F5D0B0" }} />
                <div style={{ position: "absolute", top: 18, right: 4, width: 2, height: 4, background: "#F5D0B0" }} />
                <div style={{ position: "absolute", bottom: 0, left: 3, width: 3, height: 2, background: "#111" }} />
                <div style={{ position: "absolute", bottom: 0, right: 3, width: 3, height: 2, background: "#111" }} />
              </div>
              {/* Ball */}
              <div className="absolute animate-[prBallBounce_2s_ease-in-out_infinite]" style={{ bottom: 6, left: "50%", marginLeft: -5 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #fff, #ddd)", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/10" />
            </div>

            {/* ── Text + stats ── */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-base font-black font-mono tracking-wide text-gray-900 dark:text-white" style={{
                  textShadow: "var(--pr-title-shadow, none)",
                }}>
                  PENALTY<span className="text-[#E11D2E]"> RUSH</span>
                </h3>
                <span className="text-[7px] font-bold font-mono uppercase px-1.5 py-px tracking-[0.12em] text-amber-600 dark:text-[#FFD700] border border-amber-300/40 dark:border-[rgba(255,215,0,0.2)] bg-amber-50 dark:bg-[rgba(255,215,0,0.04)]">ARCADE</span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-white/35 mb-2">
                Beat the keeper. Build your streak.
              </p>
              {/* Inline stats */}
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="text-gray-400 dark:text-white/25">BEST <span className="text-gray-600 dark:text-white/60 font-bold">{prBest ? prBest.best_score.toLocaleString() : "—"}</span></span>
                <span className="text-gray-200 dark:text-white/10">|</span>
                <span className="text-gray-400 dark:text-white/25">STREAK <span className="text-amber-600 dark:text-[#FFD700]/60 font-bold">{prBest ? `x${prBest.best_streak}` : "—"}</span></span>
                <span className="text-gray-200 dark:text-white/10">|</span>
                <span className="text-gray-400 dark:text-white/25">#1 <span className="text-[#E11D2E] dark:text-[#E11D2E]/60 font-bold">{prTop ? prTop.best_score.toLocaleString() : "—"}</span></span>
              </div>
            </div>

            {/* ── CTA ── */}
            <div className="flex-shrink-0">
              <div
                className="px-4 py-2 bg-[#E11D2E] text-white font-bold text-xs font-mono tracking-wider rounded group-hover:bg-[#ff2438] transition-colors shadow-[0_2px_8px_rgba(225,29,46,0.25)] dark:animate-[prCtaPulse_2.5s_ease-in-out_infinite]"
                style={{
                  boxShadow: "inset -1px -2px 0 #6B0F18, inset 1px 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(225,29,46,0.25)",
                  textShadow: "1px 1px 0 rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                ▶ PLAY
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DUELS + LEADERBOARD — two-column editorial layout
         ═══════════════════════════════════════════════════════ */}
      <div className="grid gap-8 lg:grid-cols-5 mb-12">

        {/* ── Duels (3 cols) ────────────────────────────── */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">Duels</h2>
            <Link href="/duels" className="text-xs font-bold text-rz-red hover:text-red-500 transition">
              View all
            </Link>
          </div>
          {duels.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {duels.map((d) => {
                const st = duelStatusLabel(d);
                return (
                  <Link
                    key={d.id}
                    href="/duels"
                    className="group rounded-2xl bg-rz-surface p-4 hover:translate-y-[-1px] hover:bg-rz-surface-2 transition-all duration-150"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar src={d.other_avatar} name={d.other_name} size="base" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-bold truncate block">vs {d.other_name}</span>
                        <span className="text-[11px] text-rz-text-muted truncate block">{d.match_summary}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-rz-text-muted tabular-nums">
                        {d.stake_points} pts at stake
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>
                        {st.text}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Link
              href="/duels"
              className="block rounded-2xl bg-rz-surface p-6 text-center hover:bg-rz-surface-2 transition group"
            >
              <p className="text-sm text-rz-text-muted mb-1">No active duels</p>
              <span className="text-xs font-bold text-rz-red group-hover:text-red-400 transition">
                Challenge someone
              </span>
            </Link>
          )}
        </section>

        {/* ── Table (2 cols) ──────────────────────── */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">Table</h2>
            <Link href="/leaderboard" className="text-xs font-bold text-rz-red hover:text-red-500 transition">
              Full Table
            </Link>
          </div>
          {leaderboard.length > 0 ? (
            <div className="rounded-xl bg-rz-surface border border-rz-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rz-border">
                    <th className="py-2 pl-4 pr-2 text-[10px] font-bold uppercase tracking-widest text-rz-text-muted text-center w-10">#</th>
                    <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-rz-text-muted text-left">Player</th>
                    <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-rz-text-muted text-center w-10">E</th>
                    <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-rz-text-muted text-center w-10">O</th>
                    <th className="py-2 pl-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-rz-text-muted text-right w-14 bg-rz-red/[0.03]">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => {
                    const isMe = entry.user_id === user?.id;
                    return (
                      <tr
                        key={entry.user_id}
                        onClick={() => router.push(`/users/${entry.user_id}`)}
                        className={`group cursor-pointer transition-colors duration-100 border-b border-rz-border/50 last:border-b-0 ${
                          isMe
                            ? "bg-rz-red/[0.07] hover:bg-rz-red/[0.12]"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <td className="py-2 pl-4 pr-2 text-center">
                          <span className="text-[11px] text-rz-text-muted font-semibold tabular-nums">{entry.rank}</span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar src={entry.avatar_url} name={entry.display_name} size="sm" />
                            <span className={`text-[12px] font-semibold truncate ${
                              isMe ? "text-rz-red" : "text-rz-text group-hover:text-white"
                            } transition-colors`}>
                              {entry.display_name}
                              {isMe && <span className="ml-1 text-[8px] font-bold uppercase text-rz-red/70">you</span>}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center text-[11px] tabular-nums text-rz-text-secondary font-medium">
                          {entry.exact_count}
                        </td>
                        <td className="py-2 px-2 text-center text-[11px] tabular-nums text-rz-text-secondary font-medium">
                          {entry.outcome_count}
                        </td>
                        <td className="py-2 pl-2 pr-4 text-right bg-rz-red/[0.03]">
                          <span className="text-[13px] font-black tabular-nums text-rz-text">
                            {entry.points}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-rz-border/50 px-4 py-1.5 flex gap-x-3 text-[8px] text-rz-text-muted uppercase tracking-wider font-medium">
                <span>E = Exact</span>
                <span>O = Outcome</span>
                <span>Pts = Points</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-rz-surface border border-rz-border p-6 text-center">
              <p className="text-sm text-rz-text-muted">No standings yet</p>
            </div>
          )}
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════
          NEWS — editorial footer section
         ═══════════════════════════════════════════════════════ */}
      {news.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-rz-text-muted uppercase tracking-wider mb-4">Latest News</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {news.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-rz-surface p-4 hover:bg-rz-surface-2 transition-colors"
              >
                <p className="text-[10px] font-semibold text-rz-text-muted uppercase tracking-wide mb-1.5">
                  {item.source}
                </p>
                <h3 className="text-sm font-semibold leading-snug line-clamp-3">
                  {item.title}
                </h3>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

/* ──────────────────────────────────────────────────────────
   Penalty Rush — Page (React wrapper)
   Canvas + DPR, input handling, start / game-over overlays
   ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGame,
  selectDirection,
  startCharging,
  releaseShot,
  update,
} from "./engine";
import { render } from "./renderer";
import { initAudio, toggleMute, isMuted } from "./audio";
import { emit } from "./analytics";
import { CFG } from "./config";
import type { GameState, Lane } from "./types";

/* ─── API helpers ──────────────────────────────────────── */

async function fetchBest(): Promise<number> {
  try {
    const r = await fetch("/api/me/penalty-rush/best", {
      credentials: "include",
    });
    if (!r.ok) return 0;
    const d = await r.json();
    return d.best_score ?? 0;
  } catch { return 0; }
}

async function submitScore(state: GameState): Promise<void> {
  try {
    const acc = state.attempts > 0
      ? Math.round((state.goals / state.attempts) * 100)
      : 0;
    await fetch("/api/me/penalty-rush/score", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: state.score,
        goals_scored: state.goals,
        goals_attempted: state.attempts,
        accuracy_pct: acc,
        best_streak: state.bestStreak,
        level_reached: state.level,
        duration_secs: Math.round((Date.now() - state.startTime) / 1000),
      }),
    });
  } catch { /* silent */ }
}

interface LBEntry {
  rank: number;
  display_name: string;
  avatar_url: string | null;
  best_score: number;
  best_streak: number;
  user_id: string;
}

async function fetchLeaderboard(): Promise<{ entries: LBEntry[]; my_rank: number | null }> {
  try {
    const r = await fetch("/api/penalty-rush/leaderboard?limit=10", {
      credentials: "include",
    });
    if (!r.ok) return { entries: [], my_rank: null };
    return await r.json();
  } catch { return { entries: [], my_rank: null }; }
}

async function shareToArena(score: number, level: number, streak: number): Promise<boolean> {
  try {
    const body = `⚽ Penalty Rush: ${score.toLocaleString()} pts — Level ${level}, best streak x${streak}! Can you beat me? 🏆`;
    const r = await fetch("/api/feed", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    return r.ok;
  } catch { return false; }
}

/* ─── Component ────────────────────────────────────────── */

type Screen = "start" | "playing" | "gameover";

export default function PenaltyRushPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createGame());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const dprRef = useRef<number>(1);
  const holdingRef = useRef(false);
  const scoreSubmittedRef = useRef(false);

  const [screen, setScreen] = useState<Screen>("start");
  const [bestScore, setBestScore] = useState(0);
  const [muted, setMuted] = useState(false);
  const [finalState, setFinalState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LBEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);

  /* ── Best score on mount ─────────────────────────────── */
  useEffect(() => {
    fetchBest().then(setBestScore);
  }, []);

  /* ── Canvas size ─────────────────────────────────────── */
  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const par = c.parentElement!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    dprRef.current = dpr;
    c.width = par.clientWidth * dpr;
    c.height = par.clientHeight * dpr;
    c.style.width = `${par.clientWidth}px`;
    c.style.height = `${par.clientHeight}px`;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  /* ── Game loop ───────────────────────────────────────── */
  const loop = useCallback((time: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const st = stateRef.current;

    const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = time;

    update(st, dt);

    // Transition to game-over screen
    if (st.phase === "gameover" && screen === "playing") {
      setFinalState({ ...st });
      setScreen("gameover");
      setShared(false);
      if (!scoreSubmittedRef.current) {
        scoreSubmittedRef.current = true;
        submitScore(st).then(() => {
          fetchBest().then(setBestScore);
          fetchLeaderboard().then((lb) => {
            setLeaderboard(lb.entries);
            setMyRank(lb.my_rank);
          });
        });
      }
    }

    const dpr = dprRef.current;
    const W = c.width / dpr;
    const H = c.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    render(ctx, st, W, H);
    ctx.restore();

    rafRef.current = requestAnimationFrame(loop);
  }, [screen]);

  /* ── Start / restart ─────────────────────────────────── */
  const startGame = useCallback(() => {
    initAudio();
    stateRef.current = createGame();
    scoreSubmittedRef.current = false;
    lastTimeRef.current = 0;
    setScreen("playing");
    emit("game_started", {});
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const restart = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    startGame();
  }, [startGame]);

  /* ── Cleanup ─────────────────────────────────────────── */
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ── Start loop when entering "playing" screen ───────── */
  useEffect(() => {
    if (screen === "playing") {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, loop]);

  /* ── Input: keyboard ─────────────────────────────────── */
  useEffect(() => {
    if (screen !== "playing") return;

    const down = (e: KeyboardEvent) => {
      const st = stateRef.current;
      const pickAndCharge = (lane: Lane) => {
        selectDirection(st, lane);
        if (!holdingRef.current) {
          holdingRef.current = true;
          startCharging(st);
        }
      };
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          pickAndCharge("left");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          pickAndCharge("center");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          pickAndCharge("right");
          break;
        case " ":
          e.preventDefault();
          if (holdingRef.current) {
            holdingRef.current = false;
            releaseShot(st);
          }
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowRight" ||
          e.key === "a" || e.key === "A" || e.key === "s" || e.key === "S" ||
          e.key === "d" || e.key === "D" || e.key === " ") {
        if (holdingRef.current) {
          holdingRef.current = false;
          releaseShot(stateRef.current);
        }
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [screen]);

  /* ── Input: touch / pointer ──────────────────────────── */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (screen !== "playing") return;
      const c = canvasRef.current;
      if (!c) return;
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const W = r.width;
      const H = r.height;
      const st = stateRef.current;

      // Ignore taps inside the HUD bar
      const hudBottom = H * CFG.layout.hudHeight;
      if (y < hudBottom) return;

      // Tap anywhere below HUD → pick direction from X + start charge
      if (st.phase === "ready" || st.phase === "aiming") {
        const lane: Lane = x < W / 3 ? "left" : x < (W * 2) / 3 ? "center" : "right";
        selectDirection(st, lane);
        holdingRef.current = true;
        startCharging(st);
      }
    },
    [screen],
  );

  const handlePointerUp = useCallback(() => {
    if (holdingRef.current) {
      holdingRef.current = false;
      releaseShot(stateRef.current);
    }
  }, []);

  /* ── Mute toggle ─────────────────────────────────────── */
  const handleMute = useCallback(() => {
    initAudio();
    const m = toggleMute();
    setMuted(m);
  }, []);

  /* ── Share to arena ──────────────────────────────────── */
  const handleShare = useCallback(async () => {
    if (!finalState || sharing || shared) return;
    setSharing(true);
    const ok = await shareToArena(finalState.score, finalState.level, finalState.bestStreak);
    setSharing(false);
    if (ok) setShared(true);
  }, [finalState, sharing, shared]);

  /* ── Render ──────────────────────────────────────────── */
  const accuracy =
    finalState && finalState.attempts > 0
      ? Math.round((finalState.goals / finalState.attempts) * 100)
      : 0;

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#0B0F14] select-none touch-none">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Top bar buttons — inside MK HUD bar */}
      <button
        onClick={() => router.back()}
        className="absolute z-20 w-10 h-10 flex items-center justify-center text-white/60 text-base font-mono rounded-none"
        style={{
          top: "calc(10.5dvh / 2 - 20px)",
          left: "6px",
          background: "transparent",
          border: "none",
        }}
        aria-label="Back"
      >
        ✕
      </button>
      <button
        onClick={handleMute}
        className="absolute z-20 w-10 h-10 flex items-center justify-center text-white/60 text-lg font-mono rounded-none"
        style={{
          top: "calc(10.5dvh / 2 - 20px)",
          right: "6px",
          background: "transparent",
          border: "none",
        }}
        aria-label="Toggle sound"
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* START SCREEN */}
      {screen === "start" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 px-6">
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)",
          }} />
          <div className="mb-1 text-[10px] font-mono tracking-[0.3em] text-[#FFD700]/70 uppercase" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8), 0 0 6px rgba(255,215,0,0.3)" }}>⚡ REDZONE ARCADE ⚡</div>
          <h1 className="text-4xl font-black text-white tracking-tight font-mono" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.3)" }}>
            PENALTY<span className="text-[#E11D2E]"> RUSH</span>
          </h1>
          <p className="text-white/70 text-xs font-mono mt-2 mb-1 tracking-wider" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>AIM · TIME · SCORE</p>
          {bestScore > 0 && (
            <p className="text-[#FFD700] text-xs font-mono mb-4" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>
              BEST: {bestScore.toLocaleString()}
            </p>
          )}
          <button
            onClick={startGame}
            className="mt-6 px-10 py-3 bg-[#E11D2E] text-white font-bold text-lg font-mono active:scale-95 transition-all relative"
            style={{
              boxShadow: "inset -2px -3px 0 #6B0F18, inset 2px 2px 0 rgba(255,255,255,0.2), 3px 3px 0 rgba(0,0,0,0.5)",
              textShadow: "1px 1px 0 rgba(0,0,0,0.5)",
              border: "2px solid #B8162A",
            }}
          >
            ▶ PLAY
          </button>

          {/* ── Visual tap-direction guide ── */}
          <div className="mt-6 w-full max-w-[260px]">
            <p className="text-center text-white/60 text-[9px] font-mono tracking-[0.2em] mb-2 uppercase" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>
              TAP POSITION = BALL DIRECTION
            </p>
            <div className="relative w-full h-[56px] flex" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Left zone */}
              <div className="flex-1 flex flex-col items-center justify-center border-r border-white/10 bg-white/[0.03]">
                <span className="text-white/70 text-lg leading-none">◀</span>
                <span className="text-white/50 text-[8px] font-mono mt-0.5">LEFT</span>
              </div>
              {/* Center zone */}
              <div className="flex-1 flex flex-col items-center justify-center border-r border-white/10 bg-white/[0.06]">
                <span className="text-white/80 text-lg leading-none">▼</span>
                <span className="text-white/55 text-[8px] font-mono mt-0.5">CENTER</span>
              </div>
              {/* Right zone */}
              <div className="flex-1 flex flex-col items-center justify-center bg-white/[0.03]">
                <span className="text-white/70 text-lg leading-none">▶</span>
                <span className="text-white/50 text-[8px] font-mono mt-0.5">RIGHT</span>
              </div>
              {/* Finger icon overlay — animated */}
              <div className="absolute bottom-0 animate-[tapSlide_3s_ease-in-out_infinite]" style={{ left: "16%", filter: "drop-shadow(0 0 4px rgba(255,255,255,0.3))" }}>
                <span className="text-white/60 text-xl">👆</span>
              </div>
            </div>
            <p className="text-center text-white/50 text-[9px] font-mono mt-2" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>
              HOLD → RELEASE TO SHOOT
            </p>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {screen === "gameover" && finalState && (
        <div className="absolute inset-0 z-30 flex flex-col items-center bg-black/90 px-4 overflow-y-auto">
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)",
          }} />

          <div className="relative z-10 flex flex-col items-center w-full max-w-[340px] pt-8">
            <p className="text-[#E11D2E] font-black text-xl tracking-widest mb-2 font-mono" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.8)" }}>
              GAME OVER
            </p>
            <p className="text-white text-4xl font-black mb-0.5 font-mono" style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.8)" }}>
              {finalState.score.toLocaleString()}
            </p>
            <p className="text-white/60 text-[10px] mb-3 font-mono tracking-wider" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>FINAL SCORE</p>

            <div className="grid grid-cols-3 gap-4 text-center mb-3 font-mono w-full">
              <div>
                <p className="text-white font-bold text-base" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>{finalState.goals}</p>
                <p className="text-white/55 text-[9px]">GOALS</p>
              </div>
              <div>
                <p className="text-white font-bold text-base" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>{accuracy}%</p>
                <p className="text-white/55 text-[9px]">ACC</p>
              </div>
              <div>
                <p className="text-[#FFD700] font-bold text-base" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>
                  {finalState.bestStreak}
                </p>
                <p className="text-white/55 text-[9px]">STREAK</p>
              </div>
            </div>

            {bestScore > 0 && (
              <p className="text-[#FFD700]/50 text-[10px] font-mono mb-3" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>
                BEST: {bestScore.toLocaleString()}
                {myRank && <span className="ml-2 text-white/30">RANK #{myRank}</span>}
              </p>
            )}

            {/* ── Scoreboard ───────────────────────────── */}
            {leaderboard.length > 0 && (
              <div className="w-full mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-[#FFD700] text-[10px] font-mono tracking-widest" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}>🏆 TOP SCORES</span>
                </div>
                <div className="rounded overflow-hidden" style={{ border: "1px solid rgba(255,215,0,0.15)", background: "rgba(0,0,0,0.5)" }}>
                  {leaderboard.map((e) => (
                    <div
                      key={e.user_id}
                      className="flex items-center gap-2 px-3 py-1.5 font-mono"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: myRank === e.rank ? "rgba(225,29,46,0.12)" : "transparent",
                      }}
                    >
                      <span className={`text-[11px] w-5 text-right font-bold ${
                        e.rank === 1 ? "text-[#FFD700]" : e.rank === 2 ? "text-[#C0C0C0]" : e.rank === 3 ? "text-[#CD7F32]" : "text-white/30"
                      }`}>
                        {e.rank}
                      </span>
                      {e.avatar_url ? (
                        <img src={e.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white/40">
                          {e.display_name.charAt(0)}
                        </div>
                      )}
                      <span className="text-white/80 text-[11px] flex-1 truncate">{e.display_name}</span>
                      <span className="text-white font-bold text-[11px]">{e.best_score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Action buttons ───────────────────────── */}
            <div className="flex gap-3 w-full mb-3">
              <button
                onClick={restart}
                className="flex-1 py-2.5 bg-[#E11D2E] text-white font-bold text-sm font-mono active:scale-95 transition-all"
                style={{
                  boxShadow: "inset -2px -3px 0 #6B0F18, inset 2px 2px 0 rgba(255,255,255,0.2), 3px 3px 0 rgba(0,0,0,0.5)",
                  textShadow: "1px 1px 0 rgba(0,0,0,0.5)",
                  border: "2px solid #B8162A",
                }}
              >
                ▶ RETRY
              </button>
              <button
                onClick={handleShare}
                disabled={sharing || shared}
                className="flex-1 py-2.5 text-white font-bold text-sm font-mono active:scale-95 transition-all disabled:opacity-50"
                style={{
                  background: shared ? "rgba(34,197,94,0.3)" : "rgba(255,215,0,0.15)",
                  boxShadow: "inset -1px -2px 0 rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.1), 2px 2px 0 rgba(0,0,0,0.4)",
                  textShadow: "1px 1px 0 rgba(0,0,0,0.5)",
                  border: shared ? "2px solid rgba(34,197,94,0.4)" : "2px solid rgba(255,215,0,0.25)",
                }}
              >
                {shared ? "✓ POSTED" : sharing ? "..." : "📢 ARENA"}
              </button>
            </div>

            <button
              onClick={() => router.back()}
              className="text-white/25 text-[10px] font-mono mb-6" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.8)" }}
            >
              ✕ EXIT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

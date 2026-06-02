"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { MobilePageHeader } from "../MobilePageHeader";
import { Avatar } from "@/lib/avatar";
import { Loader } from "@/lib/loader";

interface Duel {
  id: string;
  match_id: string;
  match_summary: string;
  match_kickoff: string | null;
  match_status: string;
  challenger_id: string;
  opponent_id: string;
  challenger_name: string;
  opponent_name: string;
  other_name: string;
  other_avatar: string | null;
  is_challenger: boolean;
  status: string;
  stake_points: number;
  pot: number;
  result: string | null;
  points_delta: number | null;
  my_score: number | null;
  their_score: number | null;
  winner_id: string | null;
  resolved_at: string | null;
  expires_at: string;
  created_at: string;
  message: string | null;
}

interface Opponent {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

const STAKE_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30, 50];

export default function DuelsPage() {
  const { user } = useAuth();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  // Create duel modal
  const [showCreate, setShowCreate] = useState(false);
  const [matchId, setMatchId] = useState("");
  const [opponentQuery, setOpponentQuery] = useState("");
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [stakePoints, setStakePoints] = useState(3);
  const [duelMessage, setDuelMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [matches, setMatches] = useState<{ id: string; label: string; kickoff: string }[]>([]);
  const [availablePoints, setAvailablePoints] = useState(0);

  const fetchDuels = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab) params.set("status", tab);
    const res = await apiFetch<{ data: Duel[] }>(`/me/duels?${params}`);
    setDuels(res.data);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchDuels().catch(() => {}).finally(() => setLoading(false));
  }, [fetchDuels]);

  // Fetch balance when create modal opens
  useEffect(() => {
    if (!showCreate) return;
    apiFetch<{ available_points: number }>("/me/duel-balance")
      .then((res) => setAvailablePoints(res.available_points))
      .catch(() => setAvailablePoints(0));
    apiFetch<{ data: any[] }>("/matches?status=scheduled&limit=50")
      .then((res) => setMatches(res.data.map((m: any) => ({
        id: m.id,
        label: `${m.home_team} vs ${m.away_team}`,
        kickoff: m.kickoff_utc,
      }))))
      .catch(() => {});
  }, [showCreate]);

  // Search opponents
  useEffect(() => {
    if (opponentQuery.length < 1) { setOpponents([]); return; }
    const t = setTimeout(() => {
      apiFetch<{ data: Opponent[] }>(`/duels/opponents?q=${encodeURIComponent(opponentQuery)}&limit=8`)
        .then((res) => setOpponents(res.data))
        .catch(() => setOpponents([]));
    }, 250);
    return () => clearTimeout(t);
  }, [opponentQuery]);

  const handleAction = async (duelId: string, action: "accept" | "decline" | "cancel") => {
    setActing(duelId);
    try {
      await apiFetch(`/duels/${duelId}/${action}`, { method: "POST" });
      await fetchDuels();
    } catch (e: any) {
      alert(e?.message || `Failed to ${action} duel`);
    }
    setActing(null);
  };

  const handleCreate = async () => {
    if (!matchId || !selectedOpponent || creating) return;
    setCreating(true);
    try {
      await apiFetch(`/matches/${matchId}/duels`, {
        method: "POST",
        body: JSON.stringify({ opponent_id: selectedOpponent.id, stake_points: stakePoints, message: duelMessage.trim() || null }),
      });
      setShowCreate(false);
      setMatchId("");
      setSelectedOpponent(null);
      setOpponentQuery("");
      setStakePoints(3);
      setDuelMessage("");
      await fetchDuels();
    } catch (e: any) {
      alert(e?.message || "Failed to create duel");
    }
    setCreating(false);
  };

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const statusBadge = (d: Duel) => {
    const base = "px-2.5 py-0.5 rounded-full text-xs font-semibold";
    if (d.status === "pending") return `${base} bg-yellow-900/30 text-yellow-400`;
    if (d.status === "active") return `${base} bg-blue-900/30 text-blue-400`;
    if (d.status === "completed") {
      if (d.result === "won") return `${base} bg-green-900/30 text-rz-success`;
      if (d.result === "lost") return `${base} bg-red-900/30 text-red-400`;
      return `${base} bg-rz-surface-2 text-rz-text-secondary`;
    }
    if (d.status === "expired") return `${base} bg-rz-surface-2 text-rz-text-muted`;
    if (d.status === "declined") return `${base} bg-rz-surface-2 text-rz-text-muted`;
    return `${base} bg-rz-surface-2 text-rz-text-muted`;
  };

  const statusLabel = (d: Duel) => {
    if (d.status === "completed") {
      if (d.result === "won") return `Won +${d.stake_points} pts`;
      if (d.result === "lost") return `Lost −${d.stake_points} pts`;
      return "Draw (refund)";
    }
    if (d.status === "active") return "Active (in escrow)";
    if (d.status === "pending" && !d.is_challenger) return "Awaiting your response";
    if (d.status === "pending" && d.is_challenger) return "Pending";
    return d.status.charAt(0).toUpperCase() + d.status.slice(1);
  };

  return (
    <div className="max-w-xl mx-auto">
      <MobilePageHeader title="Duel Center" backHref="/home" backLabel="Home" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Duel Center</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-rz-red text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-rz-red-hover transition"
        >
          + Challenge
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 bg-rz-surface rounded-lg p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
              tab === t.key
                ? "bg-rz-surface-2 shadow text-rz-red"
                : "text-rz-text-muted hover:text-rz-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : duels.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-rz-text-muted mb-2">No duels found</p>
          <p className="text-sm text-rz-text-muted">
            Challenge a friend to a prediction duel!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {duels.map((duel) => (
            <div
              key={duel.id}
              className="bg-rz-surface rounded-xl border border-rz-border p-4"
            >
              {/* Header: opponent + status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <Avatar src={duel.other_avatar} name={duel.other_name} />
                  <div>
                    <p className="text-sm font-semibold">
                      {duel.is_challenger ? "You" : duel.challenger_name} vs {duel.is_challenger ? duel.opponent_name : "You"}
                    </p>
                    <p className="text-xs text-rz-text-muted">{duel.match_summary}</p>
                  </div>
                </div>
                <span className={statusBadge(duel)}>{statusLabel(duel)}</span>
              </div>

              {/* Stake info */}
              <div className="flex items-center gap-3 text-[10px] text-rz-text-muted mb-2">
                <span className="font-medium text-rz-text-secondary">
                  Stake: {duel.stake_points} pts
                </span>
                {(duel.status === "active" || duel.status === "pending") && (
                  <span className="text-amber-400">
                    Pot: {duel.pot} pts
                  </span>
                )}
                <span>{timeAgo(duel.created_at)}</span>
                {duel.status === "pending" && (
                  <span>Expires {new Date(duel.expires_at).toLocaleDateString()}</span>
                )}
              </div>

              {/* Message */}
              {duel.message && (
                <p className="text-xs text-rz-text-secondary italic bg-rz-surface-2 rounded-lg px-3 py-2 mb-2">
                  &ldquo;{duel.message}&rdquo;
                </p>
              )}

              {/* Score breakdown for completed duels */}
              {duel.status === "completed" && duel.my_score !== null && (
                <div className="bg-rz-surface-2 rounded-lg p-2 mb-2 text-xs">
                  <div className="flex justify-between">
                    <span>Your prediction score: <strong>{duel.my_score} pts</strong></span>
                    <span>Opponent score: <strong>{duel.their_score} pts</strong></span>
                  </div>
                  {duel.points_delta !== null && duel.points_delta !== 0 && (
                    <p className={`mt-1 font-semibold ${duel.points_delta > 0 ? "text-rz-success" : "text-red-400"}`}>
                      Net: {duel.points_delta > 0 ? "+" : ""}{duel.points_delta} pts
                    </p>
                  )}
                </div>
              )}

              {/* Actions for pending duels */}
              {duel.status === "pending" && !duel.is_challenger && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => handleAction(duel.id, "accept")}
                    disabled={acting === duel.id}
                    className="flex-1 bg-rz-red text-white py-1.5 rounded-lg text-xs font-medium hover:bg-rz-red-hover disabled:opacity-50 transition"
                  >
                    Accept ({duel.stake_points} pts)
                  </button>
                  <button
                    onClick={() => handleAction(duel.id, "decline")}
                    disabled={acting === duel.id}
                    className="flex-1 bg-red-900/30 text-red-400 py-1.5 rounded-lg text-xs font-medium hover:bg-red-900/50 disabled:opacity-50 transition"
                  >
                    Decline
                  </button>
                </div>
              )}
              {duel.status === "pending" && duel.is_challenger && (
                <button
                  onClick={() => handleAction(duel.id, "cancel")}
                  disabled={acting === duel.id}
                  className="text-xs text-rz-text-muted hover:text-red-400 transition"
                >
                  Cancel challenge
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Duel Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-rz-surface rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">New Duel</h2>

            {/* Available points */}
            <div className="bg-rz-surface-2 rounded-lg px-3 py-2 mb-4 text-sm">
              <span className="text-rz-text-muted">Available: </span>
              <span className="font-bold text-rz-red">{availablePoints} pts</span>
            </div>

            {/* Match select */}
            <label className="block text-xs font-medium text-rz-text-muted mb-1">Match</label>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="w-full rounded-lg border border-rz-border bg-rz-surface-2 px-3 py-2 text-sm text-rz-text mb-4 focus:outline-none focus:ring-2 focus:ring-rz-red"
            >
              <option value="">Select a match…</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>

            {/* Opponent search */}
            <label className="block text-xs font-medium text-rz-text-muted mb-1">Opponent</label>
            {selectedOpponent ? (
              <div className="flex items-center gap-2 bg-rz-red/10 rounded-lg px-3 py-2 mb-4">
                <Avatar src={selectedOpponent.avatar_url} name={selectedOpponent.display_name} size="sm" />
                <span className="text-sm font-medium flex-1">{selectedOpponent.display_name}</span>
                <button onClick={() => { setSelectedOpponent(null); setOpponentQuery(""); }} className="text-xs text-rz-text-muted hover:text-red-400">✕</button>
              </div>
            ) : (
              <div className="relative mb-4">
                <input
                  value={opponentQuery}
                  onChange={(e) => setOpponentQuery(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full rounded-lg border border-rz-border bg-rz-surface-2 px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
                />
                {opponents.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-rz-surface border border-rz-border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {opponents.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => { setSelectedOpponent(o); setOpponents([]); }}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-rz-surface-2 transition"
                      >
                        <Avatar src={o.avatar_url} name={o.display_name} size="xs" />
                        <span>{o.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Stake selection */}
            <label className="block text-xs font-medium text-rz-text-muted mb-1">Stake (points)</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {STAKE_OPTIONS.filter((s) => s <= availablePoints).map((s) => (
                <button
                  key={s}
                  onClick={() => setStakePoints(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    stakePoints === s
                      ? "bg-rz-red text-white border-rz-red"
                      : "bg-rz-surface-2 border-rz-border text-rz-text-secondary hover:border-rz-red"
                  }`}
                >
                  {s} pts
                </button>
              ))}
              {STAKE_OPTIONS.every((s) => s > availablePoints) && (
                <p className="text-xs text-red-500">Not enough points to stake</p>
              )}
            </div>

            {stakePoints > 0 && (
              <div className="bg-amber-900/20 rounded-lg px-3 py-2 mb-4 text-xs text-amber-400">
                Winner takes: <strong>{stakePoints * 2} pts</strong> • Tie: both refunded
              </div>
            )}

            {/* Message */}
            <label className="block text-xs font-medium text-rz-text-muted mb-1">Trash talk <span className="text-rz-text-muted/50">(optional)</span></label>
            <textarea
              value={duelMessage}
              onChange={(e) => setDuelMessage(e.target.value.slice(0, 200))}
              placeholder="Send a message with your challenge…"
              rows={2}
              className="w-full rounded-lg border border-rz-border bg-rz-surface-2 px-3 py-2 text-sm text-rz-text mb-1 focus:outline-none focus:ring-2 focus:ring-rz-red resize-none"
            />
            <p className="text-[10px] text-rz-text-muted mb-4 text-right">{duelMessage.length}/200</p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(false); setMatchId(""); setSelectedOpponent(null); setOpponentQuery(""); setStakePoints(3); setDuelMessage(""); }}
                className="flex-1 py-2 rounded-lg border border-rz-border text-sm text-rz-text-secondary hover:bg-rz-surface-2 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!matchId || !selectedOpponent || creating || stakePoints < 1 || stakePoints > availablePoints}
                className="flex-1 py-2 rounded-lg bg-rz-red text-white text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating ? "Sending…" : `Challenge (${stakePoints} pts)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

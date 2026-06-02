"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { MobilePageHeader } from "../MobilePageHeader";
import { Loader } from "@/lib/loader";

interface ChallengeOption {
  id: string;
  label: string;
  order_index?: number;
}

interface ActiveChallenge {
  id: string;
  title: string;
  description: string | null;
  type: string;
  scope: string;
  participation_cost: number;
  reward_points: number;
  open_at: string;
  close_at: string;
  match: { id: string; home_team: string; away_team: string } | null;
  options: ChallengeOption[];
  answered: boolean;
  selected_option_id: string | null;
}

interface MyChallenge {
  id: string;
  challenge_id: string;
  title: string;
  description: string | null;
  type: string;
  scope: string;
  status: string;
  participation_cost: number;
  reward_points: number;
  selected_option_id: string;
  selected_label: string | null;
  correct_option_id: string | null;
  correct_label: string | null;
  is_correct: boolean | null;
  paid_points: number;
  reward_points_awarded: number | null;
  outcome_status: string;
  net_points: number | null;
  submitted_at: string;
  resolved_at: string | null;
  options: ChallengeOption[];
}

type Tab = "active" | "history";

export default function ChallengesPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>([]);
  const [myChallenges, setMyChallenges] = useState<MyChallenge[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{ challengeId: string; optionId: string; optionLabel: string; cost: number; reward: number; isEdit: boolean } | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: ActiveChallenge[]; available_balance: number }>("/challenges/active");
      setActiveChallenges(res.data);
      setAvailableBalance(res.available_balance);
    } catch {
      setActiveChallenges([]);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: MyChallenge[] }>("/me/challenges");
      setMyChallenges(res.data);
    } catch {
      setMyChallenges([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchActive(), fetchHistory()]).finally(() => setLoading(false));
  }, [fetchActive, fetchHistory]);

  const handleOptionClick = (challenge: ActiveChallenge, optionId: string) => {
    const opt = challenge.options.find(o => o.id === optionId);
    const isEdit = challenge.answered;
    setConfirmData({
      challengeId: challenge.id,
      optionId,
      optionLabel: opt?.label || "?",
      cost: challenge.participation_cost,
      reward: challenge.reward_points,
      isEdit,
    });
  };

  const confirmAnswer = async () => {
    if (!confirmData) return;
    setSubmitting(confirmData.challengeId);
    setConfirmData(null);
    try {
      const res = await apiFetch<{ available_balance?: number }>(`/challenges/${confirmData.challengeId}/answer`, {
        method: "POST",
        body: JSON.stringify({ option_id: confirmData.optionId }),
      });
      setActiveChallenges((prev) =>
        prev.map((c) =>
          c.id === confirmData.challengeId
            ? { ...c, answered: true, selected_option_id: confirmData.optionId }
            : c
        )
      );
      if (res.available_balance !== undefined) {
        setAvailableBalance(res.available_balance);
      } else {
        fetchActive();
      }
      fetchHistory();
    } catch (err: any) {
      alert(err.message || "Failed to submit answer");
    }
    setSubmitting(null);
  };

  const timeRemaining = (closeAt: string) => {
    const diff = new Date(closeAt).getTime() - Date.now();
    if (diff <= 0) return "Closed";
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m left`;
    return `${mins}m left`;
  };

  const resultBadge = (c: MyChallenge) => {
    if (c.outcome_status === "refunded") {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 font-semibold">
          Refunded +{c.paid_points} pts
        </span>
      );
    }
    if (c.outcome_status === "won") {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-rz-success font-semibold">
          Won +{c.reward_points_awarded} pts ✓
        </span>
      );
    }
    if (c.outcome_status === "lost") {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400">
          Lost -{c.paid_points} pts
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-rz-surface-2 text-rz-text-muted">
        Pending
      </span>
    );
  };

  return (
    <div>
      <MobilePageHeader title="Challenges" backHref="/home" backLabel="Home" />
      <h1 className="text-2xl font-bold tracking-tight mb-2">Challenges</h1>
      <p className="text-sm text-rz-text-secondary mb-1">
        Spend points to enter challenges and win bigger rewards!
      </p>
      <p className="text-sm font-medium mb-6">
        Available balance: <span className="text-rz-red">{availableBalance} pts</span>
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "active"
              ? "bg-rz-red text-white"
              : "bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2"
          }`}
        >
          Active{" "}
          {activeChallenges.filter((c) => !c.answered).length > 0 && (
            <span className="ml-1 bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {activeChallenges.filter((c) => !c.answered).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "history"
              ? "bg-rz-red text-white"
              : "bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2"
          }`}
        >
          My Answers
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : tab === "active" ? (
        /* ═══ ACTIVE TAB ═══ */
        activeChallenges.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-rz-text-muted mb-2">No active challenges</p>
            <p className="text-sm text-rz-text-muted">
              Challenges appear during matches. Check back during live games!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeChallenges.map((c) => {
              const canAfford = availableBalance >= c.participation_cost;
              return (
                <div
                  key={c.id}
                  className="bg-rz-surface rounded-xl border border-rz-border p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-red-400 bg-red-900/30 px-2 py-1 rounded">
                        Cost: {c.participation_cost} pts
                      </span>
                      <span className="text-xs font-semibold text-rz-success bg-green-900/30 px-2 py-1 rounded">
                        Win: +{c.reward_points} pts
                      </span>
                    </div>
                    <span className="text-xs text-rz-text-secondary">
                      {timeRemaining(c.close_at)}
                    </span>
                  </div>

                  {c.match && (
                    <div className="text-[11px] text-rz-text-secondary mb-2">
                      {c.match.home_team} vs {c.match.away_team}
                    </div>
                  )}

                  <p className="font-medium mb-1 text-rz-text">{c.title}</p>
                  {c.description && (
                    <p className="text-xs text-rz-text-secondary mb-3">{c.description}</p>
                  )}

                  {c.answered ? (
                    <div className="space-y-2">
                      {c.options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleOptionClick(c, opt.id)}
                          disabled={submitting === c.id}
                          className={`w-full text-left px-4 py-2 rounded-lg border text-sm transition disabled:opacity-50 ${
                            c.selected_option_id === opt.id
                              ? "border-rz-red bg-rz-red/10 text-rz-red font-medium"
                              : "border-rz-border text-rz-text-secondary hover:border-rz-warning hover:bg-amber-900/20"
                          }`}
                        >
                          {opt.label}{" "}
                          {c.selected_option_id === opt.id && "✓ Your answer"}
                        </button>
                      ))}
                      <p className="text-xs text-rz-text-secondary text-center mt-2">
                        Tap another option to change (free edit)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {c.options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleOptionClick(c, opt.id)}
                          disabled={submitting === c.id || !canAfford}
                          className={`w-full text-left px-4 py-2 rounded-lg border border-rz-border text-sm text-rz-text transition ${
                            canAfford
                              ? "hover:border-rz-red hover:bg-rz-red/10"
                              : "opacity-50 cursor-not-allowed"
                          } disabled:opacity-50`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {!canAfford && (
                        <p className="text-xs text-red-500 text-center">
                          Insufficient points ({availableBalance} available, need {c.participation_cost})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ═══ HISTORY TAB ═══ */
        myChallenges.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-rz-text-muted mb-2">No answers yet</p>
            <p className="text-sm text-rz-text-muted">
              Answer active challenges to see your history here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myChallenges.map((c) => (
              <div
                key={c.id}
                className="bg-rz-surface rounded-xl border border-rz-border px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {resultBadge(c)}
                      <span className="text-[10px] text-rz-text-secondary">
                        {c.type === "yes_no" ? "Yes/No" : "Multiple Choice"}
                      </span>
                      <span className="text-[10px] text-rz-text-secondary">
                        Cost:{c.participation_cost} · Win:{c.reward_points}
                      </span>
                    </div>
                    <h3 className="font-medium text-sm">{c.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      {c.options.map((o) => (
                        <span
                          key={o.id}
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            c.status === "resolved" &&
                            c.correct_option_id === o.id
                              ? "bg-green-900/30 text-rz-success border-green-700 font-bold"
                              : c.selected_option_id === o.id
                              ? "bg-blue-900/30 text-blue-400 border-blue-700 font-medium"
                              : "bg-rz-surface-2 text-rz-text-secondary border-rz-border"
                          }`}
                        >
                          {o.label}
                          {c.selected_option_id === o.id && " ◄"}
                          {c.status === "resolved" &&
                            c.correct_option_id === o.id &&
                            " ✓"}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-rz-text-secondary mt-2">
                      Answered{" "}
                      {new Date(c.submitted_at).toLocaleString()}
                      {c.resolved_at &&
                        ` · Resolved ${new Date(c.resolved_at).toLocaleString()}`}
                    </p>
                  </div>
                  {c.net_points !== null && (
                    <div className={`text-sm font-bold ${c.net_points > 0 ? "text-rz-success" : c.net_points < 0 ? "text-red-400" : "text-rz-text-muted"}`}>
                      {c.net_points > 0 ? "+" : ""}{c.net_points}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══ CONFIRM MODAL ═══ */}
      {confirmData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmData(null)}>
          <div className="bg-rz-surface rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-3">
              {confirmData.isEdit ? "Change Answer" : "Confirm Entry"}
            </h3>
            {confirmData.isEdit ? (
              <p className="text-sm text-rz-text-secondary mb-4">
                Change your answer to <strong>{confirmData.optionLabel}</strong>? No additional cost.
              </p>
            ) : (
              <>
                <p className="text-sm text-rz-text-secondary mb-2">
                  Your answer: <strong>{confirmData.optionLabel}</strong>
                </p>
                <div className="bg-rz-surface-2 rounded-lg p-3 mb-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-rz-text-muted">Entry cost:</span>
                    <span className="font-medium text-red-400">-{confirmData.cost} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-rz-text-muted">Potential win:</span>
                    <span className="font-medium text-rz-success">+{confirmData.reward} pts</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-rz-border pt-1 mt-1">
                    <span className="text-rz-text-muted">Your balance:</span>
                    <span className="font-medium">{availableBalance} pts</span>
                  </div>
                </div>
              </>
            )}
            <div className="flex gap-3">
              <button onClick={confirmAnswer}
                className="flex-1 bg-rz-red text-white py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover transition">
                {confirmData.isEdit ? "Change Answer" : `Pay ${confirmData.cost} pts & Submit`}
              </button>
              <button onClick={() => setConfirmData(null)}
                className="px-4 py-2 rounded-lg text-sm text-rz-text-muted hover:bg-rz-surface-2 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

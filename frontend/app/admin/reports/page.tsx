"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Loader } from "@/lib/loader";

interface UserAudit {
  user_id: string;
  email: string;
  display_name: string;
  total_points: number;
  challenge_balance: number;
  duel_balance: number;
  composite: number;
  integrity: { predictions_ok: boolean; challenges_ok: boolean; duels_ok: boolean };
}

interface Analytics {
  period_days: number;
  generated_at: string;
  users: { total: number; active: number; new_in_period: number; registration_trend: { date: string; count: number }[] };
  predictions: { total: number; in_period: number; unique_users_all_time: number; trend: { date: string; count: number }[] };
  social: { total_posts: number; posts_in_period: number; unique_posters_in_period: number; total_reactions: number; reactions_in_period: number; total_follows: number; follows_in_period: number; post_trend: { date: string; count: number }[] };
  challenges: { total_challenges: number; total_answers: number; answers_in_period: number };
  duels: { total: number; in_period: number; by_status: Record<string, number> };
  matches: { total: number; finished_or_confirmed: number };
  notifications: { in_app_total: number; in_app_read: number; read_rate: number; emails_sent: number };
  top_engaged: { posters: { name: string; posts: number }[]; predictors: { name: string; predictions: number }[] };
}

interface UserDetail {
  user: { id: string; email: string; display_name: string };
  profile_balances: Record<string, number>;
  predictions: Record<string, number | boolean>;
  challenges: Record<string, number | boolean>;
  duels: Record<string, number | boolean>;
  integrity: Record<string, boolean>;
  ledger: { id: string; type: string; delta: number; balance_after: number; reference_type: string | null; created_at: string; metadata: Record<string, unknown> | null }[];
}

interface CommunityOdds {
  period_days: number;
  generated_at: string;
  toggle: { community_odds_enabled: boolean };
  threshold: number;
  users: { total: number; active: number };
  predictions: { total: number; in_period: number; unique_predictors_period: number; avg_per_match: number };
  upcoming_matches: { total: number; at_threshold: number; below_threshold: number; at_5_plus: number; at_10_plus: number; readiness_pct: number };
  distribution: Record<string, number>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
      <p className="text-xs text-rz-text-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-rz-text mt-1">{value}</p>
      {sub && <p className="text-xs text-rz-text-secondary mt-0.5">{sub}</p>}
    </div>
  );
}

function IntegrityBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-900/30 text-green-400">OK</span>
  ) : (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">MISMATCH</span>
  );
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"analytics" | "audit" | "odds">("analytics");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [usersAudit, setUsersAudit] = useState<UserAudit[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [odds, setOdds] = useState<CommunityOdds | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (tab === "analytics") {
      setLoading(true);
      apiFetch<Analytics>(`/admin/reports/analytics?days=${days}`)
        .then(setAnalytics)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (tab === "audit") {
      setLoading(true);
      apiFetch<{ data: UserAudit[] }>("/admin/reports/users-audit")
        .then((r) => setUsersAudit(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (tab === "odds") {
      setLoading(true);
      apiFetch<CommunityOdds>(`/admin/reports/community-odds?days=${days}`)
        .then(setOdds)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab, days]);

  const handleToggleOdds = async () => {
    setToggling(true);
    try {
      const res = await apiFetch<{ community_odds_enabled: boolean }>("/admin/reports/community-odds/toggle", { method: "PUT" });
      setOdds((prev) => prev ? { ...prev, toggle: { community_odds_enabled: res.community_odds_enabled } } : prev);
    } catch {}
    setToggling(false);
  };

  const loadUserDetail = async (userId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<UserDetail>(`/admin/reports/user-audit/${userId}`);
      setSelectedUser(data);
    } catch {}
    setLoading(false);
  };

  if (authLoading) return null;
  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-rz-text-muted">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Link href="/admin" className="text-sm text-rz-red hover:underline">← Admin</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["analytics", "audit", "odds"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedUser(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t ? "bg-rz-red text-white" : "bg-rz-surface text-rz-text-secondary border border-rz-border hover:bg-rz-surface-2"
            }`}
          >
            {t === "analytics" ? "App Analytics" : t === "audit" ? "User Audit" : "Community Odds"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {tab === "analytics" && analytics && !loading && (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-rz-text-secondary">Period:</span>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  days === d ? "bg-rz-red text-white" : "bg-rz-surface-2 text-rz-text-muted hover:text-rz-text"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Users */}
          <section>
            <h2 className="text-sm font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Users</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Users" value={analytics.users.total} />
              <StatCard label="Active" value={analytics.users.active} />
              <StatCard label={`New (${days}d)`} value={analytics.users.new_in_period} />
              <StatCard label="Notification Read Rate" value={`${analytics.notifications.read_rate}%`} sub={`${analytics.notifications.in_app_read} / ${analytics.notifications.in_app_total} in-app`} />
            </div>
          </section>

          {/* Predictions */}
          <section>
            <h2 className="text-sm font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Predictions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Total Predictions" value={analytics.predictions.total} />
              <StatCard label={`In Period (${days}d)`} value={analytics.predictions.in_period} />
              <StatCard label="Users Who Predicted" value={analytics.predictions.unique_users_all_time} />
            </div>
          </section>

          {/* Social */}
          <section>
            <h2 className="text-sm font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Social / Arena</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Posts" value={analytics.social.total_posts} />
              <StatCard label={`Posts (${days}d)`} value={analytics.social.posts_in_period} sub={`${analytics.social.unique_posters_in_period} unique users`} />
              <StatCard label="Total Reactions" value={analytics.social.total_reactions} sub={`${analytics.social.reactions_in_period} in period`} />
              <StatCard label="Follows" value={analytics.social.total_follows} sub={`${analytics.social.follows_in_period} in period`} />
            </div>
          </section>

          {/* Challenges & Duels */}
          <section>
            <h2 className="text-sm font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Challenges & Duels</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Flash Challenges" value={analytics.challenges.total_challenges} sub={`${analytics.challenges.total_answers} answers`} />
              <StatCard label={`Challenge Answers (${days}d)`} value={analytics.challenges.answers_in_period} />
              <StatCard label="Total Duels" value={analytics.duels.total} sub={`${analytics.duels.in_period} in period`} />
              <StatCard label="Matches" value={analytics.matches.total} sub={`${analytics.matches.finished_or_confirmed} finished`} />
            </div>
            {Object.keys(analytics.duels.by_status).length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {Object.entries(analytics.duels.by_status).map(([status, count]) => (
                  <span key={status} className="text-xs bg-rz-surface-2 text-rz-text-secondary px-2 py-1 rounded">
                    {status}: {count}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Top Engaged */}
          <section>
            <h2 className="text-sm font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Top Engaged ({days}d)</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
                <p className="text-xs text-rz-text-muted mb-2 font-semibold">Top Posters</p>
                {analytics.top_engaged.posters.length === 0 ? (
                  <p className="text-xs text-rz-text-muted">No posts in period</p>
                ) : (
                  analytics.top_engaged.posters.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span className="text-rz-text">{p.name}</span>
                      <span className="text-rz-text-secondary">{p.posts}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
                <p className="text-xs text-rz-text-muted mb-2 font-semibold">Top Predictors</p>
                {analytics.top_engaged.predictors.length === 0 ? (
                  <p className="text-xs text-rz-text-muted">No predictions in period</p>
                ) : (
                  analytics.top_engaged.predictors.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span className="text-rz-text">{p.name}</span>
                      <span className="text-rz-text-secondary">{p.predictions}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Audit Tab ── */}
      {tab === "audit" && !loading && !selectedUser && (
        <div className="bg-rz-surface rounded-xl border border-rz-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-rz-surface-2 text-rz-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-right px-4 py-3">Predictions</th>
                <th className="text-right px-4 py-3">Challenges</th>
                <th className="text-right px-4 py-3">Duels</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Integrity</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {usersAudit.map((u) => {
                const allOk = u.integrity.predictions_ok && u.integrity.challenges_ok && u.integrity.duels_ok;
                return (
                  <tr key={u.user_id} className="border-t border-rz-border hover:bg-rz-surface-2/50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-rz-text">{u.display_name}</p>
                      <p className="text-xs text-rz-text-muted">{u.email}</p>
                    </td>
                    <td className="text-right px-4 py-3 text-rz-text">{u.total_points}</td>
                    <td className="text-right px-4 py-3 text-rz-text">{u.challenge_balance}</td>
                    <td className="text-right px-4 py-3 text-rz-text">{u.duel_balance}</td>
                    <td className="text-right px-4 py-3 font-semibold text-rz-text">{u.composite}</td>
                    <td className="text-center px-4 py-3"><IntegrityBadge ok={allOk} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => loadUserDetail(u.user_id)}
                        className="text-xs text-rz-red hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── User Detail ── */}
      {tab === "audit" && selectedUser && !loading && (
        <div className="space-y-6">
          <button onClick={() => setSelectedUser(null)} className="text-sm text-rz-red hover:underline">← Back to list</button>

          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-rz-text">{selectedUser.user.display_name}</h2>
              <p className="text-sm text-rz-text-muted">{selectedUser.user.email}</p>
            </div>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Prediction Points" value={selectedUser.profile_balances.total_points} />
            <StatCard label="Challenge Balance" value={selectedUser.profile_balances.challenge_points_balance} />
            <StatCard label="Duel Balance" value={selectedUser.profile_balances.duel_points_balance} />
            <StatCard label="Composite Total" value={selectedUser.profile_balances.composite_total} />
          </div>

          {/* Integrity */}
          <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
            <h3 className="text-xs font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Integrity Checks</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(selectedUser.integrity).map(([key, ok]) => (
                <div key={key} className="flex items-center gap-2">
                  <IntegrityBadge ok={ok} />
                  <span className="text-xs text-rz-text-secondary">{key.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
              <h3 className="text-xs font-semibold text-rz-text-muted uppercase mb-2">Predictions</h3>
              {Object.entries(selectedUser.predictions).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-0.5">
                  <span className="text-rz-text-secondary">{k.replace(/_/g, " ")}</span>
                  <span className="text-rz-text">{typeof v === "boolean" ? (v ? "✓" : "✗") : v}</span>
                </div>
              ))}
            </div>
            <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
              <h3 className="text-xs font-semibold text-rz-text-muted uppercase mb-2">Challenges</h3>
              {Object.entries(selectedUser.challenges).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-0.5">
                  <span className="text-rz-text-secondary">{k.replace(/_/g, " ")}</span>
                  <span className="text-rz-text">{typeof v === "boolean" ? (v ? "✓" : "✗") : v}</span>
                </div>
              ))}
            </div>
            <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
              <h3 className="text-xs font-semibold text-rz-text-muted uppercase mb-2">Duels</h3>
              {Object.entries(selectedUser.duels).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-0.5">
                  <span className="text-rz-text-secondary">{k.replace(/_/g, " ")}</span>
                  <span className="text-rz-text">{typeof v === "boolean" ? (v ? "✓" : "✗") : v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ledger */}
          {selectedUser.ledger.length > 0 && (
            <div className="bg-rz-surface rounded-xl border border-rz-border overflow-hidden">
              <h3 className="text-xs font-semibold text-rz-text-muted uppercase tracking-wide px-4 pt-4 mb-2">Points Ledger</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-rz-surface-2 text-rz-text-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-right px-4 py-2">Delta</th>
                    <th className="text-right px-4 py-2">Balance After</th>
                    <th className="text-left px-4 py-2">Reference</th>
                    <th className="text-left px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUser.ledger.map((e) => (
                    <tr key={e.id} className="border-t border-rz-border">
                      <td className="px-4 py-2 text-rz-text">{e.type}</td>
                      <td className={`text-right px-4 py-2 font-medium ${e.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {e.delta >= 0 ? "+" : ""}{e.delta}
                      </td>
                      <td className="text-right px-4 py-2 text-rz-text-secondary">{e.balance_after}</td>
                      <td className="px-4 py-2 text-xs text-rz-text-muted">{e.reference_type || "—"}</td>
                      <td className="px-4 py-2 text-xs text-rz-text-muted">{new Date(e.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Community Odds Tab ── */}
      {tab === "odds" && odds && !loading && (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-rz-text-secondary">Period:</span>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  days === d ? "bg-rz-red text-white" : "bg-rz-surface-2 text-rz-text-muted hover:text-rz-text"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Feature Toggle */}
          <div className="bg-rz-surface rounded-xl border border-rz-border p-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-rz-text">Community Odds Feature</h2>
              <p className="text-xs text-rz-text-muted mt-0.5">Show community-generated match probabilities to users</p>
            </div>
            <button
              onClick={handleToggleOdds}
              disabled={toggling}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                odds.toggle.community_odds_enabled ? "bg-green-600" : "bg-rz-surface-2 border border-rz-border"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                  odds.toggle.community_odds_enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Readiness summary */}
          <div className={`rounded-xl border p-5 ${
            odds.upcoming_matches.readiness_pct >= 60
              ? "bg-green-900/10 border-green-800/40"
              : odds.upcoming_matches.readiness_pct >= 30
              ? "bg-yellow-900/10 border-yellow-800/40"
              : "bg-red-900/10 border-red-800/40"
          }`}>
            <p className="text-sm font-semibold text-rz-text">
              {odds.upcoming_matches.at_threshold} of {odds.upcoming_matches.total} upcoming matches have enough signal
            </p>
            <p className="text-xs text-rz-text-muted mt-1">
              Threshold: {odds.threshold}+ predictions per match &middot; Readiness: {odds.upcoming_matches.readiness_pct}%
            </p>
          </div>

          {/* Core metrics */}
          <section>
            <h2 className="text-sm font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Platform Activity</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Users" value={odds.users.total} />
              <StatCard label="Active Users" value={odds.users.active} />
              <StatCard label="Total Predictions" value={odds.predictions.total} />
              <StatCard label={`Predictions (${days}d)`} value={odds.predictions.in_period} sub={`${odds.predictions.unique_predictors_period} unique users`} />
            </div>
          </section>

          {/* Signal quality */}
          <section>
            <h2 className="text-sm font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Signal Quality</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Avg Predictions / Match" value={odds.predictions.avg_per_match} />
              <StatCard label="Matches ≥ 5 Predictions" value={odds.upcoming_matches.at_5_plus} sub={`of ${odds.upcoming_matches.total} upcoming`} />
              <StatCard label="Matches ≥ 10 Predictions" value={odds.upcoming_matches.at_10_plus} sub={`of ${odds.upcoming_matches.total} upcoming`} />
              <StatCard label="Below Threshold" value={odds.upcoming_matches.below_threshold} sub={`need ${odds.threshold}+ each`} />
            </div>
          </section>

          {/* Distribution chart */}
          <section>
            <h2 className="text-sm font-semibold text-rz-text-muted uppercase tracking-wide mb-3">Prediction Volume Distribution</h2>
            <p className="text-xs text-rz-text-muted mb-4">Upcoming matches grouped by number of predictions received</p>
            <div className="bg-rz-surface rounded-xl border border-rz-border p-5">
              <div className="space-y-3">
                {Object.entries(odds.distribution).map(([bucket, count]) => {
                  const maxCount = Math.max(...Object.values(odds.distribution), 1);
                  const pct = (count / maxCount) * 100;
                  const isAboveThreshold = bucket === "5-9" || bucket === "10-19" || bucket === "20+";
                  return (
                    <div key={bucket} className="flex items-center gap-3">
                      <span className="text-xs text-rz-text-muted w-12 text-right font-mono">{bucket}</span>
                      <div className="flex-1 h-6 bg-rz-surface-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isAboveThreshold ? "bg-green-600" : "bg-rz-red/70"}`}
                          style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-rz-text w-8">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-rz-border">
                <span className="flex items-center gap-1.5 text-xs text-rz-text-muted">
                  <span className="inline-block w-3 h-3 rounded-full bg-rz-red/70" /> Below threshold
                </span>
                <span className="flex items-center gap-1.5 text-xs text-rz-text-muted">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-600" /> Meets threshold
                </span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

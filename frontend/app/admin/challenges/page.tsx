"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Loader } from "@/lib/loader";

interface ChallengeOption { id: string; label: string; order_index: number; }

interface Challenge {
  id: string;
  tournament_id: string;
  stage_id: string | null;
  match_id: string | null;
  title: string;
  description: string | null;
  scope: string;
  type: string;
  participation_cost: number;
  reward_points: number;
  status: string;
  open_at: string;
  close_at: string;
  correct_option_id: string | null;
  resolved_at: string | null;
  answer_count: number;
  options: ChallengeOption[];
  created_at: string;
}

interface Participant {
  user_id: string;
  display_name: string;
  option_id: string;
  option_label: string;
  paid_points: number;
  reward_points_awarded: number | null;
  outcome_status: string;
  submitted_at: string;
}

interface DropdownItem { id: string; name: string; }
interface StageItem extends DropdownItem { tournament_id: string; }
interface MatchItem { id: string; label: string; kickoff_utc: string | null; tournament_id: string; stage_id: string; }

type Tab = "list" | "create";

export default function AdminChallengesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("list");

  // ── List state ──
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  // ── Dropdown data ──
  const [tournaments, setTournaments] = useState<DropdownItem[]>([]);
  const [stages, setStages] = useState<StageItem[]>([]);
  const [allMatches, setAllMatches] = useState<MatchItem[]>([]);

  // ── Create form ──
  const [fTournament, setFTournament] = useState("");
  const [fStage, setFStage] = useState("");
  const [fScope, setFScope] = useState<"match" | "stage" | "open">("stage");
  const [fMatch, setFMatch] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fType, setFType] = useState<"yes_no" | "multiple_choice">("yes_no");
  const [fCost, setFCost] = useState(2);
  const [fReward, setFReward] = useState(5);
  const [fOpenAt, setFOpenAt] = useState("");
  const [fCloseAt, setFCloseAt] = useState("");
  const [fOptions, setFOptions] = useState<string[]>(["", ""]);
  const [creating, setCreating] = useState(false);

  // ── Edit modal ──
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", participation_cost: 1, reward_points: 1, open_at: "", close_at: "" });
  const [editBusy, setEditBusy] = useState(false);

  // ── Resolve modal ──
  const [resolving, setResolving] = useState<Challenge | null>(null);
  const [resolveOptionId, setResolveOptionId] = useState("");
  const [resolveBusy, setResolveBusy] = useState(false);

  // ── Participants modal ──
  const [viewingParticipants, setViewingParticipants] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  const [busy, setBusy] = useState(false);

  // ── Fetch dropdown data ──
  useEffect(() => {
    apiFetch<{ tournaments: DropdownItem[]; stages: StageItem[]; matches: MatchItem[] }>("/admin/dropdown-data")
      .then(res => {
        setTournaments(res.tournaments);
        setStages(res.stages);
        setAllMatches(res.matches || []);
        if (res.tournaments.length === 1) setFTournament(res.tournaments[0].id);
      })
      .catch(() => {});
  }, []);

  // ── Fetch challenges ──
  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");
      const res = await apiFetch<{ data: Challenge[] }>(`/admin/challenges?${params}`);
      setChallenges(res.data);
    } catch {}
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  // ── Create challenge ──
  const handleCreate = async () => {
    if (!fTournament || !fTitle || !fOpenAt || !fCloseAt) { alert("Fill all required fields"); return; }
    setCreating(true);
    try {
      await apiFetch("/admin/challenges", {
        method: "POST",
        body: JSON.stringify({
          tournament_id: fTournament,
          stage_id: fScope !== "open" ? (fStage || null) : null,
          match_id: fScope === "match" ? (fMatch || null) : null,
          scope: fScope,
          title: fTitle,
          description: fDesc || null,
          type: fType,
          participation_cost: fCost,
          reward_points: fReward,
          open_at: new Date(fOpenAt).toISOString(),
          close_at: new Date(fCloseAt).toISOString(),
          options: fType === "multiple_choice" ? fOptions.filter(o => o.trim()).map(o => ({ label: o.trim() })) : [],
        }),
      });
      setFTitle(""); setFDesc(""); setFOpenAt(""); setFCloseAt(""); setFOptions(["", ""]); setFMatch("");
      setTab("list");
      fetchChallenges();
    } catch (err: any) { alert(err.message); }
    setCreating(false);
  };

  // ── Status change ──
  const handleStatusChange = async (id: string, newStatus: string) => {
    setBusy(true);
    try {
      await apiFetch(`/admin/challenges/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      fetchChallenges();
    } catch (err: any) { alert(err.message); }
    setBusy(false);
  };

  // ── Cancel (with refund) ──
  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this challenge? All participants will be refunded.")) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ participants_refunded: number }>(`/admin/challenges/${id}/cancel`, { method: "POST" });
      alert(`Challenge cancelled. ${res.participants_refunded} participant(s) refunded.`);
      fetchChallenges();
    } catch (err: any) { alert(err.message); }
    setBusy(false);
  };

  // ── Resolve ──
  const handleResolve = async () => {
    if (!resolving || !resolveOptionId) return;
    setResolveBusy(true);
    try {
      const res = await apiFetch<{ winners: number; losers: number; reward_points: number }>(`/admin/challenges/${resolving.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ correct_option_id: resolveOptionId }),
      });
      alert(`Resolved! ${res.winners} winner(s) awarded ${res.reward_points} pts each. ${res.losers} loser(s).`);
      setResolving(null);
      fetchChallenges();
    } catch (err: any) { alert(err.message); }
    setResolveBusy(false);
  };

  // ── View participants ──
  const handleViewParticipants = async (c: Challenge) => {
    setViewingParticipants(c);
    setParticipantsLoading(true);
    try {
      const res = await apiFetch<{ participants: Participant[] }>(`/admin/challenges/${c.id}/participants`);
      setParticipants(res.participants);
    } catch { setParticipants([]); }
    setParticipantsLoading(false);
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this challenge? This cannot be undone.")) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/challenges/${id}`, { method: "DELETE" });
      setChallenges(prev => prev.filter(c => c.id !== id));
    } catch (err: any) { alert(err.message); }
    setBusy(false);
  };

  const handleStartEdit = (c: Challenge) => {
    const toLocal = (iso: string) => {
      const d = new Date(iso);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    };
    setEditForm({
      title: c.title,
      description: c.description || "",
      participation_cost: c.participation_cost,
      reward_points: c.reward_points,
      open_at: toLocal(c.open_at),
      close_at: toLocal(c.close_at),
    });
    setEditing(c);
  };

  const handleClone = (c: Challenge) => {
    const toLocal = (iso: string) => {
      const d = new Date(iso);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    };
    setFTournament(c.tournament_id);
    setFStage(c.stage_id || "");
    setFScope(c.scope as "match" | "stage" | "open");
    setFMatch(c.match_id || "");
    setFTitle(c.title);
    setFDesc(c.description || "");
    setFType(c.type as "yes_no" | "multiple_choice");
    setFCost(c.participation_cost);
    setFReward(c.reward_points);
    setFOpenAt(toLocal(c.open_at));
    setFCloseAt(toLocal(c.close_at));
    if (c.type === "multiple_choice") {
      setFOptions(c.options.map(o => o.label));
    } else {
      setFOptions(["", ""]);
    }
    setTab("create");
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setEditBusy(true);
    try {
      await apiFetch(`/admin/challenges/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          participation_cost: editForm.participation_cost,
          reward_points: editForm.reward_points,
          open_at: new Date(editForm.open_at).toISOString(),
          close_at: new Date(editForm.close_at).toISOString(),
        }),
      });
      setEditing(null);
      fetchChallenges();
    } catch (err: any) { alert(err.message); }
    setEditBusy(false);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-rz-red/15 text-rz-red";
      case "locked": return "bg-yellow-100 text-yellow-700";
      case "resolved": return "bg-blue-100 text-blue-700";
      case "cancelled": return "bg-rz-surface-2 text-rz-text-secondary";
      default: return "bg-rz-surface-2 text-rz-text-secondary";
    }
  };

  const outcomeColor = (s: string) => {
    switch (s) {
      case "won": return "text-rz-red bg-rz-red/15";
      case "lost": return "text-red-600 bg-red-100";
      case "refunded": return "text-blue-600 bg-blue-100";
      default: return "text-rz-text-secondary bg-rz-surface-2";
    }
  };

  const filteredStages = stages.filter(s => s.tournament_id === fTournament);
  const filteredMatches = allMatches.filter(m => {
    if (fTournament && m.tournament_id !== fTournament) return false;
    if (fStage && m.stage_id !== fStage) return false;
    return true;
  });

  if (!user || user.role !== "admin") {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-rz-text-secondary">Access Denied</p></div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Challenges</h1>
        <Link href="/admin" className="text-sm text-rz-red hover:underline">← Admin</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("list")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "list" ? "bg-rz-red text-white" : "bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2"
          }`}>All Challenges</button>
        <button onClick={() => setTab("create")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "create" ? "bg-rz-red text-white" : "bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2"
          }`}>Create Challenge</button>
      </div>

      {/* ═══ TAB: LIST ═══ */}
      {tab === "list" && (
        <>
          <div className="flex gap-3 mb-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {["draft","active","locked","resolved","cancelled"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader /></div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-12 text-rz-text-muted">No challenges found.</div>
          ) : (
            <div className="space-y-3">
              {challenges.map(c => (
                <div key={c.id} className="bg-rz-surface rounded-xl shadow px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColor(c.status)}`}>{c.status}</span>
                        <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">{c.type === "yes_no" ? "Yes/No" : "Multiple Choice"}</span>
                        <span className="text-[10px] text-rz-text-muted">{c.scope}</span>
                        <span className="text-[10px] text-red-500 font-medium">Cost:{c.participation_cost}</span>
                        <span className="text-[10px] text-rz-red font-medium">Win:{c.reward_points}</span>
                      </div>
                      <h3 className="font-medium text-sm">{c.title}</h3>
                      {c.description && <p className="text-xs text-rz-text-muted mt-0.5">{c.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-rz-text-muted">
                        <span>Opens: {new Date(c.open_at).toLocaleString()}</span>
                        <span>Closes: {new Date(c.close_at).toLocaleString()}</span>
                        <span>· {c.answer_count} participants</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {c.options.map(o => (
                          <span key={o.id}
                            className={`text-[10px] px-2 py-0.5 rounded border ${
                              c.correct_option_id === o.id
                                ? "bg-rz-red/15 text-rz-red border-rz-red font-bold"
                                : "bg-rz-surface-2 text-rz-text-secondary border-rz-border"
                            }`}>
                            {o.label} {c.correct_option_id === o.id && "✓"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {c.status !== "resolved" && c.status !== "cancelled" && (
                        <button onClick={() => handleStartEdit(c)} disabled={busy}
                          className="text-[10px] px-2.5 py-1 rounded bg-rz-surface-2 text-rz-text-secondary hover:bg-rz-border transition disabled:opacity-50 w-full text-center">Edit</button>
                      )}
                      {c.status === "draft" && (
                        <button onClick={() => handleStatusChange(c.id, "active")} disabled={busy}
                          className="text-[10px] px-2.5 py-1 rounded bg-rz-red/10 text-rz-red hover:bg-rz-red/15 transition disabled:opacity-50 w-full text-center">Activate</button>
                      )}
                      {c.status === "active" && (
                        <button onClick={() => handleStatusChange(c.id, "locked")} disabled={busy}
                          className="text-[10px] px-2.5 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition disabled:opacity-50 w-full text-center">Lock</button>
                      )}
                      {(c.status === "locked" || c.status === "active") && !c.correct_option_id && (
                        <button onClick={() => { setResolving(c); setResolveOptionId(""); }}
                          className="text-[10px] px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition w-full text-center">Resolve</button>
                      )}
                      {c.answer_count > 0 && (
                        <button onClick={() => handleViewParticipants(c)}
                          className="text-[10px] px-2.5 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition w-full text-center">Participants</button>
                      )}
                      {c.status !== "resolved" && c.status !== "cancelled" && (
                        <button onClick={() => handleCancel(c.id)} disabled={busy}
                          className="text-[10px] px-2.5 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 transition disabled:opacity-50 w-full text-center">Cancel & Refund</button>
                      )}
                      <button onClick={() => handleClone(c)}
                        className="text-[10px] px-2.5 py-1 rounded bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition w-full text-center">Clone</button>
                      <button onClick={() => handleDelete(c.id)} disabled={busy}
                        className="text-[10px] px-2.5 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50 w-full text-center">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: CREATE ═══ */}
      {tab === "create" && (
        <div className="bg-rz-surface rounded-xl shadow p-6 max-w-2xl">
          <h2 className="text-lg font-bold mb-4">Create Challenge</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Tournament</label>
                <select value={fTournament} onChange={e => setFTournament(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Scope</label>
                <select value={fScope} onChange={e => setFScope(e.target.value as any)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="open">Open (no match/stage)</option>
                  <option value="stage">Stage</option>
                  <option value="match">Match</option>
                </select>
              </div>
            </div>

            {fScope !== "open" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Stage (optional)</label>
                <select value={fStage} onChange={e => setFStage(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="">None</option>
                  {filteredStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Type</label>
                <select value={fType} onChange={e => setFType(e.target.value as any)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="yes_no">Yes / No</option>
                  <option value="multiple_choice">Multiple Choice</option>
                </select>
              </div>
            </div>
            )}

            {fScope === "open" && (
            <div>
              <label className="block text-xs font-medium text-rz-text-secondary mb-1">Type</label>
              <select value={fType} onChange={e => setFType(e.target.value as any)}
                className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                <option value="yes_no">Yes / No</option>
                <option value="multiple_choice">Multiple Choice</option>
              </select>
            </div>
            )}

            {fScope === "match" && (
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Match</label>
                <select value={fMatch} onChange={e => {
                  const matchId = e.target.value;
                  setFMatch(matchId);
                  if (matchId) {
                    const match = filteredMatches.find(m => m.id === matchId);
                    if (match?.kickoff_utc) {
                      const d = new Date(match.kickoff_utc);
                      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                      setFCloseAt(d.toISOString().slice(0, 16));
                    }
                  }
                }}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="">Select a match…</option>
                  {filteredMatches.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}{m.kickoff_utc ? ` — ${new Date(m.kickoff_utc).toLocaleDateString()}` : ""}
                    </option>
                  ))}
                </select>
                {filteredMatches.length === 0 && (
                  <p className="text-xs text-rz-text-muted mt-1">No matches found. Import matches first.</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-rz-text-secondary mb-1">Title</label>
              <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Will Brazil score first?"
                className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-rz-text-secondary mb-1">Description (optional)</label>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="More context…"
                className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Entry Cost (points)</label>
                <input type="number" value={fCost} onChange={e => setFCost(parseInt(e.target.value) || 0)} min={0} max={50}
                  className="w-24 rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                <p className="text-[10px] text-rz-text-muted mt-0.5">Deducted from participant on entry</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Reward (points)</label>
                <input type="number" value={fReward} onChange={e => setFReward(parseInt(e.target.value) || 0)} min={0} max={100}
                  className="w-24 rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                <p className="text-[10px] text-rz-text-muted mt-0.5">Awarded to winners on resolve</p>
              </div>
            </div>

            {fType === "multiple_choice" && (
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Options</label>
                <div className="space-y-2">
                  {fOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={opt} onChange={e => {
                        const newOpts = [...fOptions]; newOpts[idx] = e.target.value; setFOptions(newOpts);
                      }} placeholder={`Option ${idx + 1}`}
                        className="flex-1 rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                      {fOptions.length > 2 && (
                        <button onClick={() => setFOptions(prev => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-red-400 hover:text-red-600">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setFOptions(prev => [...prev, ""])}
                    className="text-xs text-rz-red hover:underline">+ Add option</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Opens at</label>
                <input type="datetime-local" value={fOpenAt} onChange={e => setFOpenAt(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Closes at</label>
                <input type="datetime-local" value={fCloseAt} onChange={e => setFCloseAt(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
              </div>
            </div>

            <button onClick={handleCreate} disabled={creating}
              className="bg-rz-red text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
              {creating ? "Creating..." : "Create Challenge"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditing(null)}>
          <div className="bg-rz-surface rounded-2xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Edit Challenge</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Title</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Entry Cost</label>
                  <input type="number" min={0} max={50} value={editForm.participation_cost}
                    onChange={e => setEditForm(f => ({ ...f, participation_cost: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                  {editing.answer_count > 0 && <p className="text-[10px] text-orange-500 mt-0.5">Cannot change — has participants</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Reward</label>
                  <input type="number" min={0} max={100} value={editForm.reward_points}
                    onChange={e => setEditForm(f => ({ ...f, reward_points: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Opens at</label>
                  <input type="datetime-local" value={editForm.open_at}
                    onChange={e => setEditForm(f => ({ ...f, open_at: e.target.value }))}
                    className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Closes at</label>
                  <input type="datetime-local" value={editForm.close_at}
                    onChange={e => setEditForm(f => ({ ...f, close_at: e.target.value }))}
                    className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleEditSave} disabled={editBusy || !editForm.title}
                className="flex-1 bg-rz-red text-white py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
                {editBusy ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg text-sm text-rz-text-secondary hover:bg-rz-surface-2 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RESOLVE MODAL ═══ */}
      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setResolving(null)}>
          <div className="bg-rz-surface rounded-2xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">Resolve Challenge</h3>
            <p className="text-sm text-rz-text-secondary mb-1">{resolving.title}</p>
            <p className="text-xs text-rz-text-muted mb-3">
              {resolving.answer_count} participants · Cost: {resolving.participation_cost} pts · Reward: {resolving.reward_points} pts
            </p>
            <p className="text-xs text-rz-text-muted mb-3">Select the correct answer:</p>
            <div className="space-y-2 mb-4">
              {resolving.options.map(o => (
                <label key={o.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition border ${
                    resolveOptionId === o.id
                      ? "bg-rz-red/10 border-rz-red ring-1 ring-rz-red/40"
                      : "border-rz-border hover:bg-rz-surface-2/50"
                  }`}>
                  <input type="radio" name="resolve" value={o.id} checked={resolveOptionId === o.id}
                    onChange={() => setResolveOptionId(o.id)}
                    className="text-rz-red focus:ring-rz-red" />
                  <span className="text-sm font-medium">{o.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleResolve} disabled={!resolveOptionId || resolveBusy}
                className="flex-1 bg-rz-red text-white py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
                {resolveBusy ? "Resolving…" : "Confirm & Award Points"}
              </button>
              <button onClick={() => setResolving(null)}
                className="px-4 py-2 rounded-lg text-sm text-rz-text-secondary hover:bg-rz-surface-2 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PARTICIPANTS MODAL ═══ */}
      {viewingParticipants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewingParticipants(null)}>
          <div className="bg-rz-surface rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">Participants</h3>
            <p className="text-sm text-rz-text-secondary mb-1">{viewingParticipants.title}</p>
            <p className="text-xs text-rz-text-muted mb-4">
              Cost: {viewingParticipants.participation_cost} pts · Reward: {viewingParticipants.reward_points} pts
            </p>
            {participantsLoading ? (
              <div className="flex justify-center py-8"><Loader size="sm" /></div>
            ) : participants.length === 0 ? (
              <p className="text-sm text-rz-text-muted text-center py-4">No participants</p>
            ) : (
              <div className="space-y-2">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-rz-border pb-2">
                    <div>
                      <p className="text-sm font-medium">{p.display_name}</p>
                      <p className="text-[10px] text-rz-text-muted">
                        Answered: {p.option_label} · Paid: {p.paid_points} pts
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${outcomeColor(p.outcome_status)}`}>
                      {p.outcome_status}
                      {p.outcome_status === "won" && ` (+${p.reward_points_awarded})`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setViewingParticipants(null)}
              className="mt-4 w-full py-2 rounded-lg text-sm text-rz-text-secondary hover:bg-rz-surface-2 transition">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

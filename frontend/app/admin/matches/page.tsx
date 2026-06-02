"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Loader } from "@/lib/loader";

interface AdminMatch {
  id: string;
  tournament_id: string;
  stage_id: string;
  home_team_id: string;
  away_team_id: string;
  home_team: string;
  away_team: string;
  stage_name: string;
  kickoff_utc: string;
  venue: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  is_override: boolean;
  notes: string;
}

interface DropdownItem { id: string; name: string; }
interface StageItem extends DropdownItem { tournament_id: string; }
interface TeamItem extends DropdownItem { short_code: string | null; tournament_ids: string[]; }

/* ── Searchable team picker ── */
function TeamSearchSelect({
  teams,
  value,
  onChange,
  placeholder,
}: {
  teams: TeamItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = teams.find(t => t.id === value);

  useEffect(() => {
    if (selected) setQuery("");
  }, [selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query
    ? teams.filter(t =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        (t.short_code && t.short_code.toLowerCase().includes(query.toLowerCase()))
      )
    : teams;

  return (
    <div ref={ref} className="relative">
      <div
        className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm flex items-center cursor-text"
        onClick={() => setOpen(true)}
      >
        {selected && !open ? (
          <div className="flex items-center justify-between w-full">
            <span>{selected.name} ({selected.short_code})</span>
            <button onClick={(e) => { e.stopPropagation(); onChange(""); setQuery(""); }}
              className="text-rz-text-muted hover:text-rz-text-secondary ml-2">✕</button>
          </div>
        ) : (
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder || "Search team…"}
            className="w-full bg-transparent outline-none text-sm"
          />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-rz-surface border border-rz-border-strong rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-rz-text-muted">No teams found</div>
          ) : (
            filtered.map(t => (
              <button key={t.id}
                onClick={() => { onChange(t.id); setQuery(""); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-rz-red/10 transition ${
                  t.id === value ? "bg-rz-red/10 font-medium" : ""
                }`}>
                {t.name} <span className="text-rz-text-muted">({t.short_code})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface SyncMatch {
  external_id: string;
  home_team: string;
  home_tla: string;
  away_team: string;
  away_tla: string;
  kickoff_utc: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  selected: boolean;
}

type Tab = "list" | "create" | "sync" | "import";

export default function AdminMatchesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("list");

  // ── List state ──
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [tournamentFilter, setTournamentFilter] = useState("");
  const [matchSearch, setMatchSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [scoreField, setScoreField] = useState<"home" | "away">("home");
  const [busy, setBusy] = useState(false);

  // ── Edit match modal ──
  const [editMatch, setEditMatch] = useState<AdminMatch | null>(null);
  const [emStage, setEmStage] = useState("");
  const [emHome, setEmHome] = useState("");
  const [emAway, setEmAway] = useState("");
  const [emKickoff, setEmKickoff] = useState("");
  const [emVenue, setEmVenue] = useState("");
  const [emStatus, setEmStatus] = useState("");
  const [emNotes, setEmNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Dropdown data ──
  const [tournaments, setTournaments] = useState<DropdownItem[]>([]);
  const [stages, setStages] = useState<StageItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);

  // ── Create form ──
  const [cTournament, setCTournament] = useState("");
  const [cStage, setCStage] = useState("");
  const [cHome, setCHome] = useState("");
  const [cAway, setCAway] = useState("");
  const [cKickoff, setCKickoff] = useState("");
  const [cVenue, setCVenue] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Sync state ──
  const [syncCompId, setSyncCompId] = useState("WC");
  const [syncMatches, setSyncMatches] = useState<SyncMatch[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncTournament, setSyncTournament] = useState("");
  const [syncStage, setSyncStage] = useState("");
  const [importing, setImporting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; skipped: string[] } | null>(null);

  // ── UNAFUT sync state ──
  const [unafutSyncing, setUnafutSyncing] = useState(false);
  const [unafutResult, setUnafutResult] = useState<{
    scraped: number; created: number; updated: number; results_added: number; unchanged: number; error?: string;
  } | null>(null);

  // ── CSV import state ──
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvTournament, setCsvTournament] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    created: number; scores_set: number; errors: string[];
  } | null>(null);

  // ── Fetch dropdown data ──
  useEffect(() => {
    apiFetch<{
      tournaments: DropdownItem[];
      stages: StageItem[];
      teams: TeamItem[];
    }>("/admin/dropdown-data")
      .then((res) => {
        setTournaments(res.tournaments);
        setStages(res.stages);
        setTeams(res.teams);
        if (res.tournaments.length === 1) {
          setCTournament(res.tournaments[0].id);
          setSyncTournament(res.tournaments[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // ── Fetch matches ──
  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (tournamentFilter) params.set("tournament_id", tournamentFilter);
      params.set("limit", "200");
      const res = await apiFetch<{ data: AdminMatch[] }>(`/admin/matches?${params}`);
      setMatches(res.data);
    } catch {}
    setLoading(false);
  }, [statusFilter, tournamentFilter]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  // ── Match actions ──
  const handleSetResult = async (matchId: string) => {
    const hs = parseInt(homeScore), as_ = parseInt(awayScore);
    if (isNaN(hs) || isNaN(as_) || hs < 0 || as_ < 0) { alert("Enter valid scores"); return; }
    setBusy(true);
    try {
      await apiFetch(`/admin/matches/${matchId}/result`, {
        method: "PUT", body: JSON.stringify({ home_score: hs, away_score: as_ }),
      });
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, home_score: hs, away_score: as_, status: "confirmed", is_override: true } : m));
      setEditingId(null);
    } catch (err: any) { alert(err.message); }
    setBusy(false);
  };

  const handleClearResult = async (matchId: string) => {
    if (!confirm("Clear this match score? Status will reset to scheduled.")) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/matches/${matchId}/result`, { method: "DELETE" });
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, home_score: null, away_score: null, status: "scheduled", is_override: false } : m));
      setEditingId(null);
    } catch (err: any) { alert(err.message); }
    setBusy(false);
  };

  const handleStatusChange = async (matchId: string, newStatus: string) => {
    setBusy(true);
    try {
      await apiFetch(`/admin/matches/${matchId}/status?status=${newStatus}`, { method: "PUT" });
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: newStatus } : m));
    } catch (err: any) { alert(err.message); }
    setBusy(false);
  };

  const openEditMatch = (m: AdminMatch) => {
    setEditMatch(m);
    setEmStage(m.stage_id);
    setEmHome(m.home_team_id);
    setEmAway(m.away_team_id);
    const d = new Date(m.kickoff_utc);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setEmKickoff(d.toISOString().slice(0, 16));
    setEmVenue(m.venue || "");
    setEmStatus(m.status);
    setEmNotes(m.notes || "");
  };

  const handleEditSave = async () => {
    if (!editMatch) return;
    if (emHome === emAway) { alert("Home and away must differ"); return; }
    setSaving(true);
    try {
      await apiFetch(`/admin/matches/${editMatch.id}`, {
        method: "PUT",
        body: JSON.stringify({
          stage_id: emStage || null,
          home_team_id: emHome || null,
          away_team_id: emAway || null,
          kickoff_utc: emKickoff ? new Date(emKickoff).toISOString() : null,
          venue: emVenue,
          notes: emNotes,
          status: emStatus || null,
        }),
      });
      setEditMatch(null);
      fetchMatches();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (matchId: string, label: string) => {
    if (!confirm(`Delete "${label}"? This will also remove all predictions for this match. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/matches/${matchId}`, { method: "DELETE" });
      setMatches(prev => prev.filter(m => m.id !== matchId));
    } catch (err: any) { alert(err.message); }
    setBusy(false);
  };

  // ── Create match ──
  const handleCreate = async () => {
    if (!cTournament || !cStage || !cHome || !cAway || !cKickoff) { alert("Fill all required fields"); return; }
    if (cHome === cAway) { alert("Home and away must differ"); return; }
    setCreating(true);
    try {
      await apiFetch("/admin/matches", {
        method: "POST",
        body: JSON.stringify({
          tournament_id: cTournament, stage_id: cStage,
          home_team_id: cHome, away_team_id: cAway,
          kickoff_utc: new Date(cKickoff).toISOString(),
          venue: cVenue || null,
        }),
      });
      setCHome(""); setCAway(""); setCKickoff(""); setCVenue("");
      setTab("list");
      fetchMatches();
    } catch (err: any) { alert(err.message); }
    setCreating(false);
  };

  // ── Sync preview ──
  const handleSyncPreview = async () => {
    setSyncLoading(true); setSyncResult(null);
    try {
      const res = await apiFetch<{ data: any[]; total: number }>(`/admin/sync/preview?competition_id=${syncCompId}`);
      setSyncMatches(res.data.map((m: any) => ({ ...m, selected: false })));
    } catch (err: any) { alert(err.message || "Sync failed"); }
    setSyncLoading(false);
  };

  const toggleSyncMatch = (idx: number) => {
    setSyncMatches(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m));
  };
  const selectAllSync = () => setSyncMatches(prev => prev.map(m => ({ ...m, selected: true })));
  const deselectAllSync = () => setSyncMatches(prev => prev.map(m => ({ ...m, selected: false })));

  const handleImport = async () => {
    const selected = syncMatches.filter(m => m.selected);
    if (!selected.length) { alert("Select at least one match"); return; }
    if (!syncTournament || !syncStage) { alert("Select tournament and stage"); return; }
    setImporting(true);
    try {
      const res = await apiFetch<{ created: number; skipped: string[] }>("/admin/sync/import", {
        method: "POST",
        body: JSON.stringify({
          tournament_id: syncTournament,
          stage_id: syncStage,
          matches: selected.map(m => ({
            home_team: m.home_team, home_tla: m.home_tla,
            away_team: m.away_team, away_tla: m.away_tla,
            kickoff_utc: m.kickoff_utc, external_id: m.external_id,
          })),
        }),
      });
      setSyncResult(res);
      fetchMatches();
    } catch (err: any) { alert(err.message); }
    setImporting(false);
  };

  // ── UNAFUT sync ──
  const handleUnafutSync = async () => {
    setUnafutSyncing(true);
    setUnafutResult(null);
    try {
      const res = await apiFetch<{
        scraped: number; created: number; updated: number; results_added: number; unchanged: number; error?: string;
      }>("/admin/sync/unafut", { method: "POST" });
      setUnafutResult(res);
      if (res.created > 0 || res.updated > 0) fetchMatches();
    } catch (err: any) {
      setUnafutResult({ scraped: 0, created: 0, updated: 0, results_added: 0, unchanged: 0, error: err.message });
    }
    setUnafutSyncing(false);
  };

  // ── CSV import ──
  const handleCsvImport = async () => {
    if (!csvFile || !csvTournament) { alert("Select a tournament and CSV file"); return; }
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
      const res = await fetch(`${apiBase}/admin/csv/import?tournament_id=${csvTournament}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Import failed");
      }
      const data = await res.json();
      setCsvResult(data);
      if (data.created > 0 || data.scores_set > 0) fetchMatches();
    } catch (err: any) {
      setCsvResult({ created: 0, scores_set: 0, errors: [err.message || "Import failed"] });
    }
    setCsvImporting(false);
  };

  const downloadCsvTemplate = () => {
    if (csvTournament) {
      // Download current matches for this tournament
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
      window.open(`${apiBase}/admin/csv/export?tournament_id=${csvTournament}`, "_blank");
    } else {
      // Generic empty template
      const csv = "home_team,away_team,kickoff_utc,stage,venue,home_score,away_score\nLDA,SAP,2026-04-10T20:00:00-06:00,Jornada 1,Estadio Nacional,,\n";
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "match_import_template.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "live": return "bg-red-100 text-red-600";
      case "finished": return "bg-yellow-100 text-yellow-700";
      case "confirmed": return "bg-rz-red/15 text-rz-red";
      case "postponed": case "cancelled": return "bg-rz-surface-2 text-rz-text-secondary";
      default: return "bg-blue-100 text-blue-600";
    }
  };

  const filteredStages = stages.filter(s => s.tournament_id === cTournament);
  const filteredTeams = cTournament
    ? teams.filter(t => t.tournament_ids.includes(cTournament))
    : teams;
  const syncFilteredStages = stages.filter(s => s.tournament_id === syncTournament);

  if (!user || user.role !== "admin") {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-rz-text-secondary">Access Denied</p></div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Match Management</h1>
        <Link href="/admin" className="text-sm text-rz-red hover:underline">← Admin</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["list", "create", "import", "sync"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t ? "bg-rz-red text-white" : "bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2"
            }`}
          >
            {t === "list" ? "Matches" : t === "create" ? "Create" : t === "import" ? "CSV Import" : "Sync"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: LIST ═══ */}
      {tab === "list" && (
        <>
          <div className="flex gap-3 mb-4 flex-wrap">
            <input
              value={matchSearch}
              onChange={e => setMatchSearch(e.target.value)}
              placeholder="Search teams or stage…"
              className="flex-1 min-w-[180px] rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rz-red"
            />
            <select value={tournamentFilter} onChange={e => setTournamentFilter(e.target.value)}
              className="rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
              <option value="">All tournaments</option>
              {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {["scheduled","live","finished","confirmed","postponed","cancelled"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader /></div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 text-rz-text-muted">No matches found.</div>
          ) : (
            <div className="space-y-3">
              {matches.filter(m => {
                if (!matchSearch) return true;
                const q = matchSearch.toLowerCase();
                return m.home_team.toLowerCase().includes(q)
                  || m.away_team.toLowerCase().includes(q)
                  || m.stage_name.toLowerCase().includes(q);
              }).map(m => (
                <div key={m.id} className="bg-rz-surface rounded-xl shadow px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-[10px] text-rz-text-muted">{m.stage_name}</span>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="font-medium text-sm">{m.home_team}</span>
                        <span className="font-mono font-bold text-lg">{m.home_score ?? "–"} : {m.away_score ?? "–"}</span>
                        <span className="font-medium text-sm">{m.away_team}</span>
                        {m.is_override && <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">override</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-rz-text-muted">
                          {new Date(m.kickoff_utc).toLocaleDateString()} at {new Date(m.kickoff_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColor(m.status)}`}>{m.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {editingId === m.id ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{homeScore} : {awayScore}</span>
                          <button onClick={() => setEditingId(null)} className="text-[10px] text-rz-text-muted hover:text-rz-text-secondary">✕</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(m.id); setHomeScore(m.home_score?.toString() ?? "0"); setAwayScore(m.away_score?.toString() ?? "0"); setScoreField("home"); }}
                            className="text-[10px] px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition">Score</button>
                          <button onClick={() => openEditMatch(m)}
                            className="text-[10px] px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 transition">Edit</button>
                          <button onClick={() => handleDelete(m.id, `${m.home_team} vs ${m.away_team}`)} disabled={busy}
                            className="text-[10px] px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 transition disabled:opacity-50">Delete</button>
                          {m.status === "scheduled" && (
                            <button onClick={() => handleStatusChange(m.id, "live")} disabled={busy}
                              className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50">Go Live</button>
                          )}
                          {m.status === "live" && (
                            <button onClick={() => handleStatusChange(m.id, "finished")} disabled={busy}
                              className="text-[10px] px-2 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition disabled:opacity-50">Finish</button>
                          )}
                        </>
                      )}
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
          <h2 className="text-lg font-bold mb-4">Create Match</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Tournament</label>
                <select value={cTournament} onChange={e => setCTournament(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Stage</label>
                <select value={cStage} onChange={e => setCStage(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {filteredStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Home Team</label>
                <TeamSearchSelect teams={filteredTeams} value={cHome} onChange={setCHome} placeholder="Search home team…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Away Team</label>
                <TeamSearchSelect teams={filteredTeams} value={cAway} onChange={setCAway} placeholder="Search away team…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Kickoff (local time)</label>
                <input type="datetime-local" value={cKickoff} onChange={e => setCKickoff(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Venue (optional)</label>
                <input value={cVenue} onChange={e => setCVenue(e.target.value)} placeholder="Stadium name"
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={handleCreate} disabled={creating}
              className="bg-rz-red text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
              {creating ? "Creating…" : "Create Match"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ TAB: CSV IMPORT ═══ */}
      {tab === "import" && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-rz-surface rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-2">CSV Import / Update Scores</h2>
            <p className="text-xs text-rz-text-muted mb-4">
              Import new matches or update scores for existing ones. Matches are matched by home_team + away_team within the selected tournament.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Tournament</label>
                <select value={csvTournament} onChange={e => setCsvTournament(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="">Select tournament…</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">CSV File</label>
                <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-rz-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-rz-red/10 file:text-rz-red hover:file:bg-rz-red/20" />
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleCsvImport} disabled={csvImporting || !csvFile || !csvTournament}
                  className="bg-rz-red text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
                  {csvImporting ? "Importing..." : "Import CSV"}
                </button>
                <button onClick={downloadCsvTemplate}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-rz-border-strong text-rz-text-secondary hover:bg-rz-surface-2 transition">
                  {csvTournament ? "Export Current Matches" : "Download Empty Template"}
                </button>
              </div>
            </div>

            {csvResult && (
              <div className={`mt-4 p-4 rounded-lg text-sm ${csvResult.errors.length > 0 && csvResult.created === 0 && csvResult.scores_set === 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-rz-red/10"}`}>
                {(csvResult.created > 0 || csvResult.scores_set > 0) && (
                  <p className="font-medium text-rz-red mb-1">
                    ✅ Created: {csvResult.created} matches · Scores updated: {csvResult.scores_set}
                  </p>
                )}
                {csvResult.errors.length > 0 && (
                  <div>
                    <p className="font-medium text-red-600 mb-1">⚠️ {csvResult.errors.length} error{csvResult.errors.length > 1 ? "s" : ""}:</p>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {csvResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-500">· {e}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CSV Format Reference */}
          <div className="bg-rz-surface rounded-xl shadow p-6">
            <h3 className="font-bold text-sm mb-3">CSV Format</h3>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-rz-border">
                    <th className="text-left py-1.5 px-2 font-semibold text-rz-text-secondary">Column</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-rz-text-secondary">Required</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-rz-text-secondary">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  <tr><td className="py-1.5 px-2 font-mono">home_team</td><td className="py-1.5 px-2">✅</td><td className="py-1.5 px-2 text-rz-text-muted">Team code (e.g. LDA) or full name</td></tr>
                  <tr><td className="py-1.5 px-2 font-mono">away_team</td><td className="py-1.5 px-2">✅</td><td className="py-1.5 px-2 text-rz-text-muted">Team code or full name</td></tr>
                  <tr><td className="py-1.5 px-2 font-mono">kickoff_utc</td><td className="py-1.5 px-2">✅*</td><td className="py-1.5 px-2 text-rz-text-muted">ISO 8601 datetime (required for new matches)</td></tr>
                  <tr><td className="py-1.5 px-2 font-mono">stage</td><td className="py-1.5 px-2">✅*</td><td className="py-1.5 px-2 text-rz-text-muted">Stage name (required for new, auto-created)</td></tr>
                  <tr><td className="py-1.5 px-2 font-mono">venue</td><td className="py-1.5 px-2">–</td><td className="py-1.5 px-2 text-rz-text-muted">Stadium name</td></tr>
                  <tr><td className="py-1.5 px-2 font-mono">home_score</td><td className="py-1.5 px-2">–</td><td className="py-1.5 px-2 text-rz-text-muted">Home team score (for setting results)</td></tr>
                  <tr><td className="py-1.5 px-2 font-mono">away_score</td><td className="py-1.5 px-2">–</td><td className="py-1.5 px-2 text-rz-text-muted">Away team score (for setting results)</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-rz-text-muted mt-2">* Only required when creating new matches. To update scores only, just provide home_team, away_team, home_score, away_score.</p>
          </div>
        </div>
      )}

      {/* ═══ TAB: SYNC ═══ */}
      {tab === "sync" && (
        <div className="space-y-4">
          {/* UNAFUT Sync */}
          <div className="bg-rz-surface rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-2">🇨🇷 Sync UNAFUT (Costa Rica)</h2>
            <p className="text-xs text-rz-text-muted mb-4">
              Scrapes match schedules and scores from unafut.com/calendario/. Runs automatically once a day.
            </p>
            <button onClick={handleUnafutSync} disabled={unafutSyncing}
              className="bg-rz-red text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
              {unafutSyncing ? "Syncing..." : "Sync Now"}
            </button>
            {unafutResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${unafutResult.error ? "bg-red-50 dark:bg-red-900/20" : "bg-rz-red/10"}`}>
                {unafutResult.error ? (
                  <p className="text-red-600">❌ {unafutResult.error}</p>
                ) : (
                  <div className="text-rz-red">
                    <p className="font-medium">✅ Sync complete</p>
                    <p className="text-xs mt-1">
                      Scraped: {unafutResult.scraped} · Created: {unafutResult.created} · Updated: {unafutResult.updated} · Results added: {unafutResult.results_added} · Unchanged: {unafutResult.unchanged}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Football-Data.org Sync */}
          <div className="bg-rz-surface rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">Sync from Football-Data.org</h2>
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Competition ID</label>
                <input value={syncCompId} onChange={e => setSyncCompId(e.target.value)} placeholder="WC, CL, PL…"
                  className="rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm w-32" />
              </div>
              <button onClick={handleSyncPreview} disabled={syncLoading}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {syncLoading ? "Fetching..." : "Fetch Matches"}
              </button>
            </div>
          </div>

          {syncMatches.length > 0 && (
            <div className="bg-rz-surface rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">
                  {syncMatches.length} matches found · {syncMatches.filter(m => m.selected).length} selected
                </h3>
                <div className="flex gap-2">
                  <button onClick={selectAllSync} className="text-xs text-rz-red hover:underline">Select all</button>
                  <button onClick={deselectAllSync} className="text-xs text-rz-text-muted hover:underline">Deselect all</button>
                </div>
              </div>

              {/* Import target */}
              <div className="grid grid-cols-2 gap-4 mb-4 bg-rz-surface-2 rounded-lg p-3">
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Import into Tournament</label>
                  <select value={syncTournament} onChange={e => setSyncTournament(e.target.value)}
                    className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                    <option value="">Select…</option>
                    {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Stage</label>
                  <select value={syncStage} onChange={e => setSyncStage(e.target.value)}
                    className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                    <option value="">Select…</option>
                    {syncFilteredStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Match list */}
              <div className="max-h-96 overflow-y-auto space-y-1">
                {syncMatches.map((m, idx) => (
                  <label key={idx}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                      m.selected ? "bg-rz-red/10 ring-1 ring-rz-red/40" : "hover:bg-rz-surface-2/50"
                    }`}>
                    <input type="checkbox" checked={m.selected} onChange={() => toggleSyncMatch(idx)}
                      className="rounded border-rz-border-strong text-rz-red focus:ring-rz-red" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{m.home_team}</span>
                        <span className="text-rz-text-muted">vs</span>
                        <span className="font-medium">{m.away_team}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-rz-text-muted">
                        <span>{m.stage}{m.group ? ` · ${m.group}` : ""}{m.matchday ? ` · MD${m.matchday}` : ""}</span>
                        <span>·</span>
                        <span>{m.kickoff_utc ? new Date(m.kickoff_utc).toLocaleDateString() : "TBD"}</span>
                        <span className={`px-1 py-0.5 rounded ${statusColor(m.status.toLowerCase())}`}>{m.status}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <button onClick={handleImport} disabled={importing || !syncMatches.some(m => m.selected)}
                className="mt-4 bg-rz-red text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
                {importing ? "Importing…" : `Import ${syncMatches.filter(m => m.selected).length} matches`}
              </button>

              {syncResult && (
                <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm">
                  <p className="font-medium text-blue-700">✅ {syncResult.created} matches imported</p>
                  {syncResult.skipped.length > 0 && (
                    <div className="mt-1 text-xs text-rz-text-secondary">
                      <p className="font-medium">Skipped:</p>
                      {syncResult.skipped.map((s, i) => <p key={i}>· {s}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ EDIT MATCH MODAL ═══ */}
      {editMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditMatch(null)}>
          <div className="bg-rz-surface rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Edit Match</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Stage</label>
                <select value={emStage} onChange={e => setEmStage(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {stages.filter(s => s.tournament_id === editMatch.tournament_id).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Home Team</label>
                  <TeamSearchSelect
                    teams={editMatch.tournament_id ? teams.filter(t => t.tournament_ids.includes(editMatch.tournament_id)) : teams}
                    value={emHome} onChange={setEmHome} placeholder="Search home team…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Away Team</label>
                  <TeamSearchSelect
                    teams={editMatch.tournament_id ? teams.filter(t => t.tournament_ids.includes(editMatch.tournament_id)) : teams}
                    value={emAway} onChange={setEmAway} placeholder="Search away team…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Kickoff</label>
                  <input type="datetime-local" value={emKickoff} onChange={e => setEmKickoff(e.target.value)}
                    className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-rz-text-secondary mb-1">Venue</label>
                  <input value={emVenue} onChange={e => setEmVenue(e.target.value)} placeholder="Stadium"
                    className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Notes</label>
                <textarea value={emNotes} onChange={e => setEmNotes(e.target.value)} placeholder="Match notes / news (optional)"
                  rows={3} className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-secondary mb-1">Status</label>
                <select value={emStatus} onChange={e => setEmStatus(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm">
                  {["scheduled","live","finished","confirmed","postponed","cancelled"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleEditSave} disabled={saving}
                  className="bg-rz-red text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => setEditMatch(null)}
                  className="px-5 py-2 rounded-lg text-sm font-medium bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SCORE NUMPAD MODAL ═══ */}
      {editingId && (() => {
        const sm = matches.find(x => x.id === editingId);
        return sm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingId(null)}>
            <div className="bg-rz-surface rounded-2xl shadow-xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
              {/* Match header */}
              <div className="text-center mb-4">
                <p className="text-xs text-rz-text-muted mb-1">{sm.stage_name}</p>
                <p className="text-sm font-semibold">{sm.home_team} vs {sm.away_team}</p>
              </div>
              {/* Score display */}
              <div className="flex items-center justify-center gap-4 mb-5">
                <div className="text-center">
                  <p className="text-[10px] text-rz-text-muted mb-1">{sm.home_team}</p>
                  <button onClick={() => setScoreField("home")}
                    className={`w-16 h-14 text-center font-mono font-black text-3xl rounded-xl transition ${
                      scoreField === "home"
                        ? "bg-indigo-500 text-white ring-2 ring-indigo-400 shadow-lg"
                        : "bg-rz-surface-2 text-indigo-700 dark:text-indigo-300 border border-indigo-300"
                    }`}>
                    {homeScore || "0"}
                  </button>
                </div>
                <span className="text-rz-text-muted font-black text-2xl mt-4">:</span>
                <div className="text-center">
                  <p className="text-[10px] text-rz-text-muted mb-1">{sm.away_team}</p>
                  <button onClick={() => setScoreField("away")}
                    className={`w-16 h-14 text-center font-mono font-black text-3xl rounded-xl transition ${
                      scoreField === "away"
                        ? "bg-indigo-500 text-white ring-2 ring-indigo-400 shadow-lg"
                        : "bg-rz-surface-2 text-indigo-700 dark:text-indigo-300 border border-indigo-300"
                    }`}>
                    {awayScore || "0"}
                  </button>
                </div>
              </div>
              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => {
                    if (scoreField === "home") { setHomeScore(String(n)); setScoreField("away"); }
                    else { setAwayScore(String(n)); }
                  }}
                    className="h-12 rounded-xl bg-rz-surface border border-rz-border font-mono font-bold text-xl text-rz-text hover:bg-rz-surface-2 active:bg-rz-border transition shadow-sm">
                    {n}
                  </button>
                ))}
                <button onClick={() => { if (scoreField === "home") setHomeScore("0"); else setAwayScore("0"); }}
                  className="h-12 rounded-xl bg-red-900/30 border border-red-700 font-bold text-sm text-red-500 hover:bg-red-900/50 active:bg-red-900/60 transition shadow-sm">C</button>
                <button onClick={() => {
                  if (scoreField === "home") { setHomeScore("0"); setScoreField("away"); }
                  else { setAwayScore("0"); }
                }}
                  className="h-12 rounded-xl bg-rz-surface border border-rz-border font-mono font-bold text-xl text-rz-text hover:bg-rz-surface-2 active:bg-rz-border transition shadow-sm">0</button>
                <button onClick={() => setScoreField(scoreField === "home" ? "away" : "home")}
                  className="h-12 rounded-xl bg-rz-red/20 border border-rz-red/40 font-bold text-xs text-rz-red hover:bg-rz-red/30 active:bg-rz-red/40 transition shadow-sm">
                  {scoreField === "home" ? "Next →" : "← Back"}
                </button>
              </div>
              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => handleSetResult(editingId)} disabled={busy}
                  className="flex-1 bg-rz-red text-white py-2.5 rounded-xl text-sm font-bold hover:bg-rz-red-hover disabled:opacity-50 transition">
                  {busy ? "Saving…" : "Save Score"}
                </button>
                {sm.home_score != null && (
                  <button onClick={() => handleClearResult(editingId)} disabled={busy}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-200 disabled:opacity-50 transition">
                    Clear
                  </button>
                )}
                <button onClick={() => setEditingId(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}

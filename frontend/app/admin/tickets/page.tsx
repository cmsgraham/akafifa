"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { Loader } from "@/lib/loader";

/* ── Types ── */

interface Ticket {
  id: string;
  user_id: string;
  user_email: string;
  display_name: string | null;
  subject: string;
  body: string;
  category: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

interface Stats {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-rz-text-muted/20 text-rz-text-muted border-rz-text-muted/30",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  bug: "Bug",
  account: "Account",
  scoring: "Scoring",
  suggestion: "Suggestion",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Page ── */

export default function AdminTicketsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Reply state
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState("resolved");
  const [saving, setSaving] = useState(false);

  const perPage = 20;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      const res = await apiFetch<{ data: Ticket[]; total: number }>(
        `/admin/tickets?${params}`
      );
      setTickets(res.data);
      setTotal(res.total);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [filter, page]);

  const fetchStats = async () => {
    try {
      const s = await apiFetch<Stats>("/admin/tickets/stats");
      setStats(s);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchTickets();
      fetchStats();
    }
  }, [user, fetchTickets]);

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/tickets/${ticketId}`, {
        method: "PUT",
        body: JSON.stringify({ reply: replyText, status: replyStatus }),
      });
      setReplyingId(null);
      setReplyText("");
      setReplyStatus("resolved");
      await Promise.all([fetchTickets(), fetchStats()]);
    } catch {
      alert("Failed to save reply");
    }
    setSaving(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-rz-text-muted">Access Denied</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Support Tickets</h1>
          <Link href="/admin" className="text-xs text-rz-text-muted hover:text-rz-red transition">
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(filter === s ? "" : s); setPage(1); }}
              className={`rounded-xl border p-3 text-center transition ${
                filter === s
                  ? STATUS_COLORS[s]
                  : "bg-rz-surface border-rz-border hover:border-rz-border-hover"
              }`}
            >
              <p className="text-2xl font-bold">{stats[s]}</p>
              <p className="text-[10px] uppercase tracking-wide font-semibold opacity-70">
                {STATUS_LABELS[s]}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Tickets */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-rz-text-muted text-sm">
          {filter ? "No tickets with this status" : "No tickets yet"}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const isReplying = replyingId === t.id;
            return (
              <div
                key={t.id}
                className="bg-rz-surface border border-rz-border rounded-2xl overflow-hidden"
              >
                <div className="px-4 py-3">
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}
                        >
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                        <span className="text-[10px] text-rz-text-muted capitalize px-1.5 py-0.5 bg-rz-surface-2 rounded">
                          {CATEGORY_LABELS[t.category] || t.category}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{t.subject}</p>
                      <p className="text-[10px] text-rz-text-muted mt-0.5">
                        <Link href={`/users/${t.user_id}`} className="text-rz-red hover:underline">
                          {t.display_name || t.user_email}
                        </Link>
                        {" · "}
                        {fmtDate(t.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (isReplying) {
                          setReplyingId(null);
                        } else {
                          setReplyingId(t.id);
                          setReplyText(t.admin_reply || "");
                          setReplyStatus(t.status === "open" ? "resolved" : t.status);
                        }
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-rz-surface-2 text-rz-text-secondary hover:text-rz-text font-medium transition shrink-0"
                    >
                      {isReplying ? "Close" : "Reply"}
                    </button>
                  </div>

                  {/* Body */}
                  <div className="mt-2 bg-rz-bg rounded-xl px-3 py-2">
                    <p className="text-xs text-rz-text-secondary whitespace-pre-wrap">
                      {t.body}
                    </p>
                  </div>

                  {/* Existing reply */}
                  {t.admin_reply && !isReplying && (
                    <div className="mt-2 bg-rz-red/5 border border-rz-red/10 rounded-xl px-3 py-2">
                      <p className="text-[10px] font-semibold text-rz-red mb-0.5">Admin Reply</p>
                      <p className="text-xs text-rz-text-secondary whitespace-pre-wrap">
                        {t.admin_reply}
                      </p>
                    </div>
                  )}

                  {/* Reply form */}
                  {isReplying && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={3}
                        placeholder="Type your reply..."
                        className="w-full bg-rz-bg border border-rz-border rounded-xl px-3 py-2 text-xs text-rz-text placeholder:text-rz-text-muted focus:outline-none focus:ring-1 focus:ring-rz-red resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <select
                          value={replyStatus}
                          onChange={(e) => setReplyStatus(e.target.value)}
                          className="bg-rz-bg border border-rz-border rounded-lg px-2 py-1.5 text-xs text-rz-text focus:outline-none focus:ring-1 focus:ring-rz-red"
                        >
                          <option value="open">Keep Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                        <button
                          onClick={() => handleReply(t.id)}
                          disabled={saving || !replyText.trim()}
                          className="px-4 py-1.5 rounded-lg bg-rz-red text-white text-xs font-bold hover:bg-red-600 disabled:opacity-50 transition"
                        >
                          {saving ? "Saving..." : "Send Reply"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg bg-rz-surface border border-rz-border text-xs disabled:opacity-30 hover:bg-rz-surface-2 transition"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-xs text-rz-text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-rz-surface border border-rz-border text-xs disabled:opacity-30 hover:bg-rz-surface-2 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Loader } from "@/lib/loader";
import { TicketIcon, PlusIcon, XMarkIcon } from "@/lib/icons";

/* ── Types ── */

interface Ticket {
  id: string;
  subject: string;
  body: string;
  category: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "general", label: "General Question" },
  { value: "bug", label: "Bug Report" },
  { value: "account", label: "Account Issue" },
  { value: "scoring", label: "Scoring / Points" },
  { value: "suggestion", label: "Suggestion" },
];

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-500/20 text-yellow-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  resolved: "bg-green-500/20 text-green-400",
  closed: "bg-rz-text-muted/20 text-rz-text-muted",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Page ── */

export default function HelpPage() {
  const { user, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchTickets = async () => {
    try {
      const res = await apiFetch<{ data: Ticket[] }>("/me/tickets");
      setTickets(res.data);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchTickets();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiFetch("/me/tickets", {
        method: "POST",
        body: JSON.stringify({ subject, body, category }),
      });
      setSubject("");
      setBody("");
      setCategory("general");
      setShowForm(false);
      await fetchTickets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit ticket");
    }
    setSubmitting(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-rz-red" />
            Help Center
          </h1>
          <p className="text-xs text-rz-text-muted mt-1">
            Submit a ticket and we&apos;ll get back to you
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rz-red text-white text-xs font-bold hover:bg-red-600 transition"
        >
          {showForm ? (
            <>
              <XMarkIcon className="w-4 h-4" /> Cancel
            </>
          ) : (
            <>
              <PlusIcon className="w-4 h-4" /> New Ticket
            </>
          )}
        </button>
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-rz-surface border border-rz-border rounded-2xl p-5 mb-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-rz-text-secondary mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-rz-bg border border-rz-border rounded-xl px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-1 focus:ring-rz-red"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-rz-text-secondary mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              maxLength={200}
              required
              className="w-full bg-rz-bg border border-rz-border rounded-xl px-3 py-2 text-sm text-rz-text placeholder:text-rz-text-muted focus:outline-none focus:ring-1 focus:ring-rz-red"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-rz-text-secondary mb-1.5">
              Description
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={4}
              maxLength={5000}
              required
              className="w-full bg-rz-bg border border-rz-border rounded-xl px-3 py-2 text-sm text-rz-text placeholder:text-rz-text-muted focus:outline-none focus:ring-1 focus:ring-rz-red resize-none"
            />
            <p className="text-[10px] text-rz-text-muted text-right mt-0.5">
              {body.length}/5000
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || subject.length < 3 || body.length < 10}
            className="w-full py-2.5 rounded-xl bg-rz-red text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition"
          >
            {submitting ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>
      )}

      {/* Tickets List */}
      {tickets.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <TicketIcon className="w-12 h-12 text-rz-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-sm text-rz-text-muted">No tickets yet</p>
          <p className="text-xs text-rz-text-muted mt-1">
            Need help? Click &quot;New Ticket&quot; to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const expanded = expandedId === t.id;
            return (
              <div
                key={t.id}
                className="bg-rz-surface border border-rz-border rounded-2xl overflow-hidden transition hover:border-rz-border-hover"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] || STATUS_COLORS.open}`}
                      >
                        {STATUS_LABELS[t.status] || t.status}
                      </span>
                      <span className="text-[10px] text-rz-text-muted capitalize">
                        {t.category}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{t.subject}</p>
                    <p className="text-[10px] text-rz-text-muted mt-0.5">
                      {timeAgo(t.created_at)}
                    </p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-rz-text-muted shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                  </svg>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-rz-border pt-3 space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold text-rz-text-muted uppercase tracking-wide mb-1">
                        Your Message
                      </p>
                      <p className="text-xs text-rz-text-secondary whitespace-pre-wrap">
                        {t.body}
                      </p>
                    </div>

                    {t.admin_reply && (
                      <div className="bg-rz-surface-2 rounded-xl p-3">
                        <p className="text-[10px] font-semibold text-rz-red uppercase tracking-wide mb-1">
                          Admin Reply
                        </p>
                        <p className="text-xs text-rz-text whitespace-pre-wrap">
                          {t.admin_reply}
                        </p>
                        {t.replied_at && (
                          <p className="text-[10px] text-rz-text-muted mt-1">
                            {timeAgo(t.replied_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

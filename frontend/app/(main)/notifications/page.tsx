"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { MobilePageHeader } from "../MobilePageHeader";
import { Loader } from "@/lib/loader";

interface Notification {
  id: string;
  category: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  status: string;
  action_url: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "social", label: "Social" },
  { value: "match", label: "Matches" },
  { value: "duel", label: "Duels" },
  { value: "challenge", label: "Challenges" },
  { value: "system", label: "System" },
];

const categoryIcon = (cat: string) => {
  switch (cat) {
    case "social": return "";
    case "duel": return "";
    case "challenge": return "";
    case "match": return "";
    case "system": return "";
    default: return "";
  }
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [category, setCategory] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async (cat: string, cur: string | null, append: boolean) => {
    setLoading(true);
    try {
      let url = `/me/notifications?limit=30`;
      if (cat) url += `&category=${cat}`;
      if (cur) url += `&cursor=${encodeURIComponent(cur)}`;
      const data = await apiFetch<{ data: Notification[]; pagination: { next_cursor: string | null; has_more: boolean } }>(url);
      setNotifications((prev) => append ? [...prev, ...data.data] : data.data);
      setCursor(data.pagination.next_cursor);
      setHasMore(data.pagination.has_more);
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(category, null, false);
  }, [category, load]);

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/me/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)));
    } catch {
      // silently fail
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch("/me/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
    } catch {
      // silently fail
    }
  };

  const handleClick = (n: Notification) => {
    if (n.status === "unread") markRead(n.id);
    if (n.action_url) router.push(n.action_url);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <div className="max-w-2xl mx-auto">
      <MobilePageHeader title="Notifications" backHref="/home" backLabel="Home" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-rz-text">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-rz-red hover:text-rz-red-hover font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              category === c.value
                ? "bg-rz-red/10 text-rz-red"
                : "bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-1 bg-rz-surface rounded-xl border border-rz-border overflow-hidden">
        {notifications.length === 0 && !loading ? (
          <div className="py-12 text-center text-sm text-rz-text-muted">No notifications</div>
        ) : (
          notifications.map((n) => {
            const isUnread = n.status === "unread";
            const isHigh = n.priority === "high";
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-rz-surface-2 transition border-b border-rz-border last:border-0 ${
                  isUnread ? "bg-rz-red/5" : ""
                }`}
              >
                <span className="text-lg shrink-0 mt-0.5">{categoryIcon(n.category)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isUnread ? "text-rz-text" : "text-rz-text-secondary"}`}>
                      {n.title}
                    </span>
                    {isHigh && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 font-medium">!</span>}
                    {isUnread && <span className="w-2 h-2 rounded-full bg-rz-red shrink-0" />}
                  </div>
                  <p className="text-sm text-rz-text-secondary mt-0.5">{n.message}</p>
                  <span className="text-xs text-rz-text-muted mt-1 block">{timeAgo(n.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={() => load(category, cursor, true)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-rz-red hover:text-rz-red-hover disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {loading && notifications.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader />
        </div>
      )}
    </div>
  );
}

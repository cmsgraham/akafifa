"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  created_at: string;
  read_at: string | null;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ unread_count: number }>("/me/notifications/unread-count");
      setUnreadCount(data.unread_count);
    } catch {
      // silently fail
    }
  }, []);

  // Poll every 30s
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: Notification[] }>("/me/notifications?limit=10");
      setNotifications(data.data);
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  const toggleDropdown = () => {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  };

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/me/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silently fail
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch("/me/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 rounded-lg hover:bg-rz-surface-2 transition"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-rz-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-rz-red rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-rz-surface border border-rz-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-rz-border">
            <span className="text-sm font-semibold text-rz-text">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-rz-red hover:text-rz-red-hover font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader size="sm" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-rz-text-muted">No notifications yet</div>
            ) : (
              notifications.map((n) => {
                const isUnread = n.status === "unread";
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (isUnread) markRead(n.id);
                      setOpen(false);
                      if (n.action_url) router.push(n.action_url);
                    }}
                    className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-rz-surface-2/50 transition ${
                      isUnread ? "bg-rz-red/5" : ""
                    }`}
                  >
                    <span className="text-lg shrink-0 mt-0.5">{categoryIcon(n.category)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${isUnread ? "text-rz-text" : "text-rz-text-secondary"}`}>
                          {n.title}
                        </span>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-rz-red shrink-0" />}
                      </div>
                      <p className="text-xs text-rz-text-muted line-clamp-2 mt-0.5">{n.message}</p>
                      <span className="text-[10px] text-rz-text-muted mt-1">{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-sm text-rz-red hover:text-rz-red-hover font-medium py-3 border-t border-rz-border"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

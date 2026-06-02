"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Loader } from "@/lib/loader";

interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export default function AdminAuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLogs = useCallback(async (cursor?: string | null) => {
    const params = new URLSearchParams({ limit: "30" });
    if (cursor) params.set("cursor", cursor);
    return apiFetch<{
      data: AuditLog[];
      pagination: { next_cursor: string | null; has_more: boolean };
    }>(`/admin/audit-logs?${params}`);
  }, []);

  useEffect(() => {
    fetchLogs()
      .then((res) => {
        setLogs(res.data);
        setHasMore(res.pagination.has_more);
        setNextCursor(res.pagination.next_cursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchLogs]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchLogs(nextCursor);
      setLogs((prev) => [...prev, ...res.data]);
      setHasMore(res.pagination.has_more);
      setNextCursor(res.pagination.next_cursor);
    } catch {}
    setLoadingMore(false);
  };

  const actionColor = (action: string) => {
    if (action.includes("delete")) return "text-red-600 bg-red-50 dark:bg-red-900/20";
    if (action.includes("create")) return "text-rz-red bg-rz-red/10";
    if (action.includes("change_role")) return "text-purple-600 bg-purple-50 dark:bg-purple-900/20";
    return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
  };

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-rz-text-secondary">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <Link href="/admin" className="text-sm text-rz-red hover:underline">
          ← Admin
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-rz-text-muted">No audit logs yet.</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-rz-surface rounded-lg shadow px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${actionColor(
                    log.action
                  )}`}
                >
                  {log.action}
                </span>
                {log.resource_type && (
                  <span className="text-[10px] text-rz-text-muted">
                    {log.resource_type}
                    {log.resource_id && ` · ${log.resource_id.slice(0, 8)}…`}
                  </span>
                )}
                <span className="text-[10px] text-rz-text-muted ml-auto">
                  {timeAgo(log.created_at)}
                </span>
              </div>
              {(log.before_state || log.after_state) && (
                <div className="mt-2 flex gap-4 text-[10px]">
                  {log.before_state && (
                    <div className="bg-red-50 dark:bg-red-900/10 rounded px-2 py-1">
                      <span className="text-red-500 font-medium">Before: </span>
                      {JSON.stringify(log.before_state)}
                    </div>
                  )}
                  {log.after_state && (
                    <div className="bg-rz-red/10 rounded px-2 py-1">
                      <span className="text-rz-red font-medium">After: </span>
                      {JSON.stringify(log.after_state)}
                    </div>
                  )}
                </div>
              )}
              {log.actor_id && (
                <span className="text-[9px] text-rz-text-muted mt-1 block">
                  by {log.actor_name || log.actor_id.slice(0, 8) + "…"}
                </span>
              )}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-sm text-rz-red hover:bg-rz-red/10 rounded-xl transition disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

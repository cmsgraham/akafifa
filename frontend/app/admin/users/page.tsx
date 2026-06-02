"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/lib/avatar";
import { Loader } from "@/lib/loader";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  display_name: string;
  total_points: number;
  prediction_points: number;
  challenge_points: number;
  duel_points: number;
  created_at: string;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (roleFilter) params.set("role", roleFilter);
      params.set("limit", "100");
      const res = await apiFetch<{ data: AdminUser[]; total: number }>(
        `/admin/users?${params}`
      );
      setUsers(res.data);
      setTotal(res.total);
    } catch {}
    setLoading(false);
  }, [search, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Change this user's role to "${newRole}"?`)) return;
    setBusy(userId);
    try {
      await apiFetch(`/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    }
    setBusy(null);
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    if (busy) return;
    setBusy(userId);
    const target = !currentActive;
    try {
      const res = await apiFetch<{ is_active: boolean }>(
        `/admin/users/${userId}/toggle-active`,
        { method: "PUT", body: JSON.stringify({ is_active: target }) }
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_active: res.is_active } : u
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to toggle status");
    }
    setBusy(null);
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-rz-text-secondary">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Link href="/admin" className="text-sm text-rz-red hover:underline">
          ← Admin
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name…"
          className="flex-1 rounded-lg border border-rz-border-strong bg-rz-surface px-4 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm text-rz-text"
        >
          <option value="">All roles</option>
          <option value="admin">Admins</option>
          <option value="user">Users</option>
        </select>
      </div>

      <p className="text-xs text-rz-text-muted mb-3">{total} users total</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-rz-text-muted">No users found.</div>
      ) : (
        <div className="bg-rz-surface rounded-xl border border-rz-border overflow-hidden">
          {/* Desktop table */}
          <table className="w-full text-sm hidden md:table">
            <thead>
              <tr className="bg-rz-surface-2 text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium text-center">Points</th>
                <th className="px-4 py-3 font-medium text-center">Role</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rz-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-rz-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.display_name} size="md" />
                      <span className="font-medium">{u.display_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-rz-text-muted text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-center font-mono">
                    <span className="font-bold">{u.total_points}</span>
                    {(u.challenge_points > 0 || u.duel_points > 0) && (
                      <div className="text-[10px] text-rz-text-muted mt-0.5">
                        {u.prediction_points}p
                        {u.challenge_points > 0 && <span className="text-purple-400 ml-1">+{u.challenge_points}c</span>}
                        {u.duel_points > 0 && <span className="text-blue-400 ml-1">+{u.duel_points}d</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                          : "bg-rz-surface text-rz-text-secondary"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.is_active
                          ? "bg-rz-red/15 text-rz-red"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      }`}
                    >
                      {u.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.id === user?.id ? (
                      <span className="text-[10px] text-rz-text-muted">You</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() =>
                            handleRoleChange(
                              u.id,
                              u.role === "admin" ? "user" : "admin"
                            )
                          }
                          disabled={busy === u.id}
                          className="text-[10px] px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition disabled:opacity-50"
                        >
                          {u.role === "admin" ? "Demote" : "Promote"}
                        </button>
                        <button
                          onClick={() => handleToggleActive(u.id, u.is_active)}
                          disabled={busy === u.id}
                          className={`text-[10px] px-2 py-1 rounded transition disabled:opacity-50 ${
                            u.is_active
                              ? "bg-red-900/20 text-red-400 hover:bg-red-900/30"
                              : "bg-rz-red/10 text-rz-red hover:bg-rz-red/20"
                          }`}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-rz-border">
            {users.map((u) => (
              <div key={u.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.display_name} />
                    <div>
                      <p className="font-medium text-sm">{u.display_name}</p>
                      <p className="text-xs text-rz-text-muted">{u.email}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm">{u.total_points} pts</span>
                  {(u.challenge_points > 0 || u.duel_points > 0) && (
                    <span className="text-[10px] text-rz-text-muted ml-1">
                      ({u.prediction_points}p{u.challenge_points > 0 ? `+${u.challenge_points}c` : ""}{u.duel_points > 0 ? `+${u.duel_points}d` : ""})
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                          : "bg-rz-surface text-rz-text-secondary"
                      }`}
                    >
                      {u.role}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.is_active
                          ? "bg-rz-red/15 text-rz-red"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      }`}
                    >
                      {u.is_active ? "active" : "inactive"}
                    </span>
                  </div>
                  {u.id === user?.id ? (
                    <span className="text-xs text-rz-text-muted">You</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleRoleChange(u.id, u.role === "admin" ? "user" : "admin")
                        }
                        disabled={busy === u.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition disabled:opacity-50"
                      >
                        {u.role === "admin" ? "Demote" : "Promote"}
                      </button>
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        disabled={busy === u.id}
                        className={`text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                          u.is_active
                            ? "bg-red-900/20 text-red-400 hover:bg-red-900/30"
                            : "bg-rz-red/10 text-rz-red hover:bg-rz-red/20"
                        }`}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

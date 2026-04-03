"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const ADMIN_LINKS = [
  { href: "/admin/users", label: "Users", icon: "👥", desc: "Manage user accounts and roles" },
  { href: "/admin/matches", label: "Matches", icon: "⚽", desc: "Manage matches and scores" },
  { href: "/admin/challenges", label: "Flash Challenges", icon: "⚡", desc: "Create and manage challenges" },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: "📋", desc: "View system activity logs" },
];

export default function AdminDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-500 mb-2">Access Denied</p>
          <Link href="/tournaments" className="text-green-600 hover:underline text-sm">
            ← Back to app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Link href="/tournaments" className="text-sm text-green-600 hover:underline">
          ← Back to app
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:ring-2 hover:ring-green-500 transition block"
          >
            <span className="text-2xl">{link.icon}</span>
            <h3 className="font-bold text-lg mt-2">{link.label}</h3>
            <p className="text-sm text-gray-500 mt-1">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Loader } from "@/lib/loader";

const ADMIN_LINKS = [
  { href: "/admin/users", label: "Users", desc: "Manage user accounts and roles" },
  { href: "/admin/matches", label: "Matches", desc: "Manage matches and scores" },
  { href: "/admin/challenges", label: "Flash Challenges", desc: "Create and manage challenges" },
  { href: "/admin/audit-logs", label: "Audit Logs", desc: "View system activity logs" },
  { href: "/admin/reports", label: "Reports", desc: "Analytics, engagement, and user point audits" },
  { href: "/admin/tickets", label: "Support Tickets", desc: "View and respond to user help requests" },
];

export default function AdminDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-rz-text-muted mb-2">Access Denied</p>
          <Link href="/home" className="text-rz-red hover:underline text-sm">
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
        <Link href="/home" className="text-sm text-rz-red hover:underline">
          ← Back to app
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-rz-surface rounded-xl border border-rz-border p-6 hover:ring-2 hover:ring-rz-red transition block"
          >
            <span className="text-2xl"> </span>
            <h3 className="font-bold text-lg mt-2">{link.label}</h3>
            <p className="text-sm text-rz-text-muted mt-1">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

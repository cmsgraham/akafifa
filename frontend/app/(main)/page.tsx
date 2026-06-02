"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { DASHBOARD } from "@/constants/strings";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{DASHBOARD.TITLE}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/home"
          className="rounded-xl border border-rz-border p-6 hover:bg-rz-surface-2 transition-colors"
        >
          <h2 className="text-lg font-semibold">{DASHBOARD.TOURNAMENTS}</h2>
          <p className="text-sm text-rz-text-secondary">
            View upcoming matches and make predictions.
          </p>
        </Link>

        <Link
          href="/leaderboard"
          className="rounded-xl border border-rz-border p-6 hover:bg-rz-surface-2 transition-colors"
        >
          <h2 className="text-lg font-semibold">{DASHBOARD.LEADERBOARD}</h2>
          <p className="text-sm text-rz-text-secondary">
            Check the standings and see who's on top.
          </p>
        </Link>

        <Link
          href="/duels"
          className="rounded-xl border border-rz-border p-6 hover:bg-rz-surface-2 transition-colors"
        >
          <h2 className="text-lg font-semibold">{DASHBOARD.DUELS}</h2>
          <p className="text-sm text-rz-text-secondary">
            Challenge your colleagues to head-to-head predictions.
          </p>
        </Link>

        <Link
          href="/challenges"
          className="rounded-xl border border-rz-border p-6 hover:bg-rz-surface-2 transition-colors"
        >
          <h2 className="text-lg font-semibold">{DASHBOARD.CHALLENGES}</h2>
          <p className="text-sm text-rz-text-secondary">
            Answer flash challenges for bonus points.
          </p>
        </Link>

        <Link
          href="/profile"
          className="rounded-xl border border-rz-border p-6 hover:bg-rz-surface-2 transition-colors"
        >
          <h2 className="text-lg font-semibold">{DASHBOARD.PROFILE}</h2>
          <p className="text-sm text-rz-text-secondary">
            Manage your profile, avatar, and preferences.
          </p>
        </Link>
      </div>
    </div>
  );
}

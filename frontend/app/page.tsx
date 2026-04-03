"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP, AUTH } from "@/constants/strings";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/tournaments");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <span className="text-xl font-bold text-green-600">⚽ {APP.name}</span>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            {AUTH.signIn}
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
          >
            {AUTH.signUp}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-4">
          {APP.name}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-lg">
          {APP.tagline}. Predict scores, climb the leaderboard, challenge your friends, and prove you know the beautiful game.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/register"
            className="px-8 py-3 text-lg font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 transition shadow-lg"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 text-lg font-semibold rounded-xl border-2 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition"
          >
            {AUTH.signIn}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto px-6 pb-16">
        <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow">
          <h3 className="font-bold text-lg mb-2">🏆 Predict &amp; Score</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Submit predictions for every match and earn points for correct outcomes and exact scores.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow">
          <h3 className="font-bold text-lg mb-2">⚔️ Duel Friends</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Challenge your friends to head-to-head prediction duels across matches.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow">
          <h3 className="font-bold text-lg mb-2">📊 Live Leaderboard</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Track your ranking in real-time on global and stage-based leaderboards.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-gray-500 border-t border-gray-200 dark:border-gray-800">
        © 2025 {APP.name}
      </footer>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP, AUTH } from "@/constants/strings";
import { Loader } from "@/lib/loader";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-rz-bg">
        <Loader />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-rz-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-rz-border">
        <Link href="/">
          <img src="/redzone-logo-horizontal.png" alt="REDZONE" className="h-8 object-contain hidden dark:block" />
          <img src="/redzone-logo-horizontal-light.png" alt="REDZONE" className="h-8 object-contain dark:hidden" />
        </Link>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-rz-border-strong text-rz-text-secondary hover:bg-rz-surface transition"
          >
            {AUTH.signIn}
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-rz-red text-white hover:bg-rz-red-hover transition"
          >
            {AUTH.signUp}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <img src="/redzone-logo-stacked.png" alt="REDZONE" className="h-48 sm:h-64 object-contain mb-6 hidden dark:block" />
        <img src="/redzone-logo-stacked-light.png" alt="REDZONE" className="h-48 sm:h-64 object-contain mb-6 dark:hidden" />
        <p className="text-lg text-rz-text-secondary mb-2 font-semibold tracking-wide uppercase">
          {APP.tagline}
        </p>
        <p className="text-base text-rz-text-muted mb-8 max-w-lg">
          Predict scores, climb the leaderboard, challenge your friends, and prove you know the beautiful game.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/register"
            className="px-8 py-3 text-lg font-semibold rounded-xl bg-rz-red text-white hover:bg-rz-red-hover transition shadow-lg shadow-rz-red/20"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 text-lg font-semibold rounded-xl border-2 border-rz-red text-rz-red hover:bg-rz-red/10 transition"
          >
            {AUTH.signIn}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto px-6 pb-16">
        <div className="p-6 rounded-xl bg-rz-surface border border-rz-border">
          <h3 className="font-bold text-lg mb-2 text-rz-text">Predict & Score</h3>
          <p className="text-sm text-rz-text-secondary">
            Submit predictions for every match and earn points for correct outcomes and exact scores.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-rz-surface border border-rz-border">
          <h3 className="font-bold text-lg mb-2 text-rz-text">Duel Friends</h3>
          <p className="text-sm text-rz-text-secondary">
            Challenge your friends to head-to-head prediction duels across matches.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-rz-surface border border-rz-border">
          <h3 className="font-bold text-lg mb-2 text-rz-text">Live Leaderboard</h3>
          <p className="text-sm text-rz-text-secondary">
            Track your ranking in real-time on global and stage-based leaderboards.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-rz-text-muted border-t border-rz-border">
        © 2025 {APP.name}
      </footer>
    </main>
  );
}

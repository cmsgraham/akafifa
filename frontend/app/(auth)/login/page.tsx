"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AUTH, APP } from "@/constants/strings";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/home");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-rz-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="block">
            <img src="/redzone-logo-horizontal.png" alt="REDZONE" className="w-full object-contain hidden dark:block" />
            <img src="/redzone-logo-horizontal-light.png" alt="REDZONE" className="w-full object-contain dark:hidden" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-rz-text">{AUTH.signIn}</h1>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1 text-rz-text">
              {AUTH.email}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1 text-rz-text">
              {AUTH.password}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-rz-red px-4 py-2 text-sm font-semibold text-white hover:bg-rz-red-hover disabled:opacity-50 transition"
          >
            {submitting ? "Signing in…" : AUTH.signIn}
          </button>
        </form>

        <div className="text-center text-sm space-y-2">
          <Link href="/forgot-password" className="text-rz-red hover:underline">
            {AUTH.forgotPassword}
          </Link>
          <p className="text-rz-text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-rz-red hover:underline">
              {AUTH.signUp}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

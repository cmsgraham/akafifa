"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { APP, AUTH } from "@/constants/strings";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setLoading(false);
      setSent(true);
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
          <h1 className="mt-4 text-2xl font-bold text-rz-text">{AUTH.forgotPassword}</h1>
        </div>

        {sent ? (
          <div className="rounded-lg bg-rz-surface border border-rz-border p-4 text-center">
            <p className="text-sm text-rz-text-secondary">
              If an account with that email exists, we&apos;ve sent password reset instructions.
            </p>
            <Link href="/login" className="inline-block mt-3 text-sm text-rz-red hover:underline">
              ← Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-rz-text-muted text-center">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-rz-red px-4 py-2 text-sm font-semibold text-white hover:bg-rz-red-hover transition disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-rz-text-muted">
          Remember your password?{" "}
          <Link href="/login" className="text-rz-red hover:underline">
            {AUTH.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}

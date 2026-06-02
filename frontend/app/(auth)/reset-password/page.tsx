"use client";

import { useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { APP, AUTH } from "@/constants/strings";
import { apiFetch } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: password }),
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
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
          <h1 className="mt-4 text-2xl font-bold text-rz-text">{AUTH.resetPassword}</h1>
        </div>

        {done ? (
          <div className="rounded-lg bg-rz-surface border border-rz-border p-4 text-center">
            <p className="text-sm text-rz-text-secondary">
              Your password has been reset.
            </p>
            <Link href="/login" className="inline-block mt-3 text-sm text-rz-red hover:underline">
              Sign In →
            </Link>
          </div>
        ) : !token ? (
          <div className="rounded-lg bg-rz-surface border border-rz-border p-4 text-center">
            <p className="text-sm text-rz-text-secondary">
              Invalid or expired reset link.
            </p>
            <Link href="/forgot-password" className="inline-block mt-3 text-sm text-rz-red hover:underline">
              Request a new link →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-900/30 p-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1 text-rz-text">
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium mb-1 text-rz-text">
                Confirm Password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-rz-red px-4 py-2 text-sm font-semibold text-white hover:bg-rz-red-hover transition disabled:opacity-50"
            >
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center p-4 bg-rz-bg">
        <div className="text-rz-text-secondary text-sm">Loading…</div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

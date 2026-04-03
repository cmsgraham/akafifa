"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { APP, AUTH } from "@/constants/strings";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    // TODO: wire to backend when endpoint exists
    setDone(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-green-600">
            ⚽ {APP.name}
          </Link>
          <h1 className="mt-4 text-2xl font-bold">{AUTH.resetPassword}</h1>
        </div>

        {done ? (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-4 text-center">
            <p className="text-sm text-green-700 dark:text-green-400">
              Your password has been reset.
            </p>
            <Link href="/login" className="inline-block mt-3 text-sm text-green-600 hover:underline">
              Sign In →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium mb-1">
                Confirm Password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
            >
              Reset Password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

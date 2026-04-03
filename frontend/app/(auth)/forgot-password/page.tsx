"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { APP, AUTH } from "@/constants/strings";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: wire to backend when endpoint exists
    setSent(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-green-600">
            ⚽ {APP.name}
          </Link>
          <h1 className="mt-4 text-2xl font-bold">{AUTH.forgotPassword}</h1>
        </div>

        {sent ? (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-4 text-center">
            <p className="text-sm text-green-700 dark:text-green-400">
              If an account with that email exists, we&apos;ve sent password reset instructions.
            </p>
            <Link href="/login" className="inline-block mt-3 text-sm text-green-600 hover:underline">
              ← Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500 text-center">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                {AUTH.email}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
            >
              Send Reset Link
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500">
          Remember your password?{" "}
          <Link href="/login" className="text-green-600 hover:underline">
            {AUTH.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}

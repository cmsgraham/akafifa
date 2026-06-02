"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AUTH } from "@/constants/strings";

export default function RegisterPage() {
  const { sendVerificationCode, verifyAndRegister } = useAuth();
  const router = useRouter();

  // Step 1 state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Step 2 state
  const [step, setStep] = useState<"form" | "verify">("form");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-focus first code input when entering step 2
  useEffect(() => {
    if (step === "verify") inputRefs.current[0]?.focus();
  }, [step]);

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await sendVerificationCode(email, password, displayName, country);
      setStep("verify");
      setCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    if (value.length > 1) {
      // Handle paste of full code
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      digits.forEach((d, i) => { if (i < 6) next[i] = d; });
      setCode(next);
      const focusIdx = Math.min(digits.length, 5);
      inputRefs.current[focusIdx]?.focus();
    } else {
      next[index] = value;
      setCode(next);
      if (value && index < 5) inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      await verifyAndRegister(email, fullCode);
      router.push("/home");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setError("");
    try {
      await sendVerificationCode(email, password, displayName, country);
      setCooldown(60);
      setCode(["", "", "", "", "", ""]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResending(false);
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
          <h1 className="mt-4 text-2xl font-bold text-rz-text">
            {step === "form" ? AUTH.signUp : "Verify your email"}
          </h1>
          {step === "verify" && (
            <p className="mt-1 text-sm text-rz-text-muted">
              We sent a 6-digit code to <span className="text-rz-text font-medium">{email}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {step === "form" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium mb-1 text-rz-text">
                {AUTH.displayName}
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
                placeholder="Your display name"
              />
            </div>
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label htmlFor="country" className="block text-sm font-medium mb-1 text-rz-text">
                Country
              </label>
              <select
                id="country"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-lg border border-rz-border-strong bg-rz-surface px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
              >
                <option value="" disabled>Select your country</option>
                <option value="Argentina">Argentina</option>
                <option value="Brazil">Brazil</option>
                <option value="Colombia">Colombia</option>
                <option value="Costa Rica">Costa Rica</option>
                <option value="Mexico">Mexico</option>
                <option value="USA">USA</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-rz-red px-4 py-2 text-sm font-semibold text-white hover:bg-rz-red-hover disabled:opacity-50 transition"
            >
              {submitting ? "Sending code..." : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="flex justify-center gap-2">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={i === 0 ? 6 : 1}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  className="w-11 h-13 text-center text-xl font-bold rounded-lg border border-rz-border-strong bg-rz-surface text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red transition"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={verifying || code.join("").length !== 6}
              className="w-full rounded-lg bg-rz-red px-4 py-2 text-sm font-semibold text-white hover:bg-rz-red-hover disabled:opacity-50 transition"
            >
              {verifying ? "Verifying..." : "Verify & Create Account"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="text-sm text-rz-text-muted hover:text-rz-red disabled:opacity-50 transition"
              >
                {resending ? "Sending..." : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setStep("form"); setCode(["", "", "", "", "", ""]); setError(""); }}
              className="w-full text-center text-sm text-rz-text-muted hover:text-rz-text transition"
            >
              Back to registration
            </button>
          </form>
        )}

        <p className="text-center text-sm text-rz-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-rz-red hover:underline">
            {AUTH.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}

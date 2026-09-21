"use client";

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [code]);

  const handleKeyDown = useCallback((index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const digits = pasted.split("");
    const next = [...Array(6).fill("")];
    digits.forEach((d, i) => { next[i] = d; });
    setCode(next);
    const lastFilled = Math.min(digits.length, 5);
    inputRefs.current[lastFilled]?.focus();
  }, []);

  const handleSubmit = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setError(null);
    setIsLoading(true);

    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: fullCode }),
    });

    const data = await res.json().catch(() => ({ error: "Something went wrong" }));

    if (!res.ok) {
      setError(data.error ?? "Verification failed");
      setIsLoading(false);
      return;
    }

    router.push("/login?verified=1");
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    setError(null);

    await fetch("/api/auth/resend-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  };

  if (!email) {
    return (
      <div className="min-h-[100dvh] w-full bg-white text-surface-950 flex flex-col items-center justify-center p-4 sm:p-6 py-12">
        <p className="text-sm text-surface-500">No email provided. Please go back and try signing up again.</p>
        <Link href="/register" className="mt-4 inline-block text-sm text-surface-950 hover:underline font-semibold">
          Back to Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-white text-surface-950 flex flex-col items-center justify-center p-4 sm:p-6 py-12">
      <div className="w-full max-w-[400px] flex flex-col items-center text-center">

        <Link href="/" className="text-2xl font-bold tracking-tight text-surface-950 mb-6">
          leadsdom
        </Link>

        <Mail className="h-12 w-12 text-surface-950 stroke-[1.25] mx-auto mb-6" />

        <h1 className="text-2xl font-semibold tracking-tight text-surface-950 mb-2">
          Check your inbox
        </h1>
        <p className="mb-8 text-sm text-surface-500">
          We sent a 6-digit verification code to{" "}
          <span className="font-semibold text-surface-950">{email}</span>
        </p>

        <div className="flex items-center justify-between gap-2 w-full mb-6" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-12 text-center text-lg font-bold tabular-nums bg-white border border-surface-200 rounded-md text-surface-950 focus:border-surface-950 focus:ring-1 focus:ring-surface-950 transition-all outline-none"
            />
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full h-11 bg-surface-950 hover:bg-surface-800 text-white rounded-md text-sm font-semibold transition-colors shadow-xs disabled:opacity-60"
        >
          {isLoading ? "Verifying..." : "Verify & Continue"}
        </button>

        <p className="mt-4 text-xs text-surface-500">
          Didn&apos;t receive the code?{" "}
          {resendCooldown > 0 ? (
            <span className="text-surface-400">Resend in {resendCooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-surface-500 hover:text-surface-950 font-medium cursor-pointer"
            >
              Resend code
            </button>
          )}
        </p>

        <p className="mt-8 text-[11px] text-surface-400">
          &copy; 2026 LeadsDom. All Rights Reserved.{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-surface-600">Privacy</Link>{" "}
          and{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-surface-600">Terms</Link>.
        </p>

      </div>
    </div>
  );
}
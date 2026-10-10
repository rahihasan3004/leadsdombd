"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const actionLock = useRef(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return;
      const next = [...code];
      next[index] = value;
      setCode(next);

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [code],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const digits = pasted.split("");
    const next = [...Array(6).fill("")];
    digits.forEach((d, i) => {
      next[i] = d;
    });
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

    if (actionLock.current) return;
    actionLock.current = true;
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Verification failed");
      router.push("/login?verified=1");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Verification failed";
      setError(message);
      toast.error(message);
    } finally {
      actionLock.current = false;
      setIsLoading(false);
    }
  };
  const handleResend = async () => {
    if (actionLock.current || resendCooldown > 0) return;
    actionLock.current = true;
    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to resend code");
      setResendCooldown(60);
      toast.success("Verification code sent");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resend code";
      setError(message);
      toast.error(message);
    } finally {
      actionLock.current = false;
      setResending(false);
    }
  };

  if (!email) {
    return (
      <>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4">
            <Logo
              showText={false}
              size={56}
              className="w-14 h-14 object-contain transition-transform hover:scale-105"
            />
          </div>
        </div>
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 py-12">
          <p className="text-sm text-surface-500">
            No email provided. Please go back and try signing up again.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block text-sm text-surface-950 hover:underline font-semibold"
          >
            Back to Sign Up
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center text-center mb-6">
        <div className="mb-4">
          <Logo
            showText={false}
            size={56}
            className="w-14 h-14 object-contain transition-transform hover:scale-105"
          />
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-2">
          Check your inbox
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          We sent a 6-digit verification code to{" "}
          <span className="font-semibold text-slate-900">{email}</span>
        </p>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 py-12">
        <div className="w-full max-w-[400px] flex flex-col items-center text-center">
          <div
            className="flex items-center justify-between gap-1.5 sm:gap-2 w-full mb-6"
            onPaste={handlePaste}
          >
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="flex-1 min-w-0 max-w-12 h-12 sm:w-12 text-center text-lg font-bold tabular-nums bg-white border border-surface-200 rounded-md text-surface-950 focus:border-surface-950 focus:ring-1 focus:ring-surface-950 transition-all outline-none"
                aria-label={`Verification digit ${i + 1}`}
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
            disabled={isLoading || resending}
            aria-busy={isLoading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-sm font-semibold transition-all duration-200 shadow-none border-0 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Continue"
            )}
          </button>

          <p className="mt-4 text-xs text-surface-500">
            Didn&apos;t receive the code?{" "}
            {resendCooldown > 0 ? (
              <span className="text-surface-400">
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading || resending || resendCooldown > 0}
                aria-busy={resending}
                className="text-surface-500 hover:text-surface-950 font-medium cursor-pointer"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend code"
                )}
              </button>
            )}
          </p>

          <p className="mt-8 text-xs text-surface-400">
            &copy; 2026 LeadsDom. All Rights Reserved.{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-surface-600"
            >
              Privacy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              className="underline underline-offset-2 hover:text-surface-600"
            >
              Terms
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4">
            <Logo
              showText={false}
              size={56}
              className="w-14 h-14 object-contain transition-transform hover:scale-105"
            />
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

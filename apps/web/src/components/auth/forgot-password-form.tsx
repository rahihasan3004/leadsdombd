"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "./password-input";
import { toast } from "sonner";

type Step = "email" | "code" | "password";

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const chars = code.split("");
    chars[index] = digit;
    const newCode = chars.join("").slice(0, 6);
    setCode(newCode);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setCode(pasted);
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      });

      if (res.ok) {
        setSuccess("We sent a 6-digit verification code to your email.");
        setStep("code");
      } else {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(email),
          code: code.trim(),
        }),
      });

      if (res.ok) {
        setStep("password");
      } else {
        const data = await res.json();
        setError(data.error ?? "Invalid code. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(email),
          code: code.trim(),
          newPassword,
        }),
      });

      if (res.ok) {
        router.push("/login?" + new URLSearchParams({ reset: "success" }).toString());
      } else {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      });

      if (res.ok) {
        setSuccess("A new code has been sent to your email.");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to resend code.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-md border border-surface-200 bg-white px-3.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-surface-950 focus:ring-1 focus:ring-surface-950 transition-all outline-none";
  const otpBoxClass =
    "w-12 h-12 text-center text-lg font-bold tabular-nums bg-white border border-surface-200 rounded-md text-surface-950 focus:border-surface-950 focus:ring-1 focus:ring-surface-950 transition-all outline-none";
  const btnClass =
    "w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-none border-0 transition-all duration-200 flex items-center justify-center cursor-pointer disabled:opacity-50";

  return (
    <div className="w-full max-w-[400px] sm:max-w-[420px] flex flex-col items-center">
      {step === "email" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-surface-950 text-center mb-2">
            Reset your password
          </h1>
          <p className="text-sm text-surface-500 text-center mb-8">
            Enter your work email and we&apos;ll send you a 6-digit code.
          </p>

          {error && (
            <p className="mt-4 text-xs text-red-600 text-center">{error}</p>
          )}
          {success && (
            <p className="mt-4 text-xs text-emerald-600 text-center">{success}</p>
          )}

          <form onSubmit={handleSendCode} className="w-full space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-1.5 block text-xs font-medium text-surface-700"
              >
                Work Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <button type="submit" disabled={loading} className={btnClass + " mt-2"}>
              {loading ? "Sending..." : "Send Verification Code"}
            </button>

            <p className="text-xs text-surface-500 hover:text-surface-950 font-medium text-center mt-6">
              <Link href="/login">Back to log in</Link>
            </p>
          </form>
        </>
      )}

      {step === "code" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-surface-950 text-center mb-2">
            Enter verification code
          </h1>
          <p className="text-sm text-surface-500 text-center mb-8">
            We sent a 6-digit code to <span className="font-medium text-surface-900">{email}</span>. Enter it below to proceed.
          </p>

          {error && (
            <p className="mt-4 text-xs text-red-600 text-center">{error}</p>
          )}

          <form onSubmit={handleVerifyCode} className="w-full space-y-4">
            <div className="flex items-center justify-between gap-2 w-full my-1" onPaste={handleOtpPaste}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={code[i] ?? ""}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={otpBoxClass}
                />
              ))}
            </div>

            <button type="submit" disabled={loading} className={btnClass + " mt-4"}>
              {loading ? "Verifying..." : "Verify Code"}
            </button>

            <div className="flex items-center justify-between w-full mt-4 text-xs">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setStep("email");
                }}
                className="text-surface-500 hover:text-surface-950 font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="text-surface-500 hover:text-surface-950 font-medium transition-colors disabled:opacity-50"
              >
                Didn&apos;t receive code? Resend
              </button>
            </div>
          </form>
        </>
      )}

      {step === "password" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-surface-950 text-center mb-2">
            Set new password
          </h1>
          <p className="text-sm text-surface-500 text-center mb-8">
            Code verified successfully. Enter a secure new password for your account.
          </p>

          {error && (
            <p className="mt-4 text-xs text-red-600 text-center">{error}</p>
          )}

          <form onSubmit={handleResetPassword} className="w-full space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="mb-1.5 block text-xs font-medium text-surface-700"
              >
                New Password
              </label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-xs font-medium text-surface-700"
              >
                Confirm New Password
              </label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading} className={btnClass + " mt-2"}>
              {loading ? "Updating..." : "Update Password & Log In"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { Checkbox } from "@fine-leads/ui";
import { PasswordInput } from "./password-input";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorParam = searchParams.get("error");
  const [error, setError] = useState("");
  const verifiedFired = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (verifiedFired.current) return;
    const verified = searchParams.get("verified");
    if (verified === "1" || verified === "true") {
      verifiedFired.current = true;
      toast.success("Email verified successfully. You can now log in.", {
        duration: 5000,
      });
    }
  }, [searchParams]);

  const displayError = errorParam === "CredentialsSignin"
    ? "Invalid email or password, or your email has not been verified. Please check your inbox for a verification code."
    : errorParam === "auth"
    ? "Authentication failed. Please try again or contact support if the issue persists."
    : error
    ? error
    : "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password, or your email has not been verified. Please check your inbox for a verification code.");
    } else if (res?.ok) {
      router.push("/dashboard");
      router.refresh();
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {displayError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {displayError}
        </p>
      )}

      <div>
        <label
          htmlFor="email"
          className="text-left block text-sm font-medium text-slate-700 mb-1.5"
        >
          Work Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="name@company.com"
          className="h-11 w-full rounded-md border border-surface-200 bg-white px-3.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-surface-950 focus:ring-1 focus:ring-surface-950 transition-all outline-none"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label
            htmlFor="password"
            className="text-left block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-[#465FFF] hover:underline inline-block"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          name="password"
          autoComplete="current-password"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="keepSignedIn" name="keepSignedIn" />
        <label htmlFor="keepSignedIn" className="text-xs text-surface-600 select-none cursor-pointer">
          Remember me
        </label>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 bg-[#465FFF] hover:bg-[#3B50E0] text-white font-semibold rounded-xl shadow-none transition-colors flex items-center justify-center mt-2 cursor-pointer disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Logging in...
          </>
        ) : (
          "Log In"
        )}
      </button>

    </form>
  );
}
"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { Checkbox } from "@fine-leads/ui";
import { PasswordInput } from "./password-input";

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorParam = searchParams.get("error");
  const [error, setError] = useState("");
  const verifiedFired = useRef(false);

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
    : error
    ? error
    : "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

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
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {displayError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {displayError}
        </p>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-medium text-surface-700"
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
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-xs font-medium text-surface-700"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-surface-500 hover:text-surface-950 hover:underline inline-block"
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
        className="w-full h-11 bg-surface-950 hover:bg-surface-800 text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center mt-2 shadow-xs cursor-pointer"
      >
        Log In
      </button>

    </form>
  );
}
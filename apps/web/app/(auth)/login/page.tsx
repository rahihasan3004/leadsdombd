import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { ResetSuccessNotifier } from "@/components/auth/reset-success-notifier";

export const metadata: Metadata = {
  title: "Log In | LeadsDom",
  description: "Sign in to your LeadsDom account to access curated US real estate agent leads.",
};

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] w-full bg-white text-surface-950 flex flex-col items-center justify-center p-4 sm:p-6 py-12 sm:py-16">
      <div className="w-full max-w-[400px] sm:max-w-[420px] flex flex-col items-center">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight text-surface-950 text-center mb-6 sm:mb-8"
        >
          leadsdom
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-surface-950 text-center mb-2">
          Log in to your workspace
        </h1>
        <p className="text-sm text-surface-500 text-center mb-8">
          Enter your email below to access your account
        </p>

        <div className="w-full space-y-4">
          <GoogleButton variant="outline" />

          <div className="relative text-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-surface-200" />
            </div>
            <span className="relative bg-white px-3 text-xs text-surface-400">
              or continue with email
            </span>
          </div>

          <Suspense>
            <ResetSuccessNotifier />
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-xs text-surface-500 text-center mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-surface-950 hover:underline"
          >
            Sign up
          </Link>
        </p>

        <p className="text-[11px] text-surface-400 text-center mt-8">
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
    </div>
  );
}
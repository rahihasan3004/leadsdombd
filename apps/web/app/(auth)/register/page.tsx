import Link from "next/link";
import type { Metadata } from "next";
import { GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Sign Up | LeadsDom",
  description: "Create your LeadsDom account and get immediate access to curated US real estate agent leads.",
};

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-3">
        <Logo showText={false} size={56} className="w-14 h-14 object-contain transition-transform hover:scale-105" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="text-sm text-slate-500 mt-1 mb-4">
        Start building and enriching your pipeline in seconds
      </p>

      <div className="w-full max-w-[400px] flex flex-col gap-4">
        <GoogleButton variant="outline" />

        <div className="relative text-center my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-surface-200" />
          </div>
          <span className="relative bg-white px-3 text-xs text-surface-400">
            or continue with email
          </span>
        </div>

        <RegisterForm />
      </div>

      <p className="text-xs text-surface-500 text-center mt-4">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-surface-950 hover:underline"
        >
          Log In
        </Link>
      </p>

      <p className="text-[11px] text-surface-400 text-center mt-6">
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
  );
}

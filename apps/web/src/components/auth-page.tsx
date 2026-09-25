"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { MapPin } from "lucide-react";

const signupSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormData = z.infer<typeof signupSchema>;

function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-brand-500"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const states = [
  { name: "Florida", code: "FL" },
  { name: "California", code: "CA" },
  { name: "Texas", code: "TX" },
  { name: "New York", code: "NY" },
  { name: "Arizona", code: "AZ" },
];

const guarantees = [
  "100% Hand-Validated Business Emails (0% Bounce Guarantee)",
  "Direct Phone Lines & Verified Mobile Contacts",
  "Complete Brokerage, Review Ratings & Google Maps Metadata",
];

function BrandShowcase() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-8 py-16 lg:px-14 lg:py-20">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-2 inline-flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
          <span className="text-2xl md:text-[28px] font-bold tracking-tight text-[#14A800]">leadsdom</span>
          <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
        </div>

        <div className="mb-10">
          <span className="inline-block rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-400">
            RESTRICTED ACCESS • TIER-1 US REAL ESTATE AGENTS
          </span>
        </div>

        <h1 className="mb-5 text-[2.25rem] font-bold leading-[1.15] tracking-tight text-white lg:text-[2.75rem]">
          Target the Top 1% of US Real Estate Dealmakers.
        </h1>

        <p className="mb-10 text-[15px] leading-relaxed text-slate-400">
          Directly reach verified Realtors, Principal Brokers, and Luxury Property
          Managers across high-net-worth US territories with zero deliverability
          friction.
        </p>

        <div className="mb-10 space-y-2.5">
          {states.map((state) => (
            <div
              key={state.code}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-white/[0.03] px-4 py-3"
            >
              <span className="flex items-center gap-2.5 text-sm text-slate-300">
                <MapPin className="h-4 w-4 text-slate-400" />
                {state.name} ({state.code})
              </span>
              <span className="text-xs font-medium text-slate-500">
                200 Verified Leads
              </span>
            </div>
          ))}
        </div>

        <div className="mb-10 space-y-3.5">
          {guarantees.map((text) => (
            <div key={text} className="flex items-start gap-3">
              <CheckIcon />
              <span className="text-sm leading-relaxed text-slate-300">{text}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-800 bg-white/[0.02] px-4 py-3.5">
          <p className="text-[13px] italic leading-relaxed text-slate-400">
            &ldquo;Generated 18 booked appointments in our first 10 days targeting
            Miami luxury brokerages.&rdquo;
          </p>
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            B2B Cold Outreach Agency
          </p>
        </div>
      </div>
    </div>
  );
}

interface AuthPageProps {
  mode: "login" | "register";
}

export function AuthPage({ mode }: AuthPageProps) {
  const [currentMode, setCurrentMode] = useState<"login" | "register">(mode);
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setServerError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Something went wrong" }));
      setServerError(err.error || "Something went wrong");
      return;
    }

    router.push("/login");
  };

  const isLogin = currentMode === "login";
  const isRegister = currentMode === "register";

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 lg:block">
        <BrandShowcase />
      </div>

      <div className="flex w-full items-center justify-center bg-white px-6 py-12 dark:bg-slate-900 lg:w-1/2">
        <div className="w-full max-w-md px-0 py-12 sm:px-8">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              <span className="text-2xl md:text-[28px] font-bold tracking-tight text-[#14A800]">leadsdom</span>
              <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {isLogin ? "Sign in to LeadsDom" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {isLogin
                ? "Access your unlocked state packs and export history."
                : "Get immediate access to the curated US real estate lead database."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800/60"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                or continue with work email
              </span>
            </div>
          </div>

          {isLogin ? (
            <form
              onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get("email") as string;
                const password = formData.get("password") as string;
                await signIn("credentials", { email, password, redirect: true });
              }}
              className="space-y-3.5"
            >
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                required
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <div className="mt-1.5 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
              <button
                type="submit"
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-blue-600 text-white shadow-none transition-all duration-200 hover:bg-blue-700 active:bg-blue-800"
              >
                Sign In →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              <div>
                <input
                  type="text"
                  placeholder="Jane Doe"
                  autoComplete="name"
                  {...register("name")}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <input
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  {...register("email")}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register("password")}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {serverError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-blue-600 text-white shadow-none transition-all duration-200 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60"
              >
                {isSubmitting ? "Creating account..." : "Get Lead Access →"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            {isLogin ? (
              <p className="text-slate-500 dark:text-slate-400">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setCurrentMode("register")}
                  className="font-medium text-brand-500 hover:text-brand-600 transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                  Create one
                </button>
              </p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setCurrentMode("login")}
                  className="font-medium text-brand-500 hover:text-brand-600 transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            By proceeding, you agree to LeadsDom&apos;{" "}
            <Link
              href="/terms"
              className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
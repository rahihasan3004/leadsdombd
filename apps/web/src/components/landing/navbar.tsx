"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@fine-leads/ui";
import { cn } from "@fine-leads/utils";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";

const navLinks = [
  { href: "/dashboard", label: "Explore Leads" },
  { href: "/#features", label: "How It Works" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full bg-white border-b border-slate-100/80 shadow-xs",
        "md:z-50 md:border-white/10 md:bg-white/80 md:backdrop-blur-xl md:shadow-none",
        "md:dark:bg-surface-950/80 md:dark:border-surface-800",
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Logo />

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <Button
              asChild
              variant="default"
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 shadow-none border-0 px-5"
            >
              <Link href="/dashboard">Go to Dashboard →</Link>
            </Button>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors"
              >
                Log in
              </Link>
              <Button
                asChild
                variant="default"
                className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 shadow-none border-0 px-5"
              >
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 text-surface-600"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[9999] bg-white w-screen h-[100dvh] flex flex-col justify-between p-6 lg:hidden overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <Logo />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close menu"
            >
              <X className="h-7 w-7 text-slate-800" />
            </button>
          </div>

          <nav className="flex flex-col gap-1 mt-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-lg font-semibold text-slate-800 hover:text-blue-600 hover:bg-slate-50 py-3 px-2 rounded-xl transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="space-y-3 pt-6 border-t border-slate-100 mt-auto">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block w-full py-3 text-center font-medium text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-full shadow-none transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="block w-full py-3.5 text-center font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-none transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

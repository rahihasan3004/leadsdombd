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
        "sticky top-0 z-50 w-full",
        "border-b border-white/10 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60",
        "dark:bg-surface-950/80 dark:supports-[backdrop-filter]:bg-surface-950/60 dark:border-surface-800"
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
              className="rounded-full bg-[#465FFF] hover:bg-[#3B50E0] text-white font-medium transition-colors shadow-none px-5"
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
                className="rounded-full bg-[#465FFF] hover:bg-[#3B50E0] text-white font-medium transition-colors shadow-none px-5"
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
        <div className="md:hidden border-t border-surface-200 bg-white px-6 pb-6 pt-4">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-surface-200" />
            {isLoggedIn ? (
              <Button
                asChild
                variant="default"
                className="rounded-full bg-surface-900 px-5 text-white hover:bg-surface-800 w-full"
              >
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  Go to Dashboard →
                </Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Button
                  asChild
                  variant="default"
                  className="rounded-full bg-surface-900 px-5 text-white hover:bg-surface-800 w-full"
                >
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    Get Started
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
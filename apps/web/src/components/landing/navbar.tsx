"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@fine-leads/ui";
import { cn } from "@fine-leads/utils";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/logo";

const navLinks = [
  { href: "/dashboard", label: "Explore Leads" },
  { href: "/#features", label: "How It Works" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "bg-white/95 backdrop-blur-md border-b border-neutral-100 shadow-xs"
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Logo />

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
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
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
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
          className="md:hidden p-3 rounded-lg hover:bg-neutral-100 text-neutral-600"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mounted && (
        <>
          {mobileOpen && (
            <div className="md:hidden fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          )}
          <div
            className={cn(
              "md:hidden fixed top-0 right-0 z-[70] h-full w-80 bg-white border-l border-neutral-100 shadow-2xl transition-transform duration-300 ease-in-out",
              mobileOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <span className="text-base font-semibold text-neutral-900">Menu</span>
              <button
                className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-2 p-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors py-3"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <hr className="border-neutral-100 my-4" />
              {isLoggedIn ? (
                <Button
                  asChild
                  variant="default"
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
                >
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    Go to Dashboard →
                  </Link>
                </Button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors py-3"
                    onClick={() => setMobileOpen(false)}
                  >
                    Log in
                  </Link>
                  <Button
                    asChild
                    variant="default"
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
                  >
                    <Link href="/register" onClick={() => setMobileOpen(false)}>
                      Get Started
                    </Link>
                  </Button>
                </>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}

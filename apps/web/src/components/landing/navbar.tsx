"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@fine-leads/ui";
import { cn } from "@fine-leads/utils";
import { Menu, X } from "lucide-react";
import { useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { useModalA11y } from "@/hooks/use-modal-a11y";

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
  const menuRef = useRef<HTMLDivElement>(null);
  useModalA11y(menuRef, mobileOpen, () => setMobileOpen(false));

  return (
    <header
      className={cn(
        // Always light: the logo text is dark (text-slate-900), so the bar must stay white in OS dark mode too.
        "sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs",
        "md:z-50 md:shadow-none",
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
          type="button"
          className="md:hidden -mr-2.5 inline-flex h-11 w-11 items-center justify-center rounded-lg text-surface-600"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          ref={menuRef}
          id="landing-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          tabIndex={-1}
          className="fixed inset-0 z-[9999] bg-white h-dvh flex flex-col justify-between p-6 md:hidden overflow-y-auto overscroll-contain outline-none"
        >
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

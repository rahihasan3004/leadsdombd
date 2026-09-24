"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@fine-leads/ui";
import { cn } from "@fine-leads/utils";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/logo";

const navLinks = [
  { href: "#features", label: "Explore Leads" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#faq", label: "FAQ" },
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
    <header className="w-full h-16 bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 sm:px-8 z-40">
      <Logo />

      <nav className="hidden md:flex items-center gap-8">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
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
              className="text-sm font-medium text-slate-600 hover:text-neutral-900 transition-colors"
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
        className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mounted && mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-[85%] max-w-xs bg-white shadow-2xl p-6 flex flex-col justify-between z-50 lg:hidden transform transition-transform duration-300 ease-in-out">
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <Logo />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <nav className="flex flex-col gap-4 mt-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-slate-700 hover:text-blue-600 font-medium text-base py-2"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="space-y-3 pt-6 border-t border-slate-100">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block w-full py-3 text-center font-medium text-slate-800 hover:bg-slate-50 rounded-xl"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="block w-full py-3 text-center font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

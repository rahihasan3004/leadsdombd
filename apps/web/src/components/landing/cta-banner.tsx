"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

function CrosshairGridBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="ctaGridPattern"
            x="0"
            y="0"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <rect x="0" y="0" width="5" height="5" fill="rgba(0,0,0,0.07)" rx="1" />
            <rect x="55" y="0" width="5" height="5" fill="rgba(0,0,0,0.07)" rx="1" />
            <rect x="0" y="55" width="5" height="5" fill="rgba(0,0,0,0.07)" rx="1" />
            <rect x="55" y="55" width="5" height="5" fill="rgba(0,0,0,0.07)" rx="1" />
            <line x1="30" y1="27" x2="30" y2="33" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            <line x1="27" y1="30" x2="33" y2="30" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ctaGridPattern)" />
      </svg>
    </div>
  );
}

export function CTABanner() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const ctaHref = isLoggedIn ? "/dashboard" : "/register";

  return (
    <section className="relative overflow-hidden bg-[#FAFAFA]">
      <CrosshairGridBackground />
      <div className="max-w-6xl mx-auto px-4 my-20 relative">
        <div className="bg-[#0B0F17] border border-neutral-800 rounded-[28px] md:rounded-[36px] py-16 md:py-20 px-6 md:px-12 text-center relative overflow-hidden shadow-none">
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800/40 via-transparent to-transparent pointer-events-none"
            aria-hidden="true"
          />
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white max-w-2xl mx-auto leading-tight relative z-10">
            Ready to scale your real estate pipeline?
          </h2>
          <p className="text-sm md:text-base text-neutral-400 max-w-lg mx-auto mt-4 mb-8 leading-relaxed relative z-10">
            Get instant access to 1,200,000+ verified agent leads across all 50 US states at a flat $0.019 per contact.
          </p>
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center px-7 py-3 rounded-full bg-white text-neutral-900 font-semibold text-sm hover:bg-neutral-100 hover:scale-[1.02] transition-all duration-200 relative z-10 shadow-none"
          >
            {isLoggedIn ? "Go to Dashboard →" : "Get Started →"}
          </Link>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";

export function LandingFooter() {
  return (
    <footer className="w-full bg-white relative overflow-hidden border-none pt-16">
      {/* Top Content: Max-width Container */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12">
          {/* Brand / Left Column */}
          <div className="space-y-3">
            <Logo />
            <p className="text-xs text-neutral-400 leading-relaxed">
              © 2026 LeadsDom. All rights reserved.
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">Product</h4>
            <ul className="space-y-1.5 text-sm text-neutral-500">
              <li><Link href="/dashboard" className="hover:text-neutral-900 transition-colors">Explore Leads</Link></li>
              <li><Link href="/#features" className="hover:text-neutral-900 transition-colors">How It Works</Link></li>
              <li><Link href="/#faq" className="hover:text-neutral-900 transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-neutral-900 transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">Legal</h4>
            <ul className="space-y-1.5 text-sm text-neutral-500">
              <li><Link href="/privacy" className="hover:text-neutral-900 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-neutral-900 transition-colors">Terms of Service</Link></li>
              <li><Link href="/refund" className="hover:text-neutral-900 transition-colors">Refund Policy</Link></li>
            </ul>
          </div>

          {/* Connect Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">Connect</h4>
            <ul className="space-y-1.5 text-sm text-neutral-500">
              <li><a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:text-neutral-900 transition-colors">Twitter / X</a></li>
              <li><a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:text-neutral-900 transition-colors">LinkedIn</a></li>
              <li><Link href="/contact" className="hover:text-neutral-900 transition-colors">Support</Link></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Full Width Edge-to-Edge Watermark */}
      <div className="w-full overflow-hidden select-none pointer-events-none text-center pt-8 pb-1 -mb-1 md:-mb-2">
        <span className="text-[clamp(40px,11.5vw,200px)] font-black tracking-tight text-neutral-100 uppercase leading-none block whitespace-nowrap">
          LEADSDOM
        </span>
      </div>
    </footer>
  );
}

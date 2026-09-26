import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the LeadsDom team.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <LandingNavbar />
      <main className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900">
          Contact Us
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Have questions? We&apos;d love to hear from you.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="font-semibold text-neutral-900">Sales</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Interested in LeadsDom for your team?
            </p>
            <a
              href="mailto:sales@leadsdom.com"
              className="mt-2 inline-block text-sm font-medium text-neutral-600 hover:text-black transition-colors"
            >
              sales@leadsdom.com
            </a>
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900">Support</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Need help with your account?
            </p>
            <a
              href="mailto:support@leadsdom.com"
              className="mt-2 inline-block text-sm font-medium text-neutral-600 hover:text-black transition-colors"
            >
              support@leadsdom.com
            </a>
          </div>
        </div>

        <div className="mt-12 bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-2xl border border-slate-100">
          <h2 className="text-lg font-bold text-neutral-900 mb-6">
            Send us a message
          </h2>
          <form className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                className="w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 p-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="Your name"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                className="w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 p-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="message"
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block"
              >
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                className="w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 p-3 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="How can we help?"
              />
            </div>
            <button
              type="submit"
              className="rounded-full px-6 py-2.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-none border-0"
            >
              Send Message
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

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
      <main className="max-w-2xl mx-auto px-6 py-16">
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

        <div className="mt-12">
          <h2 className="text-lg font-bold text-neutral-900 mb-6">
            Send us a message
          </h2>
          <form className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-neutral-700"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
                placeholder="Your name"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-neutral-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-neutral-700"
              >
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
                placeholder="How can we help?"
              />
            </div>
            <button
              type="submit"
              className="rounded-full px-6 py-2.5 bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              Send Message
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

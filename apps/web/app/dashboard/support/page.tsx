"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export default function SupportPage() {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Something went wrong.");
        return;
      }

      toast.success("Support ticket submitted!");
      setMessage("");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col justify-center items-center py-10 px-4">
      <div className="max-w-3xl w-full mx-auto">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900">
        Support Center
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Get direct assistance with your LeadsDom workspace and data.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-surface-200 bg-white p-5">
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
        <div className="rounded-xl border border-surface-200 bg-white p-5">
          <h2 className="font-semibold text-neutral-900">Technical Support</h2>
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

      <div className="mt-10">
        <h2 className="text-lg font-bold text-neutral-900 mb-6">
          Send us a message
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3.5 py-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
              placeholder="Your name"
              required
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3.5 py-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
              placeholder="you@company.com"
              required
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
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full px-3.5 py-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
              placeholder="How can we help?"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl px-6 py-2.5 transition-all duration-200 disabled:opacity-50 inline-flex items-center gap-2 shadow-none border-0"
          >
            {loading && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </div>
    </div>
  );
}

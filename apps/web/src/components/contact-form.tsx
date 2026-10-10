"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const labelClass =
  "text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block";
const fieldClass =
  "w-full bg-white border border-slate-200 text-slate-900 text-base sm:text-sm placeholder:text-slate-400 min-h-11 px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const submitLock = useRef(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (submitLock.current) return;
    submitLock.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Failed to send message. Please try again.");
        return;
      }
      toast.success("Message sent! We'll get back to you soon.");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={320}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label htmlFor="message" className={labelClass}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={fieldClass}
          placeholder="How can we help?"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 min-h-11 rounded-full px-6 py-2.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-none border-0 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {loading ? (
          <>
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Send Message"
        )}
      </button>
    </form>
  );
}

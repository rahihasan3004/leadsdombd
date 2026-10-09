import Link from "next/link";
import { ArrowRight, Check, Sparkles, type LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** What the feature will offer once launched. */
  highlights: string[];
  /** Optional note shown above the CTA (e.g. what users can do today). */
  note?: string;
  cta?: { href: string; label: string };
}

/** Branded placeholder for dashboard sections that are not part of the MVP launch. */
export function ComingSoon({ title, description, icon: Icon, highlights, note, cta }: ComingSoonProps) {
  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-white p-8 sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 ring-1 ring-blue-100">
            <Icon className="h-7 w-7 text-blue-600" />
          </div>

          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            Coming soon
          </span>

          <h2 className="mt-4 text-lg sm:text-xl font-semibold text-slate-900">{title} is on the way</h2>

          <ul className="mt-6 w-full space-y-2.5 text-left">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                {item}
              </li>
            ))}
          </ul>

          {note && <p className="mt-6 text-sm text-slate-500">{note}</p>}

          {cta && (
            <Link
              href={cta.href}
              className="mt-6 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-blue-600 text-white text-xs font-semibold transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              {cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

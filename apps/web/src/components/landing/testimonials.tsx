"use client";

const testimonials = [
  {
    name: "Marcus Johnson",
    designation: "Real Estate Investor",
    initials: "MJ",
    color: "bg-blue-100 text-blue-700",
    content: "Saving $2k/mo on skip tracing. LeadsDom gave us direct cell numbers we couldn't find anywhere else.",
  },
  {
    name: "Sarah Chen",
    designation: "Acquisition Lead",
    initials: "SC",
    color: "bg-violet-100 text-violet-700",
    content: "99% deliverability is a game changer for cold outreach. Our email campaigns finally hit the inbox.",
  },
  {
    name: "David Martinez",
    designation: "Agency Founder",
    initials: "DM",
    color: "bg-emerald-100 text-emerald-700",
    content: "Unmasked direct cell numbers allowed us to close 5 deals in Florida last quarter alone.",
  },
  {
    name: "Emily Rodriguez",
    designation: "Wholesaler",
    initials: "ER",
    color: "bg-amber-100 text-amber-700",
    content: "We scaled our outreach from 200 to 2,000 leads a week without breaking a sweat.",
  },
  {
    name: "James Wilson",
    designation: "Marketing Agency Owner",
    initials: "JW",
    color: "bg-rose-100 text-rose-700",
    content: "The CSV export is flawless. We push directly into our CRM and start dialing within minutes.",
  },
  {
    name: "Aisha Patel",
    designation: "Real Estate Investor",
    initials: "AP",
    color: "bg-cyan-100 text-cyan-700",
    content: "Territory-based pricing is transparent and fair. No lock-ins, no hidden fees — just clean data.",
  },
];

function StarRating() {
  return (
    <div className="flex items-center gap-0.5 text-amber-400">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.951.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.05 9.729c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({
  name,
  designation,
  initials,
  color,
  content,
}: {
  name: string;
  designation: string;
  initials: string;
  color: string;
  content: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-neutral-100 shadow-xs space-y-3">
      <StarRating />
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color}`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">
            {name}
          </p>
          <p className="text-xs text-neutral-500 truncate">{designation}</p>
        </div>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed">{content}</p>
    </div>
  );
}

export function Testimonials() {
  const mobileTests = testimonials.slice(0, 2);
  const column1 = testimonials.slice(0, 3);
  const column2 = testimonials.slice(3, 6);

  return (
    <section className="py-24 bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-neutral-900">
            Loved by real estate professionals
          </h2>
          <p className="text-sm md:text-base text-neutral-500 mt-3 max-w-xl mx-auto leading-relaxed">
            See how wholesalers, investors, and marketing agencies are scaling
            their outreach with LeadsDom.
          </p>
        </div>

        <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12">
          {mobileTests.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </div>

        <div className="hidden md:block grid grid-cols-3 gap-6 h-[540px] overflow-hidden relative mt-16">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#FAFAFA] to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FAFAFA] to-transparent z-10"
            aria-hidden="true"
          />

          <MarqueeColumn items={column1} />
          <MarqueeColumn items={column2} reverse />
        </div>
      </div>

      <style>{`
        @keyframes marquee-vertical {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </section>
  );
}

function MarqueeColumn({ items, reverse = false }: { items: typeof testimonials; reverse?: boolean }) {
  return (
    <div className="relative h-full overflow-hidden">
      <div
        className="animate-marquee-vertical"
        style={{
          animation: "marquee-vertical 40s linear infinite",
          ...(reverse ? { animationDirection: "reverse" as const } : {}),
        }}
      >
        {[...items, ...items].map((t, i) => (
          <TestimonialCard key={`${t.name}-${i}`} {...t} />
        ))}
      </div>
    </div>
  );
}

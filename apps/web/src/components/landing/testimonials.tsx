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
  {
    name: "Tom Bradley",
    designation: "Acquisition Lead",
    initials: "TB",
    color: "bg-indigo-100 text-indigo-700",
    content: "We cut our data sourcing costs by 60% while improving lead quality significantly.",
  },
  {
    name: "Nina Kowalski",
    designation: "Agency Founder",
    initials: "NK",
    color: "bg-pink-100 text-pink-700",
    content: "Verified brokerages and active status flags save us hours of manual research every week.",
  },
  {
    name: "Chris Thompson",
    designation: "Wholesaler",
    initials: "CT",
    color: "bg-teal-100 text-teal-700",
    content: "Direct lines mean we skip the gatekeepers. Our connect rate jumped from 12% to 34%.",
  },
];

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
    <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-neutral-200 transition-all duration-300 break-inside-avoid mb-6">
      <div className="flex items-center gap-3 mb-3">
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

function MarqueeColumn({ items, reverse = false }: { items: typeof testimonials; reverse?: boolean }) {
  return (
    <div className="relative h-full overflow-hidden">
      <div
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

export function Testimonials() {
  const column1 = testimonials.slice(0, 3);
  const column2 = testimonials.slice(3, 6);
  const column3 = testimonials.slice(6, 9);

  return (
    <section className="w-full py-24 bg-[#FAFAFA]">
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-neutral-900">
            Loved by real estate professionals
          </h2>
          <p className="text-sm md:text-base text-neutral-500 mt-3 max-w-xl mx-auto leading-relaxed">
            See how wholesalers, investors, and marketing agencies are scaling
            their outreach with LeadsDom.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 h-[540px] overflow-hidden relative mt-16">
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
          <MarqueeColumn items={column3} />
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

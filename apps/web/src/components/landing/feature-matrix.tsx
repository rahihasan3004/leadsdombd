"use client";

import {
  DollarSign,
  ShieldCheck,
  Smartphone,
  MapPin,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  Headphones,
} from "lucide-react";

const features = [
  {
    icon: DollarSign,
    title: "Pricing like no other",
    description:
      "Flat $0.019 per verified lead. No monthly lock-ins, no hidden fees, no credit card required to browse.",
  },
  {
    icon: ShieldCheck,
    title: "99% Deliverability",
    description:
      "Real-time SMTP handshake on every email. Protect your domain reputation with zero hard bounces.",
  },
  {
    icon: Smartphone,
    title: "Direct Cell Lines",
    description:
      "Bypass brokerage switchboards. Get direct mobile numbers for producing agents and principal brokers.",
  },
  {
    icon: MapPin,
    title: "50 US States + DC",
    description:
      "Territory-based state packs covering over 1,200,000+ licensed real estate agents nationwide.",
  },
  {
    icon: FileSpreadsheet,
    title: "Instant CSV & Excel",
    description:
      "Stream thousands of leads in seconds. Pre-formatted for HubSpot, Salesforce, and Google Sheets.",
  },
  {
    icon: RefreshCw,
    title: "Continuous Ingestion",
    description:
      "Our scraper pipeline continuously crawls, enriches, and validates new MLS and license data.",
  },
  {
    icon: CheckCircle2,
    title: "Catch-All Filtered",
    description:
      "Advanced SMTP probing eliminates catch-all domains, spam traps, and dead mailboxes automatically.",
  },
  {
    icon: Headphones,
    title: "24/7 Territory Support",
    description:
      "Need custom data scoping or high-volume enterprise batches? Our data team is available around the clock.",
  },
];

function FeatureCell({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 md:p-8 relative group hover:bg-neutral-50/50 transition-colors">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-neutral-200 group-hover:bg-neutral-900 rounded-r transition-colors" />
      <Icon className="h-5 w-5 text-neutral-800 mb-4" />
      <h3 className="font-bold text-neutral-900 text-base mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-xs text-neutral-500 leading-relaxed">{description}</p>
    </div>
  );
}

export function FeatureMatrix() {
  return (
    <section className="max-w-6xl mx-auto px-4 my-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-b border-neutral-200/80 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200/80 bg-white">
        {features.map((feature) => (
          <FeatureCell key={feature.title} {...feature} />
        ))}
      </div>
      <div className="border-t border-neutral-200/80" />
    </section>
  );
}

"use client";

import { ArrowUpRight, Download, FileSpreadsheet, Mail, Phone, Shield, Upload } from "lucide-react";
import { cn } from "@fine-leads/utils";

function SectionHeader() {
  return (
    <div className="text-center px-6">
      <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
        Built for lead generation teams
      </h2>
      <p className="text-sm md:text-base text-neutral-500 mt-3 max-w-xl mx-auto leading-relaxed">
        From territory unlocking to CRM push, every step is verified, fast, and
        transparently priced.
      </p>
    </div>
  );
}

const territoryStates = [
  { name: "Florida", code: "FL", leads: "42,800" },
  { name: "Texas", code: "TX", leads: "54,100" },
];

function CardShell({
  className,
  gradient,
  children,
}: {
  className?: string;
  gradient: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
         "min-h-[460px] rounded-none overflow-hidden p-8 md:p-10 flex flex-col justify-between relative border-x border-t border-neutral-200/40 hover:border-neutral-200/60 transition-all duration-300 bg-white [mask-image:linear-gradient(to_bottom,black_65%,transparent_100%)]",
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-70 pointer-events-none"
        style={{
          background: gradient,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function CardTopRightArrow() {
  return (
    <div className="absolute top-8 right-8 md:top-10 md:right-10 z-20">
        <div className="h-8 w-8 rounded-sm border border-neutral-200/40 flex items-center justify-center bg-white/60 backdrop-blur-sm">
        <ArrowUpRight className="h-4 w-4 text-neutral-500" />
      </div>
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h3 className="text-lg md:text-xl font-semibold text-neutral-900 tracking-tight leading-snug">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs md:text-sm text-neutral-500 mt-1 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Card1() {
  return (
    <CardShell
      gradient="linear-gradient(160deg, rgba(251,146,60,0.18) 0%, rgba(253,186,140,0.12) 40%, rgba(255,255,255,0) 70%)"
    >
      <div>
        <div className="relative">
          <CardHeader
            title="Instant State Territory Unlocks"
            subtitle="Transparent pay-per-lead pricing with zero lock-ins."
          />
          <CardTopRightArrow />
        </div>

        <div className="mt-8 space-y-3">
          {territoryStates.map((state) => (
            <div
              key={state.code}
               className="flex items-center justify-between rounded-sm bg-white/70 border border-orange-100/50 px-5 py-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-sm bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {state.code}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {state.name}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {state.leads} leads
                  </p>
                </div>
              </div>
               <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-100/70 rounded-sm px-2.5 py-1">
                Unlocked
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-sm bg-white/80 border border-neutral-200/40 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">
              Territory rate
            </p>
            <p className="text-2xl font-semibold text-neutral-900 tracking-tight mt-0.5">
              $0.019
              <span className="text-sm font-normal text-neutral-500 ml-1">
                /lead
              </span>
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-sm bg-[#465FFF] hover:bg-[#3B50E0] text-white pl-4 pr-5 py-2.5 text-xs font-semibold transition-colors shadow-none"
          >
            Unlock Territory
          </button>
        </div>
      </div>
    </CardShell>
  );
}

function Card2() {
  return (
    <CardShell
      gradient="linear-gradient(160deg, rgba(124,58,237,0.16) 0%, rgba(167,139,250,0.10) 40%, rgba(255,255,255,0) 70%)"
    >
      <div>
        <div className="relative">
          <CardHeader
            title="Direct Realtor Contact Intelligence"
            subtitle="Unmasked direct lines and verified profiles."
          />
          <CardTopRightArrow />
        </div>

        <div className="mt-8 rounded-sm bg-white/70 border border-neutral-200/40 p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-sm bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">
              SM
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                Sarah Mitchell
              </p>
              <p className="text-xs text-neutral-500 truncate">
                Keller Williams &middot; ACTIVE (FL)
              </p>
            </div>
            <div className="ml-auto shrink-0">
               <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <Shield className="h-3 w-3" />
                Verified
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-neutral-500 uppercase tracking-wide font-medium">
                Direct cell
              </p>
              <p className="text-sm font-semibold text-neutral-900 mt-0.5 tracking-tight">
                (305) 555-0192
              </p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 uppercase tracking-wide font-medium">
                Volume (12M)
              </p>
              <div className="mt-1 flex items-end gap-1 h-8">
                {[35, 55, 40, 70, 60, 80, 65, 90].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-violet-100"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function Card3() {
  return (
    <CardShell
      gradient="linear-gradient(160deg, rgba(6,182,212,0.16) 0%, rgba(153,246,228,0.10) 40%, rgba(255,255,255,0) 70%)"
    >
      <div>
        <div className="relative">
          <CardHeader
            title="Zero-Bounce SMTP Verification"
            subtitle="Live inbox deliverability on every contact."
          />
          <CardTopRightArrow />
        </div>

        <div className="mt-8 space-y-3.5">
          {[
            "Syntax Valid",
            "MX Handshake Active",
            "99.2% Inbox Deliverable",
          ].map((label) => (
            <div
              key={label}
               className="flex items-center justify-between rounded-sm bg-white/70 border border-neutral-200/40 px-5 py-3.5"
            >
              <p className="text-sm font-medium text-neutral-800 tracking-tight">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-sm bg-emerald-50/70 border border-emerald-100/60 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700 tracking-tight">
                Deliverability stream live
              </p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-100/60 rounded-sm px-2.5 py-1">
              99.2%
            </span>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function Card4() {
  const rows = [
    {
      name: "Sarah Mitchell",
      brokerage: "Keller Williams",
      email: "sarah@kwrealty.com",
      phone: "(305) 555-0192",
      state: "FL",
    },
    {
      name: "David Miller",
      brokerage: "Compass",
      email: "david@compass.com",
      phone: "(512) 555-0147",
      state: "TX",
    },
    {
      name: "Emily Chen",
      brokerage: "eXp Realty",
      email: "emily@exprealty.com",
      phone: "(713) 555-0183",
      state: "TX",
    },
    {
      name: "Marcus Johnson",
      brokerage: "RE/MAX",
      email: "marcus@remax.com",
      phone: "(407) 555-0164",
      state: "FL",
    },
  ];

  return (
    <div
      className="min-h-[460px] rounded-none overflow-hidden relative border-x border-t border-neutral-200/40 hover:border-neutral-200/60 transition-all duration-300 bg-white [mask-image:linear-gradient(to_bottom,black_65%,transparent_100%)]"
    >
      <div
        className="absolute inset-0 opacity-70 pointer-events-none"
        style={{
          background:
            "linear-gradient(160deg, rgba(59,130,246,0.14) 0%, rgba(124,58,237,0.10) 40%, rgba(255,255,255,0) 70%)",
        }}
      />

      <div className="relative z-10 p-8 md:p-10 flex flex-col justify-between h-full">
        <div>
          <div className="relative">
            <CardHeader
              title="One-Click Export & CRM Sync"
              subtitle="Verified leads ready for CSV, Excel, or direct CRM push."
            />
            <CardTopRightArrow />
          </div>
        </div>

        <div className="mt-8 rounded-sm bg-white/70 border border-neutral-200/40 overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-4 py-2.5 border-b border-neutral-100 bg-neutral-50/60">
            {["Name", "Brokerage", "Email", "Phone", "State"].map((h) => (
              <p
                key={h}
                className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider"
              >
                {h}
              </p>
            ))}
          </div>
          {rows.map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-neutral-50 last:border-b-0 hover:bg-neutral-50/50 transition-colors"
            >
              <p className="text-sm font-medium text-neutral-900 truncate">
                {row.name}
              </p>
              <p className="text-sm text-neutral-600 truncate">
                {row.brokerage}
              </p>
              <p className="text-sm text-neutral-600 truncate">{row.email}</p>
              <p className="text-sm text-neutral-600 truncate">{row.phone}</p>
              <p className="text-sm font-semibold text-neutral-900">{row.state}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-sm bg-[#465FFF] hover:bg-[#3B50E0] text-white px-4 py-2 text-xs font-semibold transition-colors shadow-none"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-sm bg-white border border-neutral-200/60 text-neutral-900 px-4 py-2 text-xs font-semibold hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-sm bg-white border border-neutral-200/60 text-neutral-900 px-4 py-2 text-xs font-semibold hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Push to CRM
          </button>
        </div>
      </div>
    </div>
  );
}

export function BentoFeatures() {
  return (
    <section id="features" className="py-24 bg-white">
      <SectionHeader />

      <div className="mx-auto max-w-7xl px-4 mt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <Card1 />
          <Card2 />
          <Card3 />
          <Card4 />
        </div>
      </div>
    </section>
  );
}

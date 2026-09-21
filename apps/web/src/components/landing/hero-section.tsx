"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowRight,
  DollarSign,
  Inbox,
  Key,
  Map,
  Percent,
  Radio,
  Search,
  Users,
} from "lucide-react";

function CrosshairGridBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <style>{`
        @keyframes gridBreathe {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.002); }
        }
      `}</style>
      <div
        className="absolute inset-0"
        style={{
          animation: "gridBreathe 8s ease-in-out infinite",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)",
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="gridPattern"
              x="0"
              y="0"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width="5" height="5" fill="rgba(0,0,0,0.07)" rx="1" />
              <rect x="55" y="0" width="5" height="5" fill="rgba(0,0,0,0.07)" rx="1" />
              <rect x="0" y="55" width="5" height="5" fill="rgba(0,0,0,0.07)" rx="1" />
              <rect x="55" y="55" width="5" height="5" fill="rgba(0,0,0,0.07)" rx="1" />
              <line x1="30" y1="27" x2="30" y2="33" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
              <line x1="27" y1="30" x2="33" y2="30" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridPattern)" />
        </svg>
      </div>
    </div>
  );
}

function LineChart() {
  const width = 400;
  const height = 180;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const gridLines = [0, 25, 50, 75, 100];
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const blueData = [30, 46, 35, 64, 52, 88];
  const redData = [20, 32, 48, 38, 62, 51];

  const toX = (i: number) => pad.left + (i / (months.length - 1)) * plotW;
  const toY = (v: number) => pad.top + plotH - (v / 100) * plotH;

  const buildPath = (data: number[]) => {
    const points = data.map((d, i) => `${toX(i)},${toY(d)}`);
    let path = `M${points[0]}`;
    for (let i = 1; i < points.length; i++) {
      const prevX = toX(i - 1);
      const prevY = toY(data[i - 1]);
      const curX = toX(i);
      const curY = toY(data[i]);
      const cpX = (prevX + curX) / 2;
      path += ` C${cpX},${prevY} ${cpX},${curY} ${curX},${curY}`;
    }
    return path;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            y1={toY(v)}
            x2={width - pad.right}
            y2={toY(v)}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          <text
            x={pad.left - 8}
            y={toY(v) + 4}
            textAnchor="end"
            className="text-[10px]"
            fill="#9CA3AF"
          >
            {v}k
          </text>
        </g>
      ))}

      {months.map((m, i) => (
        <text
          key={m}
          x={toX(i)}
          y={height - 4}
          textAnchor="middle"
          className="text-[10px]"
          fill="#9CA3AF"
        >
          {m}
        </text>
      ))}

      <path
        d={buildPath(blueData)}
        fill="none"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {blueData.map((d, i) => (
        <g key={`bd-${i}`}>
          <circle cx={toX(i)} cy={toY(d)} r="4" fill="white" stroke="#3B82F6" strokeWidth="2" />
        </g>
      ))}

      <path
        d={buildPath(redData)}
        fill="none"
        stroke="#EF4444"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {redData.map((d, i) => (
        <g key={`rd-${i}`}>
          <circle cx={toX(i)} cy={toY(d)} r="4" fill="white" stroke="#EF4444" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}

function BarChart() {
  const width = 340;
  const height = 160;
  const pad = { top: 16, right: 16, bottom: 32, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const data = [42, 68, 55, 80, 73, 92];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const barWidth = Math.min(30, (plotW / data.length) * 0.5);
  const gap = plotW / data.length;

  const toY = (v: number) => pad.top + plotH - (v / 100) * plotH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            y1={toY(v)}
            x2={width - pad.right}
            y2={toY(v)}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          <text
            x={pad.left - 6}
            y={toY(v) + 4}
            textAnchor="end"
            className="text-[10px]"
            fill="#9CA3AF"
          >
            {v}k
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const cx = pad.left + gap * i + gap / 2;
        const barH = (d / 100) * plotH;
        const y = pad.top + plotH - barH;
        return (
          <g key={i}>
            <rect
              x={cx - barWidth / 2}
              y={y}
              width={barWidth}
              height={barH}
              rx="4"
              ry="4"
              fill="#3B82F6"
            />
            <text
              x={cx}
              y={height - 8}
              textAnchor="middle"
              className="text-[10px]"
              fill="#9CA3AF"
            >
              {months[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart() {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 56;
  const innerR = 34;

  const segments = [
    { label: "FL", pct: 35, color: "#3B82F6" },
    { label: "CA", pct: 28, color: "#60A5FA" },
    { label: "TX", pct: 22, color: "#93C5FD" },
    { label: "NY", pct: 10, color: "#BFDBFE" },
    { label: "Other", pct: 5, color: "#DBEAFE" },
  ];

  const polarToCartesian = (
    cx: number,
    cy: number,
    r: number,
    angleDeg: number
  ) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: Number((cx + r * Math.cos(rad)).toFixed(2)),
      y: Number((cy + r * Math.sin(rad)).toFixed(2)),
    };
  };

  const describeArc = (startAngle: number, endAngle: number) => {
    const s = polarToCartesian(cx, cy, outerR, endAngle);
    const e = polarToCartesian(cx, cy, outerR, startAngle);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M${cx},${cy} L${e.x},${e.y} A${outerR},${outerR} 0 ${large} 0 ${s.x},${s.y} Z`;
  };

  let cumulative = 0;
  const slices = segments.map((seg) => {
    const angle = (seg.pct / 100) * 360;
    const start = cumulative;
    const end = cumulative + angle;
    cumulative = end;
    return { ...seg, start, end };
  });

  const legendItems = [
    { label: "FL", pct: 35, color: "#3B82F6" },
    { label: "CA", pct: 28, color: "#60A5FA" },
    { label: "TX", pct: 22, color: "#93C5FD" },
  ];

  return (
    <div className="flex items-center gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-[140px] h-[140px] shrink-0"
      >
        {slices.map((seg, i) => (
          <path
            key={i}
            d={describeArc(seg.start, seg.end)}
            fill={seg.color}
          />
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill="white" />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="text-lg"
          fontWeight="700"
          fill="#171717"
        >
          1.2M
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          className="text-[10px]"
          fill="#9CA3AF"
        >
          Agents
        </text>
      </svg>

      <div className="space-y-2">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs font-medium text-neutral-700">{item.label}</span>
            <span className="text-xs text-neutral-400 ml-auto tabular-nums">{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardMockup() {
  const navLinks = [
    { label: "Dashboard", icon: Radio, active: true },
    { label: "States Directory", icon: Map },
    { label: "Live Scraper", icon: Search },
    { label: "CSV Export", icon: Key },
  ];

  const kpiCards = [
    { label: "Total Agents", value: "1,248,500", icon: Users },
    { label: "Deliverable Leads", value: "1,238,000", icon: Inbox },
    { label: "Delivery Rate", value: "99.2%", icon: Percent },
    { label: "Base Price", value: "$0.019", icon: DollarSign },
  ];

  return (
    <div className="max-w-[1200px] w-full mx-auto">
      <div className="p-2 md:p-3 bg-[#F8F9FA] border border-neutral-200/80 rounded-[32px] md:rounded-[40px] shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
        <div className="bg-[#F9FAFB] rounded-[24px] md:rounded-[30px] border border-neutral-200/60 p-6 md:p-8 min-h-[540px]">
          <div className="flex h-full">
            <div className="w-44 shrink-0 border-r border-neutral-200/80 pr-4 space-y-5 hidden md:block">
              <p className="text-sm font-bold text-neutral-900 tracking-tight pt-0.5">
                LeadsDom
              </p>
              <nav className="space-y-0.5">
                {navLinks.map((link) => (
                  <div
                    key={link.label}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      link.active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    <link.icon className="h-3.5 w-3.5 shrink-0" />
                    {link.label}
                  </div>
                ))}
              </nav>
            </div>

            <div className="flex-1 pl-0 md:pl-5 space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-semibold text-neutral-900">Dashboard</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 w-44 h-7 text-[11px] bg-white border border-neutral-200 rounded-md px-2.5 text-neutral-400">
                    <Search className="h-3 w-3 shrink-0" />
                    <span>Search agents...</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 h-7 text-[10px] font-medium text-neutral-500 bg-white border border-neutral-200 rounded-md px-2.5">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                    Full Screen
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {kpiCards.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-none hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-neutral-400 mb-1.5">
                      <kpi.icon className="h-3.5 w-3.5" />
                      <p className="text-[10px] font-medium uppercase tracking-wider">
                        {kpi.label}
                      </p>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-neutral-200/60 bg-white p-5 min-h-[220px]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 mb-3">
                    Sales / Lead Trends
                  </p>
                  <LineChart />
                  <div className="flex items-center gap-4 mt-1.5 pl-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-[10px] text-neutral-500">Leads</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-[10px] text-neutral-500">Sales</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200/60 bg-white p-5 min-h-[220px]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 mb-3">
                    User Acquisition
                  </p>
                  <BarChart />
                </div>

                <div className="rounded-2xl border border-neutral-200/60 bg-white p-5 min-h-[220px]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 mb-3">
                    Top States Distribution
                  </p>
                  <DonutChart />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const ctaHref = isLoggedIn ? "/dashboard" : "/register";

  return (
    <section className="relative overflow-hidden bg-[#FAFAFA] pt-16 md:pt-24 pb-12">
      <CrosshairGridBackground />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full bg-gradient-to-tr from-neutral-200/50 via-slate-100/60 to-transparent blur-3xl -z-10 animate-pulse pointer-events-none [animation-duration:6s]" />

      <div className="mx-auto max-w-7xl px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-neutral-900 leading-[1.08] max-w-4xl mx-auto text-center">
          Find and Unlock Top Real Estate Agents Across 50 States
        </h1>

        <p className="text-base md:text-lg text-neutral-500 max-w-xl mx-auto mt-4 mb-6 text-center leading-relaxed">
          Direct contact information, 99% deliverable emails, and verified brokerages across all US
          territories.
        </p>

        <div className="flex items-center justify-center gap-4 mb-10">
          <Link
            href={ctaHref}
            className="rounded-full px-6 py-2.5 bg-black text-white font-medium text-sm hover:bg-neutral-800 transition-colors inline-flex items-center"
          >
            {isLoggedIn ? "Go to Dashboard →" : "Get started"}
          </Link>
          <Link
            href="/contact"
            className="text-sm font-medium text-neutral-700 hover:text-black flex items-center gap-1.5 transition-colors"
          >
            Contact us
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="relative mt-8">
          <div className="[mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)] md:[mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
            <DashboardMockup />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA]/80 to-transparent pointer-events-none z-10" />
        </div>
      </div>
    </section>
  );
}
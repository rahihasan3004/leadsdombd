"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface MonthlyData {
  month: string;
  leads: number;
  year: number;
}

interface MonthlyLeadVolumeChartProps {
  data: MonthlyData[];
}

function LeadVolumeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const leads = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold text-neutral-900">{label}</p>
      <p className="text-xs text-neutral-500">{leads.toLocaleString()} leads ingested</p>
    </div>
  );
}

export function MonthlyLeadVolumeChart({ data }: MonthlyLeadVolumeChartProps) {
  return (
    <div className="h-[260px] w-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="leadVolumeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#465FFF" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#465FFF" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#737373" }}
            dy={8}
          />
          <YAxis
            domain={[0, "auto"]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#737373" }}
            allowDecimals={false}
          />
          <Tooltip content={<LeadVolumeTooltip />} cursor={{ fill: "#F3F4F6" }} />
          <Bar
            dataKey="leads"
            fill="url(#leadVolumeFill)"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

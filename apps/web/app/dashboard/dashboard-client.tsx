"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Check,
  MoreVertical,
  Users,
  Wallet,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthlyLeadVolumeChart } from "@/components/dashboard/monthly-lead-volume-chart";
import { formatNumber } from "@fine-leads/utils";

interface MonthlyData {
  month: string;
  leads: number;
  year: number;
}

interface DashboardMetrics {
  totalLeads: number;
  availableCredits: number;
  walletBalance: number;
  deliveredFiles: number;
  deliverability: number;
  monthlyTrends: MonthlyData[];
}

interface DashboardClientProps {
  metrics: DashboardMetrics;
  userName: string;
}

export function DashboardClient({ metrics, userName }: DashboardClientProps) {
  const router = useRouter();
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchaseCancelled, setPurchaseCancelled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "success" || params.get("checkout_success") === "true") {
      setPurchaseSuccess(true);
      router.refresh();
      window.history.replaceState({}, "", "/dashboard");
    } else if (params.get("purchase") === "cancelled") {
      setPurchaseCancelled(true);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [router]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const totalLeadsFormatted = formatNumber(metrics.totalLeads);
  const creditsFormatted = metrics.availableCredits.toLocaleString();
  const deliveredFilesFormatted = `${metrics.deliveredFiles} File${metrics.deliveredFiles === 1 ? "" : "s"}`;
  const deliverabilityFormatted = `${metrics.deliverability}%`;
  const radius = 100;
  const halfCircumference = Math.PI * radius; // 314.16
  const percentage = Math.min(Math.max(Number(metrics.deliverability ?? 99), 0), 99);
  const strokeDashoffset = halfCircumference - (halfCircumference * percentage) / 100;

  return (
    <div className="w-full p-3.5 sm:p-6 lg:p-8 space-y-6">
      {purchaseSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200/60 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-700">
              Purchase successful
            </p>
            <p className="text-xs text-emerald-600">
              Your selected states have been unlocked. You can now export lead data.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPurchaseSuccess(false)}
            className="text-emerald-400 hover:text-emerald-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {purchaseCancelled && (
        <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-4 flex items-center gap-3">
          <X className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700">
              Payment cancelled
            </p>
            <p className="text-xs text-amber-600">
              Your payment was not completed. Try again when you&apos;re ready.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPurchaseCancelled(false)}
            className="text-amber-400 hover:text-amber-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500 mb-0.5">
            Welcome back, {userName}
          </p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900">
            Dashboard
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Real-time pipeline overview and lead intelligence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-600 bg-white border border-neutral-200/80 rounded-lg px-3 py-1.5">
            {today}
          </span>
          <a
            href="/dashboard/search"
            className="inline-flex items-center h-9 px-4 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-none border-0"
          >
            + New Lead Search
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4 lg:gap-6">
        <KpiCard
          label="Total Leads in Vault"
          value={totalLeadsFormatted}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
        />
        <KpiCard
          label="Available Credits"
          value={creditsFormatted}
          icon={Wallet}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
          action={{ label: "+ Buy Credits", href: "/dashboard/billing" }}
        />
        <KpiCard
          label="Delivered Files"
          value={deliveredFilesFormatted}
          icon={FileText}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
        />
        <KpiCard
          label="Vault Deliverability"
          value={deliverabilityFormatted}
          icon={CheckCircle2}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
          badge="Zero Bounce"
        />
      </div>

      <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white shadow-none border-0 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Monthly Lead Volume
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Leads ingested in your vault
              </p>
            </div>
            <button className="text-neutral-400 hover:text-neutral-600 transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <MonthlyLeadVolumeChart data={metrics.monthlyTrends} />
        </div>

        <div className="bg-white shadow-none border-0 rounded-2xl p-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-900">
              Vault Deliverability
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {metrics.deliverability}% guaranteed active &amp; SMTP verified
            </p>
          </div>
          <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center my-2">
            <svg viewBox="0 0 240 135" className="w-64 max-w-full overflow-visible">
              <path
                d="M 20 120 A 100 100 0 0 1 220 120"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                d="M 20 120 A 100 100 0 0 1 220 120"
                fill="none"
                stroke="#2563EB"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={halfCircumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute top-[35%] flex flex-col items-center">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{metrics.deliverability}%</span>
              <span className="mt-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Guaranteed Active
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 w-full">
            <div className="text-center">
              <p className="text-base font-bold text-neutral-900">
                {formatNumber(metrics.totalLeads)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Delivered</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-neutral-900">{metrics.deliverability}% Valid</p>
              <p className="text-xs text-slate-400 mt-0.5">Verified</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-neutral-900">{(100 - metrics.deliverability).toFixed(1)}%</p>
              <p className="text-xs text-slate-400 mt-0.5">Bounce Risk</p>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

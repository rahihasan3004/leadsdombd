"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
import { formatNumber } from "@fine-leads/utils";
import { useQuery } from "@tanstack/react-query";

interface MonthlyData {
  month: string;
  leads: number;
  orders: number;
}

interface RecentOrder {
  id: string;
  orderId: string;
  date: string;
  states: string;
  category: string;
  quantity: number;
  status: string;
}

interface DashboardMetrics {
  totalLeads: number;
  availableBalance: number;
  walletBalance: number;
  deliveredFiles: number;
  deliverability: number;
  monthlyTrends: MonthlyData[];
  recentOrders: RecentOrder[];
}

const EMPTY_METRICS: DashboardMetrics = {
  totalLeads: 0,
  availableBalance: 0,
  walletBalance: 0,
  deliveredFiles: 0,
  deliverability: 100,
  monthlyTrends: [],
  recentOrders: [],
};

const formatCurrency = (val: number | string | undefined | null) => {
  const num = typeof val === "number" ? val : Number(val ?? 0);
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
};

export default function DashboardPage() {
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchaseCancelled, setPurchaseCancelled] = useState(false);
  const { data: session, status: sessionStatus } = useSession();
  const userName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "User";

  const { data: metrics = EMPTY_METRICS, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", "metrics"],
    enabled: sessionStatus === "authenticated",
    queryFn: async () => {
      const res = await fetch("/api/dashboard/metrics", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard metrics");
      return res.json() as Promise<DashboardMetrics>;
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "success" || params.get("checkout_success") === "true") {
      setPurchaseSuccess(true);
      refetch();
      window.history.replaceState({}, "", "/dashboard");
    } else if (params.get("purchase") === "cancelled") {
      setPurchaseCancelled(true);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [refetch]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const totalLeadsFormatted = formatNumber(metrics.totalLeads);
  const walletFormatted = formatCurrency(metrics?.availableBalance ?? 0);
  const deliveredFilesFormatted = `${metrics.deliveredFiles} File${metrics.deliveredFiles === 1 ? "" : "s"}`;
  const deliverabilityFormatted = `${metrics.deliverability}%`;

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

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
        <KpiCard
          label="Total Leads in Vault"
          value={isLoading ? "—" : totalLeadsFormatted}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
        />
        <KpiCard
          label="Available Balance"
          value={isLoading ? "—" : walletFormatted}
          icon={Wallet}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
          action={{ label: "+ Top Up", href: "/dashboard/billing" }}
        />
        <KpiCard
          label="Delivered Files"
          value={isLoading ? "—" : deliveredFilesFormatted}
          icon={FileText}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
        />
        <KpiCard
          label="Vault Deliverability"
          value={isLoading ? "—" : deliverabilityFormatted}
          icon={CheckCircle2}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
          badge="Zero Bounce"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
          {error ? (
            <div className="flex items-center justify-center h-[180px] text-xs text-red-500">
              {error instanceof Error ? error.message : "Failed to load chart"}
            </div>
          ) : (
            <div className="flex items-end gap-2 h-[180px]">
              {metrics.monthlyTrends.map((item, index) => {
                const leadHeight = Math.max(1, (item.leads / Math.max(1, ...metrics.monthlyTrends.map(m => m.leads))) * 100);
                return (
                  <div
                    key={item.month}
                    className="flex-1 flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-full flex items-end justify-center"
                      style={{ height: "100%" }}
                    >
                      <div
                        className="bg-[#465FFF] hover:bg-[#3B50E0] rounded-t-sm w-4 md:w-5 transition-all duration-300"
                        style={{ height: `${leadHeight}%` }}
                        title={`${item.leads.toLocaleString()} leads`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-neutral-400">
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
            <div className="relative w-[180px] h-[90px]">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <path
                  d="M 10 100 A 80 80 0 0 1 190 100"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 100 A 80 80 0 0 1 190 100"
                  fill="none"
                  stroke="#465FFF"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 80}
                  strokeDashoffset={2 * Math.PI * 80 * (1 - metrics.deliverability / 100)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                <span className="text-2xl font-bold text-neutral-900">{metrics.deliverability}%</span>
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 mt-1">
                  {metrics.deliverability === 100 ? "Guaranteed Active" : "Verified"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6 w-full">
              <div className="text-center">
                <p className="text-xs font-semibold text-neutral-900">
                  {isLoading ? "—" : formatNumber(metrics.totalLeads)}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Delivered</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-neutral-900">{metrics.deliverability}% Valid</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Verified</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-neutral-900">{(100 - metrics.deliverability).toFixed(1)}%</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Bounce Risk</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

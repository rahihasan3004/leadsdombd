"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  X,
  Check,
  Download,
  MoreVertical,
  Users,
  Wallet,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatNumber } from "@fine-leads/utils";

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

const formatCurrency = (val: any) => {
  const num = typeof val === "number" ? val : Number(val?.toString?.() || val || 0);
  return isNaN(num) ? "$0.00" : `$${num.toFixed(2)}`;
};

export default function DashboardPage() {
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchaseCancelled, setPurchaseCancelled] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "User";

  const fetchMetrics = useCallback(async () => {
    if (sessionStatus !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/metrics", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard metrics");
      const data: DashboardMetrics = await res.json();
      setMetrics(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, [sessionStatus]);

  const handleDownloadCsv = useCallback((states: string) => {
    const stateList = states.split(",").map((s) => s.trim()).filter(Boolean);
    stateList.forEach((stateCode) => {
      const url = `/api/exports/stream?state=${encodeURIComponent(stateCode)}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "success" || params.get("checkout_success") === "true") {
      setPurchaseSuccess(true);
      window.history.replaceState({}, "", "/dashboard");
    } else if (params.get("purchase") === "cancelled") {
      setPurchaseCancelled(true);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  useEffect(() => {
    fetch("/api/user/profile", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.walletBalance !== undefined) {
          setLiveBalance(Number(data.walletBalance));
        }
      })
      .catch((err) => console.error("Error fetching live profile balance:", err));
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const totalLeadsFormatted = formatNumber(metrics.totalLeads);
  const walletFormatted = formatCurrency(metrics?.availableBalance ?? 0);
  const deliveredFilesFormatted = `${metrics.deliveredFiles} File${metrics.deliveredFiles === 1 ? "" : "s"}`;
  const verifiedCount = metrics.totalLeads;
  const verifiedFormatted = `${formatNumber(verifiedCount)} Valid`;

  return (
    <div className="w-full min-h-screen bg-[#F4F7FB] p-6 md:p-8 space-y-6">
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
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Leads in Vault"
          value={loading ? "—" : totalLeadsFormatted}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
        />
        <KpiCard
          label="Available Balance"
          value={liveBalance === null ? "—" : formatCurrency(liveBalance)}
          icon={Wallet}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
          action={{ label: "+ Top Up", href: "/dashboard/billing" }}
        />
        <KpiCard
          label="Delivered Files"
          value={loading ? "—" : deliveredFilesFormatted}
          icon={FileText}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
        />
        <KpiCard
          label="Vault Deliverability"
          value="100%"
          icon={CheckCircle2}
          iconBg="bg-blue-50"
          iconColor="text-[#465FFF]"
          badge="Zero Bounce"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border-0 shadow-none rounded-2xl p-6">
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
              {error}
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

        <div className="bg-white border-0 shadow-none rounded-2xl p-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-900">
              Vault Deliverability
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              100% guaranteed active &amp; SMTP verified
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
                  strokeDashoffset="0"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                <span className="text-2xl font-bold text-neutral-900">100%</span>
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 mt-1">
                  Guaranteed Active
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6 w-full">
              <div className="text-center">
                <p className="text-xs font-semibold text-neutral-900">
                  {loading ? "—" : formatNumber(metrics.totalLeads)}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Delivered</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-neutral-900">100% Valid</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Verified</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-neutral-900">0.0%</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Bounce Risk</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-0 shadow-none rounded-2xl p-6 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-neutral-900">
            Recent Lead Orders &amp; Batches
          </h3>
          <a
            href="/dashboard/lists"
            className="text-xs font-semibold text-neutral-900 hover:text-neutral-600 transition-colors"
          >
            View All in Vault &rarr;
          </a>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="h-9 px-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Order ID &amp; Date
                </th>
                <th className="h-9 px-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Target States
                </th>
                <th className="h-9 px-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="h-9 px-4 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="h-9 px-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="h-9 px-4 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentOrders && metrics.recentOrders.length > 0
                ? metrics.recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-neutral-900 tabular-nums">
                          {order.orderId}
                        </span>
                        <p className="text-neutral-400 tabular-nums mt-0.5">
                          {order.date}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-neutral-100 border border-neutral-200/60 text-neutral-700 font-medium">
                        {order.states}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-neutral-600 font-medium">
                        {order.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-neutral-900 font-bold tabular-nums">
                        {order.quantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-600 font-semibold text-xs">
                        {order.status || "Delivered"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadCsv(order.states)}
                        className="inline-flex items-center gap-1.5 h-11 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-all duration-200 shadow-none border-0 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download CSV
                      </button>
                    </td>
                  </tr>
                ))
                : (
                  <tr>
                    <td colSpan={6} className="py-10 px-4 text-center text-sm text-neutral-400">
                      No orders yet. Your recent lead purchases will appear here.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

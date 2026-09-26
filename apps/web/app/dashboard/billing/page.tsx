"use client";

import { useState, useEffect, useCallback } from "react";



interface WalletData {
  walletBalance: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    balanceAfter?: number | null;
    status: string;
    createdAt: string;
  }>;
}

export default function BillingPage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [data, setData] = useState<WalletData>({
    walletBalance: 0,
    transactions: [],
  });
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 5;

  const metrics = { availableBalance: 0 };

  const fetchBillingData = useCallback(async () => {
    try {
      const [txRes, profileRes] = await Promise.all([
        fetch("/api/billing/transactions"),
        fetch("/api/user/profile"),
      ]);
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        setLiveBalance(Number(profileJson.walletBalance ?? 0));
      }
      if (txRes.ok) {
        const json = await txRes.json();
        setData(json);
        setError(null);
      } else {
        const json = await txRes.json().catch(() => ({}));
        setError(json.error || "Failed to load billing data");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.transactions.length]);

  const handleAddFunds = useCallback(async () => {
    const amount = customAmount
      ? parseFloat(customAmount)
      : selectedAmount;

    if (!amount || amount <= 0) {
      setError("Please select or enter a valid amount");
      return;
    }

    if (amount < 1) {
      setError("Minimum recharge is $1.00.");
      return;
    }

    if (amount > 1000) {
      setError("Maximum single recharge is $1,000.00.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/billing/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      });

      const json = await res.json();

      if (res.ok) {
        setSelectedAmount(null);
        setCustomAmount("");
        if (json.url) {
          window.location.href = json.url;
          return;
        }
        setSuccessMessage(json.message || "Funds added successfully.");
        if (json.newBalance != null) {
          setLiveBalance(Number(json.newBalance));
        }
        await fetchBillingData();
      } else {
        setError(json.error || "Failed to add funds");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedAmount, customAmount, fetchBillingData]);

  const formatCurrency = (val: any) => {
    const num = typeof val === "number" ? val : Number(val?.toString?.() || val || 0);
    return isNaN(num) ? "$0.00" : `$${num.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const transactions = data.transactions;
  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (pageLoading) {
    return (
      <div className="w-full min-h-screen bg-slate-50 p-6 pb-6 animate-pulse">
        <div className="h-7 w-64 bg-slate-200 rounded-md" />
        <div className="h-5 w-96 bg-slate-200 rounded-md mt-2" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mt-6">
          <div className="lg:col-span-8 h-72 bg-slate-200 rounded-2xl" />
          <div className="lg:col-span-4 h-72 bg-slate-200 rounded-2xl" />
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl mt-6" />
      </div>
    );
  }

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "TOPUP":
      case "RECHARGE":
        return { amountClass: "text-emerald-600" };
      case "PURCHASE":
        return { amountClass: "text-slate-900" };
      case "REFUND":
        return { amountClass: "text-emerald-600" };
      default:
        return { amountClass: "text-slate-900" };
    }
  };

  return (
      <div className="w-full min-h-screen bg-slate-50 p-3.5 sm:p-6 lg:p-8 pb-3.5 sm:pb-6 lg:pb-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Billing & Wallet Balance
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Pre-load wallet funds for instant 1-click lead purchases and manage
          your transaction ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Available Wallet Balance
            </div>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(liveBalance ?? data?.walletBalance ?? 0)}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Amount to Recharge (USD)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                step="0.01"
                value={customAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setCustomAmount("");
                    setSelectedAmount(null);
                    setError(null);
                    return;
                  }
                  const num = parseFloat(val);
                  if (!isNaN(num)) {
                    if (num > 1000) setCustomAmount("1000");
                    else if (num < 1) setCustomAmount("1");
                    else setCustomAmount(val);
                  }
                  setSelectedAmount(null);
                  setError(null);
                }}
                placeholder="Enter amount in USD ($1 – $1,000)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-[#465FFF] transition-colors"
              />
              <p className="text-xs text-slate-400 mt-1.5 font-normal">
                Min: $1.00 · Max: $1,000.00 per top-up transaction
              </p>
            </div>

            {error && (
              <div className="text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="text-xs font-medium text-slate-600">
                {successMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddFunds}
              disabled={loading || (!selectedAmount && !customAmount)}
               className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-none border-0 transition-all duration-200 block text-center disabled:opacity-50"
            >
              {loading ? "Processing..." : "Add Funds to Wallet →"}
            </button>

            <div className="text-xs text-slate-400">
              Secure 256-Bit Encrypted Checkout · Instant Balance Credit · No Monthly Lock-in
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="text-lg font-bold text-slate-900 mb-1">
              Custom Territory Feeds
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              For acquisition teams, marketing agencies, and funds requiring 50,000+ lead bulk territories.
            </p>

            <ul className="space-y-3">
              {[
                "Custom volume pricing for 50,000+ batches",
                "Dedicated data manager and CRM mapping",
                "Flexible invoicing and wire transfer support",
              ].map((benefit) => (
                <li
                  key={benefit}
                  className="text-sm text-slate-700"
                >
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <a
            href="/contact"
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors text-center block no-underline"
          >
            Contact Sales →
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between min-h-[300px]">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200/60 p-4 flex items-center gap-3">
            <span className="text-xs font-medium text-red-600 flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        {/* Top: Header */}
        <div className="shrink-0">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Transaction Ledger</h2>
          <p className="text-xs text-slate-400 mt-0.5">Full historical record of your wallet top-ups, lead purchases, and automated adjustments.</p>
        </div>

         {/* Middle: 5 Rows Table OR Empty State (Same Fixed Space) */}
        <div className="flex-1 flex flex-col justify-center my-2 overflow-hidden">
          {transactions.length > 0 ? (
            <div className="w-full overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="border-b border-slate-100 text-[11px] font-normal text-slate-400 uppercase">
                <tr className="h-8">
                  <th className="py-2 px-4 font-medium">Transaction ID & Date</th>
                  <th className="py-2 px-4 font-medium">Type</th>
                  <th className="py-2 px-4 font-medium">Description</th>
                  <th className="py-2 px-4 font-medium text-right">Amount</th>
                  <th className="py-2 px-4 font-medium text-right">Balance After</th>
                  <th className="py-2 px-4 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTransactions.map((tx) => {
                  const isPositive = tx.amount >= 0;
                  const typeConfig = getTypeConfig(tx.type);

                  return (
                     <tr key={tx.id} className="h-11 hover:bg-slate-50/70 text-xs transition-colors">
                      <td className="py-2 px-4 whitespace-nowrap">
                        <div className="text-xs font-sans font-normal text-sm text-slate-900">
                          {tx.id}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatDate(tx.createdAt)}
                        </div>
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap text-xs text-slate-700">
                        {tx.type === "TOPUP" || tx.type === "RECHARGE" ? "Top-up" : tx.type === "PURCHASE" ? "Purchase" : tx.type === "REFUND" ? "Refund" : tx.type}
                      </td>
                      <td className="py-2 px-4 text-slate-700 text-xs max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td
                        className={`py-2 px-4 text-xs font-semibold tabular-nums whitespace-nowrap text-right ${typeConfig.amountClass}`}
                      >
                        {isPositive ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2 px-4 text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap text-right">
                        {tx.balanceAfter != null
                          ? formatCurrency(tx.balanceAfter)
                          : "—"}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap text-right text-xs font-medium">
                        {tx.status === "COMPLETED" && <span className="text-emerald-600">Completed</span>}
                        {tx.status === "PENDING" && <span className="text-amber-600">Pending</span>}
                        {tx.status === "FAILED" && <span className="text-red-600">Failed</span>}
                        {tx.status === "REFUNDED" && <span className="text-slate-500">Refunded</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No transactions recorded yet. Your top-ups and purchases will appear here.
            </div>
          )}
        </div>

        {/* Bottom: Pagination Bar (Always fixed at bottom of card) */}
        <div className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing{" "}
            <strong className="text-slate-900 tabular-nums font-semibold">
              {transactions.length === 0
                ? "0"
                : `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)}`}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-900 tabular-nums font-semibold">
              {transactions.length}
            </strong>{" "}
            transactions
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-200 ${
                  currentPage === page
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

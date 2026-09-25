"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Download,
  ArrowLeft,
  ArrowRight,
  Database,
  ChevronRight,
  Calendar,
  ExternalLink,
  Filter,
} from "lucide-react";
import { Skeleton } from "@fine-leads/ui";
import {
  AgentDetailModal,
  type AgentData,
} from "@/components/dashboard/agent-detail-modal";

interface OrderRow {
  referenceId: string;
  id: string;
  orderDate: string;
  states: string;
  category: string;
  quantity: number;
  status: string;
}

interface Purchase {
  id: string;
  referenceId: string;
  state: string | null;
  unlockedStates: string[];
  amountPaid: number;
  status: string;
  createdAt: string;
}

const PAGE_SIZE = 10;
const LEAD_PAGE_SIZE = 10;

function formatQuantity(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTimezoneDisplay(tz: string | null): string {
  if (!tz) return "--";
  const map: Record<string, string> = {
    "America/New_York": "Eastern",
    "America/Chicago": "Central",
    "America/Denver": "Mountain",
    "America/Los_Angeles": "Pacific",
    "America/Anchorage": "Alaska",
    "Pacific/Honolulu": "Hawaii",
  };
  return map[tz] ?? tz;
}

export default function ListsPage() {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [orderPage, setOrderPage] = useState(0);
  const [leadPage, setLeadPage] = useState(0);
  const [leads, setLeads] = useState<AgentData[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [totalLeads, setTotalLeads] = useState(0);
  const leadSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const res = await fetch("/api/purchases");
        if (res.ok) {
          const data = await res.json();
          const mapped: Purchase[] = (data.purchases || []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            referenceId: p.referenceId as string,
            state: p.state as string | null,
            unlockedStates: (p.unlockedStates as string[]) || [],
            amountPaid: Number(p.amountPaid) || 0,
            status: p.status as string,
            createdAt: p.createdAt as string,
          }));
          setPurchases(mapped);
        }
      } catch {
        // handle error silently, show empty state
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, []);

  useEffect(() => {
    setOrderPage(0);
  }, [orderSearch]);

  useEffect(() => {
    setLeadPage(0);
  }, [leadSearch]);

  const filteredPurchases = useMemo(() => {
    const q = orderSearch.toLowerCase().trim();
    if (!q) return purchases;
    return purchases.filter(
      (p) =>
        p.referenceId.toLowerCase().includes(q) ||
        p.unlockedStates.some((s) => s.toLowerCase().includes(q))
    );
  }, [orderSearch, purchases]);

  const totalOrderPages = Math.ceil(filteredPurchases.length / PAGE_SIZE);
  const paginatedPurchases = useMemo(() => {
    const start = orderPage * PAGE_SIZE;
    return filteredPurchases.slice(start, start + PAGE_SIZE);
  }, [filteredPurchases, orderPage]);

  const showingFrom = filteredPurchases.length === 0 ? 0 : orderPage * PAGE_SIZE + 1;
  const showingTo = Math.min((orderPage + 1) * PAGE_SIZE, filteredPurchases.length);

  const handleSelectPurchase = useCallback(async (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setLeadSearch("");
    setLeadPage(0);
    setLeadsLoading(true);
    setLeads([]);

    try {
      const states = purchase.unlockedStates.join(",");
      const res = await fetch(`/api/agents?state=${states}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.agents || []);
        setTotalLeads(data.pagination?.total || (data.agents || []).length);
      }
    } catch {
      setLeads([]);
    } finally {
      setLeadsLoading(false);
      setTimeout(() => leadSearchRef.current?.focus(), 100);
    }
  }, []);

  const handleBackToOrders = useCallback(() => {
    setSelectedPurchase(null);
    setLeadSearch("");
    setLeadPage(0);
    setLeads([]);
  }, []);

  const handleOpenAgent = useCallback((agent: AgentData) => {
    setSelectedAgent(agent);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedAgent(null);
  }, []);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.toLowerCase().trim();
    if (!q) return leads;
    return leads.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        (a.brokerageName || "").toLowerCase().includes(q) ||
        (a.city || "").toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q)
    );
  }, [leads, leadSearch]);

  const handleDownloadCsv = useCallback((states: string[]) => {
    states.forEach((stateCode) => {
      const url = `/api/exports/stream?state=${encodeURIComponent(stateCode)}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }, []);

  const totalLeadPages = Math.ceil(filteredLeads.length / LEAD_PAGE_SIZE);
  const paginatedLeads = useMemo(() => {
    const start = leadPage * LEAD_PAGE_SIZE;
    return filteredLeads.slice(start, start + LEAD_PAGE_SIZE);
  }, [filteredLeads, leadPage]);

  const leadShowingFrom = filteredLeads.length === 0 ? 0 : leadPage * LEAD_PAGE_SIZE + 1;
  const leadShowingTo = Math.min((leadPage + 1) * LEAD_PAGE_SIZE, filteredLeads.length);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-[#F4F7FB] p-6 pb-4 space-y-4">
        <div className="bg-white rounded-2xl border-0 shadow-none p-7 md:p-9 space-y-6">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-64 rounded-xl" />
          <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-slate-100 px-4 py-4">
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (purchases.length === 0 && !selectedPurchase) {
    return (
      <div className="w-full min-h-screen bg-[#F4F7FB] p-6 pb-4 space-y-4">
        <div className="bg-white rounded-2xl border-0 shadow-none p-7 md:p-9 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              My Leads Vault
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Access, search, and export your unlocked Real Estate Agent databases.
            </p>
          </div>

          <div className="min-h-[400px] border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100">
              <Database className="h-6 w-6 text-slate-400" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Your Lead Vault is Empty
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
              You haven&apos;t unlocked any lead databases yet. Start by ordering verified territories.
            </p>
            <a
              href="/dashboard/search"
              className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-semibold transition-all duration-200 shadow-none border-0"
            >
              Order Leads Now
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (selectedPurchase) {
    return (
      <>
        <div className="w-full h-screen bg-[#F4F7FB] p-6 overflow-hidden flex flex-col">
          <div className="bg-white border-0 shadow-none rounded-2xl p-6 md:p-8 flex flex-col h-[calc(100vh-48px)] overflow-hidden justify-between">
            <div className="shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBackToOrders}
                    className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#465FFF] hover:bg-[#F0F4FF] font-medium text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to All Orders
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Order #{selectedPurchase.referenceId}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1.5">
                      {selectedPurchase.unlockedStates.join(", ")} · {formatQuantity(Math.round(selectedPurchase.amountPaid / 0.019))} Verified Leads
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv(selectedPurchase.unlockedStates)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-none border-0 transition-all duration-200 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Download Full CSV
                </button>
              </div>

              <div className="mt-6 mb-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    ref={leadSearchRef}
                    type="text"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search agents in this order by name, brokerage, city, or email..."
                    className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#465FFF] bg-white pl-10 placeholder:text-slate-400 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="w-full flex-1 overflow-hidden my-2">
              {leadsLoading ? (
                <div className="w-full divide-y divide-slate-100">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-4">
                      <Skeleton className="h-5 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-[11px] font-normal text-slate-400 uppercase tracking-wider">
                    <tr className="h-14">
                      <th className="px-4 align-middle text-left">Agent & Company</th>
                      <th className="px-4 align-middle text-left">Category</th>
                      <th className="px-4 align-middle text-left">Direct Phone</th>
                      <th className="px-4 align-middle text-left">Verified Email</th>
                      <th className="px-4 align-middle text-left">Location</th>
                      <th className="px-4 align-middle text-left">Rating & Reviews</th>
                      <th className="px-4 align-middle text-left">Timezone</th>
                      <th className="px-4 align-middle text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedLeads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                          {leadSearch ? "No agents match your search." : "No agents available for this order."}
                        </td>
                      </tr>
                    ) : (
                      paginatedLeads.map((agent) => (
                        <tr
                          key={agent.id}
                          className="h-14 hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => handleOpenAgent(agent)}
                        >
                          <td className="px-4 align-middle text-xs">
                            <span className="font-normal text-slate-900">
                              {agent.fullName}
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {agent.brokerageName}
                            </p>
                          </td>
                          <td className="px-4 align-middle text-xs">
                            <span className="font-normal text-slate-600">
                              {agent.category ?? "Real Estate Agent"}
                            </span>
                          </td>
                          <td className="px-4 align-middle text-xs font-sans text-sm font-normal text-slate-800">
                            {agent.phone ?? "--"}
                          </td>
                          <td className="px-4 align-middle text-xs">
                            <span className="text-xs text-slate-800 select-all">
                              {agent.email}
                            </span>
                          </td>
                          <td className="px-4 align-middle text-xs">
                            <span className="font-normal text-slate-700">
                              {[agent.city, agent.state].filter(Boolean).join(", ") || "--"}
                            </span>
                          </td>
                          <td className="px-4 align-middle text-xs">
                            <span className="font-normal text-slate-700 tabular-nums">
                              {agent.rating != null
                                ? `★ ${agent.rating.toFixed(1)} (${agent.reviewCount})`
                                : "--"}
                            </span>
                          </td>
                          <td className="px-4 align-middle text-xs">
                            <span className="font-normal text-slate-500">
                              {formatTimezoneDisplay(agent.timezone)}
                            </span>
                          </td>
                          <td className="px-4 align-middle text-xs text-right">
                            {agent.googleMapsLink ? (
                              <a
                                href={agent.googleMapsLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs font-normal text-slate-600 hover:text-slate-900 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View on Maps
                              </a>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            <div className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing{" "}
                <strong className="text-slate-900 tabular-nums">{leadShowingFrom}&ndash;{leadShowingTo}</strong>{" "}
                of{" "}
                <strong className="text-slate-900 tabular-nums">{filteredLeads.length}</strong>{" "}
                agents
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={leadPage === 0}
                  onClick={() => setLeadPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalLeadPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setLeadPage(page - 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all duration-200 shadow-none border-0 ${
                      leadPage === page - 1
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={leadPage >= totalLeadPages - 1}
                  onClick={() => setLeadPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <AgentDetailModal
          agent={selectedAgent}
          open={modalOpen}
          onClose={handleCloseModal}
        />
      </>
    );
  }

  return (
    <div className="w-full h-screen bg-[#F4F7FB] p-6 overflow-hidden flex flex-col">
      <div className="bg-white border-0 shadow-none rounded-2xl p-6 md:p-8 flex flex-col h-[calc(100vh-48px)] overflow-hidden justify-between">
        <div className="shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                My Leads Vault
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Access, search, and export your unlocked Real Estate Agent databases.
              </p>
            </div>
            <a
              href="/dashboard/search"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-none border-0 transition-all duration-200 flex items-center gap-2"
            >
              + Order Leads
            </a>
          </div>

          <div className="mt-6 mb-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search orders by Order ID or State..."
                className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#465FFF] bg-white pl-10 placeholder:text-slate-400 focus:outline-none transition-colors"
              />
            </div>
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
        </div>

        <div className="w-full flex-1 overflow-hidden my-2">
          <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] font-normal text-slate-400 uppercase tracking-wider">
              <tr className="h-14">
                <th className="px-4 align-middle text-left">Order ID & Date</th>
                <th className="px-4 align-middle text-left">Target States</th>
                <th className="px-4 align-middle text-left">Category</th>
                <th className="px-4 align-middle text-right">Quantity</th>
                <th className="px-4 align-middle text-left">Status</th>
                <th className="px-4 align-middle text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    No orders match your search.
                  </td>
                </tr>
              ) : (
                paginatedPurchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="h-14 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleSelectPurchase(purchase)}
                  >
                    <td className="px-4 align-middle text-xs">
                      <div>
                        <span className="font-normal text-slate-900 tabular-nums">
                          {purchase.referenceId}
                        </span>
                        <p className="text-xs text-slate-400 font-normal tabular-nums mt-0.5">
                          {formatDate(purchase.createdAt)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 align-middle text-xs">
                      <span className="font-normal text-[11px] text-[#465FFF] bg-[#F0F4FF] px-2 py-0.5 rounded-md">
                        {purchase.unlockedStates.join(", ")}
                      </span>
                    </td>
                    <td className="px-4 align-middle text-xs">
                      <span className="font-normal text-slate-600 text-xs">
                        Real Estate Agents
                      </span>
                    </td>
                    <td className="px-4 align-middle text-xs text-right">
                      <span className="font-normal text-slate-800 text-xs tabular-nums">
                        {formatQuantity(Math.round(purchase.amountPaid / 0.019))}
                      </span>
                    </td>
                    <td className="px-4 align-middle text-xs">
                      <span className="font-normal text-emerald-600 text-xs">
                        {purchase.status || "Delivered"}
                      </span>
                    </td>
                    <td className="px-4 align-middle text-xs text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPurchase(purchase);
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-none border-0 transition-all duration-200 cursor-pointer"
                        >
                          View Leads
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadCsv(purchase.unlockedStates);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F4FF] text-[#465FFF] border border-blue-100 hover:bg-blue-100/70 font-semibold text-xs shadow-none transition-colors cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing{" "}
            <strong className="text-slate-900 tabular-nums">{showingFrom}</strong>
            &ndash;<strong className="text-slate-900 tabular-nums">{showingTo}</strong>{" "}
            of{" "}
            <strong className="text-slate-900 tabular-nums">{filteredPurchases.length}</strong>{" "}
            orders
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={orderPage === 0}
              onClick={() => setOrderPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalOrderPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setOrderPage(page - 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all duration-200 shadow-none border-0 ${
                      orderPage === page - 1
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={orderPage >= totalOrderPages - 1}
              onClick={() => setOrderPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

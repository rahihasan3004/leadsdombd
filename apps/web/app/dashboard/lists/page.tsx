"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search,
  ArrowLeft,
  ArrowRight,
  Database,
  ChevronRight,
  Calendar,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import type { LeadTier } from "@fine-leads/utils";
import {
  OrderStatusBadge,
  isOrderDownloadable,
} from "@/components/dashboard/order-status-badge";
import { VaultExportControl } from "@/components/dashboard/vault-export-control";
import { ColdCallingTierBadge } from "@/components/dashboard/lead-tier-badge";
import { Skeleton } from "@fine-leads/ui";
import { BrandedLoader } from "@/components/ui/branded-loader";
import { DashboardPagination } from "@/components/ui/dashboard-pagination";
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
  tier: LeadTier;
  id: string;
  referenceId: string;
  state: string | null;
  unlockedStates: string[];
  amountPaid: number;
  status: string;
  createdAt: string;
  quantity: number;
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

function formatPhone(phone: string | null): string {
  if (!phone) return "--";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function formatStateBadge(states: string[]) {
  if (states.length === 0) return { label: "--" };
  if (
    states.length >= 50 ||
    states.some((state) => /^(ALL|ALL[ _-]+STATES)$/i.test(state.trim()))
  )
    return { label: "All States" };
  if (states.length === 1) return { label: states[0] };
  return { label: `${states[0]}+${states.length - 1}` };
}

export default function ListsPage() {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [ordersReady, setOrdersReady] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(
    null,
  );
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
  const syncAttempts = useRef(new Map<string, number>());

  // Resolve the billing deep link before issuing the first (and only) page request.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("order");
    if (ref) setOrderSearch(ref);
    setOrdersReady(true);
  }, []);

  useEffect(() => {
    if (!ordersReady) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        try {
          const params = new URLSearchParams({
            view: "orders",
            page: String(orderPage + 1),
            limit: String(PAGE_SIZE),
          });
          if (orderSearch.trim()) params.set("q", orderSearch.trim());
          const res = await fetch(`/api/purchases?${params}`, {
            signal: controller.signal,
          });
          if (!res.ok)
            throw new Error("Failed to load orders. Please try again.");
          const data = await res.json();
          if (controller.signal.aborted) return;
          setPurchases(
            (data.purchases ?? []).map((p: Record<string, unknown>) => ({
              id: p.id as string,
              tier:
                p.tier === "VERIFIED_EMAIL" ? "VERIFIED_EMAIL" : "PHONE_ONLY",
              referenceId: p.referenceId as string,
              state: p.state as string | null,
              unlockedStates: (p.unlockedStates as string[]) || [],
              amountPaid: Number(p.amountPaid) || 0,
              status: p.status as string,
              createdAt: p.createdAt as string,
              quantity: Number(p.quantity) || 0,
            })),
          );
          setTotalOrders(data.pagination?.total ?? 0);
          setOrdersError(null);
        } catch (error) {
          if (!controller.signal.aborted) {
            setOrdersError(
              error instanceof Error ? error.message : "Failed to load orders.",
            );
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      orderSearch.trim() ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ordersReady, orderPage, orderSearch, refreshTick]);

  const hasProcessingOrders = purchases.some(
    (purchase) => purchase.status === "PROCESSING",
  );
  useEffect(() => {
    if (!hasProcessingOrders) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        setRefreshTick((tick) => tick + 1);
    }, 15_000);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible")
        setRefreshTick((tick) => tick + 1);
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [hasProcessingOrders]);

  // One bounded owner-only sync per refresh, not a request for every order on the page.
  useEffect(() => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    const stale = purchases.find(
      (purchase) =>
        purchase.status === "PROCESSING" &&
        now - new Date(purchase.createdAt).getTime() > 3 * 60_000 &&
        now - (syncAttempts.current.get(purchase.id) ?? 0) >= 30_000,
    );
    if (!stale) return;
    syncAttempts.current.set(stale.id, now);
    const controller = new AbortController();
    void fetch(`/api/purchases/${encodeURIComponent(stale.id)}/sync`, {
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || controller.signal.aborted) return;
        const result = await response.json();
        if (!controller.signal.aborted && result.status !== "PROCESSING")
          setRefreshTick((tick) => tick + 1);
      })
      .catch(() => {
        /* Keep the normal status poll running; a failed sync cannot alter an order. */
      });
    return () => controller.abort();
  }, [purchases]);

  useEffect(() => {
    setLeadPage(0);
  }, [leadSearch]);

  const totalOrderPages = Math.ceil(totalOrders / PAGE_SIZE);
  // The API already returns the current page. Do not paginate it a second time.
  const paginatedPurchases = purchases;
  const showingFrom = purchases.length === 0 ? 0 : orderPage * PAGE_SIZE + 1;
  const showingTo =
    purchases.length === 0 ? 0 : orderPage * PAGE_SIZE + purchases.length;

  const handleSelectPurchase = useCallback(async (purchase: Purchase) => {
    if (!isOrderDownloadable(purchase.status)) return;
    setSelectedPurchase(purchase);
    setLeadSearch("");
    setLeadPage(0);
    setLeadsLoading(true);
    setLeads([]);

    try {
      const res = await fetch(
        `/api/purchases?purchaseId=${encodeURIComponent(purchase.id)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setLeads(
          (data.leads || []).map((agent: Record<string, unknown>) => ({
            id: agent.id as string,
            fullName: agent.fullName as string,
            firstName: agent.firstName as string | undefined,
            lastName: agent.lastName as string | undefined,
            leadTier:
              data.purchase?.tier === "VERIFIED_EMAIL"
                ? "VERIFIED_EMAIL"
                : "PHONE_ONLY",
            email:
              data.purchase?.tier === "VERIFIED_EMAIL"
                ? (agent.email as string | undefined)
                : null,
            phone: agent.phone as string | undefined,
            officePhone: agent.officePhone as string | undefined,
            brokerageName: agent.brokerageName as string | undefined,
            city: agent.city as string | undefined,
            state: agent.state as string | undefined,
            zipCode: agent.zipCode as string | undefined,
            county: agent.county as string | undefined,
            category: agent.category as string | undefined,
            rating: agent.rating as number | undefined,
            reviewCount: agent.reviewCount as number | undefined,
            timezone: agent.timezone as string | undefined,
            googlePlaceId: agent.googlePlaceId as string | undefined,
            googleMapsLink: agent.googleMapsLink as string | undefined,
            scrapedAt: agent.scrapedAt as string | undefined,
            verificationScore: agent.verificationScore as number | undefined,
            dataSource: agent.dataSource as string | undefined,
            photoUrl: agent.photoUrl as string | undefined,
            websiteUrl: agent.websiteUrl as string | undefined,
            brokerageAddress: agent.brokerageAddress as string | undefined,
            licenseNumber: agent.licenseNumber as string | undefined,
            licenseState: agent.licenseState as string | undefined,
            licenseStatus: agent.licenseStatus as string | undefined,
            licenseExpiry: agent.licenseExpiry as string | undefined,
            nmlsId: agent.nmlsId as string | undefined,
            marketArea: agent.marketArea as string | undefined,
            propertyTypes: agent.propertyTypes as string[] | undefined,
            transactionCount: agent.transactionCount as number | undefined,
            totalVolume: agent.totalVolume as number | undefined,
            averagePrice: agent.averagePrice as number | undefined,
            yearsExperience: agent.yearsExperience as number | undefined,
            specializations: agent.specializations as string[] | undefined,
            bio: agent.bio as string | undefined,
            socialProfiles: agent.socialProfiles as
              Record<string, unknown> | undefined,
            lastVerifiedAt: agent.lastVerifiedAt as string | undefined,
            isVerified: agent.isVerified as boolean | undefined,
            emailStatus: agent.emailStatus as string | undefined,
            isDeliverable: agent.isDeliverable as boolean | undefined,
            createdAt: agent.createdAt as string | undefined,
            updatedAt: agent.updatedAt as string | undefined,
          })),
        );
        setTotalLeads(data.leads?.length || 0);
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
        (a.email || "").toLowerCase().includes(q),
    );
  }, [leads, leadSearch]);

  const totalLeadPages = Math.ceil(filteredLeads.length / LEAD_PAGE_SIZE);
  const paginatedLeads = useMemo(() => {
    const start = leadPage * LEAD_PAGE_SIZE;
    return filteredLeads.slice(start, start + LEAD_PAGE_SIZE);
  }, [filteredLeads, leadPage]);

  const leadShowingFrom =
    filteredLeads.length === 0 ? 0 : leadPage * LEAD_PAGE_SIZE + 1;
  const leadShowingTo = Math.min(
    (leadPage + 1) * LEAD_PAGE_SIZE,
    filteredLeads.length,
  );

  if (loading) {
    return <BrandedLoader />;
  }

  if (
    totalOrders === 0 &&
    !orderSearch.trim() &&
    !ordersError &&
    !selectedPurchase
  ) {
    return (
      <div className="w-full min-h-dvh bg-white md:bg-slate-50 p-0 pb-4 md:p-6 md:pb-4 space-y-4">
        <div className="bg-white shadow-none border-0 rounded-2xl p-7 md:p-9 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              My Leads Vault
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Access, search, and export your unlocked Real Estate Agent
              databases.
            </p>
          </div>

          <div className="min-h-[400px] border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-white md:border-transparent md:bg-slate-100">
              <Database className="h-6 w-6 text-slate-400" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Your Lead Vault is Empty
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
              You haven&apos;t unlocked any lead databases yet. Start by
              ordering verified territories.
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
        <div className="-mx-4 min-h-dvh bg-white px-4 pt-4 pb-20 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:p-0 flex flex-col">
          <div className="bg-transparent rounded-none md:bg-white md:rounded-2xl p-0 md:p-6 lg:p-8 flex flex-col md:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3.5rem)] justify-between">
            <div className="shrink-0">
              {selectedPurchase.tier === "PHONE_ONLY" && (
                <div className="mb-3">
                  <ColdCallingTierBadge />
                </div>
              )}
              <div className="md:hidden space-y-3">
                <button
                  type="button"
                  onClick={handleBackToOrders}
                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 font-medium text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to All Orders
                </button>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    Order #{selectedPurchase.referenceId}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatStateBadge(selectedPurchase.unlockedStates).label} -{" "}
                    {formatQuantity(selectedPurchase.quantity)} Leads
                  </p>
                </div>
                <VaultExportControl purchase={selectedPurchase} />
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    ref={leadSearchRef}
                    type="text"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search agents in this order by name..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-white pl-10 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
              </div>
              <div className="hidden md:block">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleBackToOrders}
                      className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#465FFF] hover:bg-[#F0F4FF] font-medium text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to All Orders
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Order #{selectedPurchase.referenceId}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1.5">
                        {selectedPurchase.unlockedStates.join(", ")} ·{" "}
                        {formatQuantity(selectedPurchase.quantity)} Leads
                      </p>
                    </div>
                  </div>
                  <VaultExportControl purchase={selectedPurchase} />
                </div>

                <div className="mt-6 mb-5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      ref={leadSearchRef}
                      type="text"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder={
                        selectedPurchase.tier === "PHONE_ONLY"
                          ? "Search by name, brokerage, or city..."
                          : "Search by name, brokerage, city, or email..."
                      }
                      className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#465FFF] bg-white pl-10 placeholder:text-slate-400 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full flex-1 my-2">
              {leadsLoading ? (
                <>
                  <div className="md:hidden w-full">
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-xl border border-slate-200 p-4"
                        >
                          <div className="space-y-2">
                            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                            <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="w-full divide-y divide-slate-100">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="px-4 py-4">
                          <Skeleton className="h-5 w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="md:hidden w-full">
                    <div className="w-full bg-white divide-y divide-slate-100 border-t border-b border-slate-100 my-2">
                      {paginatedLeads.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-400">
                          {leadSearch
                            ? "No agents match your search."
                            : "No agents available for this order."}
                        </div>
                      ) : (
                        paginatedLeads.map((agent, index) => (
                          <div
                            key={agent.id}
                            className="flex items-start gap-3 p-3.5 active:bg-slate-50 md:hover:bg-slate-50/60 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => handleOpenAgent(agent)}
                          >
                            <span className="text-xs font-medium text-slate-400 w-5 text-right shrink-0 mt-0.5">
                              {leadPage * LEAD_PAGE_SIZE + index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-slate-900 line-clamp-1">
                                {agent.brokerageName || "Agent"}
                              </p>
                              {agent.phone && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{formatPhone(agent.phone)}</span>
                                </div>
                              )}
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                {agent.fullName}{" "}
                                {agent.brokerageName
                                  ? `- ${agent.brokerageName}`
                                  : ""}{" "}
                                {agent.city || agent.state
                                  ? `- ${[agent.city, agent.state].filter(Boolean).join(", ")}`
                                  : ""}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
                          </div>
                        ))
                      )}
                    </div>
                    {totalLeadPages > 1 && (
                      <div className="flex flex-col gap-3 pt-4 pb-6">
                        <p className="text-sm text-slate-500 text-center">
                          Showing{" "}
                          <span className="font-medium text-slate-900 tabular-nums">
                            {leadShowingFrom}
                          </span>
                          &ndash;
                          <span className="font-medium text-slate-900 tabular-nums">
                            {leadShowingTo}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium text-slate-900 tabular-nums">
                            {filteredLeads.length}
                          </span>{" "}
                          agents
                        </p>
                        <DashboardPagination
                          label="Leads pagination"
                          currentPage={leadPage + 1}
                          totalPages={totalLeadPages}
                          onPageChange={(page) => setLeadPage(page - 1)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <div className="w-full overflow-x-auto no-scrollbar">
                      <table className="w-full text-left text-sm min-w-[600px]">
                        <thead className="border-b border-slate-100 text-xs font-normal text-slate-400 uppercase tracking-wider">
                          <tr className="h-14">
                            <th className="px-4 align-middle text-left">
                              Agent & Company
                            </th>
                            <th className="px-4 align-middle text-left">
                              Category
                            </th>
                            <th className="px-4 align-middle text-left">
                              Direct Phone
                            </th>
                            <th className="px-4 align-middle text-left">
                              Verified Email
                            </th>
                            <th className="px-4 align-middle text-left">
                              Location
                            </th>
                            <th className="px-4 align-middle text-left">
                              Rating & Reviews
                            </th>
                            <th className="px-4 align-middle text-left">
                              Timezone
                            </th>
                            <th className="px-4 align-middle text-right">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedLeads.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-4 py-12 text-center text-sm text-slate-400"
                              >
                                {leadSearch
                                  ? "No agents match your search."
                                  : "No agents available for this order."}
                              </td>
                            </tr>
                          ) : (
                            paginatedLeads.map((agent) => (
                              <tr
                                key={agent.id}
                                className="h-14 hover:bg-slate-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => handleOpenAgent(agent)}
                              >
                                <td className="px-4 align-middle text-xs">
                                  <span className="font-normal text-slate-900">
                                    {agent.fullName}
                                  </span>
                                  <p className="text-xs text-slate-500 mt-0.5">
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
                                  {agent.leadTier === "PHONE_ONLY" ? (
                                    <ColdCallingTierBadge />
                                  ) : (
                                    <span className="text-xs text-slate-800 select-all">
                                      {agent.email || "--"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 align-middle text-xs">
                                  <span className="font-normal text-slate-700">
                                    {[agent.city, agent.state]
                                      .filter(Boolean)
                                      .join(", ") || "--"}
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
                                      className="inline-flex items-center gap-1 text-xs font-normal text-slate-600 hover:text-slate-900 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
                  </div>
                </>
              )}
            </div>

            <div className="hidden md:flex shrink-0 flex-col lg:flex-row items-center lg:justify-between gap-4 pt-4 mt-2 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-900 tabular-nums">
                  {leadShowingFrom}
                </span>
                &ndash;
                <span className="font-medium text-slate-900 tabular-nums">
                  {leadShowingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-900 tabular-nums">
                  {filteredLeads.length}
                </span>{" "}
                agents
              </p>
              <DashboardPagination
                label="Leads pagination"
                currentPage={leadPage + 1}
                totalPages={totalLeadPages}
                onPageChange={(page) => setLeadPage(page - 1)}
              />
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
    <div className="-mx-4 min-h-0 h-auto bg-white px-4 pt-4 pb-20 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:p-0 overflow-x-clip md:overflow-hidden flex flex-col">
      <div className="bg-transparent rounded-none md:bg-white md:rounded-2xl p-0 md:p-6 lg:p-8 flex flex-col md:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3.5rem)] md:overflow-hidden justify-between">
        <div className="shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                My Leads Vault
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Access, search, and export your unlocked Real Estate Agent
                databases.
              </p>
            </div>
            <a
              href="/dashboard/search"
              className="hidden md:inline-flex items-center gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-none border-0 transition-all duration-200"
            >
              + Order Leads
            </a>
          </div>

          <div className="mt-6 mb-5">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => {
                  setOrderPage(0);
                  setOrderSearch(e.target.value);
                }}
                placeholder="Search orders by Order ID or State..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#465FFF] bg-white pl-10 placeholder:text-slate-400 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              />
            </div>
          </div>
        </div>

        {ordersError && (
          <p role="alert" className="text-sm text-red-600">
            {ordersError}
          </p>
        )}

        <div className="w-full flex-1 min-h-0 md:overflow-hidden my-2">
          <div className="md:hidden w-full">
            <div className="w-full bg-white divide-y divide-slate-100 border-t border-b border-slate-100 my-2">
              {paginatedPurchases.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  No orders match your search.
                </div>
              ) : (
                paginatedPurchases.map((purchase) => {
                  const stateBadge = formatStateBadge(purchase.unlockedStates);
                  return (
                    <div key={purchase.id} className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-900 tabular-nums">
                          {purchase.referenceId}
                        </span>
                        <OrderStatusBadge status={purchase.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {stateBadge.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatQuantity(purchase.quantity)} Leads
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(purchase.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          disabled={!isOrderDownloadable(purchase.status)}
                          onClick={() => handleSelectPurchase(purchase)}
                          className="inline-flex items-center justify-center h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          View Leads
                        </button>
                        <VaultExportControl purchase={purchase} />
                      </div>
                    </div>
                  );
                })
              )}
              {totalOrderPages > 1 && (
                <div className="flex flex-col gap-3 pt-4 pb-6">
                  <p className="text-sm text-slate-500 text-center">
                    Showing{" "}
                    <span className="font-medium text-slate-900 tabular-nums">
                      {showingFrom}
                    </span>
                    &ndash;
                    <span className="font-medium text-slate-900 tabular-nums">
                      {showingTo}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-slate-900 tabular-nums">
                      {totalOrders}
                    </span>{" "}
                    orders
                  </p>
                  <DashboardPagination
                    label="Orders pagination"
                    currentPage={orderPage + 1}
                    totalPages={totalOrderPages}
                    onPageChange={(page) => setOrderPage(page - 1)}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="hidden md:block h-full overflow-y-auto no-scrollbar">
            <div className="w-full overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="border-b border-slate-100 text-xs font-normal text-slate-400 uppercase tracking-wider">
                  <tr className="h-14">
                    <th className="px-4 align-middle text-left">
                      Order ID & Date
                    </th>
                    <th className="px-4 align-middle text-left">
                      Target States
                    </th>
                    <th className="px-4 align-middle text-left">Category</th>
                    <th className="px-4 align-middle text-right">Quantity</th>
                    <th className="px-4 align-middle text-left">Status</th>
                    <th className="px-4 align-middle text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPurchases.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-sm text-slate-400"
                      >
                        No orders match your search.
                      </td>
                    </tr>
                  ) : (
                    paginatedPurchases.map((purchase) => (
                      <tr
                        key={purchase.id}
                        className="h-14 hover:bg-slate-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
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
                          {(() => {
                            const stateBadge = formatStateBadge(
                              purchase.unlockedStates,
                            );
                            return (
                              <span className="font-normal text-xs text-[#465FFF] bg-[#F0F4FF] px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap">
                                {stateBadge.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 align-middle text-xs">
                          <span className="font-normal text-slate-600 text-xs">
                            Real Estate Agents
                          </span>
                        </td>
                        <td className="px-4 align-middle text-xs text-right">
                          <span className="font-normal text-slate-800 text-xs tabular-nums">
                            {formatQuantity(purchase.quantity)}
                          </span>
                        </td>
                        <td className="px-4 align-middle text-xs">
                          <OrderStatusBadge status={purchase.status} />
                        </td>
                        <td className="px-4 align-middle text-xs text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={!isOrderDownloadable(purchase.status)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPurchase(purchase);
                              }}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-none border-0 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              View Leads
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <VaultExportControl purchase={purchase} />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="hidden md:flex shrink-0 flex-col lg:flex-row items-center lg:justify-between gap-4 pt-4 mt-2 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-900 tabular-nums">
              {showingFrom}
            </span>
            &ndash;
            <span className="font-medium text-slate-900 tabular-nums">
              {showingTo}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-900 tabular-nums">
              {totalOrders}
            </span>{" "}
            orders
          </p>
          <DashboardPagination
            label="Orders pagination"
            currentPage={orderPage + 1}
            totalPages={totalOrderPages}
            onPageChange={(page) => setOrderPage(page - 1)}
          />
        </div>
      </div>
    </div>
  );
}

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
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { Skeleton } from "@fine-leads/ui";
import { BrandedLoader } from "@/components/ui/branded-loader";
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
  if (states.length >= 50) return { label: "All States" };
  if (states.length === 1) return { label: states[0] };
  return { label: `${states[0]}+${states.length - 1}` };
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
        // /api/purchases is paginated (20 per page by default), so walk every page.
        const raw: Record<string, unknown>[] = [];
        for (let page = 1; page <= 50; page++) {
          const res = await fetch(`/api/purchases?view=orders&page=${page}&limit=100`);
          if (!res.ok) break;
          const data = await res.json();
          raw.push(...((data.purchases as Record<string, unknown>[] | undefined) ?? []));
          if (!data.pagination?.hasMore) break;
        }
        const mapped: Purchase[] = raw.map((p) => ({
          id: p.id as string,
          referenceId: p.referenceId as string,
          state: p.state as string | null,
          unlockedStates: (p.unlockedStates as string[]) || [],
          amountPaid: Number(p.amountPaid) || 0,
          status: p.status as string,
          createdAt: p.createdAt as string,
          quantity: Number(p.quantity) || 0,
        }));
        setPurchases(mapped);
      } catch {
        // handle error silently, show empty state
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, []);

  // Deep link from Billing: /dashboard/lists?order=LD-ORD-XXXX pre-fills the order search.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("order");
    if (ref) setOrderSearch(ref);
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
      const res = await fetch(`/api/purchases?purchaseId=${encodeURIComponent(purchase.id)}`);
      if (res.ok) {
        const data = await res.json();
        setLeads((data.leads || []).map((agent: Record<string, unknown>) => ({
          id: agent.id as string,
          fullName: agent.fullName as string,
          firstName: agent.firstName as string | undefined,
          lastName: agent.lastName as string | undefined,
          email: agent.email as string | undefined,
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
          socialProfiles: agent.socialProfiles as Record<string, unknown> | undefined,
          lastVerifiedAt: agent.lastVerifiedAt as string | undefined,
          isVerified: agent.isVerified as boolean | undefined,
          emailStatus: agent.emailStatus as string | undefined,
          isDeliverable: agent.isDeliverable as boolean | undefined,
          createdAt: agent.createdAt as string | undefined,
          updatedAt: agent.updatedAt as string | undefined,
        })));
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
        (a.email || "").toLowerCase().includes(q)
    );
  }, [leads, leadSearch]);

  const handleDownloadCsv = useCallback((states: string[], purchaseId?: string) => {
    states.forEach((stateCode) => {
      const url = purchaseId
        ? `/api/exports/stream?state=${encodeURIComponent(stateCode)}&purchaseId=${encodeURIComponent(purchaseId)}`
        : `/api/exports/stream?state=${encodeURIComponent(stateCode)}`;
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
    return <BrandedLoader />;
  }

  if (purchases.length === 0 && !selectedPurchase) {
    return (
      <div className="w-full min-h-dvh bg-white md:bg-slate-50 p-0 pb-4 md:p-6 md:pb-4 space-y-4">
        <div className="bg-white shadow-none border-0 rounded-2xl p-7 md:p-9 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              My Leads Vault
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Access, search, and export your unlocked Real Estate Agent databases.
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
        <div className="-mx-4 min-h-dvh bg-white px-4 pt-4 pb-20 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:p-0 flex flex-col">
          <div className="bg-transparent rounded-none md:bg-white md:rounded-2xl p-0 md:p-6 lg:p-8 flex flex-col md:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3.5rem)] justify-between">
            <div className="shrink-0">
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
                    {formatStateBadge(selectedPurchase.unlockedStates).label} - {formatQuantity(selectedPurchase.quantity)} Verified Leads
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv(selectedPurchase.unlockedStates, selectedPurchase.id)}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Full CSV
                </button>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    ref={leadSearchRef}
                    type="text"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search agents in this order by name..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-white pl-10 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="hidden md:block">
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
                         {selectedPurchase.unlockedStates.join(", ")} · {formatQuantity(selectedPurchase.quantity)} Verified Leads
                       </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv(selectedPurchase.unlockedStates, selectedPurchase.id)}
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
            </div>

            <div className="w-full flex-1 my-2">
              {leadsLoading ? (
                <>
                  <div className="md:hidden w-full">
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
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
                          {leadSearch ? "No agents match your search." : "No agents available for this order."}
                        </div>
                      ) : (
                        paginatedLeads.map((agent, index) => (
                          <div
                            key={agent.id}
                            className="flex items-start gap-3 p-3.5 active:bg-slate-50 md:hover:bg-slate-50/60 transition-colors cursor-pointer"
                            onClick={() => handleOpenAgent(agent)}
                          >
                            <span className="text-xs font-medium text-slate-400 w-5 text-right shrink-0 mt-0.5">
                              {(leadPage * LEAD_PAGE_SIZE) + index + 1}
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
                                {agent.fullName} {agent.brokerageName ? `- ${agent.brokerageName}` : ""} {agent.city || agent.state ? `- ${[agent.city, agent.state].filter(Boolean).join(", ")}` : ""}
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
                          <span className="font-medium text-slate-900 tabular-nums">{leadShowingFrom}</span>&ndash;<span className="font-medium text-slate-900 tabular-nums">{leadShowingTo}</span>{" "}
                          of{" "}
                          <span className="font-medium text-slate-900 tabular-nums">{filteredLeads.length}</span>{" "}
                          agents
                        </p>
                        <nav aria-label="Leads pagination" className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            disabled={leadPage === 0}
                            onClick={() => setLeadPage((p) => Math.max(0, p - 1))}
                            className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Previous
                          </button>
                          <span className="text-xs font-medium text-slate-500 tabular-nums">
                            Page {leadPage + 1} of {totalLeadPages}
                          </span>
                          <button
                            type="button"
                            disabled={leadPage >= totalLeadPages - 1}
                            onClick={() => setLeadPage((p) => p + 1)}
                            className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </nav>
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <div className="w-full overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-sm min-w-[600px]">
                      <thead className="border-b border-slate-100 text-xs font-normal text-slate-400 uppercase tracking-wider">
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
                  </div>
                </>
              )}
            </div>

            <div className="hidden md:flex shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 mt-2 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-900 tabular-nums">{leadShowingFrom}</span>&ndash;<span className="font-medium text-slate-900 tabular-nums">{leadShowingTo}</span>{" "}
                of{" "}
                <span className="font-medium text-slate-900 tabular-nums">{filteredLeads.length}</span>{" "}
                agents
              </p>
              <nav aria-label="Leads pagination" className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={leadPage === 0}
                  onClick={() => setLeadPage((p) => Math.max(0, p - 1))}
                  className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalLeadPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setLeadPage(page - 1)}
                    aria-current={leadPage === page - 1 ? "page" : undefined}
                    className={`h-9 min-w-9 px-2 rounded-lg border text-xs font-medium tabular-nums transition-colors ${
                      leadPage === page - 1
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={leadPage >= totalLeadPages - 1}
                  onClick={() => setLeadPage((p) => p + 1)}
                  className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </nav>
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
                Access, search, and export your unlocked Real Estate Agent databases.
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
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search orders by Order ID or State..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#465FFF] bg-white pl-10 placeholder:text-slate-400 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="w-full flex-1 min-h-0 md:overflow-hidden my-2">
          <div className="md:hidden w-full">
            <div className="w-full bg-white divide-y divide-slate-100 border-t border-b border-slate-100 my-2">
              {paginatedPurchases.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No orders match your search.</div>
              ) : (
                paginatedPurchases.map((purchase) => {
                  const stateBadge = formatStateBadge(purchase.unlockedStates);
                  return (
                    <div key={purchase.id} className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-900 tabular-nums">{purchase.referenceId}</span>
                        <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                          {purchase.status || "COMPLETED"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {stateBadge.label}
                        </span>
                        <span className="text-xs text-slate-500">{formatQuantity(purchase.quantity)} Leads</span>
                        <span className="text-xs text-slate-500">{formatDate(purchase.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => handleSelectPurchase(purchase)}
                          className="inline-flex items-center justify-center h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          View Leads
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadCsv(purchase.unlockedStates, purchase.id);
                          }}
                          className="inline-flex items-center justify-center h-10 px-4 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          CSV
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              {totalOrderPages > 1 && (
                <div className="flex flex-col gap-3 pt-4 pb-6">
                  <p className="text-sm text-slate-500 text-center">
                    Showing{" "}
                    <span className="font-medium text-slate-900 tabular-nums">{showingFrom}</span>&ndash;<span className="font-medium text-slate-900 tabular-nums">{showingTo}</span>{" "}
                    of{" "}
                    <span className="font-medium text-slate-900 tabular-nums">{filteredPurchases.length}</span>{" "}
                    orders
                  </p>
                  <nav aria-label="Orders pagination" className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={orderPage === 0}
                      onClick={() => setOrderPage((p) => Math.max(0, p - 1))}
                      className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-medium text-slate-500 tabular-nums">
                      Page {orderPage + 1} of {totalOrderPages}
                    </span>
                    <button
                      type="button"
                      disabled={orderPage >= totalOrderPages - 1}
                      onClick={() => setOrderPage((p) => p + 1)}
                      className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
          <div className="hidden md:block h-full overflow-y-auto no-scrollbar">
            <div className="w-full overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="border-b border-slate-100 text-xs font-normal text-slate-400 uppercase tracking-wider">
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
                        {(() => {
                          const stateBadge = formatStateBadge(purchase.unlockedStates);
                          return (
                            <span
                              className="font-normal text-xs text-[#465FFF] bg-[#F0F4FF] px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap"
                            >
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
                              handleDownloadCsv(purchase.unlockedStates, purchase.id);
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
        </div>

        <div className="hidden md:flex shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 mt-2 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-900 tabular-nums">{showingFrom}</span>&ndash;<span className="font-medium text-slate-900 tabular-nums">{showingTo}</span>{" "}
            of{" "}
            <span className="font-medium text-slate-900 tabular-nums">{filteredPurchases.length}</span>{" "}
            orders
          </p>
          <nav aria-label="Orders pagination" className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={orderPage === 0}
              onClick={() => setOrderPage((p) => Math.max(0, p - 1))}
              className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalOrderPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setOrderPage(page - 1)}
                aria-current={orderPage === page - 1 ? "page" : undefined}
                className={`h-9 min-w-9 px-2 rounded-lg border text-xs font-medium tabular-nums transition-colors ${
                  orderPage === page - 1
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={orderPage >= totalOrderPages - 1}
              onClick={() => setOrderPage((p) => p + 1)}
              className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Search, Lock, Star, Phone, Mail, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { LEAD_STATES } from "@fine-leads/utils";

export interface LeadRow {
  id: string;
  fullName: string;
  brokerageName: string;
  state: string;
  city: string;
  email: string;
  phone: string;
  rating: number;
  locked: boolean;
}

interface LeadExplorerProps {
  leads?: LeadRow[];
}

const STATE_TABS = [
  { code: "ALL", label: "ALL", count: 1000 },
  ...LEAD_STATES.map((s) => ({ code: s.code, label: s.name, count: s.count })),
] as const;

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "***@***.com";
  return `${name.charAt(0)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "+* (***) ***-****";
  const last4 = digits.slice(-4);
  return `+1 (***) ***-${last4}`;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-slate-200 dark:text-slate-700"
          }`}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-slate-600 dark:text-slate-400">
        {rating}
      </span>
    </div>
  );
}

export function LeadExplorer({ leads = [] }: LeadExplorerProps) {
  const [activeState, setActiveState] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesState = activeState === "ALL" || lead.state === activeState;
      const matchesSearch =
        !searchQuery ||
        lead.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.brokerageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.city.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesState && matchesSearch;
    });
  }, [leads, activeState, searchQuery]);

  return (
    <div className="rounded-xl border-0 bg-slate-50 dark:bg-slate-900 shadow-none">
      <div className="p-5">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Live Lead Explorer
        </h3>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Agent Name, Brokerage, or City..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border-0 bg-slate-100 dark:bg-slate-800 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-[#14A800] dark:text-white dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STATE_TABS.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => setActiveState(s.code)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeState === s.code
                  ? "bg-blue-600 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {s.label}
              <span className={`ml-1 ${activeState === s.code ? "text-white/70" : "text-slate-400"}`}>
                ({s.count})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100/50 dark:bg-slate-800/40">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Agent & Brokerage
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  State / City
                </span>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </span>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Phone
                </span>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Rating
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr
                key={lead.id}
                className={`hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-colors ${
                  lead.locked ? "opacity-75" : ""
                }`}
              >
                <td className="px-5 py-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {lead.fullName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {lead.brokerageName}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {lead.state}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {lead.city}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {lead.locked ? (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Lock className="h-3 w-3" />
                      {maskEmail(lead.email)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-700 dark:text-slate-300">
                      {lead.email}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {lead.locked ? (
                    <span className="text-xs text-slate-400">
                      {maskPhone(lead.phone)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-700 dark:text-slate-300">
                      {lead.phone}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <StarRating rating={lead.rating} />
                </td>
                <td className="px-5 py-3 text-right">
                  {lead.locked ? (
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/search")}
                      className="inline-flex items-center gap-1 rounded-lg border-0 bg-[#14A800]/5 px-3 py-1.5 text-xs font-semibold text-[#14A800] hover:bg-[#14A800]/10 transition-colors cursor-pointer shadow-none"
                    >
                      <Lock className="h-3 w-3" />
                      Unlock Pack
                    </button>
                  ) : (
                    <span className="rounded-full bg-[#14A800]/10 px-2.5 py-1 text-xs font-semibold text-[#14A800]">
                      Accessible
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLeads.length === 0 && (
        <div className="px-5 py-12 text-center text-sm text-slate-400">
          No leads match your search criteria.
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Showing {filteredLeads.length} of {leads.length} leads
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled
            className="rounded-lg border-0 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border-0 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

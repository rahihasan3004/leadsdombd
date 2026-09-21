"use client";

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Checkbox,
  Button,
} from "@fine-leads/ui";
import { US_STATES, formatNumber, calculateLeadPrice } from "@fine-leads/utils";
import {
  Search,
  ChevronDown,
  Database,
  ArrowRight,
  Mail,
  Phone,
  Check,
  MapPin,
  Building2,
  Award,
  ShieldCheck,
  X,
} from "lucide-react";

const BROKERAGES = [
  "All Brokerages",
  "Compass",
  "Keller Williams",
  "RE/MAX",
  "eXp Realty",
  "Sotheby's International",
  "Coldwell Banker",
] as const;

const MOCK_AGENTS = [
  {
    id: "1",
    name: "Sarah Mitchell",
    title: "Managing Broker",
    brokerage: "Compass Florida",
    city: "Miami",
    state: "FL",
    hasEmail: true,
    hasPhone: true,
    tier: "Top 1% Producer",
    status: "Verified",
  },
  {
    id: "2",
    name: "Marcus Rodriguez",
    title: "Principal Agent",
    brokerage: "Douglas Elliman",
    city: "Austin",
    state: "TX",
    hasEmail: true,
    hasPhone: true,
    tier: "Luxury Specialist",
    status: "Verified",
  },
  {
    id: "3",
    name: "Emily Chen",
    title: "VP of Sales",
    brokerage: "Sotheby's International",
    city: "Beverly Hills",
    state: "CA",
    hasEmail: true,
    hasPhone: true,
    tier: "15+ Yrs Exp",
    status: "Verified",
  },
  {
    id: "4",
    name: "David Ross",
    title: "Associate Broker",
    brokerage: "Keller Williams Premier",
    city: "Atlanta",
    state: "GA",
    hasEmail: true,
    hasPhone: true,
    tier: "Commercial & Res",
    status: "Verified",
  },
  {
    id: "5",
    name: "Rachel Vance",
    title: "Team Lead",
    brokerage: "eXp Realty",
    city: "Seattle",
    state: "WA",
    hasEmail: true,
    hasPhone: true,
    tier: "Top Producer",
    status: "Verified",
  },
  {
    id: "6",
    name: "Alexander Wright",
    title: "Managing Broker",
    brokerage: "Coldwell Banker",
    city: "Chicago",
    state: "IL",
    hasEmail: true,
    hasPhone: true,
    tier: "Luxury Residential",
    status: "Verified",
  },
  {
    id: "7",
    name: "Lauren Hayes",
    title: "Senior Realtor",
    brokerage: "RE/MAX Alliance",
    city: "Denver",
    state: "CO",
    hasEmail: true,
    hasPhone: true,
    tier: "10+ Yrs Exp",
    status: "Verified",
  },
];

const TOTAL_RECORDS = 2418900;
const MATCH_COUNT = 142850;

export function LeadSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedBrokerage, setSelectedBrokerage] = useState("All Brokerages");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [quantity, setQuantity] = useState(1000);
  const [statePopoverOpen, setStatePopoverOpen] = useState(false);

  const toggleState = (code: string) => {
    setSelectedStates((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  };

  const selectAllStates = () => {
    if (selectedStates.length === US_STATES.length) {
      setSelectedStates([]);
    } else {
      setSelectedStates(US_STATES.map((s) => s.code));
    }
  };

  const clearAllStates = () => {
    setSelectedStates([]);
  };

  const stateLabel = useMemo(() => {
    if (selectedStates.length === 0 || selectedStates.length === US_STATES.length) {
      return "All 51 States";
    }
    return `${selectedStates.length} State${selectedStates.length > 1 ? "s" : ""} Selected`;
  }, [selectedStates]);

  const chipClasses = "inline-flex items-center gap-1 rounded-sm bg-surface-200 dark:bg-surface-700 px-1.5 py-0.5 text-[10px] font-medium text-surface-600 dark:text-surface-300";

  const tableHeaderClasses = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400";
  const tableCellClasses = "px-4 py-3.5 align-middle";

  return (
    <div className="h-full overflow-auto">
      <div className="pb-8">
        {/* ===== PAGE HEADER ===== */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-surface-950 dark:text-white">
              Search Leads
            </h1>
            <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
              Search and unlock verified US Real Estate Agents across all 51 territories.
            </p>
          </div>
          <div className="flex-shrink-0 text-xs font-bold font-sans tabular-nums text-surface-900 dark:text-surface-100 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-3 py-1.5 rounded-sm inline-flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-surface-500" />
            {formatNumber(TOTAL_RECORDS)} Verified Records
          </div>
        </div>

        {/* ===== FILTER TOOLBAR ===== */}
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-md p-3.5 flex flex-wrap items-center gap-3 shadow-2xs mb-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" />
            <input
              type="text"
              placeholder="Search agents by name, firm, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 h-9 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-md pl-9 pr-3 text-xs placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-surface-950 dark:focus:ring-surface-400 text-surface-950 dark:text-surface-100"
            />
          </div>

          {/* State Multi-Select */}
          <Popover open={statePopoverOpen} onOpenChange={setStatePopoverOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-surface-700 dark:text-surface-300 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                <MapPin className="h-3.5 w-3.5 text-surface-400" />
                {stateLabel}
                <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-800">
                <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">
                  Select States
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllStates}
                    className="text-[11px] font-medium text-surface-500 hover:text-surface-950 dark:hover:text-surface-200 transition-colors"
                  >
                    {selectedStates.length === US_STATES.length ? "Deselect All" : "Select All"}
                  </button>
                  <button
                    onClick={clearAllStates}
                    className="text-[11px] font-medium text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-2 grid grid-cols-2 gap-0.5">
                {US_STATES.map((s) => (
                  <label
                    key={s.code}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  >
                    <Checkbox
                      checked={selectedStates.includes(s.code)}
                      onCheckedChange={() => toggleState(s.code)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-xs text-surface-700 dark:text-surface-300 select-none">
                      {s.name}
                    </span>
                  </label>
                ))}
              </div>
              {selectedStates.length > 0 && selectedStates.length < US_STATES.length && (
                <div className="flex flex-wrap gap-1 px-4 py-3 border-t border-surface-200 dark:border-surface-800">
                  {selectedStates.slice(0, 8).map((code) => (
                    <span key={code} className={chipClasses}>
                      {code}
                      <X
                        className="h-2.5 w-2.5 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleState(code);
                        }}
                      />
                    </span>
                  ))}
                  {selectedStates.length > 8 && (
                    <span className={chipClasses}>+{selectedStates.length - 8} more</span>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Brokerage Select */}
          <Select value={selectedBrokerage} onValueChange={setSelectedBrokerage}>
            <SelectTrigger className="h-9 w-44 text-xs bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-md px-3 gap-1.5 focus:ring-1 focus:ring-surface-950 dark:focus:ring-surface-400 focus:ring-offset-0 [&>svg]:hidden">
              <Building2 className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
              <SelectValue />
              <ChevronDown className="h-3.5 w-3.5 text-surface-400 flex-shrink-0 ml-auto" />
            </SelectTrigger>
            <SelectContent align="start" className="text-xs">
              {BROKERAGES.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Separator */}
          <div className="w-px h-7 bg-surface-200 dark:bg-surface-700" />

          {/* Verified Filter Pill */}
          <button
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border transition-colors ${
              verifiedOnly
                ? "bg-surface-950 dark:bg-white text-white dark:text-surface-950 border-surface-950 dark:border-white"
                : "bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-surface-300"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified Only
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Reset Button */}
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedStates([]);
              setSelectedBrokerage("All Brokerages");
              setVerifiedOnly(true);
            }}
            className="text-xs text-surface-500 hover:text-surface-950 dark:hover:text-surface-200 px-2 py-1 font-medium transition-colors"
          >
            Reset Filters
          </button>
        </div>

        {/* ===== ACTION BAR ===== */}
        <div className="bg-surface-100 dark:bg-surface-150 border border-surface-200 dark:border-surface-800 rounded-md px-4 py-2.5 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-surface-950 dark:text-surface-100 tabular-nums">
              {formatNumber(MATCH_COUNT)} Agents Match Active Filters
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400 font-medium">
              <span>Quantity</span>
              <input
                type="number"
                min={100}
                max={50000}
                step={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(100, Math.min(50000, Number(e.target.value) || 0)))}
                className="w-24 h-8 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-md px-2 text-xs font-bold tabular-nums text-center text-surface-950 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-surface-950 dark:focus:ring-surface-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <span className="text-xs text-surface-500 dark:text-surface-400 font-medium tabular-nums">
              {`$${calculateLeadPrice(quantity).toFixed(2)} @ $0.019/lead`}
            </span>
            <Button
              variant="default"
              size="sm"
              className="h-8 px-4 bg-surface-950 hover:bg-surface-800 dark:bg-white dark:hover:bg-surface-200 dark:text-surface-950 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              Unlock &amp; Export Leads
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ===== DATA GRID TABLE ===== */}
        <div className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-md overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-950/50">
                  <th className={tableHeaderClasses}>Agent &amp; Title</th>
                  <th className={tableHeaderClasses}>Brokerage / Firm</th>
                  <th className={tableHeaderClasses}>Location</th>
                  <th className={tableHeaderClasses}>Contact Channels</th>
                  <th className={tableHeaderClasses}>Experience / Tier</th>
                  <th className={tableHeaderClasses}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {MOCK_AGENTS.map((agent) => (
                  <tr
                    key={agent.id}
                    className="hover:bg-surface-50/50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <td className={tableCellClasses}>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-bold text-surface-500 dark:text-surface-400 tabular-nums">
                            {agent.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                            {agent.name}
                          </p>
                          <p className="text-xs text-surface-500 dark:text-surface-400">
                            {agent.title}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={tableCellClasses}>
                      <span className="text-sm text-surface-700 dark:text-surface-300 font-medium">
                        {agent.brokerage}
                      </span>
                    </td>
                    <td className={tableCellClasses}>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-surface-400 flex-shrink-0" />
                        <span className="text-sm text-surface-700 dark:text-surface-300">
                          {agent.city}, {agent.state}
                        </span>
                      </div>
                    </td>
                    <td className={tableCellClasses}>
                      <div className="flex items-center gap-3">
                        {agent.hasEmail && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-status-verified">
                            <Mail className="h-3 w-3" />
                            Email
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                        <span className="text-surface-300 dark:text-surface-600">•</span>
                        {agent.hasPhone && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-status-verified">
                            <Phone className="h-3 w-3" />
                            Direct Phone
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={tableCellClasses}>
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <Award className="h-3 w-3 text-surface-400" />
                        <span className="text-surface-700 dark:text-surface-300">{agent.tier}</span>
                      </span>
                    </td>
                    <td className={tableCellClasses}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-verified-bg dark:bg-emerald-950/50 text-status-verified dark:text-emerald-400 border border-status-verified-border dark:border-emerald-900/50">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        {agent.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
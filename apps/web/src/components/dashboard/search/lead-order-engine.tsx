"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { US_STATES } from "@fine-leads/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@fine-leads/ui";
import { Check, Search, X, ChevronDown, Lock } from "lucide-react";

const ALL_US_STATES = US_STATES.map((s) => s.code);

const DATA_GUARANTEES = [
  "Company Name",
  "Direct Phone Number",
  "Real Estate Category",
  "Physical Address",
  "City",
  "State",
  "Zip Code",
  "Timezone",
  "Website",
  "100% Deliverable Email",
  "License Number",
  "License State",
  "Brokerage Name",
  "Review Count",
  "Star Rating",
  "Scraped Timestamp",
  "Live Google Maps Link",
] as const;

export function LeadOrderEngine() {
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(0);
  const [quantityInput, setQuantityInput] = useState("");
  const [inventoryStats, setInventoryStats] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leads/stats")
      .then((res) => res.json())
      .then((data: Record<string, number>) => {
        if (!cancelled) setInventoryStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const totalAvailable = useMemo(
    () => selectedStates.reduce((sum, code) => sum + (inventoryStats[code] || 0), 0),
    [selectedStates, inventoryStats],
  );

  const handleQuantityChange = useCallback(
    (val: number) => {
      setQuantity(val);
      setQuantityInput(val > 0 ? String(val) : "");
    },
    [],
  );

  const handleToggleState = (code: string) => {
    setSelectedStates((prev) => {
      const next = prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code];
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedStates(ALL_US_STATES.map((s) => s));
  };

  const handleClearAll = () => {
    setSelectedStates([]);
  };

  const handleQuickSelect = (code: string) => {
    setSelectedStates((prev) => {
      if (prev.includes(code) && prev.length === 1) {
        return [];
      }
      return [code];
    });
    if (quantity === 0) {
      setQuantity(1000);
      setQuantityInput("1000");
    }
  };

  const parsedQty = parseInt(quantityInput, 10) || 0;
  const minLeads = Math.max(10, selectedStates.length);
  const isValidQty = parsedQty >= minLeads && parsedQty <= 50000;
  const isFormValid = selectedStates.length > 0 && isValidQty;

  const totalPrice = useMemo(() => {
    const num = (isValidQty ? parsedQty * 0.019 : 0).toFixed(2);
    return parseFloat(num).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }, [parsedQty, isValidQty]);

  const minQuantity = useMemo(
    () => Math.max(10, selectedStates.length || 10),
    [selectedStates.length],
  );

  const isValid = isFormValid;

  const handleCheckout = useCallback(async () => {
    if (!isFormValid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/lemon-squeezy/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "LEAD_PURCHASE",
          unlockedStates: selectedStates,
          amount: parsedQty * 0.019,
        }),
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error || "Unknown error");
      }
    } catch (err) {
      console.error("[CHECKOUT_ERROR]:", err);
    } finally {
      setSubmitting(false);
    }
  }, [isFormValid, selectedStates, parsedQty]);

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="px-0 sm:px-0 lg:px-0">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
          Order Real Estate Leads
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure your target US territories, select lead volume, and unlock verified agent datasets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl p-6 sm:p-8 border-0 shadow-none space-y-7">
          <SectionNiche />
          <SectionStates
            selectedStates={selectedStates}
            onToggleState={handleToggleState}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
            inventoryStats={inventoryStats}
          />
          <SectionQuantity
            quantity={quantity}
            quantityInput={quantityInput}
            onQuantityChange={handleQuantityChange}
            onQuantityInputChange={setQuantityInput}
            totalAvailable={totalAvailable}
            minQuantity={minQuantity}
            selectedStatesCount={selectedStates.length}
          />
          <SectionGuarantee />
        </div>

        <div className="lg:col-span-5 xl:col-span-4 sticky top-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border-0 shadow-none space-y-6">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Order Summary
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500">Target States</span>
                <span
                  className={
                    selectedStates.length === 0
                      ? "text-slate-400"
                      : "font-semibold text-slate-900"
                  }
                  title={
                    selectedStates.length > 4
                      ? selectedStates.join(", ")
                      : undefined
                  }
                >
                  {selectedStates.length === 0
                    ? "None selected"
                      : selectedStates.length === ALL_US_STATES.length
                        ? "All 50 US States + DC"
                      : selectedStates.length <= 4
                        ? selectedStates.join(", ")
                        : `${selectedStates.slice(0, 3).join(", ")} (+${selectedStates.length - 3} more)`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Lead Quantity</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {parsedQty > 0 ? `${parsedQty.toLocaleString()} Leads` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Unit Price</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  $0.019 / lead ($19.00 / 1k)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Delivery Speed</span>
                <span className="font-semibold text-slate-900">Instant Cloud Vault Delivery</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">SMTP Deliverability</span>
                <span className="font-semibold text-emerald-600">100% Verified (0% Bounce)</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Estimated Total</span>
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                  {totalPrice}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={!isFormValid || submitting}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-none border-0 transition-all duration-200 block text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Processing..." : "Unlock & Export Leads →"}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              <span>Secured Checkout · 100% Deliverable Guarantee · Instant Download</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionNiche() {
  return (
    <div>
      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2.5">
        Target Industry & Category
      </span>
      <div className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm text-slate-900">
        <span className="font-semibold text-slate-900">Real Estate Agents & Brokers</span>
      </div>
    </div>
  );
}

function SectionStates({
  selectedStates,
  onToggleState,
  onSelectAll,
  onClearAll,
  inventoryStats,
}: {
  selectedStates: string[];
  onToggleState: (code: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  inventoryStats: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const allSelected = selectedStates.length === ALL_US_STATES.length;

  const filteredStates = useMemo(() => {
    if (!search.trim()) return US_STATES;
    const q = search.toLowerCase();
    return US_STATES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 mb-3">
        Select States / Territories
      </h3>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full h-12 flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 text-sm text-slate-900 hover:border-[#465FFF] transition-colors"
          >
            <span className={selectedStates.length === 0 ? "text-slate-400" : ""}>
              {selectedStates.length === 0
                ? "Select states..."
                : `${selectedStates.length} selected`}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          sideOffset={4}
        >
          <div className="border-b border-slate-100 px-3 py-2.5 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search state by name or code..."
              className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              {selectedStates.length} of {ALL_US_STATES.length} selected
            </span>
            <button
              type="button"
              onClick={allSelected ? onClearAll : onSelectAll}
              className="text-xs font-semibold text-slate-900 hover:underline transition-colors"
            >
              {allSelected ? "Clear All" : "Select All 50 States"}
            </button>
          </div>

          <div className="max-h-72 overflow-auto p-1">
            {filteredStates.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No states found</p>
            ) : (
              filteredStates.map((state) => (
                <div
                  key={state.code}
                  onClick={() => onToggleState(state.code)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer select-none transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedStates.includes(state.code)}
                    onChange={() => onToggleState(state.code)}
                    className="h-4 w-4 rounded-[3px] border-slate-300 accent-[#465FFF] cursor-pointer pointer-events-none"
                  />
                  <span className="text-xs text-slate-700 font-normal">
                    {state.code}
                  </span>
                  <span className="text-xs text-slate-700">
                    {state.name}
                  </span>
                  <span className="text-xs font-sans text-slate-500 font-normal ml-auto">
                    {(inventoryStats[state.code] || 0).toLocaleString()} leads
                  </span>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedStates.length > 0 && (
        <div className="max-w-full pt-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
            Selected States
          </span>
          <div className="flex flex-wrap max-w-full gap-1.5 pt-1.5">
            {selectedStates.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-blue-100 transition-colors"
              >
                {code}
                <button
                  type="button"
                  onClick={() => onToggleState(code)}
                  className="text-slate-400 hover:text-red-500 transition-colors ml-0.5"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionQuantity({
  quantity,
  quantityInput,
  onQuantityChange,
  onQuantityInputChange,
  totalAvailable,
  minQuantity,
  selectedStatesCount,
}: {
  quantity: number;
  quantityInput: string;
  onQuantityChange: (qty: number) => void;
  onQuantityInputChange: (val: string) => void;
  totalAvailable: number;
  minQuantity: number;
  selectedStatesCount: number;
}) {
  const parsedQty = parseInt(quantityInput, 10) || 0;
  const isValidQty = parsedQty >= minQuantity && parsedQty <= 50000;

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 mb-3">
        Choose Lead Volume
      </h3>
      <div className="relative">
        <input
          type="number"
          min={minQuantity}
          max={50000}
          placeholder={`Enter lead quantity (min. ${minQuantity})`}
          value={quantityInput}
          onChange={(e) => onQuantityInputChange(e.target.value)}
          className="w-full h-12 text-base rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF] px-4 text-sm text-slate-900 focus:outline-none transition-colors bg-white"
        />
      </div>

      {parsedQty > 0 && !isValidQty && (
        <p className="text-xs text-red-500 mt-2 font-medium">
          Minimum {minQuantity.toLocaleString()} leads required ({selectedStatesCount} state{selectedStatesCount !== 1 ? "s" : ""} selected · 1 lead/state min)
        </p>
      )}

      {parsedQty > 0 && isValidQty && (
        <p className="text-xs text-slate-400 mt-2 font-normal">
          Min: {minQuantity.toLocaleString()} leads · Max: 50,000 leads per order
        </p>
      )}

      {parsedQty === 0 && (
        <p className="text-xs text-slate-400 mt-2 font-normal">
          Min: {minQuantity.toLocaleString()} leads · Max: 50,000 leads per order
        </p>
      )}
    </div>
  );
}

function SectionGuarantee() {
  return (
    <div className="space-y-3">
      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-3">
        Included Data Guarantee (17 Verified Fields)
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5 text-xs text-slate-600">
        {DATA_GUARANTEES.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2.5 text-[11px] text-slate-600"
          >
            <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

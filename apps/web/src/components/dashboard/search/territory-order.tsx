"use client";

import { useState, useCallback } from "react";
import { US_STATES } from "@fine-leads/utils";
import { Database } from "lucide-react";
import { USMap } from "./us-map";
import { OrderPanel } from "./order-panel";

type PackageType = "full" | "phone-only" | "email-only";

const ALL_STATE_CODES = US_STATES.map((s) => s.code);

export function TerritoryOrder() {
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [packageType, setPackageType] = useState<PackageType>("full");
  const [quantity, setQuantity] = useState(1000);
  const [submitting, setSubmitting] = useState(false);

  const toggleState = useCallback((code: string) => {
    setSelectedStates((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  }, []);

  const removeState = useCallback((code: string) => {
    setSelectedStates((prev) => prev.filter((s) => s !== code));
  }, []);

  const selectRegion = useCallback((codes: string[]) => {
    setSelectedStates(codes);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedStates(ALL_STATE_CODES);
  }, []);

  const clearAll = useCallback(() => {
    setSelectedStates([]);
  }, []);

  const handleCheckout = useCallback(async () => {
    if (selectedStates.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/lemon-squeezy/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "LEAD_PURCHASE",
          unlockedStates: selectedStates,
          amount: quantity * 0.019,
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
  }, [selectedStates, quantity, submitting]);

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="pb-6">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-surface-950 dark:text-white">
              Territory Leads
            </h1>
            <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
              Select states on the map to unlock verified Real Estate Agent data by territory.
            </p>
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="flex gap-5 min-h-0">
          {/* Left: Map */}
          <div className="w-[60%] flex-shrink-0">
            <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-md p-4 shadow-2xs">
              <USMap
                selectedStates={selectedStates}
                onToggleState={toggleState}
                onSelectRegion={selectRegion}
                onSelectAll={selectAll}
                onClearAll={clearAll}
              />
            </div>
          </div>

          {/* Right: Order Panel */}
          <div className="w-[40%] flex-shrink-0">
            <OrderPanel
              selectedStates={selectedStates}
              onRemoveState={removeState}
              packageType={packageType}
              onPackageTypeChange={setPackageType}
              quantity={quantity}
              onQuantityChange={setQuantity}
              onCheckout={handleCheckout}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
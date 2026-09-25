"use client";

import { US_STATES } from "@fine-leads/utils";
import { Lock, X, Zap, Phone, Mail, Building2, ShieldCheck, ArrowRight, Download } from "lucide-react";

type PackageType = "full" | "phone-only" | "email-only";

interface OrderPanelProps {
  selectedStates: string[];
  onRemoveState: (code: string) => void;
  packageType: PackageType;
  onPackageTypeChange: (type: PackageType) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onCheckout?: () => void;
}

const QUANTITY_PILLS = [1000, 2500, 5000, 10000] as const;
const PRICE_PER_LEAD = 0.019;

function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function OrderPanel({
  selectedStates,
  onRemoveState,
  packageType,
  onPackageTypeChange,
  quantity,
  onQuantityChange,
  onCheckout,
}: OrderPanelProps) {
  const allSelected = selectedStates.length === US_STATES.length;
  const totalPrice = quantity * PRICE_PER_LEAD;

  return (
    <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-md p-6 flex flex-col shadow-2xs h-full">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="h-4 w-4 text-surface-600 dark:text-surface-400" />
        <h2 className="text-sm font-bold tracking-tight text-surface-950 dark:text-white uppercase">
          Territory Order
        </h2>
      </div>

      <div className="flex-1 flex flex-col gap-5 overflow-auto">
        {/* Step 1: Target Niche */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Target Niche
          </span>
          <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
            <Lock className="h-3 w-3 text-surface-400" />
            <span className="text-xs font-medium text-surface-700 dark:text-surface-300">
              Real Estate Agents
            </span>
          </div>
        </div>

        {/* Step 2: Selected Territories */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Selected Territories
          </span>
          <div className="mt-1.5 min-h-[48px]">
            {allSelected ? (
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                All 51 States Selected
              </span>
            ) : selectedStates.length === 0 ? (
              <span className="text-xs text-surface-400">
                Select states on the map
              </span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedStates.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-sm bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-2 py-0.5 text-[10px] font-medium text-surface-700 dark:text-surface-300"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => onRemoveState(code)}
                      className="inline-flex items-center justify-center hover:text-surface-950 dark:hover:text-white transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Verified Data Package Type */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Verified Data Package
          </span>
          <div className="mt-1.5 space-y-2">
            <PackageCard
              type="full"
              label="Full Verified Lead Profile"
              description="Direct Phone + Deliverable Email + Brokerage + License"
              icon={ShieldCheck}
              isSelected={packageType === "full"}
              onClick={() => onPackageTypeChange("full")}
            />
            <PackageCard
              type="phone-only"
              label="Phone-Only Validated"
              description="Mobile verified direct phone numbers"
              icon={Phone}
              isSelected={packageType === "phone-only"}
              onClick={() => onPackageTypeChange("phone-only")}
            />
            <PackageCard
              type="email-only"
              label="Email-Only Validated"
              description="Deliverable business email addresses"
              icon={Mail}
              isSelected={packageType === "email-only"}
              onClick={() => onPackageTypeChange("email-only")}
            />
          </div>
        </div>

        {/* Step 4: Quantity & Live Pricing */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Quantity &amp; Pricing
          </span>
          <div className="mt-1.5 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {QUANTITY_PILLS.map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => onQuantityChange(qty)}
                  className={`text-xs font-semibold rounded-sm border px-3 py-1.5 transition-all duration-200 ${
                    quantity === qty
                       ? "bg-blue-600 text-white border-blue-600"
                       : "text-surface-500 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-700 dark:hover:text-surface-200"
                  }`}
                >
                  {qty.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={100}
                max={50000}
                step={100}
                value={quantity}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 100 && v <= 50000) {
                    onQuantityChange(v);
                  }
                }}
                className="w-28 h-8 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-sm px-2.5 text-xs font-bold tabular-nums text-center text-surface-950 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-surface-950 dark:focus:ring-surface-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="Custom"
              />
              <span className="text-[11px] text-surface-500 dark:text-surface-400 tabular-nums">
                ${PRICE_PER_LEAD.toFixed(3)}/lead
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-2 border-t border-surface-200 dark:border-surface-800">
              <span className="text-[11px] font-medium text-surface-500 dark:text-surface-400">
                Total
              </span>
              <span className="text-2xl font-bold tabular-nums text-surface-950 dark:text-white">
                {formatPrice(totalPrice)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action */}
      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={onCheckout}
          className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-none border-0 cursor-pointer"
        >
          Unlock &amp; Order Leads
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-center text-[10px] text-surface-400 dark:text-surface-500">
          <ShieldCheck className="inline h-3 w-3 mr-0.5 -mt-0.5" />
          100% Deliverability Guarantee &bull; Instant CSV Export in Vault
        </p>
      </div>
    </div>
  );
}

function PackageCard({
  label,
  description,
  icon: Icon,
  isSelected,
  onClick,
}: {
  type: PackageType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-sm border transition-all duration-200 ${
        isSelected
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600"
      }`}
    >
      <div className="flex items-start gap-2.5">
      <Icon
        className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
          isSelected
            ? "text-white"
            : "text-surface-400 dark:text-surface-500"
        }`}
      />
      <div className="min-w-0">
        <p
          className={`text-xs font-semibold ${
            isSelected
              ? "text-white"
              : "text-surface-700 dark:text-surface-300"
          }`}
        >
          {label}
        </p>
        <p
          className={`text-[10px] mt-0.5 ${
            isSelected
              ? "text-white/80"
              : "text-surface-400 dark:text-surface-500"
          }`}
        >
          {description}
        </p>
      </div>
      </div>
    </button>
  );
}
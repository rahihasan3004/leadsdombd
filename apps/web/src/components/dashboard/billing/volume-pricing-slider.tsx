"use client";

import { useState, useEffect, useCallback } from "react";
import { VOLUME_PRICING_TIERS, type PricingTier, getDefaultTier } from "@fine-leads/utils";

interface VolumePricingSliderProps {
  selectedTier: PricingTier | null;
  onTierChange: (tier: PricingTier) => void;
  onConfirm: (params: { amount: number; credits: number }) => void;
  loading: boolean;
  disabled?: boolean;
}

export default function VolumePricingSlider({
  selectedTier,
  onTierChange,
  onConfirm,
  loading,
  disabled = false,
}: VolumePricingSliderProps) {
  const initialTier = selectedTier ?? getDefaultTier();
  const initialIndex = Math.max(0, VOLUME_PRICING_TIERS.findIndex((t) => t.credits === initialTier.credits));
  const [sliderValue, setSliderValue] = useState(initialIndex);

  useEffect(() => {
    if (selectedTier) {
      const idx = Math.max(0, VOLUME_PRICING_TIERS.findIndex((t) => t.credits === selectedTier.credits));
      setSliderValue(idx);
    }
  }, [selectedTier]);

  const currentTier = VOLUME_PRICING_TIERS[sliderValue] ?? getDefaultTier();

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = parseInt(e.target.value, 10);
      setSliderValue(idx);
      onTierChange(VOLUME_PRICING_TIERS[idx]);
    },
    [onTierChange]
  );

  const handleStepClick = useCallback(
    (tier: PricingTier, idx: number) => {
      setSliderValue(idx);
      onTierChange(tier);
    },
    [onTierChange]
  );

  const progressPercentage =
    (sliderValue / Math.max(1, VOLUME_PRICING_TIERS.length - 1)) * 100;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-black text-slate-900 tabular-nums">
            ${currentTier.price}
          </span>
          <span className="text-sm font-medium text-slate-400">once</span>
        </div>
        <p className="text-sm text-slate-500">
          {currentTier.credits.toLocaleString()} credits • ${currentTier.unitPrice.toFixed(5)} per credit
        </p>
      </div>

      <div className="relative flex items-center w-full select-none touch-none py-6">
        <div className="pointer-events-none absolute inset-0 flex items-center">
          <div className="h-2 w-full rounded-full bg-slate-100" />
          <div
            className="absolute h-2 rounded-full bg-blue-600 transition-all duration-150"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={VOLUME_PRICING_TIERS.length - 1}
          step={1}
          value={sliderValue}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-label="Lead volume"
          className="volume-pricing-slider relative z-10 h-8 w-full cursor-pointer appearance-none bg-transparent"
        />

        <style>{`
          .volume-pricing-slider {
            -webkit-appearance: none;
            appearance: none;
          }
          .volume-pricing-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #2563eb;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            cursor: pointer;
            transition: transform 0.15s ease;
            margin-top: -6px;
          }
          .volume-pricing-slider::-webkit-slider-thumb:hover {
            transform: scale(1.05);
          }
          .volume-pricing-slider::-webkit-slider-thumb:active {
            transform: scale(0.95);
          }
          .volume-pricing-slider::-webkit-slider-runnable-track {
            -webkit-appearance: none;
            appearance: none;
            height: 8px;
            background: transparent;
            border-radius: 9999px;
          }
          .volume-pricing-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #2563eb;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            cursor: pointer;
            border: none;
          }
          .volume-pricing-slider::-moz-range-track {
            height: 8px;
            background: transparent;
            border-radius: 9999px;
          }
          .volume-pricing-slider:focus-visible::-webkit-slider-thumb {
            outline: none;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
          }
          .volume-pricing-slider:disabled {
            cursor: not-allowed;
            opacity: 0.6;
          }
          .volume-pricing-slider:disabled::-webkit-slider-thumb {
            cursor: not-allowed;
            background: #94a3b8;
            box-shadow: none;
          }
        `}</style>
      </div>

      <div className="flex justify-between px-1">
        {VOLUME_PRICING_TIERS.map((tier, idx) => (
          <button
            key={tier.credits}
            type="button"
            onClick={() => handleStepClick(tier, idx)}
            disabled={disabled}
            className={`text-xs font-medium transition-colors cursor-pointer ${
              idx === sliderValue
                ? "text-blue-600 font-bold"
                : "text-slate-400 hover:text-slate-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {tier.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onConfirm({ amount: currentTier.price, credits: currentTier.credits })}
        disabled={loading || disabled}
        className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-none border-0 transition-all duration-200 block text-center disabled:opacity-50"
      >
        {loading
          ? "Processing..."
          : `Buy ${currentTier.credits.toLocaleString()} Credits for $${currentTier.price} →`}
      </button>
    </div>
  );
}

"use client";

import { MapPin } from "lucide-react";
import { Skeleton } from "@fine-leads/ui";

interface StateCoverage {
  code: string;
  name: string;
  fill: string;
  leadCount: number;
}

interface CoverageWidgetProps {
  states?: StateCoverage[];
  loading?: boolean;
}

export function CoverageWidget({ states = [], loading = false }: CoverageWidgetProps) {
  const activeStates = states.length > 0 ? states : [];

  if (loading) {
    return (
      <div className="rounded-xl border-0 bg-slate-50 p-6 dark:bg-slate-900 shadow-none">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-44 w-full mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border-0 bg-slate-100 dark:bg-slate-800/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded-md" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-0 bg-slate-50 p-6 dark:bg-slate-900 shadow-none">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Territory Coverage
        </h3>
        <span className="rounded-full bg-[#14A800]/10 px-2.5 py-0.5 text-xs font-semibold text-[#14A800]">
          {activeStates.length} / 50 States
        </span>
      </div>

      {activeStates.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          No active territories yet.
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-center">
            <svg
              viewBox="0 0 959 593"
              className="h-44 w-auto"
              aria-label={`US map showing ${activeStates.length} active state${activeStates.length === 1 ? "" : "s"}`}
            >
              <g>
                <path d="M 100 200 L 150 180 L 170 190 L 200 170 L 220 200 L 210 230 L 180 240 L 130 235 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 60 150 L 100 140 L 120 160 L 130 190 L 110 210 L 80 200 L 60 180 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 200 100 L 250 90 L 270 110 L 290 130 L 270 150 L 240 140 L 210 120 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 150 70 L 200 60 L 220 80 L 240 70 L 250 90 L 220 100 L 180 90 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                {activeStates.map((state) => (
                  <path
                    key={state.code}
                    d={state.code === "FL" ? "M 620 370 L 650 360 L 670 390 L 680 430 L 660 470 L 640 480 L 620 450 L 610 400 Z"
                      : state.code === "CA" ? "M 60 150 L 100 140 L 120 160 L 130 190 L 110 210 L 80 200 L 60 180 Z"
                      : state.code === "TX" ? "M 350 280 L 420 260 L 450 280 L 460 320 L 440 360 L 410 370 L 360 350 L 340 310 Z"
                      : state.code === "NY" ? "M 680 120 L 710 110 L 720 130 L 710 150 L 730 160 L 730 180 L 700 190 L 680 180 L 670 150 Z"
                      : state.code === "AZ" ? "M 200 220 L 240 200 L 260 210 L 270 240 L 260 270 L 230 280 L 210 260 Z"
                      : "M 300 150 L 330 140 L 350 160 L 370 150 L 380 170 L 360 190 L 340 180 L 320 170 Z"}
                    fill="#14A800"
                    fillOpacity="0.2"
                    stroke="#14A800"
                    strokeWidth="1.5"
                  />
                ))}
                <path d="M 300 150 L 330 140 L 350 160 L 370 150 L 380 170 L 360 190 L 340 180 L 320 170 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 400 120 L 430 110 L 450 130 L 460 150 L 440 170 L 420 160 L 400 150 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 460 160 L 500 140 L 520 160 L 530 180 L 510 200 L 480 190 L 460 180 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 520 100 L 560 90 L 580 110 L 570 130 L 550 120 L 530 110 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 580 130 L 620 110 L 640 130 L 650 160 L 630 170 L 600 160 L 580 150 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 730 150 L 760 140 L 780 160 L 770 180 L 750 170 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 370 190 L 400 170 L 420 190 L 430 210 L 410 220 L 390 210 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 430 210 L 460 200 L 480 220 L 490 240 L 470 250 L 450 240 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 280 200 L 310 180 L 330 200 L 350 220 L 340 250 L 310 260 L 290 240 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 340 250 L 380 230 L 400 250 L 410 280 L 390 300 L 360 290 L 340 270 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 490 240 L 520 230 L 540 250 L 530 280 L 510 290 L 490 270 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 440 290 L 470 280 L 490 300 L 500 320 L 480 340 L 460 330 L 440 310 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 530 290 L 560 280 L 580 300 L 590 320 L 570 330 L 550 320 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 500 320 L 530 310 L 550 330 L 560 360 L 540 370 L 510 360 L 490 340 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 580 320 L 610 300 L 630 320 L 640 350 L 620 360 L 600 350 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 440 370 L 470 350 L 490 370 L 480 400 L 460 410 L 440 390 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 540 370 L 570 360 L 590 380 L 600 400 L 580 410 L 560 400 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 480 400 L 510 390 L 520 420 L 500 440 L 480 430 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <path d="M 460 280 L 480 260 L 500 270 L 490 290 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
              </g>
            </svg>
          </div>

          <div className="space-y-2">
            {activeStates.map((state) => (
              <div
                key={state.code}
                className="flex items-center justify-between rounded-lg border-0 bg-slate-100 dark:bg-slate-800/30 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-[#14A800]" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {state.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#14A800]">
                  {state.leadCount.toLocaleString()} Leads
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

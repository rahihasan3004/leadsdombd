"use client";

import { getPaginationItems } from "@/lib/pagination";

interface DashboardPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function DashboardPagination({
  currentPage,
  totalPages,
  onPageChange,
  label = "Pagination",
}: DashboardPaginationProps) {
  const items = getPaginationItems(currentPage, totalPages);
  if (items.length === 0) return null;
  const current = Math.min(totalPages, Math.max(1, Number.isFinite(currentPage) ? Math.floor(currentPage) : 1));
  const buttonStyle = "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50";
  const inactiveStyle = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <nav aria-label={label} className="w-full min-w-0 max-w-full overflow-x-auto sm:w-auto">
      <span className="sr-only">Page {current} of {totalPages}</span>
      {/* Compact mobile controls stay on one line, even inside the 320px Billing card. */}
      <div className="mx-auto flex w-max flex-nowrap items-center gap-0.5 sm:gap-2 py-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={current === 1}
          onClick={() => onPageChange(current - 1)}
          className={`${buttonStyle} ${inactiveStyle} w-6 px-0 sm:w-auto sm:gap-1 sm:px-3`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="hidden sm:inline">Previous</span>
        </button>
        {items.map((item) => typeof item === "number" ? (
          <button
            key={item}
            type="button"
            aria-label={`Go to page ${item}`}
            aria-current={item === current ? "page" : undefined}
            onClick={() => onPageChange(item)}
            className={`${buttonStyle} min-w-6 px-0 sm:min-w-9 sm:px-2 ${
              item === current ? "border-blue-600 bg-blue-600 text-white" : inactiveStyle
            }`}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="inline-flex h-9 w-1.5 shrink-0 items-center justify-center text-[10px] sm:text-xs text-slate-400 sm:w-4">
            <span aria-hidden="true">…</span>
            <span className="sr-only">Skipped pages</span>
          </span>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={current === totalPages}
          onClick={() => onPageChange(current + 1)}
          className={`${buttonStyle} ${inactiveStyle} w-6 px-0 sm:w-auto sm:gap-1 sm:px-3`}
        >
          <span className="hidden sm:inline">Next</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

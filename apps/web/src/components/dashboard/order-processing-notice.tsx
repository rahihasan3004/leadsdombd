import React from "react";
import { Info, X } from "lucide-react";
import { ORDER_DELIVERY_HELP } from "@/lib/order-delivery-eta";
export function OrderProcessingNotice({
  status,
  onDismiss,
}: {
  status: string;
  onDismiss?: () => void;
}) {
  if (status !== "PROCESSING" && status !== "PENDING") return null;
  return (
    <div
      role="status"
      className="mb-3 flex shrink-0 items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800"
    >
      <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="min-w-0 flex-1 leading-relaxed">{ORDER_DELIVERY_HELP}</p>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss processing notice"
          onClick={onDismiss}
          className="-my-1 -mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

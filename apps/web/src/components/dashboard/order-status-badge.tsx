import React from "react";
import { LoaderCircle } from "lucide-react";
import { orderDeliveryEta } from "@/lib/order-delivery-eta";
export function isOrderDownloadable(status: string) {
  return status === "COMPLETED";
}
export function OrderStatusBadge({
  status,
  quantity,
}: {
  status: string;
  quantity?: number;
}) {
  const pending = status === "PROCESSING" || status === "PENDING";
  const eta =
    quantity === undefined
      ? null
      : orderDeliveryEta(quantity).replace(" mins", "m");
  return (
    <span
      role="status"
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-4 ${pending ? "border-amber-200 bg-amber-50 text-amber-700" : status === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}
    >
      {pending && (
        <LoaderCircle
          aria-hidden="true"
          className="h-3 w-3 shrink-0 motion-safe:animate-spin"
        />
      )}
      {pending
        ? eta
          ? `Processing (${eta})`
          : "Processing"
        : status === "COMPLETED"
          ? "Completed"
          : status === "REFUNDED"
            ? "Refunded"
            : "Failed"}
    </span>
  );
}

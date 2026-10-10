import React from "react";
import {
  orderDeliveryEta,
  ORDER_DELIVERY_HELP,
} from "@/lib/order-delivery-eta";
export function OrderDeliveryEstimate({
  status,
  quantity,
}: {
  status: string;
  quantity: number;
}) {
  if (status !== "PROCESSING") return null;
  return (
    <div className="mt-1.5 max-w-xs text-xs text-slate-500" role="status">
      <p className="font-medium text-slate-700">{orderDeliveryEta(quantity)}</p>
      <p className="mt-1 leading-relaxed">{ORDER_DELIVERY_HELP}</p>
    </div>
  );
}

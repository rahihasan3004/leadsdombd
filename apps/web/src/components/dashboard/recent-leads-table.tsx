"use client";

import { Download } from "lucide-react";
import Link from "next/link";

interface OrderRow {
  referenceId: string;
  id: string;
  orderDate: string;
  states: string;
  category: string;
  quantity: number;
  status: "Delivered";
}

interface RecentLeadsTableProps {
  orders?: OrderRow[];
}

function formatQuantity(n: number): string {
  return n.toLocaleString("en-US");
}

export function RecentLeadsTable({ orders = [] }: RecentLeadsTableProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-surface-500">
          Recent Lead Orders &amp; Batches
        </h2>
        <Link
          href="/dashboard/lists"
          className="text-xs font-semibold text-surface-950 hover:underline"
        >
          View All in Vault &rarr;
        </Link>
      </div>

      <div className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-md overflow-x-auto shadow-2xs">
        {orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No recent orders.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-100 dark:bg-surface-800/40 border-b border-surface-200 dark:border-surface-800">
                <th className="h-8 px-3.5 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Order &amp; Date
                </th>
                <th className="h-8 px-3.5 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Target States
                </th>
                <th className="h-8 px-3.5 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="h-8 px-3.5 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="h-8 px-3.5 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="h-8 px-3.5 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/20 transition-colors"
                >
                  <td className="py-4 px-4 text-xs font-normal">
                    <div>
                      <span className="font-medium text-surface-950 tabular-nums text-xs">
                        {order.referenceId}
                      </span>
                      <p className="text-xs text-surface-500 tabular-nums">
                        {order.orderDate}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-xs font-normal">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-surface-100 border border-surface-200 text-xs font-medium text-surface-800">
                      {order.states}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs font-normal">
                    <span className="text-xs text-surface-600 font-medium">
                      {order.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs font-normal text-right">
                    <span className="text-xs font-bold text-surface-950 tabular-nums">
                      {formatQuantity(order.quantity)} Leads
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs font-normal">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs font-medium text-surface-700 dark:text-surface-300">
                      {order.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs font-normal text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 h-8 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-semibold transition-all duration-200 shadow-none border-0 cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

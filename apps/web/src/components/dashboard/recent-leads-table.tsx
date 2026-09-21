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

const ORDERS: OrderRow[] = [
  {
    referenceId: "LD-ORD-KX9M7P2Q",
    id: "#LD-9482",
    orderDate: "2026-09-19",
    states: "Florida (FL), Texas (TX)",
    category: "Real Estate Agents",
    quantity: 2500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-N4R8W6YJ",
    id: "#LD-9480",
    orderDate: "2026-09-18",
    states: "California (CA)",
    category: "Real Estate Agents",
    quantity: 1000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-B3F5H7K9",
    id: "#LD-9475",
    orderDate: "2026-09-17",
    states: "New York (NY), New Jersey (NJ)",
    category: "Real Estate Agents",
    quantity: 5000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-P8W2M4X7",
    id: "#LD-9470",
    orderDate: "2026-09-15",
    states: "Illinois (IL), Ohio (OH), Michigan (MI)",
    category: "Real Estate Agents",
    quantity: 3200,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-R6T9Q1V5",
    id: "#LD-9465",
    orderDate: "2026-09-12",
    states: "Georgia (GA), North Carolina (NC)",
    category: "Real Estate Agents",
    quantity: 1500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-L2N4C8J3",
    id: "#LD-9460",
    orderDate: "2026-09-10",
    states: "Washington (WA), Oregon (OR)",
    category: "Real Estate Agents",
    quantity: 4000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-Y7K1F9D4",
    id: "#LD-9455",
    orderDate: "2026-09-08",
    states: "Arizona (AZ), Nevada (NV), Utah (UT)",
    category: "Real Estate Agents",
    quantity: 2000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-Z5P3W8M2",
    id: "#LD-9450",
    orderDate: "2026-09-05",
    states: "Colorado (CO), New Mexico (NM)",
    category: "Real Estate Agents",
    quantity: 10000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-M8X4Q2W6",
    id: "#LD-9445",
    orderDate: "2026-09-02",
    states: "Massachusetts (MA), Connecticut (CT)",
    category: "Real Estate Agents",
    quantity: 1800,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-H3K9N7P1",
    id: "#LD-9440",
    orderDate: "2026-08-29",
    states: "Virginia (VA), Maryland (MD)",
    category: "Real Estate Agents",
    quantity: 3500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-T6W1R5V8",
    id: "#LD-9435",
    orderDate: "2026-08-25",
    states: "Pennsylvania (PA)",
    category: "Real Estate Agents",
    quantity: 2200,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-C9F2B8L4",
    id: "#LD-9430",
    orderDate: "2026-08-20",
    states: "Tennessee (TN), Alabama (AL)",
    category: "Real Estate Agents",
    quantity: 4500,
    status: "Delivered",
  },
];

function formatQuantity(n: number): string {
  return n.toLocaleString("en-US");
}

export function RecentLeadsTable() {
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

      <div className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-md overflow-hidden shadow-2xs">
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
            {ORDERS.slice(0, 8).map((order) => (
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
                    className="inline-flex items-center gap-1 h-8 px-3 bg-surface-950 hover:bg-surface-800 text-white rounded-md text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    CSV
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
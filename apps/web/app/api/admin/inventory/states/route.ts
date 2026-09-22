export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";

interface StateInventoryRow {
  code: string;
  name: string;
  totalAgents: number;
  deliverableLeads: number;
  deliverabilityRate: number;
  purchaseCount: number;
  estimatedTerritoryValue: number;
  topCities: string[];
  topBrokerages: string[];
}

interface StateInventoryResponse {
  states: StateInventoryRow[];
  summary: {
    totalStatesCovered: number;
    totalIngestedAgents: number;
    totalDeliverableLeads: number;
    totalCatalogMarketValue: number;
  };
}

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const stateCodes = LEAD_STATES.map((s) => s.code);

    const [
      totalByState,
      deliverableByState,
      cityByState,
      brokerageByState,
      completedPurchases,
    ] = await Promise.all([
      db.agent.groupBy({
        by: ["state"],
        _count: { id: true },
      }),
      db.agent.groupBy({
        by: ["state"],
        where: {
          isDeliverable: true,
          email: { not: null },
        },
        _count: { id: true },
      }),
      db.agent.groupBy({
        by: ["state", "city"],
        where: { city: { not: null } },
        _count: { id: true },
      }),
      db.agent.groupBy({
        by: ["state", "brokerageName"],
        where: { brokerageName: { not: null } },
        _count: { id: true },
      }),
      db.leadPurchase.findMany({
        where: { status: "COMPLETED" },
        select: { unlockedStates: true },
      }),
    ]);

    const totalMap = new Map<string, number>();
    for (const row of totalByState) {
      if (row.state) totalMap.set(row.state, row._count.id);
    }

    const deliverableMap = new Map<string, number>();
    for (const row of deliverableByState) {
      if (row.state) deliverableMap.set(row.state, row._count.id);
    }

    const citiesByState = new Map<string, Map<string, number>>();
    for (const row of cityByState) {
      if (!row.state || !row.city) continue;
      if (!citiesByState.has(row.state)) {
        citiesByState.set(row.state, new Map());
      }
      citiesByState.get(row.state)!.set(row.city, row._count.id);
    }

    const brokeragesByState = new Map<string, Map<string, number>>();
    for (const row of brokerageByState) {
      if (!row.state || !row.brokerageName) continue;
      if (!brokeragesByState.has(row.state)) {
        brokeragesByState.set(row.state, new Map());
      }
      brokeragesByState.get(row.state)!.set(row.brokerageName, row._count.id);
    }

    const purchaseCountMap = new Map<string, number>();
    for (const purchase of completedPurchases) {
      for (const state of purchase.unlockedStates) {
        purchaseCountMap.set(state, (purchaseCountMap.get(state) ?? 0) + 1);
      }
    }

    function getTop3(map: Map<string, number>): string[] {
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key]) => key);
    }

    let totalIngestedAgents = 0;
    let totalDeliverableLeads = 0;

    const states: StateInventoryRow[] = stateCodes.map((code) => {
      const stateInfo = LEAD_STATES.find((s) => s.code === code);
      const totalAgents = totalMap.get(code) ?? 0;
      const deliverableLeads = deliverableMap.get(code) ?? 0;
      const deliverabilityRate =
        totalAgents > 0 ? Math.round((deliverableLeads / totalAgents) * 100 * 100) / 100 : 0;
      const purchaseCount = purchaseCountMap.get(code) ?? 0;
      const estimatedTerritoryValue = Math.round(deliverableLeads * 0.019 * 100) / 100;
      const topCities = getTop3(citiesByState.get(code) ?? new Map());
      const topBrokerages = getTop3(brokeragesByState.get(code) ?? new Map());

      totalIngestedAgents += totalAgents;
      totalDeliverableLeads += deliverableLeads;

      return {
        code,
        name: stateInfo?.name ?? code,
        totalAgents,
        deliverableLeads,
        deliverabilityRate,
        purchaseCount,
        estimatedTerritoryValue,
        topCities,
        topBrokerages,
      };
    });

    const totalCatalogMarketValue = Math.round(totalDeliverableLeads * 0.019 * 100) / 100;
    const totalStatesCovered = states.filter((s) => s.totalAgents > 0).length;

    const response: StateInventoryResponse = {
      states,
      summary: {
        totalStatesCovered,
        totalIngestedAgents,
        totalDeliverableLeads,
        totalCatalogMarketValue,
      },
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("[ADMIN_INVENTORY_STATES_ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to fetch state inventory" },
      { status: 500 },
    );
  }
}
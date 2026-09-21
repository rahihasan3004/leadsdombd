"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@fine-leads/ui";
import { cn } from "@fine-leads/utils";
import { Search, MapPin, Building2, CheckCircle2, DollarSign, ExternalLink } from "lucide-react";

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

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(2)}`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  skeleton,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  skeleton?: boolean;
}) {
  return (
    <Card className="border-surface-200 dark:border-surface-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-surface-500">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-surface-400" />
      </CardHeader>
      <CardContent>
        {skeleton ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold text-surface-950 dark:text-white">
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<StateInventoryResponse>({
    queryKey: ["admin", "inventory", "states"],
    queryFn: async () => {
      const res = await fetch("/api/admin/inventory/states");
      if (!res.ok) throw new Error("Failed to fetch state inventory");
      return res.json();
    },
    staleTime: 60_000,
  });

  const filteredStates = useMemo(() => {
    if (!data?.states) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.states;
    return data.states.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q),
    );
  }, [data?.states, search]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-surface-950 dark:text-white">
          State Inventory
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Territory catalog with state-by-state agent metrics and lead valuations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="States Covered"
          value={summary ? `${summary.totalStatesCovered} / 51` : "—"}
          icon={MapPin}
          skeleton={isLoading}
        />
        <StatCard
          title="Total Agent Leads"
          value={summary ? formatCompact(summary.totalIngestedAgents) : "—"}
          icon={Building2}
          skeleton={isLoading}
        />
        <StatCard
          title="Deliverable Leads"
          value={summary ? formatCompact(summary.totalDeliverableLeads) : "—"}
          icon={CheckCircle2}
          skeleton={isLoading}
        />
        <StatCard
          title="Catalog Market Value"
          value={summary ? formatDollar(summary.totalCatalogMarketValue) : "—"}
          icon={DollarSign}
          skeleton={isLoading}
        />
      </div>

      <Card className="border-surface-200 dark:border-surface-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Territory Catalog</CardTitle>
              <p className="text-sm text-surface-500 mt-0.5">
                {filteredStates.length} state{filteredStates.length !== 1 ? "s" : ""} shown
              </p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <Input
                placeholder="Search state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">State</TableHead>
                <TableHead className="text-right">Total Agents</TableHead>
                <TableHead>Deliverable Leads</TableHead>
                <TableHead className="text-right">Unlocked by Users</TableHead>
                <TableHead className="text-right">Est. Territory Value</TableHead>
                <TableHead>Top Cities</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : filteredStates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-surface-400 py-10">
                    No states found matching &ldquo;{search}&rdquo;
                  </TableCell>
                </TableRow>
              ) : (
                filteredStates.map((state) => (
                  <TableRow key={state.code}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-surface-950 dark:text-white text-sm">
                          {state.name}
                        </span>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {state.code}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {state.totalAgents > 0
                        ? state.totalAgents.toLocaleString()
                        : (
                          <span className="text-surface-300 dark:text-surface-600">
                            0
                          </span>
                        )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm tabular-nums font-medium">
                            {state.deliverableLeads.toLocaleString()}
                          </span>
                          <span className="text-xs text-surface-400">
                            ({state.deliverabilityRate.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              state.deliverabilityRate >= 70
                                ? "bg-emerald-500"
                                : state.deliverabilityRate >= 40
                                  ? "bg-amber-500"
                                  : "bg-red-400",
                            )}
                            style={{ width: `${Math.min(state.deliverabilityRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {state.purchaseCount > 0
                        ? state.purchaseCount.toLocaleString()
                        : (
                          <span className="text-surface-300 dark:text-surface-600">
                            0
                          </span>
                        )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {state.estimatedTerritoryValue > 0
                        ? formatDollar(state.estimatedTerritoryValue)
                        : (
                          <span className="text-surface-300 dark:text-surface-600 font-normal">
                            $0
                          </span>
                        )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {state.topCities.length > 0 ? (
                          state.topCities.map((city) => (
                            <Badge
                              key={city}
                              variant="secondary"
                              className="text-[11px] max-w-[100px] truncate"
                            >
                              {city}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-surface-300 dark:text-surface-600">
                            —
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="text-xs"
                      >
                        <Link href={`/admin/agents?state=${state.code}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Explore
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  Badge,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@fine-leads/ui";
import { US_STATES, formatNumber, formatCurrency, type USState } from "@fine-leads/utils";
import { Search } from "lucide-react";

type Agent = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  brokerageName: string | null;
  state: string | null;
  city: string | null;
  licenseNumber: string | null;
  transactionCount: number;
  totalVolume: number;
  yearsExperience: number;
  specializations: string[];
  isVerified: boolean;
  verificationScore: number;
};

type SearchResponse = {
  agents: Agent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export function AgentSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<string>("");
  const [brokerage, setBrokerage] = useState("");
  const [minTransactions, setMinTransactions] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const searchParams = new URLSearchParams();
  if (query) searchParams.set("q", query);
  if (state) searchParams.set("state", state);
  if (brokerage) searchParams.set("brokerage", brokerage);
  if (minTransactions) searchParams.set("minTransactions", minTransactions);
  if (verifiedOnly) searchParams.set("verifiedOnly", "true");
  searchParams.set("page", String(page));
  searchParams.set("limit", "25");

  const { data, isLoading, isError } = useQuery<SearchResponse>({
    queryKey: ["agents", searchParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/agents?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: true,
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium text-surface-700">Search</label>
              <Input
                placeholder="Name, email, or brokerage..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700">State</label>
              <Select value={state} onValueChange={(v) => { setState(v); setPage(1); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700">Brokerage</label>
              <Input
                placeholder="e.g. Keller Williams"
                value={brokerage}
                onChange={(e) => { setBrokerage(e.target.value); setPage(1); }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700">Min Transactions</label>
              <Input
                type="number"
                placeholder="e.g. 10"
                value={minTransactions}
                onChange={(e) => { setMinTransactions(e.target.value); setPage(1); }}
                className="mt-1"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                variant={verifiedOnly ? "default" : "outline"}
                className="flex-1"
                size="sm"
              >
                Verified Only
              </Button>
              <Button
                onClick={() => {
                  setQuery("");
                  setState("");
                  setBrokerage("");
                  setMinTransactions("");
                  setVerifiedOnly(false);
                  setPage(1);
                }}
                variant="ghost"
                size="sm"
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <div className="w-full overflow-x-auto rounded-xl border-0 bg-slate-50 dark:bg-slate-900">
            <div className="grid grid-cols-7 gap-4 p-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-4 w-16" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-7 gap-4 p-4">
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40 mt-1.5" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border-0 bg-red-50 dark:bg-red-900/20 p-8 text-center">
          <p className="text-red-600">Failed to load agents. Please try again.</p>
        </div>
      )}

      {data && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">
              Showing {data.agents.length} of {formatNumber(data.pagination.total)} agents
            </p>
          </div>

          <div className="w-full overflow-x-auto rounded-xl border-0 bg-slate-50 dark:bg-slate-900">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Brokerage</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-surface-400">
                      No agents found. Try adjusting your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-surface-900">{agent.fullName}</p>
                          {agent.email && (
                            <p className="text-xs text-surface-400">{agent.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-surface-600">{agent.licenseNumber ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-surface-600">{agent.brokerageName ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-surface-600">
                          {[agent.city, agent.state].filter(Boolean).join(", ") || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-surface-900">
                          {agent.transactionCount > 0 ? formatNumber(agent.transactionCount) : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-surface-900">
                          {agent.totalVolume > 0 ? formatCurrency(agent.totalVolume) : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={agent.isVerified ? "success" : "secondary"}>
                            {agent.isVerified ? "Verified" : "Pending"}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <p className="text-sm text-surface-500">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.pagination.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
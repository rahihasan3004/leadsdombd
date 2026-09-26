"use client";

import { useState, useMemo } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@fine-leads/ui";
import { formatDate, formatNumber } from "@fine-leads/utils";
import {
  Download,
  Loader2,
  XCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ExportUser {
  id: string;
  name: string | null;
  email: string;
}

interface LeadExportEntry {
  id: string;
  userId: string;
  format: string;
  agentCount: number;
  fileUrl: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  user: ExportUser;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ExportStats {
  total: number;
  processing: number;
  failed: number;
  completed: number;
}

interface ExportsResponse {
  exports: LeadExportEntry[];
  pagination: Pagination;
  stats: ExportStats;
}

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  COMPLETED: "success",
  PROCESSING: "warning",
  FAILED: "destructive",
  PENDING: "secondary",
};

const FORMAT_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  CSV: "default",
  EXCEL: "success",
  JSON: "secondary",
  PDF: "destructive",
};

export default function AdminExportsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const limit = 25;

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== "ALL") p.set("status", statusFilter);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p;
  }, [statusFilter, page, limit]);

  const { data, isLoading, isError } = useQuery<ExportsResponse>({
    queryKey: ["admin-exports", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/exports?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch exports");
      }
      return res.json();
    },
  });

  const stats = data?.stats;

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-950 dark:text-white">
          Lead Exports Monitor
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Monitor and track all lead export jobs across the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Total Exports
            </CardTitle>
            <Download className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {stats ? formatNumber(stats.total) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">
              {stats ? `${formatNumber(stats.completed)} completed` : "All time"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Active Processing
            </CardTitle>
            <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats ? formatNumber(stats.processing) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">Currently processing</p>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Failed Jobs
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats ? formatNumber(stats.failed) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">Require attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
      <div className="w-full overflow-x-auto no-scrollbar">
        <div className="rounded-md border border-surface-200 dark:border-surface-800">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Records Exported</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Export Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div>
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36 mt-1" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-36 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
          <p className="text-red-600 dark:text-red-400">
            Failed to load exports. Please try again.
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">
              Showing {data.exports.length} of {data.pagination.total} exports
            </p>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar">
            <div className="rounded-md border border-surface-200 dark:border-surface-800">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead className="text-right">Records Exported</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Export Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {data.exports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-surface-400">
                      No export records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.exports.map((entry) => {
                    const statusVariant = STATUS_BADGE_VARIANT[entry.status] ?? "secondary";
                    const formatVariant = FORMAT_BADGE_VARIANT[entry.format] ?? "default";
                    const statusIcon =
                      entry.status === "PROCESSING" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : entry.status === "FAILED" ? (
                        <XCircle className="h-3 w-3" />
                      ) : entry.status === "COMPLETED" ? (
                        <FileSpreadsheet className="h-3 w-3" />
                      ) : null;

                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-surface-900 dark:text-white">
                              {entry.user.name ?? "Unknown"}
                            </p>
                            <p className="text-xs text-surface-400">
                              {entry.user.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={formatVariant}>
                            {entry.format}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium text-surface-900 dark:text-white">
                            {formatNumber(entry.agentCount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant} className="inline-flex items-center gap-1">
                            {statusIcon}
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-surface-500 whitespace-nowrap">
                            {formatDate(entry.createdAt, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <p className="text-sm text-surface-500">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
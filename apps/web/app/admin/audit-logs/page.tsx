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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Skeleton,
} from "@fine-leads/ui";
import { formatDate } from "@fine-leads/utils";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLogUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: AuditLogUser | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuditLogsResponse {
  auditLogs: AuditLogEntry[];
  pagination: Pagination;
}

const ACTION_OPTIONS = [
  "STATE_UNLOCK",
  "REFUND",
  "BALANCE_ADJUST",
  "ROLE_CHANGE",
  "USER_UPDATE",
  "SUBSCRIPTION_UPDATE",
  "ORGANIZATION_UPDATE",
  "API_KEY_CREATED",
  "API_KEY_REVOKED",
  "AGENT_IMPORT",
  "AGENT_UPDATE",
  "LOGIN",
  "LOGOUT",
  "PASSWORD_CHANGE",
  "SETTINGS_CHANGE",
];

const ACTION_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  STATE_UNLOCK: "success",
  REFUND: "warning",
  BALANCE_ADJUST: "outline",
  ROLE_CHANGE: "default",
  USER_UPDATE: "default",
  SUBSCRIPTION_UPDATE: "default",
  ORGANIZATION_UPDATE: "default",
  API_KEY_CREATED: "success",
  API_KEY_REVOKED: "destructive",
  AGENT_IMPORT: "success",
  AGENT_UPDATE: "secondary",
  LOGIN: "secondary",
  LOGOUT: "secondary",
  PASSWORD_CHANGE: "warning",
  SETTINGS_CHANGE: "secondary",
};

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [resourceFilter, setResourceFilter] = useState<string>("ALL");
  const limit = 25;

  const resourceOptions = useMemo(() => {
    const resources = [
      "User",
      "Organization",
      "Subscription",
      "Agent",
      "ApiKey",
      "Wallet",
      "LeadExport",
    ];
    return resources;
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (actionFilter !== "ALL") p.set("action", actionFilter);
    if (resourceFilter !== "ALL") p.set("resource", resourceFilter);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p;
  }, [search, actionFilter, resourceFilter, page]);

  const { data, isLoading, isError } = useQuery<AuditLogsResponse>({
    queryKey: ["admin-audit-logs", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch audit logs");
      }
      return res.json();
    },
  });

  const handleFilterChange = (type: "action" | "resource" | "search", value: string) => {
    setPage(1);
    if (type === "action") setActionFilter(value);
    if (type === "resource") setResourceFilter(value);
    if (type === "search") setSearch(value);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.charAt(0).toUpperCase();
    return email.charAt(0).toUpperCase();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-950 dark:text-white">
          Audit Logs
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Track all administrative and security-related actions across the platform.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-surface-400" />
          <Input
            placeholder="Search by email, IP, or resource ID..."
            value={search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(v) => handleFilterChange("action", v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {ACTION_OPTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {action.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={resourceFilter}
          onValueChange={(v) => handleFilterChange("resource", v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Resources</SelectItem>
            {resourceOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
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
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Resource ID</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead className="text-right">Date/Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32 mt-1" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-32 ml-auto" /></TableCell>
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
            Failed to load audit logs. Please try again.
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">
              Showing {data.auditLogs.length} of {data.pagination.total} entries
            </p>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar">
            <div className="rounded-md border border-surface-200 dark:border-surface-800">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Resource ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead className="text-right">Date/Time</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {data.auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-surface-400">
                      No audit log entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.auditLogs.map((entry) => {
                    const badgeVariant = ACTION_BADGE_VARIANT[entry.action] ?? "secondary";
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={entry.user?.image ?? undefined}
                                alt={entry.user?.name ?? entry.user?.email ?? "User"}
                              />
                              <AvatarFallback className="text-xs">
                                {entry.user
                                  ? getInitials(entry.user.name, entry.user.email)
                                  : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-surface-900 dark:text-white">
                                {entry.user?.name ?? "System"}
                              </p>
                              <p className="text-xs text-surface-400">
                                {entry.user?.email ?? "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={badgeVariant} className="whitespace-nowrap">
                            {entry.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-surface-600 dark:text-surface-400">
                            {entry.resource}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-surface-500">
                            {entry.resourceId ? entry.resourceId.slice(0, 12) : "—"}
                            {entry.resourceId && entry.resourceId.length > 12 ? "..." : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-surface-500">
                            {entry.ipAddress ?? "—"}
                          </span>
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
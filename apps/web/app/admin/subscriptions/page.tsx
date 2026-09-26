"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@fine-leads/ui";
import { formatDate, formatNumber } from "@fine-leads/utils";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Building2,
  Crown,
} from "lucide-react";

interface UserInfo {
  id: string;
  name: string | null;
  email: string;
}

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface Subscription {
  id: string;
  userId: string;
  organizationId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  user: UserInfo;
  organization: OrgInfo | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TierBreakdown {
  ENTERPRISE: number;
  PRO: number;
  FREE: number;
  total: number;
}

const TIER_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  FREE: "secondary",
  PRO: "success",
  ENTERPRISE: "warning",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  ACTIVE: "success",
  PAST_DUE: "destructive",
  CANCELED: "outline",
  INCOMPLETE: "secondary",
  INCOMPLETE_EXPIRED: "secondary",
  TRIALING: "warning",
  UNPAID: "destructive",
  PAUSED: "warning",
};

const TIER_OPTIONS = [
  { value: "FREE", label: "Free" },
  { value: "PRO", label: "Pro" },
  { value: "ENTERPRISE", label: "Enterprise" },
] as const;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "CANCELED", label: "Canceled" },
  { value: "PAST_DUE", label: "Past Due" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PAUSED", label: "Paused" },
  { value: "TRIALING", label: "Trialing" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "INCOMPLETE_EXPIRED", label: "Incomplete Expired" },
] as const;

export default function AdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const limit = 20;

  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTier, setEditTier] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions", tierFilter, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tierFilter !== "ALL") params.set("tier", tierFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("includeBreakdown", "true");

      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch subscriptions");
      }
      return res.json() as Promise<{
        subscriptions: Subscription[];
        pagination: Pagination;
        breakdown: TierBreakdown;
      }>;
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({
      subscriptionId,
      tier,
      status,
    }: {
      subscriptionId: string;
      tier?: string;
      status?: string;
    }) => {
      const body: Record<string, string> = {};
      if (tier) body.tier = tier;
      if (status) body.status = status;

      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to update subscription");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setEditOpen(false);
      setEditingSub(null);
    },
  });

  const breakdown = data?.breakdown;

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="border-surface-200 dark:border-surface-800 border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Enterprise
            </CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {breakdown ? formatNumber(breakdown.ENTERPRISE) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">Active enterprise subscriptions</p>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800 border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Pro
            </CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {breakdown ? formatNumber(breakdown.PRO) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">Active pro subscriptions</p>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800 border-l-4 border-l-surface-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Free
            </CardTitle>
            <Building2 className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {breakdown ? formatNumber(breakdown.FREE) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">Active free subscriptions</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={tierFilter}
          onValueChange={(v) => {
            setTierFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Tiers</SelectItem>
            {TIER_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full overflow-x-auto no-scrollbar">
        <div className="rounded-md border border-surface-200 dark:border-surface-800">
          <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stripe Customer/Sub</TableHead>
              <TableHead>Renewal Date</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[80px]" /></TableCell>
                </TableRow>
              ))
            ) : data?.subscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-surface-400 py-10">
                  No subscriptions found
                </TableCell>
              </TableRow>
            ) : (
              data?.subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-surface-900 dark:text-surface-100">
                        {sub.user.name ?? "—"}
                      </span>
                      <span className="text-xs text-surface-400">
                        {sub.user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-surface-600 dark:text-surface-300">
                    {sub.organization?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={TIER_BADGE_VARIANT[sub.tier] ?? "secondary"}
                      className="text-[11px]"
                    >
                      {sub.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_BADGE_VARIANT[sub.status] ?? "secondary"}
                      className="text-[11px]"
                    >
                      {sub.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs font-mono text-surface-400">
                      {sub.stripeCustomerId ? (
                        <span>{sub.stripeCustomerId}</span>
                      ) : (
                        <span className="text-surface-300">—</span>
                      )}
                      {sub.stripeSubscriptionId ? (
                        <span className="text-[10px]">{sub.stripeSubscriptionId}</span>
                      ) : (
                        <span className="text-[10px] text-surface-300">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-surface-400">
                    {sub.currentPeriodEnd
                      ? formatDate(sub.currentPeriodEnd)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSub(sub);
                        setEditTier(sub.tier);
                        setEditStatus(sub.status);
                        setEditOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-400">
            Showing {(data.pagination.page - 1) * limit + 1}–
            {Math.min(data.pagination.page * limit, data.pagination.total)} of{" "}
            {data.pagination.total} subscriptions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Modify subscription for {editingSub?.user.name ?? editingSub?.user.email ?? "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Tier
              </label>
              <Select value={editTier} onValueChange={setEditTier}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Status
              </label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingSub) {
                  const tierChanged = editTier !== editingSub.tier;
                  const statusChanged = editStatus !== editingSub.status;
                  if (!tierChanged && !statusChanged) {
                    setEditOpen(false);
                    return;
                  }
                  editMutation.mutate({
                    subscriptionId: editingSub.id,
                    ...(tierChanged && { tier: editTier }),
                    ...(statusChanged && { status: editStatus }),
                  });
                }
              }}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
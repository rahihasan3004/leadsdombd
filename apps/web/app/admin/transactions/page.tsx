"use client";

import { useState, useCallback } from "react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Skeleton,
} from "@fine-leads/ui";
import { formatCurrency, formatDate, US_STATES } from "@fine-leads/utils";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Wallet,
  Undo2,
} from "lucide-react";

interface UserInfo {
  id: string;
  name: string | null;
  email: string;
}

interface WalletTransaction {
  id: string;
  referenceId: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number | null;
  description: string | null;
  status: string;
  createdAt: string;
  user: UserInfo;
}

interface LeadPurchase {
  id: string;
  referenceId: string;
  userId: string;
  state: string | null;
  unlockedStates: string[];
  amountPaid: number;
  status: string;
  createdAt: string;
  user: UserInfo;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface KPIs {
  totalRevenue: number;
  totalWalletBalance: number;
  totalRefunded: number;
}

const TX_TYPE_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  RECHARGE: "success",
  CHARGE: "secondary",
  REFUND: "warning",
  BONUS: "success",
  ADJUSTMENT: "outline",
};

const PURCHASE_STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  COMPLETED: "success",
  REFUNDED: "warning",
  PENDING: "secondary",
  FAILED: "destructive",
};

export default function AdminTransactionsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("purchases");

  const [purchasesPage, setPurchasesPage] = useState(1);
  const [purchasesStatus, setPurchasesStatus] = useState<string>("ALL");
  const [purchasesState, setPurchasesState] = useState<string>("ALL");

  const [txnPage, setTxnPage] = useState(1);
  const [txnType, setTxnType] = useState<string>("ALL");

  const [refundTarget, setRefundTarget] = useState<LeadPurchase | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const limit = 20;

  const kpisQuery = useQuery({
    queryKey: ["admin-financials-kpis"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/financials/purchases?limit=1&includeKpis=true`);
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      const data = await res.json();
      return data.kpis as KPIs;
    },
  });

  const purchasesQuery = useQuery({
    queryKey: ["admin-purchases", purchasesStatus, purchasesState, purchasesPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (purchasesStatus !== "ALL") params.set("status", purchasesStatus);
      if (purchasesState !== "ALL") params.set("state", purchasesState);
      params.set("page", String(purchasesPage));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/financials/purchases?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch purchases");
      }
      return res.json() as Promise<{ purchases: LeadPurchase[]; pagination: Pagination }>;
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["admin-transactions", txnType, txnPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (txnType !== "ALL") params.set("type", txnType);
      params.set("page", String(txnPage));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/financials/transactions?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch transactions");
      }
      return res.json() as Promise<{ transactions: WalletTransaction[]; pagination: Pagination }>;
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const res = await fetch(`/api/admin/financials/purchases/${purchaseId}/refund`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to refund purchase");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["admin-financials-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      setRefundOpen(false);
      setRefundTarget(null);
    },
  });

  const handleTabChange = useCallback((value: string) => {
    setTab(value);
  }, []);

  const kpis = kpisQuery.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {kpis ? formatCurrency(kpis.totalRevenue) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">From completed purchases</p>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Platform Wallet Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {kpis ? formatCurrency(kpis.totalWalletBalance) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">Total user wallet balance</p>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Total Refunded
            </CardTitle>
            <Undo2 className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {kpis ? formatCurrency(kpis.totalRefunded) : "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">Total amount refunded</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="purchases">State Lead Purchases</TabsTrigger>
          <TabsTrigger value="transactions">Wallet Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={purchasesStatus}
              onValueChange={(v) => {
                setPurchasesStatus(v);
                setPurchasesPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={purchasesState}
              onValueChange={(v) => {
                setPurchasesState(v);
                setPurchasesPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All States</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full overflow-x-auto">
            <div className="rounded-md border border-surface-200 dark:border-surface-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Ref</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Purchased States</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {purchasesQuery.isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[130px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[70px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[100px]" /></TableCell>
                    </TableRow>
                  ))
                ) : purchasesQuery.data?.purchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-surface-400 py-10">
                      No purchases found
                    </TableCell>
                  </TableRow>
                ) : (
                  purchasesQuery.data?.purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-mono text-xs text-surface-600 dark:text-surface-400">
                        {purchase.referenceId}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-surface-900 dark:text-surface-100">
                            {purchase.user.name ?? "—"}
                          </span>
                          <span className="text-xs text-surface-400">
                            {purchase.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {purchase.unlockedStates.length > 0 ? (
                            purchase.unlockedStates.map((code) => (
                              <Badge key={code} variant="outline" className="text-[10px] px-1.5">
                                {code}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-surface-400">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-surface-700 dark:text-surface-200">
                        {formatCurrency(purchase.amountPaid)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={PURCHASE_STATUS_BADGE_VARIANT[purchase.status] ?? "secondary"}
                          className="text-[11px]"
                        >
                          {purchase.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-surface-400">
                        {formatDate(purchase.createdAt)}
                      </TableCell>
                      <TableCell>
                        {purchase.status === "COMPLETED" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                            disabled={refundMutation.isPending}
                            onClick={() => {
                              setRefundTarget(purchase);
                              setRefundOpen(true);
                            }}
                          >
                            Issue Refund
                          </Button>
                        ) : (
                          <span className="text-xs text-surface-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </div>

          {purchasesQuery.data && purchasesQuery.data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-surface-400">
                Showing {(purchasesQuery.data.pagination.page - 1) * limit + 1}–
                {Math.min(purchasesQuery.data.pagination.page * limit, purchasesQuery.data.pagination.total)} of{" "}
                {purchasesQuery.data.pagination.total} purchases
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={purchasesPage <= 1}
                  onClick={() => setPurchasesPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={purchasesPage >= purchasesQuery.data.pagination.totalPages}
                  onClick={() => setPurchasesPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={txnType}
              onValueChange={(v) => {
                setTxnType(v);
                setTxnPage(1);
              }}
            >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="RECHARGE">Recharge</SelectItem>
                <SelectItem value="CHARGE">Charge</SelectItem>
                <SelectItem value="REFUND">Refund</SelectItem>
                <SelectItem value="BONUS">Bonus</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full overflow-x-auto">
            <div className="rounded-md border border-surface-200 dark:border-surface-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Txn Ref</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {transactionsQuery.isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[130px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[70px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                    </TableRow>
                  ))
                ) : transactionsQuery.data?.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-surface-400 py-10">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactionsQuery.data?.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs text-surface-600 dark:text-surface-400">
                        {tx.referenceId}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-surface-900 dark:text-surface-100">
                            {tx.user.name ?? "—"}
                          </span>
                          <span className="text-xs text-surface-400">
                            {tx.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={TX_TYPE_BADGE_VARIANT[tx.type] ?? "secondary"}
                          className="text-[11px]"
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={
                            tx.type === "CHARGE"
                              ? "text-red-600"
                              : "text-emerald-600"
                          }
                        >
                          {tx.type === "CHARGE" ? "-" : "+"}
                          {formatCurrency(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.status === "COMPLETED"
                              ? "success"
                              : tx.status === "FAILED"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[11px]"
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-surface-400 max-w-[200px] truncate">
                        {tx.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-surface-400">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </div>

          {transactionsQuery.data && transactionsQuery.data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-surface-400">
                Showing {(transactionsQuery.data.pagination.page - 1) * limit + 1}–
                {Math.min(transactionsQuery.data.pagination.page * limit, transactionsQuery.data.pagination.total)} of{" "}
                {transactionsQuery.data.pagination.total} transactions
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txnPage <= 1}
                  onClick={() => setTxnPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txnPage >= transactionsQuery.data.pagination.totalPages}
                  onClick={() => setTxnPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={refundOpen} onOpenChange={setRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue Refund</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to refund this purchase? This will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Mark the purchase as <strong>REFUNDED</strong></li>
                <li>Credit <strong>{refundTarget ? formatCurrency(refundTarget.amountPaid) : "$0.00"}</strong> back to the user&apos;s wallet</li>
                <li>Remove the refunded states from the user&apos;s active territory access</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refundMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              disabled={refundMutation.isPending}
              onClick={() => {
                if (refundTarget) {
                  refundMutation.mutate(refundTarget.id);
                }
              }}
            >
              {refundMutation.isPending ? "Processing..." : "Confirm Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
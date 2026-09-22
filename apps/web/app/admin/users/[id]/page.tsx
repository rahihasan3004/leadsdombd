"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
  Separator,
} from "@fine-leads/ui";
import { formatCurrency, formatDate, LEAD_STATES } from "@fine-leads/utils";
import {
  ArrowLeft,
  Shield,
  CreditCard,
  Wallet,
  ShoppingCart,
  X,
  Check,
  Loader2,
} from "lucide-react";

interface UserDetail {
  id: string;
  name: string | null;
  email: string;
  emailVerified: string | null;
  image: string | null;
  role: string;
  walletBalance: number;
  createdAt: string;
  organization: { id: string; name: string; slug: string } | null;
  subscription: {
    id: string;
    tier: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  unlockedStates: string[];
  recentPurchases: Array<{
    id: string;
    referenceId: string;
    unlockedStates: string[];
    amountPaid: number;
    status: string;
    createdAt: string;
  }>;
  recentTransactions: Array<{
    id: string;
    referenceId: string;
    type: string;
    amount: number;
    balanceAfter: number | null;
    description: string;
    status: string;
    createdAt: string;
  }>;
}

const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  USER: "secondary",
  ADMIN: "warning",
  SUPER_ADMIN: "destructive",
};

const TIER_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  FREE: "secondary",
  PRO: "success",
  ENTERPRISE: "warning",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  ACTIVE: "success",
  PAST_DUE: "destructive",
  CANCELED: "secondary",
  INCOMPLETE: "warning",
  INCOMPLETE_EXPIRED: "warning",
  TRIALING: "outline",
  UNPAID: "destructive",
  PAUSED: "warning",
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "destructive",
  REFUNDED: "secondary",
};

const TXN_TYPE_LABELS: Record<string, string> = {
  RECHARGE: "Recharge",
  CHARGE: "Charge",
  REFUND: "Refund",
  BONUS: "Bonus",
  ADJUSTMENT: "Adjustment",
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;

  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [selectedUnlockStates, setSelectedUnlockStates] = useState<string[]>([]);
  const [revokeState, setRevokeState] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch user");
      }
      const json = await res.json();
      return json.user as UserDetail;
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (states: string[]) => {
      const res = await fetch(`/api/admin/users/${userId}/unlock-states`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ states }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to unlock states");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      setUnlockDialogOpen(false);
      setSelectedUnlockStates([]);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (states: string[]) => {
      const res = await fetch(`/api/admin/users/${userId}/revoke-states`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ states }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to revoke states");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      setRevokeDialogOpen(false);
      setRevokeState(null);
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: async ({ tier, status }: { tier: string; status: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to update subscription");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
  });

  const balanceMutation = useMutation({
    mutationFn: async ({
      walletBalanceAdjustment,
      balanceReason: reason,
    }: {
      walletBalanceAdjustment: number;
      balanceReason: string;
    }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletBalanceAdjustment, balanceReason: reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to adjust balance");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      setBalanceOpen(false);
      setBalanceAmount("");
      setBalanceReason("");
    },
  });

  const handleToggleState = useCallback((code: string) => {
    setSelectedUnlockStates((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  }, []);

  const isPending =
    unlockMutation.isPending ||
    revokeMutation.isPending ||
    subscriptionMutation.isPending ||
    balanceMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[250px]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Error Loading User</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
          {(error as Error)?.message ?? "User not found"}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/users")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
      </div>
    );
  }

  const availableStates = LEAD_STATES.map((s) => s.code);
  const lockedStates = availableStates.filter((s) => !data.unlockedStates.includes(s));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-950 dark:text-white">
            {data.name ?? "Unnamed User"}
          </h1>
          <p className="text-sm text-surface-500">{data.email}</p>
        </div>
        <Badge variant={ROLE_BADGE_VARIANT[data.role] ?? "secondary"} className="text-xs">
          {data.role.replace("_", " ")}
        </Badge>
      </div>

      <Tabs defaultValue="territory" className="w-full">
        <TabsList>
          <TabsTrigger value="territory">
            <Shield className="mr-2 h-4 w-4" />
            Territory Access
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="mr-2 h-4 w-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="wallet">
            <Wallet className="mr-2 h-4 w-4" />
            Wallet &amp; Transactions
          </TabsTrigger>
          <TabsTrigger value="purchases">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Lead Purchases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="territory" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>State Access</CardTitle>
                  <CardDescription>
                    {data.unlockedStates.length} of {availableStates.length} states unlocked
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setSelectedUnlockStates([]);
                    setUnlockDialogOpen(true);
                  }}
                  disabled={lockedStates.length === 0 || isPending}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Unlock State Pack
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.unlockedStates.length === 0 ? (
                <p className="text-sm text-surface-400 py-4 text-center">
                  No states unlocked yet. Use the &quot;Unlock State Pack&quot; button to grant access.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.unlockedStates.map((code) => {
                    const state = LEAD_STATES.find((s) => s.code === code);
                    return (
                      <Badge
                        key={code}
                        variant="success"
                        className="flex items-center gap-1 pr-1 cursor-default"
                      >
                        {code}
                        <button
                          type="button"
                          className="ml-1 rounded-full p-0.5 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                          onClick={() => {
                            setRevokeState(code);
                            setRevokeDialogOpen(true);
                          }}
                          disabled={isPending}
                          aria-label={`Revoke ${code}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Manager</CardTitle>
              <CardDescription>
                Override the user&apos;s current subscription tier and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.subscription ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-surface-500">Current Tier</p>
                      <Badge
                        variant={TIER_BADGE_VARIANT[data.subscription.tier] ?? "outline"}
                        className="mt-1"
                      >
                        {data.subscription.tier}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-500">Status</p>
                      <Badge
                        variant={STATUS_BADGE_VARIANT[data.subscription.status] ?? "outline"}
                        className="mt-1"
                      >
                        {data.subscription.status.replace("_", " ")}
                      </Badge>
                    </div>
                    {data.subscription.currentPeriodEnd && (
                      <div>
                        <p className="text-sm font-medium text-surface-500">Current Period Ends</p>
                        <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
                          {formatDate(data.subscription.currentPeriodEnd)}
                        </p>
                      </div>
                    )}
                    {data.subscription.stripeSubscriptionId && (
                      <div>
                        <p className="text-sm font-medium text-surface-500">Stripe Subscription</p>
                        <p className="text-sm font-mono text-surface-700 dark:text-surface-300 mt-1">
                          {data.subscription.stripeSubscriptionId}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-surface-400">No active subscription</p>
              )}

              <Separator className="my-4" />

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                  Override Subscription
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      Tier
                    </label>
                    <Select
                      value={subscriptionTier}
                      onValueChange={setSubscriptionTier}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE">FREE</SelectItem>
                        <SelectItem value="PRO">PRO</SelectItem>
                        <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      Status
                    </label>
                    <Select
                      value={subscriptionStatus}
                      onValueChange={setSubscriptionStatus}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="PAST_DUE">Past Due</SelectItem>
                        <SelectItem value="CANCELED">Canceled</SelectItem>
                        <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
                        <SelectItem value="INCOMPLETE_EXPIRED">Incomplete Expired</SelectItem>
                        <SelectItem value="TRIALING">Trialing</SelectItem>
                        <SelectItem value="UNPAID">Unpaid</SelectItem>
                        <SelectItem value="PAUSED">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (subscriptionTier && subscriptionStatus) {
                      subscriptionMutation.mutate({
                        tier: subscriptionTier,
                        status: subscriptionStatus,
                      });
                    }
                  }}
                  disabled={
                    subscriptionMutation.isPending ||
                    !subscriptionTier ||
                    !subscriptionStatus
                  }
                >
                  {subscriptionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Apply Override
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Wallet Balance</CardTitle>
                  <CardDescription>Current balance and adjustment controls</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBalanceAmount("");
                    setBalanceReason("");
                    setBalanceOpen(true);
                  }}
                  disabled={isPending}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Adjust Balance
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-surface-950 dark:text-white">
                {formatCurrency(data.walletBalance)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 10 wallet transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentTransactions.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-4">No transactions</p>
              ) : (
                <div className="rounded-md border border-surface-200 dark:border-surface-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance After</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentTransactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="font-mono text-xs text-surface-500">
                            {txn.referenceId}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px]">
                              {TXN_TYPE_LABELS[txn.type] ?? txn.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatCurrency(txn.amount)}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-surface-500">
                            {txn.balanceAfter !== null ? formatCurrency(txn.balanceAfter) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-surface-600 dark:text-surface-300 max-w-[200px] truncate">
                            {txn.description}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_BADGE_VARIANT[txn.status] ?? "outline"}
                              className="text-[11px]"
                            >
                              {txn.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-surface-400">
                            {formatDate(txn.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Purchases</CardTitle>
              <CardDescription>Last 10 state purchase orders</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentPurchases.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-4">No purchases</p>
              ) : (
                <div className="rounded-md border border-surface-200 dark:border-surface-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>States</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentPurchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-mono text-xs text-surface-500">
                            {purchase.referenceId}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {purchase.unlockedStates.map((code) => (
                                <Badge
                                  key={code}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {code}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatCurrency(purchase.amountPaid)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_BADGE_VARIANT[purchase.status] ?? "outline"}
                              className="text-[11px]"
                            >
                              {purchase.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-surface-400">
                            {formatDate(purchase.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Unlock State Pack</DialogTitle>
            <DialogDescription>
              Select US states to grant to {data.name ?? data.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="flex flex-wrap gap-2">
              {lockedStates.map((code) => {
                const state = LEAD_STATES.find((s) => s.code === code);
                const isSelected = selectedUnlockStates.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleToggleState(code)}
                    className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 dark:border-green-700"
                        : "border-surface-200 bg-white text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300 dark:hover:bg-surface-800"
                    }`}
                  >
                    {code} — {state?.name ?? code}
                    {isSelected && <Check className="ml-1 h-3 w-3" />}
                  </button>
                );
              })}
            </div>
            {lockedStates.length === 0 && (
              <p className="text-sm text-surface-400 text-center py-4">
                All states are already unlocked.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnlockDialogOpen(false)}
              disabled={unlockMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedUnlockStates.length > 0) {
                  unlockMutation.mutate(selectedUnlockStates);
                }
              }}
              disabled={unlockMutation.isPending || selectedUnlockStates.length === 0}
            >
              {unlockMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Granting...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Grant {selectedUnlockStates.length} State{selectedUnlockStates.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke State Access</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke access to{" "}
              <Badge variant="destructive" className="mx-1">
                {revokeState}
              </Badge>{" "}
              from {data.name ?? data.email}? This will remove the state from all active
              LeadPurchase records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              disabled={revokeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (revokeState) {
                  revokeMutation.mutate([revokeState]);
                }
              }}
              disabled={revokeMutation.isPending || !revokeState}
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Wallet Balance</DialogTitle>
            <DialogDescription>
              Add or deduct funds for {data.name ?? data.email}. Current balance:{" "}
              {formatCurrency(data.walletBalance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Amount
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 50.00 to add, -25.00 to deduct"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Reason
              </label>
              <Input
                placeholder="e.g. Customer support credit"
                value={balanceReason}
                onChange={(e) => setBalanceReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBalanceOpen(false)}
              disabled={balanceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const amount = Number.parseFloat(balanceAmount);
                if (!Number.isNaN(amount) && amount !== 0) {
                  balanceMutation.mutate({
                    walletBalanceAdjustment: amount,
                    balanceReason: balanceReason || "Admin balance adjustment",
                  });
                }
              }}
              disabled={
                balanceMutation.isPending ||
                !balanceAmount ||
                Number.isNaN(Number.parseFloat(balanceAmount)) ||
                Number.parseFloat(balanceAmount) === 0
              }
            >
              {balanceMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
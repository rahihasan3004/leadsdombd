"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useState, useCallback } from "react";
import Link from "next/link";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@fine-leads/ui";
import { formatCurrency, formatDate } from "@fine-leads/utils";
import {
  MoreHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Wallet,
  Trash2,
  Eye,
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  walletBalance: number;
  createdAt: string;
  organization: { id: string; name: string; slug: string } | null;
  subscriptionTier: string | null;
  leadPurchasesCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [balanceUser, setBalanceUser] = useState<AdminUser | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-users", search, roleFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch users");
      }
      return res.json() as Promise<{ users: AdminUser[]; pagination: Pagination }>;
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditRoleOpen(false);
      setEditingUser(null);
    },
  });

  const balanceMutation = useMutation({
    mutationFn: async ({
      userId,
      walletBalanceAdjustment,
      balanceReason,
    }: {
      userId: string;
      walletBalanceAdjustment: number;
      balanceReason: string;
    }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletBalanceAdjustment, balanceReason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to adjust balance");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setBalanceOpen(false);
      setBalanceUser(null);
      setBalanceAmount("");
      setBalanceReason("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteOpen(false);
      setDeleteUser(null);
    },
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const isPending =
    roleMutation.isPending || balanceMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <Input
            placeholder="Search users by name or email..."
            value={search}
            onChange={handleSearch}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="USER">User</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
          {(error as Error)?.message ?? "Failed to load users"}
        </div>
      )}

      <div className="rounded-md border border-surface-200 dark:border-surface-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Org</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Wallet</TableHead>
              <TableHead>Purchases</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[70px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[30px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data?.users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-surface-400 py-10">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              data?.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-medium text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline"
                      >
                        {user.name ?? "—"}
                      </Link>
                      <span className="text-xs text-surface-400">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE_VARIANT[user.role] ?? "secondary"} className="text-[11px]">
                      {user.role.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-surface-600 dark:text-surface-300">
                    {user.organization?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {user.subscriptionTier ? (
                      <Badge variant={TIER_BADGE_VARIANT[user.subscriptionTier] ?? "outline"} className="text-[11px]">
                        {user.subscriptionTier}
                      </Badge>
                    ) : (
                      <span className="text-xs text-surface-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-surface-700 dark:text-surface-200">
                    {formatCurrency(user.walletBalance)}
                  </TableCell>
                  <TableCell className="text-sm text-surface-600 dark:text-surface-300 text-center">
                    {user.leadPurchasesCount}
                  </TableCell>
                  <TableCell className="text-sm text-surface-400">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/users/${user.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingUser(user);
                            setNewRole(user.role);
                            setEditRoleOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Role
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setBalanceUser(user);
                            setBalanceAmount("");
                            setBalanceReason("");
                            setBalanceOpen(true);
                          }}
                        >
                          <Wallet className="mr-2 h-4 w-4" />
                          Adjust Balance
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 dark:text-red-400"
                          onClick={() => {
                            setDeleteUser(user);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-400">
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1}–
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{" "}
            {data.pagination.total} users
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

      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingUser?.name ?? editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleOpen(false)} disabled={roleMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingUser) {
                  roleMutation.mutate({ userId: editingUser.id, role: newRole });
                }
              }}
              disabled={roleMutation.isPending || newRole === editingUser?.role}
            >
              {roleMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Wallet Balance</DialogTitle>
            <DialogDescription>
              Add or deduct funds for {balanceUser?.name ?? balanceUser?.email}. Current balance:{" "}
              {balanceUser ? formatCurrency(balanceUser.walletBalance) : "$0.00"}
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
            <Button variant="outline" onClick={() => setBalanceOpen(false)} disabled={balanceMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const amount = Number.parseFloat(balanceAmount);
                if (balanceUser && !Number.isNaN(amount) && amount !== 0) {
                  balanceMutation.mutate({
                    userId: balanceUser.id,
                    walletBalanceAdjustment: amount,
                    balanceReason: balanceReason || "Admin balance adjustment",
                  });
                }
              }}
              disabled={balanceMutation.isPending || !balanceAmount || Number.isNaN(Number.parseFloat(balanceAmount)) || Number.parseFloat(balanceAmount) === 0}
            >
              {balanceMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteUser?.name ?? deleteUser?.email}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteUser) {
                  deleteMutation.mutate(deleteUser.id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAdminAnalytics } from "@/lib/admin/analytics-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@fine-leads/ui";
import { formatCurrency, formatDate, formatNumber, formatRelativeDate } from "@fine-leads/utils";
import {
  Users,
  CreditCard,
  UserRoundSearch,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

function TrendBadge({ trend }: { trend: number }) {
  if (trend === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-surface-400 ml-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-surface-300" />
        No change
      </span>
    );
  }

  const isUp = trend > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs ml-2 ${
        isUp ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isUp ? "+" : ""}
      {trend}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, "success" | "warning" | "destructive" | "secondary" | "outline"> = {
    COMPLETED: "success",
    RECHARGE: "success",
    CHARGE: "secondary",
    REFUND: "warning",
    BONUS: "success",
    ADJUSTMENT: "secondary",
    PENDING: "warning",
    FAILED: "destructive",
    REFUNDED: "outline",
  };

  const variant = colorMap[status] ?? "secondary";

  return (
    <Badge variant={variant} className="text-[11px]">
      {status}
    </Badge>
  );
}

export default async function AdminPage() {
  const analytics = await getAdminAnalytics();

  const {
    users,
    subscriptions,
    agents,
    financials,
    recentActivity,
  } = analytics;

  const { auditLogs, transactions } = recentActivity;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {formatNumber(users.total)}
            </div>
            <div className="flex items-center mt-1">
              <span className="text-xs text-surface-400">
                {formatNumber(users.newThisMonth)} new this month
              </span>
              <TrendBadge trend={users.trend} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Active Subscriptions
            </CardTitle>
            <CreditCard className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {formatNumber(subscriptions.active)}
            </div>
            <div className="flex items-center mt-1">
              <span className="text-xs text-surface-400">vs. last month</span>
              <TrendBadge trend={subscriptions.trend} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Total Agents
            </CardTitle>
            <UserRoundSearch className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {formatNumber(agents.total)}
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <p className="text-xs text-surface-400">
                {formatNumber(agents.deliverable)} deliverable
                <Badge variant="success" className="ml-1.5 text-[10px] px-1.5 py-0">
                  deliverable
                </Badge>
              </p>
              <p className="text-xs text-surface-400">
                {formatNumber(agents.verified)} verified
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-surface-500">
              Platform Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-surface-950 dark:text-white">
              {formatCurrency(financials.totalRevenue)}
            </div>
            <p className="text-xs text-surface-400 mt-1">
              Wallet balance: {formatCurrency(financials.totalWalletBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader>
            <CardTitle className="text-base">Subscription Tiers</CardTitle>
            <CardDescription>Active subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(
                [
                  { label: "Enterprise", key: "ENTERPRISE", tier: subscriptions.byTier.ENTERPRISE },
                  { label: "Pro", key: "PRO", tier: subscriptions.byTier.PRO },
                  { label: "Free", key: "FREE", tier: subscriptions.byTier.FREE },
                ] as const
              ).map(({ label, key, tier }) => {
                const pct =
                  subscriptions.active > 0
                    ? Math.round((tier / subscriptions.active) * 100)
                    : 0;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-surface-700 dark:text-surface-300">
                        {label}
                      </span>
                      <span className="text-surface-500">
                        {formatNumber(tier)}{" "}
                        <span className="text-xs text-surface-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          key === "ENTERPRISE"
                            ? "bg-amber-500"
                            : key === "PRO"
                              ? "bg-blue-500"
                              : "bg-surface-300 dark:bg-surface-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader>
            <CardTitle className="text-base">Agent Verification</CardTitle>
            <CardDescription>Verified vs. unverified agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(
                [
                  { label: "Verified", value: agents.verified, color: "bg-emerald-500" },
                  { label: "Unverified", value: agents.unverified, color: "bg-surface-300 dark:bg-surface-600" },
                ] as const
              ).map(({ label, value, color }) => {
                const pct =
                  agents.total > 0
                    ? Math.round((value / agents.total) * 100)
                    : 0;
                return (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-surface-700 dark:text-surface-300">
                        {label}
                      </span>
                      <span className="text-surface-500">
                        {formatNumber(value)}{" "}
                        <span className="text-xs text-surface-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader>
            <CardTitle className="text-base">Recent Audit Logs</CardTitle>
            <CardDescription>Latest platform activity</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-surface-400 py-6">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium text-sm">
                        {log.user?.name ?? log.user?.email ?? "System"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-surface-500">
                        {log.resource}
                      </TableCell>
                      <TableCell className="text-right text-sm text-surface-400">
                        {formatRelativeDate(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <CardDescription>Latest wallet transactions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-surface-400 py-6">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium text-sm">
                        {tx.user?.name ?? tx.user?.email ?? "Unknown"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.type} />
                      </TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={
                            tx.type === "CHARGE" ? "text-red-600" : "text-emerald-600"
                          }
                        >
                          {tx.type === "CHARGE" ? "-" : "+"}
                          {formatCurrency(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell className="text-right text-sm text-surface-400">
                        {formatRelativeDate(tx.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
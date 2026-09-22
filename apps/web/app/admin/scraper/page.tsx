"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
} from "@fine-leads/ui";
import { formatDate, formatRelativeDate, formatNumber } from "@fine-leads/utils";
import {
  Bot,
  Mail,
  ShieldCheck,
  TrendingUp,
  Search,
  MapPin,
} from "lucide-react";

interface ScraperStats {
  totalScraped: number;
  ingestedToday: number;
  ingestedThisWeek: number;
  ingestedThisMonth: number;
  emailDiscoveryRate: number;
  smtpDeliverabilityRate: number;
  deliverableAgents: number;
  totalWithEmail: number;
  avgDataQualityScore: number;
  dailyTrend: { date: string; count: number }[];
}

interface CoverageState {
  stateCode: string;
  stateName: string;
  totalScraped: number;
  latestScrapedAt: string | null;
  freshness: "fresh" | "moderate" | "stale";
}

interface FeedAgent {
  id: string;
  fullName: string;
  brokerageName: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  isDeliverable: boolean;
  scrapedAt: string | null;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
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
        <div className="text-2xl font-bold text-surface-950 dark:text-white">
          {value}
        </div>
        <p className="text-xs text-surface-400 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function FreshnessBadge({ freshness }: { freshness: "fresh" | "moderate" | "stale" }) {
  const config = {
    fresh: { label: "Fresh", variant: "success" as const },
    moderate: { label: "Moderate", variant: "warning" as const },
    stale: { label: "Stale", variant: "destructive" as const },
  };
  const { label, variant } = config[freshness];
  return (
    <Badge variant={variant} className="text-[11px]">
      {label}
    </Badge>
  );
}

export default function ScraperDashboardPage() {
  const [coverageSearch, setCoverageSearch] = useState("");

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery<ScraperStats>({
    queryKey: ["admin-scraper-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/scraper/stats");
      if (!res.ok) throw new Error("Failed to fetch scraper stats");
      return res.json();
    },
  });

  const {
    data: coverage,
    isLoading: coverageLoading,
  } = useQuery<CoverageState[]>({
    queryKey: ["admin-scraper-coverage"],
    queryFn: async () => {
      const res = await fetch("/api/admin/scraper/coverage");
      if (!res.ok) throw new Error("Failed to fetch coverage");
      return res.json();
    },
  });

  const {
    data: feed,
    isLoading: feedLoading,
  } = useQuery<FeedAgent[]>({
    queryKey: ["admin-scraper-feed"],
    queryFn: async () => {
      const res = await fetch("/api/admin/scraper/feed");
      if (!res.ok) throw new Error("Failed to fetch feed");
      return res.json();
    },
  });

  const loading = statsLoading || coverageLoading || feedLoading;

  const filteredCoverage = useMemo(() => {
    const cov = coverage ?? [];
    if (!coverageSearch.trim()) return cov;
    const q = coverageSearch.toLowerCase();
    return cov.filter(
      (s) =>
        s.stateName.toLowerCase().includes(q) ||
        s.stateCode.toLowerCase().includes(q)
    );
  }, [coverage, coverageSearch]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-surface-200 dark:border-surface-800">
              <CardContent className="p-6">
                <div className="h-4 w-24 bg-surface-200 dark:bg-surface-700 rounded mb-3" />
                <div className="h-8 w-16 bg-surface-200 dark:bg-surface-700 rounded mb-2" />
                <div className="h-3 w-32 bg-surface-200 dark:bg-surface-700 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-surface-200 dark:border-surface-800">
          <CardContent className="p-6">
            <div className="h-64 bg-surface-200 dark:bg-surface-700 rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Ingested Leads"
          value={formatNumber(stats?.totalScraped ?? 0)}
          subtitle={`${formatNumber(stats?.ingestedToday ?? 0)} today · ${formatNumber(stats?.ingestedThisWeek ?? 0)} this week`}
          icon={Bot}
        />
        <StatCard
          title="Email Discovery Rate"
          value={`${stats?.emailDiscoveryRate ?? 0}%`}
          subtitle={`${formatNumber(stats?.totalWithEmail ?? 0)} of ${formatNumber(stats?.totalScraped ?? 0)} leads`}
          icon={Mail}
        />
        <StatCard
          title="SMTP Deliverability"
          value={`${stats?.smtpDeliverabilityRate ?? 0}%`}
          subtitle={`${formatNumber(stats?.deliverableAgents ?? 0)} deliverable`}
          icon={ShieldCheck}
        />
        <StatCard
          title="Data Quality Score"
          value={`${stats?.avgDataQualityScore ?? 0}%`}
          subtitle="Average verification score"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader>
            <CardTitle className="text-base">Email Discovery</CardTitle>
            <CardDescription>
              {stats?.emailDiscoveryRate ?? 0}% of scraped agents have an email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressBar
              value={stats?.totalWithEmail ?? 0}
              max={stats?.totalScraped ?? 1}
              color="bg-blue-500"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-surface-400">
              <span>{formatNumber(stats?.totalWithEmail ?? 0)} with email</span>
              <span>{stats?.emailDiscoveryRate ?? 0}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader>
            <CardTitle className="text-base">SMTP Deliverability</CardTitle>
            <CardDescription>
              {stats?.smtpDeliverabilityRate ?? 0}% of emails are deliverable
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressBar
              value={stats?.deliverableAgents ?? 0}
              max={stats?.totalWithEmail ?? 1}
              color="bg-emerald-500"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-surface-400">
              <span>{formatNumber(stats?.deliverableAgents ?? 0)} deliverable</span>
              <span>{stats?.smtpDeliverabilityRate ?? 0}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="coverage" className="w-full">
        <TabsList>
          <TabsTrigger value="coverage">State Coverage & Freshness</TabsTrigger>
          <TabsTrigger value="feed">Live Ingestion Feed</TabsTrigger>
        </TabsList>

        <TabsContent value="coverage" className="mt-4">
          <Card className="border-surface-200 dark:border-surface-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">State Coverage</CardTitle>
                  <CardDescription>
                    Per-state scraping freshness and agent counts
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-surface-400" />
                  <Input
                    placeholder="Search states..."
                    value={coverageSearch}
                    onChange={(e) => setCoverageSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">State</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Scraped Count</TableHead>
                    <TableHead>Last Scraped</TableHead>
                    <TableHead className="text-right">Freshness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoverage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-surface-400 py-6">
                        No state coverage data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCoverage.map((s) => (
                      <TableRow key={s.stateCode}>
                        <TableCell className="font-medium text-sm">
                          {s.stateCode}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-surface-400" />
                            {s.stateName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatNumber(s.totalScraped)}
                        </TableCell>
                        <TableCell className="text-sm text-surface-500">
                          {s.latestScrapedAt
                            ? formatDate(s.latestScrapedAt)
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <FreshnessBadge freshness={s.freshness} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feed" className="mt-4">
          <Card className="border-surface-200 dark:border-surface-800">
            <CardHeader>
              <CardTitle className="text-base">Live Ingestion Feed</CardTitle>
              <CardDescription>
                Latest 20 agents ingested from the scraper engine
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Scraped</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const feedList = Array.isArray(feed) ? feed : [];
                    if (feedList.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-surface-400 py-6">
                            No scraper agents found
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return feedList.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="text-sm">
                          <div>
                            <p className="font-medium">{agent.fullName}</p>
                            {agent.brokerageName && (
                              <p className="text-xs text-surface-400">
                                {agent.brokerageName}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-surface-500">
                          {agent.city && agent.state
                            ? `${agent.city}, ${agent.state}`
                            : agent.state ?? "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="flex items-center gap-1.5">
                            {agent.email ?? "-"}
                            {agent.email && (
                              <Badge
                                variant={agent.isDeliverable ? "success" : "destructive"}
                                className="text-[10px] px-1.5"
                              >
                                {agent.isDeliverable ? "OK" : "N/A"}
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-surface-500">
                          {agent.phone ?? "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-surface-400">
                          {agent.scrapedAt
                            ? formatRelativeDate(agent.scrapedAt)
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
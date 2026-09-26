"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@fine-leads/ui";
import { formatDate, formatNumber } from "@fine-leads/utils";
import { Building2 } from "lucide-react";

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  createdAt: string;
}

export default function AdminOrganizationsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to fetch organizations");
      }
      const json = await res.json();
      return json.organizations as OrganizationRow[];
    },
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
      <Card className="border-surface-200 dark:border-surface-800">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-surface-400" />
          <div>
            <CardTitle className="text-base">Organizations</CardTitle>
            <CardDescription>
              All registered organizations on the platform
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isError && (
          <div className="px-6 pb-4">
            <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
              {(error as Error)?.message ?? "Failed to load organizations"}
            </div>
          </div>
        )}
        <div className="w-full overflow-x-auto no-scrollbar">
          <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-[90px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-surface-400 py-10">
                  No organizations found
                </TableCell>
              </TableRow>
            ) : (
              data?.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium text-sm text-surface-950 dark:text-white">
                    {org.name}
                  </TableCell>
                  <TableCell className="text-sm text-surface-400 font-mono">
                    {org.slug}
                  </TableCell>
                  <TableCell className="text-sm text-surface-600 dark:text-surface-300">
                    {formatNumber(org.memberCount)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-surface-400">
                    {formatDate(org.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
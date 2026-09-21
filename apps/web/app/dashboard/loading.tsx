import { Skeleton } from "@fine-leads/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />

      <Skeleton className="h-16 w-full rounded-2xl" />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-[65] space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>

        <div className="flex-[35]">
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
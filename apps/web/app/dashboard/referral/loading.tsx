import { Skeleton } from "@fine-leads/ui";

export default function ReferralLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-5 w-72" />

      <Skeleton className="h-14 w-full rounded-2xl" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}
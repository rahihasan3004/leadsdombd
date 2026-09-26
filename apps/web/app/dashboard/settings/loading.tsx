import { Skeleton } from "@fine-leads/ui";

export default function SettingsLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-5 w-72" />

      <div className="space-y-4">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}
import { Skeleton } from "@fine-leads/ui";

export default function ListsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-5 w-72" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>

      <Skeleton className="h-10 w-72 rounded-lg" />

      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 flex-1 rounded-lg" style={{ width: `${80 + ((i * 13) % 40)}%` }} />
            <Skeleton className="h-10 rounded-lg" style={{ width: `${20 + ((i * 7) % 15)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
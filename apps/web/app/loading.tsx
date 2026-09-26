import { Skeleton } from "@fine-leads/ui";

export default function Loading() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white text-slate-900">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  );
}

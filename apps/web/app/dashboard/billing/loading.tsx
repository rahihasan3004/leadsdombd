import { Skeleton } from "@fine-leads/ui";

export default function BillingLoading() {
  return (
    <div className="w-full min-h-screen bg-[#F4F7FB] p-3.5 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-5 w-96 mt-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 rounded-2xl border-0 bg-slate-50 p-7">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-10 w-40 mt-2" />
          <Skeleton className="h-3 w-56 mt-2" />
          <Skeleton className="h-3 w-28 mt-6" />
          <div className="grid grid-cols-5 gap-2.5 mt-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-full" />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-3 w-4" />
            <Skeleton className="h-px flex-1" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl mt-3" />
          <Skeleton className="h-11 w-full rounded-xl mt-6" />
        </div>
        <div className="lg:col-span-4 rounded-2xl border-0 bg-slate-50 p-7">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-40 mt-1" />
          <Skeleton className="h-16 w-full mt-2" />
          <Skeleton className="h-20 w-full mt-5" />
          <Skeleton className="h-10 w-full rounded-xl mt-6" />
        </div>
      </div>

      <div className="rounded-2xl border-0 bg-slate-50 p-7">
        <Skeleton className="h-5 w-36 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl mb-2" />
        ))}
      </div>
    </div>
  );
}

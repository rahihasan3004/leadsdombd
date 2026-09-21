import { cn } from "@fine-leads/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/80", className)}
      {...props}
    />
  );
}
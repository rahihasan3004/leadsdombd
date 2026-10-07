import { type LucideIcon } from "lucide-react";
import { cn } from "@fine-leads/utils";

interface KpiCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  action?: {
    label: string;
    href: string;
  };
  badge?: string;
  badgeColor?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg = "bg-[#F0F4FF]",
  iconColor = "text-[#465FFF]",
  trend,
  action,
  badge,
  badgeColor = "bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full px-2 py-0.5 text-xs font-medium",
}: KpiCardProps) {
  return (
    <div className="bg-white shadow-none border-0 rounded-2xl p-3.5 sm:p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between w-full">
        <span className={cn("p-3 rounded-xl w-fit", iconBg, iconColor)}>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full",
              trend.positive
                ? "text-emerald-700 bg-emerald-50"
                : "text-red-700 bg-red-50"
            )}
          >
            {trend.value}
          </span>
        )}
        {badge && (
          <span
            className={cn(
              "text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 leading-tight whitespace-nowrap shrink-0",
              badgeColor
            )}
          >
            {badge}
          </span>
        )}
        {action && !trend && !badge && (
          <a
            href={action.href}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            {action.label}
          </a>
        )}
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

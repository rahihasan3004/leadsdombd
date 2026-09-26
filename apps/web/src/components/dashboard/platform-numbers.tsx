import { Users, ShieldCheck, Coins, Briefcase } from "lucide-react";

interface PlatformNumbersProps {
  totalLeads?: number;
  activeStates?: number;
  creditsAvailable?: number;
}

export function PlatformNumbers({
  totalLeads = 0,
  activeStates = 0,
  creditsAvailable = 0,
}: PlatformNumbersProps) {
  const metrics = [
    {
      label: "Total Leads",
      value: totalLeads.toLocaleString(),
      sub: `Across ${activeStates} Tier-1 States`,
      icon: Users,
      color: "text-[#14A800]",
      bg: "bg-[#14A800]/10",
    },
    {
      label: "Deliverability",
      value: "100%",
      sub: "0% Bounce Rate",
      icon: ShieldCheck,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-500/10",
    },
    {
      label: "Credits Available",
      value: creditsAvailable.toLocaleString(),
      sub: "In your inventory",
      icon: Coins,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      label: "Active Categories",
      value: "Realtors",
      sub: "& Brokers",
      icon: Briefcase,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-500/10",
    },
  ];

  return (
    <div className="rounded-xl border-0 bg-slate-50 p-6 dark:bg-slate-900 shadow-none">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
        Your Numbers
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-lg border-0 bg-slate-100 dark:bg-slate-800/30 p-3"
            >
              <div className={`mb-2 inline-flex rounded-md ${m.bg} p-1.5`}>
                <Icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
                {m.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {m.sub}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

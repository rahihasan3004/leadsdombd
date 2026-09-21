import { ShieldCheck, Users } from "lucide-react";

interface DatasetPack {
  id: string;
  title: string;
  leadCount: number;
  price: string;
  icon: typeof Users;
}

const PACKS: DatasetPack[] = [
  {
    id: "1",
    title: "US Real Estate Agents (Top 10 States)",
    leadCount: 150000,
    price: "$19.00 / 1k leads",
    icon: Users,
  },
  {
    id: "2",
    title: "California B2B Decision Makers",
    leadCount: 85000,
    price: "$19.00 / 1k leads",
    icon: Users,
  },
  {
    id: "3",
    title: "Healthcare & Medical Practice Directors",
    leadCount: 62000,
    price: "$19.00 / 1k leads",
    icon: Users,
  },
];

export function FeaturedPacks() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
          Featured Lead Datasets & Territory Packs
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PACKS.map((pack) => (
          <div
            key={pack.id}
            className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-md p-5 shadow-micro"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface-100 dark:bg-surface-800">
                <pack.icon className="h-4 w-4 text-surface-600" />
              </div>
              <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
                Dataset Pack
              </span>
            </div>

            <h3 className="text-sm font-semibold text-surface-950 dark:text-white mb-3 leading-snug">
              {pack.title}
            </h3>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-surface-950 dark:text-white">
                  {pack.leadCount.toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[11px] text-status-verified font-medium">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Leads
                </span>
              </div>
              <p className="text-xs text-surface-500 tabular-nums">{pack.price}</p>
            </div>

            <button
              type="button"
              className="w-full h-9 bg-surface-950 text-white rounded-md text-xs font-semibold hover:bg-surface-800 transition-colors cursor-pointer"
            >
              Configure & Unlock
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
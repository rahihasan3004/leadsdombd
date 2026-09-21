"use client";

import { useState, useCallback } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  Star,
  Hash,
  X,
  MapPinned,
} from "lucide-react";
import { toast } from "sonner";

export interface AgentData {
  id: string;
  fullName: string;
  brokerageName: string | null;
  brokerageAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  timezone: string | null;
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  websiteUrl: string | null;
  googlePlaceId: string | null;
  googleMapsLink: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  googleMainCategory: string | null;
  googleSubcategories: string | null;
  scrapedAt: string | null;
  verificationScore: number | null;
  dataSource: string | null;
}

interface AgentDetailModalProps {
  agent: AgentData | null;
  open: boolean;
  onClose: () => void;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimezoneDisplay(tz: string | null): string {
  if (!tz) return "--";
  const map: Record<string, string> = {
    "America/New_York": "Eastern",
    "America/Chicago": "Central",
    "America/Denver": "Mountain",
    "America/Los_Angeles": "Pacific",
    "America/Anchorage": "Alaska",
    "Pacific/Honolulu": "Hawaii",
  };
  return map[tz] ?? tz;
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        toast.success(label ? `${label} copied` : "Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [value, label],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-shrink-0 p-1 rounded-sm text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-status-verified" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-surface-100 dark:border-surface-800">
      <Icon className="w-4 h-4 text-surface-500" />
      <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">
        {label}
      </span>
    </div>
  );
}

function AttrRow({
  icon: Icon,
  label,
  value,
  copyable,
  href,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  copyable?: boolean;
  href?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 group">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Icon className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-0.5">
            {label}
          </p>
          <div className="flex items-center gap-1.5">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-surface-800 dark:text-surface-200 hover:text-surface-950 dark:hover:text-white hover:underline truncate"
              >
                {value}
              </a>
            ) : (
              <span
                className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate"
              >
                {value}
              </span>
            )}
            {badge}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {copyable && value !== "--" && <CopyButton value={value} label={label} />}
        {href && value !== "--" && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded-sm text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
            title="Open link"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function AgentDetailModal({ agent, open, onClose }: AgentDetailModalProps) {
  if (!agent || !open) return null;

  const fullAddress = [
    agent.brokerageAddress,
    agent.city,
    agent.state,
    agent.zipCode?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(", ");

  const handleCopyAllInfo = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const lines = [
        agent.fullName,
        `${agent.category ?? "Real Estate Agent"} · ${agent.brokerageName ?? ""}`,
        `Phone: ${agent.phone ?? "--"}`,
        `Email: ${agent.email ?? "--"} (${agent.emailStatus ?? "unknown"})`,
        agent.websiteUrl ? `Website: ${agent.websiteUrl}` : null,
        `Address: ${fullAddress || "--"}`,
        `Timezone: ${formatTimezoneDisplay(agent.timezone)}`,
        agent.rating != null
          ? `Rating: ${agent.rating}/5.0 (${agent.reviewCount ?? 0} reviews)`
          : null,
        agent.googleMapsLink ? `Google Maps: ${agent.googleMapsLink}` : null,
        agent.googlePlaceId ? `Google Place ID: ${agent.googlePlaceId}` : null,
        agent.scrapedAt ? `Scraped: ${formatTimestamp(agent.scrapedAt)}` : null,
      ].filter(Boolean).join("\n");

      navigator.clipboard.writeText(lines).then(() => {
        toast.success("Business info copied");
      });
    },
    [agent, fullAddress],
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-lg p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1.5 rounded-md text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="pr-8">
          <h2 className="text-lg font-bold text-surface-950 dark:text-white">
            {agent.fullName}
          </h2>
          <p className="text-xs text-surface-500 mt-0.5">
            {agent.category ?? "real estate agent"} • {[agent.city, agent.state].filter(Boolean).join(", ") || agent.state || "N/A"}
          </p>
        </div>

        {/* Primary Copy Button (Obsidian Monochrome) */}
        <div className="mt-5 mb-6">
          <button
            type="button"
            onClick={handleCopyAllInfo}
            className="w-full py-2.5 px-4 rounded-xl bg-[#465FFF] hover:bg-[#3B50E0] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors duration-150 cursor-pointer"
          >
            <Copy className="h-4 w-4" />
            <span>Copy business info</span>
          </button>
        </div>

        {/* Section 1: Contact */}
        <div className="space-y-4">
          <AttrRow
            icon={Phone}
            label="Phone"
            value={agent.phone ?? "--"}
            copyable
          />
          <AttrRow
            icon={Mail}
            label="Email"
            value={agent.email ?? "--"}
            copyable
          />
          {agent.websiteUrl && (
            <AttrRow
              icon={Globe}
              label="Website"
              value={agent.websiteUrl}
              copyable
              href={agent.websiteUrl}
            />
          )}
        </div>

        {/* Section 2: Location */}
        <div className="mt-5">
          <SectionHeader icon={MapPin} label="Location" />

          <AttrRow
            icon={MapPin}
            label="Address"
            value={fullAddress || "--"}
            copyable
          />
          <AttrRow
            icon={Clock}
            label="Time zone"
            value={formatTimezoneDisplay(agent.timezone)}
          />
        </div>

        {/* Section 3: Google Maps Intelligence */}
        <div className="mt-5">
          <SectionHeader icon={MapPinned} label="Google Maps Intelligence" />

          {agent.rating != null && (
            <AttrRow
              icon={Star}
              label="Rating & Reviews"
              value={`★ ${agent.rating.toFixed(1)} (${agent.reviewCount?.toLocaleString() ?? 0})`}
            />
          )}
          {agent.googleMapsLink && (
            <AttrRow
              icon={MapPin}
              label="Google Maps Listing"
              value="View on Google Maps"
              href={agent.googleMapsLink}
            />
          )}
          <AttrRow
            icon={Hash}
            label="Google Place ID"
            value={agent.googlePlaceId ?? "--"}
            copyable
          />
          <AttrRow
            icon={Clock}
            label="Scraped"
            value={formatTimestamp(agent.scrapedAt)}
          />
        </div>
      </div>
    </div>
  );
}
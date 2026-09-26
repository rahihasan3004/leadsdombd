"use client";

import { useState, useCallback, useEffect } from "react";
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
  X,
  Building2,
  Tag,
  Compass,
  Briefcase,
  Award,
  Calendar,
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
  phone: string | null;
  websiteUrl: string | null;
  googleMapsLink: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  scrapedAt: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  googlePlaceId: string | null;
  googleMainCategory: string | null;
  googleSubcategories: string | null;
  verificationScore: number | null;
  dataSource: string | null;
  emailStatus: string | null;
  officePhone: string | null;
  photoUrl: string | null;
  licenseStatus: string | null;
  licenseExpiry: string | null;
  nmlsId: string | null;
  marketArea: string | null;
  propertyTypes: string[] | null;
  transactionCount: number | null;
  totalVolume: number | null;
  averagePrice: number | null;
  yearsExperience: number | null;
  specializations: string[] | null;
  bio: string | null;
  socialProfiles: Record<string, unknown> | null;
  lastVerifiedAt: string | null;
  isVerified: boolean | null;
  isDeliverable: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
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

function formatPhone(phone: string | null): string {
  if (!phone) return "--";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
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
              <span className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
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
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleCopyAllInfo = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!agent) return;
      const lines = [
        agent.fullName,
        agent.category ? `Category: ${agent.category}` : null,
        [agent.city, agent.state].filter(Boolean).join(", ") || null,
        agent.phone ? `Phone: ${formatPhone(agent.phone)}` : null,
        agent.email ? `Email: ${agent.email}` : null,
        agent.websiteUrl ? `Website: ${agent.websiteUrl}` : null,
        agent.brokerageAddress ? `Address: ${agent.brokerageAddress}` : null,
        [agent.city, agent.state, agent.zipCode?.slice(0, 5)].filter(Boolean).join(", ") || null,
        agent.timezone ? `Timezone: ${formatTimezoneDisplay(agent.timezone)}` : null,
        agent.brokerageName ? `Brokerage: ${agent.brokerageName}` : null,
        [agent.licenseNumber, agent.licenseState].filter(Boolean).join(" • ") || null,
        agent.rating != null ? `Rating: ${agent.rating.toFixed(1)} (${agent.reviewCount ?? 0} reviews)` : null,
        agent.scrapedAt ? `Scraped: ${formatTimestamp(agent.scrapedAt)}` : null,
        agent.googleMapsLink ? `Google Maps: ${agent.googleMapsLink}` : null,
      ].filter(Boolean).join("\n");

      navigator.clipboard.writeText(lines).then(() => {
        toast.success("Business info copied");
      });
    },
    [agent],
  );

  if (!agent || !open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-modal-title"
        className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-lg p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1.5 rounded-md text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-8">
          <h2 id="agent-modal-title" className="text-lg font-bold text-surface-950 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-surface-500" />
            {agent.fullName}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            {agent.category && (
              <span className="inline-flex items-center gap-1 text-xs text-surface-600">
                <Tag className="h-3.5 w-3.5" />
                {agent.category}
              </span>
            )}
            {(agent.city || agent.state) && (
              <span className="inline-flex items-center gap-1 text-xs text-surface-600">
                <MapPin className="h-3.5 w-3.5" />
                {[agent.city, agent.state].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 mb-6">
          <button
            type="button"
            onClick={handleCopyAllInfo}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-none border-0 transition-all duration-150 cursor-pointer"
          >
            <Copy className="h-4 w-4" />
            <span>Copy business info</span>
          </button>
        </div>

        <div className="space-y-1">
          <SectionHeader icon={Phone} label="Direct Contact Info" />
          <AttrRow
            icon={Phone}
            label="Phone Number"
            value={formatPhone(agent.phone)}
            copyable
          />
          {agent.email && (
            <AttrRow
              icon={Mail}
              label="100% Deliverable Email"
              value={agent.email}
              copyable
              badge={
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Verified
                </span>
              }
            />
          )}
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

        <div className="mt-5 space-y-1">
          <SectionHeader icon={MapPin} label="Location & Territory" />
          <AttrRow
            icon={MapPin}
            label="Physical Address"
            value={agent.brokerageAddress ?? "--"}
            copyable={!!agent.brokerageAddress}
          />
          {(agent.city || agent.state || agent.zipCode) && (
            <AttrRow
              icon={Compass}
              label="City, State, Zip Code"
              value={[agent.city, agent.state, agent.zipCode?.slice(0, 5)].filter(Boolean).join(", ")}
            />
          )}
          <AttrRow
            icon={Clock}
            label="Timezone"
            value={formatTimezoneDisplay(agent.timezone)}
          />
        </div>

        {(agent.brokerageName || agent.licenseNumber || agent.licenseState) && (
          <div className="mt-5 space-y-1">
            <SectionHeader icon={Briefcase} label="Brokerage & Licensing" />
            {agent.brokerageName && (
              <AttrRow
                icon={Briefcase}
                label="Brokerage Name"
                value={agent.brokerageName}
              />
            )}
            {(agent.licenseNumber || agent.licenseState) && (
              <AttrRow
                icon={Award}
                label="License"
                value={[agent.licenseNumber, agent.licenseState].filter(Boolean).join(" • ")}
                copyable={!!agent.licenseNumber}
              />
            )}
          </div>
        )}

        <div className="mt-5 space-y-1">
          <SectionHeader icon={Star} label="Google Maps & Reputation" />
          {agent.rating != null && (
            <AttrRow
              icon={Star}
              label="Rating"
              value={`★ ${agent.rating.toFixed(1)} (${agent.reviewCount?.toLocaleString() ?? 0} reviews)`}
            />
          )}
          <AttrRow
            icon={Calendar}
            label="Scraped Timestamp"
            value={formatTimestamp(agent.scrapedAt)}
          />
          {agent.googleMapsLink && (
            <AttrRow
              icon={ExternalLink}
              label="Live Google Maps Link"
              value="View on Google Maps"
              href={agent.googleMapsLink}
            />
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import {
  Copy,
  Loader2,
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
  Calendar,
  Hash,
  Server,
} from "lucide-react";
import { copyText } from "@/lib/copy-text";
import { toast } from "sonner";
import type { LeadTier } from "@fine-leads/utils";
import {
  normalizeSocialProfiles,
  SOCIAL_PROFILE_FIELDS,
  isSocialProfileUrl,
} from "@/lib/lead-profiles";
import { PUBLIC_LEAD_SOURCE } from "@/lib/lead-branding";

export interface AgentData {
  leadTier?: LeadTier;
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
  const [copying, setCopying] = useState(false);
  const copyLock = useRef(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (copyLock.current) return;
      copyLock.current = true;
      setCopying(true);
      try {
        await copyText(value);
        setCopied(true);
        toast.success(label ? `${label} copied` : "Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Copy failed");
      } finally {
        copyLock.current = false;
        setCopying(false);
      }
    },
    [value, label],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={copying}
      aria-busy={copying}
      className="flex-shrink-0 p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
      title={copying ? "Copying..." : "Copy to clipboard"}
      aria-label={copying ? "Copying..." : "Copy to clipboard"}
    >
      {copying ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100">
      <Icon className="w-4 h-4 text-slate-500" />
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
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
  if (!value?.trim() || ["--", "-"].includes(value.trim())) return null;
  return (
    <div className="flex items-center justify-between py-2 group">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            {label}
          </p>
          <div className="flex items-center gap-1.5">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-800 hover:text-slate-950 hover:underline truncate"
              >
                {value}
              </a>
            ) : (
              <span className="text-sm font-medium text-slate-800 truncate">
                {value}
              </span>
            )}
            {badge}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {copyable && value !== "--" && (
          <CopyButton value={value} label={label} />
        )}
        {href && value !== "--" && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Open link"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function AgentDetailModal({
  agent,
  open,
  onClose,
}: AgentDetailModalProps) {
  // Hand-rolled modal: Escape, focus trap/return and page scroll lock.
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, open && !!agent, onClose);

  const profiles =
    agent?.leadTier === "VERIFIED_EMAIL"
      ? normalizeSocialProfiles(agent.socialProfiles, agent)
      : null;
  const website =
    agent?.leadTier === "PHONE_ONLY" && isSocialProfileUrl(agent.websiteUrl)
      ? null
      : agent?.websiteUrl;

  const copyAllLock = useRef(false);
  const [copyingAll, setCopyingAll] = useState(false);
  const handleCopyAllInfo = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!agent) return;
      const lines = [
        agent.fullName,
        agent.category ? `Category: ${agent.category}` : null,
        [agent.city, agent.state].filter(Boolean).join(", ") || null,
        agent.phone ? `Phone: ${formatPhone(agent.phone)}` : null,
        agent.leadTier !== "PHONE_ONLY" && agent.email
          ? `Email: ${agent.email}`
          : null,
        website ? `Website: ${website}` : null,
        agent.brokerageAddress ? `Address: ${agent.brokerageAddress}` : null,
        [agent.city, agent.state, agent.zipCode?.slice(0, 5)]
          .filter(Boolean)
          .join(", ") || null,
        agent.timezone
          ? `Timezone: ${formatTimezoneDisplay(agent.timezone)}`
          : null,
        agent.brokerageName ? `Brokerage: ${agent.brokerageName}` : null,
        agent.googlePlaceId ? `Google Place ID: ${agent.googlePlaceId}` : null,
        `Data Source: ${PUBLIC_LEAD_SOURCE}`,
        agent.rating != null
          ? `Rating: ${agent.rating.toFixed(1)} (${agent.reviewCount ?? 0} reviews)`
          : null,
        agent.scrapedAt ? `Scraped: ${formatTimestamp(agent.scrapedAt)}` : null,
        agent.googleMapsLink ? `Google Maps: ${agent.googleMapsLink}` : null,
        ...SOCIAL_PROFILE_FIELDS.flatMap((field) =>
          profiles?.[field.key]
            ? [`${field.label}: ${profiles[field.key]}`]
            : [],
        ),
      ]
        .filter(Boolean)
        .join("\n");

      if (copyAllLock.current) return;
      copyAllLock.current = true;
      setCopyingAll(true);
      void copyText(lines)
        .then(() => toast.success("Business info copied"))
        .catch((error) =>
          toast.error(error instanceof Error ? error.message : "Copy failed"),
        )
        .finally(() => {
          copyAllLock.current = false;
          setCopyingAll(false);
        });
    },
    [agent, profiles, website],
  );

  if (!agent || !open || typeof document === "undefined") return null;

  // Portalled to <body> at z-[100]: rendered inside the dashboard tree it shared a z-50 stacking
  // context, so the fixed mobile header (z-[80]) covered the title/category/location on phones.
  return createPortal(
    <div
      className="fixed inset-0 bg-white md:bg-slate-900/20 flex items-center justify-center p-4 z-[100]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-modal-title"
        ref={dialogRef}
        tabIndex={-1}
        className="fixed inset-0 w-full h-full max-w-none rounded-none border-0 bg-white overflow-y-auto overscroll-contain outline-none p-4 md:relative md:max-w-2xl md:h-auto md:max-h-[calc(100dvh-2rem)] md:rounded-2xl md:p-6 md:border md:border-slate-200 md:text-slate-900 md:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-10">
          <h2
            id="agent-modal-title"
            className="text-lg font-bold text-slate-900 flex items-start gap-2 min-w-0"
          >
            <Building2 className="h-5 w-5 mt-0.5 shrink-0 text-slate-500" />
            <span className="min-w-0 break-words">{agent.fullName}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {agent.category && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                <Tag className="h-3.5 w-3.5" />
                {agent.category}
              </span>
            )}
            {(agent.city || agent.state) && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
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
            disabled={copyingAll}
            aria-busy={copyingAll}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-none border-0 transition-colors cursor-pointer"
          >
            <Copy className="h-4 w-4" />
            {copyingAll && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {copyingAll ? "Copying business info..." : "Copy business info"}
            </span>
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
          {agent.leadTier !== "PHONE_ONLY" && agent.email && (
            <AttrRow
              icon={Mail}
              label={
                ["syntax_valid", "mx_valid"].includes(agent.emailStatus ?? "")
                  ? "Email"
                  : "100% Deliverable Email"
              }
              value={agent.email}
              copyable
              badge={
                <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  {agent.emailStatus === "syntax_valid"
                    ? "Syntax checked"
                    : agent.emailStatus === "mx_valid"
                      ? "MX checked"
                      : "Verified"}
                </span>
              }
            />
          )}
          {website && (
            <AttrRow
              icon={Globe}
              label="Website"
              value={website}
              copyable
              href={website}
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
              value={[agent.city, agent.state, agent.zipCode?.slice(0, 5)]
                .filter(Boolean)
                .join(", ")}
            />
          )}
          <AttrRow
            icon={Clock}
            label="Timezone"
            value={formatTimezoneDisplay(agent.timezone)}
          />
        </div>

        {
          <div className="mt-5 space-y-1">
            <SectionHeader icon={Briefcase} label="Brokerage & Source" />
            {agent.brokerageName && (
              <AttrRow
                icon={Briefcase}
                label="Brokerage Name"
                value={agent.brokerageName}
              />
            )}
            {agent.googlePlaceId && (
              <AttrRow
                icon={Hash}
                label="Google Place ID"
                value={agent.googlePlaceId}
                copyable
              />
            )}
            {
              <AttrRow
                icon={Server}
                label="Data Source"
                value={PUBLIC_LEAD_SOURCE}
              />
            }
          </div>
        }

        <div className="mt-5 space-y-1">
          <SectionHeader icon={Star} label="Google Maps & Reputation" />
          {agent.rating != null && (
            <AttrRow
              icon={Star}
              label="Rating"
              value={`${agent.rating.toFixed(1)} (${agent.reviewCount?.toLocaleString() ?? 0} reviews)`}
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
        {agent.leadTier === "VERIFIED_EMAIL" && profiles && (
          <section
            className="mt-5 space-y-1"
            aria-label="Bonus enriched profiles"
          >
            <SectionHeader
              icon={ExternalLink}
              label="Bonus Enriched Profiles (if available)"
            />
            {SOCIAL_PROFILE_FIELDS.map((field) =>
              profiles[field.key] ? (
                <AttrRow
                  key={field.key}
                  icon={ExternalLink}
                  label={field.label}
                  value={profiles[field.key]!}
                  href={profiles[field.key]!}
                  copyable
                />
              ) : null,
            )}
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@fine-leads/ui";
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
  ShieldCheck,
  Database,
  Building2,
} from "lucide-react";

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

interface LeadDetailModalProps {
  agent: AgentData | null;
  open: boolean;
  onClose: () => void;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimezone(tz: string | null): string {
  if (!tz) return "--";
  const t = tz.toLowerCase();
  if (t.includes("eastern")) return "Eastern (EST)";
  if (t.includes("central")) return "Central (CST)";
  if (t.includes("mountain")) return "Mountain (MST)";
  if (t.includes("pacific")) return "Pacific (PST)";
  if (t.includes("alaska")) return "Alaska (AKST)";
  if (t.includes("hawaii")) return "Hawaii (HST)";
  return tz;
}

function buildFullAddress(agent: AgentData): string {
  const parts = [
    agent.brokerageAddress,
    agent.city,
    agent.state,
    (agent.zipCode || "").slice(0, 5) || null,
  ].filter(Boolean);
  return parts.join(", ") || "--";
}

function buildClipboardText(agent: AgentData): string {
  const lines = [
    agent.fullName + (agent.brokerageName ? ` | ${agent.brokerageName}` : ""),
    `${agent.category || "Real Estate Agent"}` +
      (agent.city && agent.state ? ` - ${agent.city}, ${agent.state}` : ""),
    "",
    "Entity & Geography:",
    `Company Name: ${agent.brokerageName || "N/A"}`,
    `Physical Address: ${agent.brokerageAddress || "N/A"}`,
    `City: ${agent.city || "N/A"}`,
    `State: ${agent.state || "N/A"}`,
    `Zip Code: ${(agent.zipCode || "").slice(0, 5) || "N/A"}`,
    `Timezone: ${formatTimezone(agent.timezone)}`,
    "",
    "Contact Channels:",
    `Email: ${agent.email || "N/A"}${agent.emailStatus ? ` (${agent.emailStatus})` : ""}`,
    `Phone: ${agent.phone || "N/A"}`,
    `Website: ${agent.websiteUrl || "N/A"}`,
    "",
    "Reputation & System Metadata:",
    `Rating: ${agent.rating != null ? agent.rating.toFixed(1) : "N/A"}`,
    `Review Count: ${agent.reviewCount ?? "N/A"}`,
    `Category: ${agent.category || "N/A"}`,
    `Google Place ID: ${agent.googlePlaceId || "N/A"}`,
    `Google Maps: ${agent.googleMapsLink || "N/A"}`,
    `Last Scraped: ${formatTimestamp(agent.scrapedAt)}`,
    `Verification Score: ${agent.verificationScore != null ? agent.verificationScore : "N/A"}`,
    `Data Source: ${agent.dataSource || "N/A"}`,
  ];
  return lines.join("\n");
}

function FieldRow({
  icon: Icon,
  label,
  value,
  copyValue,
  href,
  badge,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  copyValue?: string;
  href?: string;
  badge?: React.ReactNode;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const text = copyValue ?? value;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    },
    [copyValue, value],
  );

  return (
    <div className="flex items-center gap-3 py-2 group">
      <div className="flex-shrink-0 w-8 flex justify-center">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400 min-w-[80px]">
            {label}
          </span>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm text-[#14A800] hover:text-[#108A00] underline truncate max-w-[240px] ${mono ? "tabular-nums text-xs" : ""}`}
            >
              {value}
            </a>
          ) : (
            <span
              className={`text-sm text-slate-700 dark:text-slate-300 truncate max-w-[240px] ${mono ? "tabular-nums text-xs" : ""}`}
            >
              {value}
            </span>
          )}
          {badge}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-[#14A800]" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-1 first:mt-0 pb-1.5 border-b border-slate-100 dark:border-slate-800">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {title}
      </h3>
    </div>
  );
}

export function LeadDetailModal({ agent, open, onClose }: LeadDetailModalProps) {
  const [masterCopied, setMasterCopied] = useState(false);

  const handleMasterCopy = useCallback(() => {
    if (!agent) return;
    const text = buildClipboardText(agent);
    navigator.clipboard.writeText(text).then(() => {
      setMasterCopied(true);
      setTimeout(() => setMasterCopied(false), 2500);
    });
  }, [agent]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {!agent ? (
          <>
            <DialogHeader>
              <div className="pr-8">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-36 mt-2" />
              </div>
            </DialogHeader>
            <Skeleton className="h-11 w-full rounded-xl my-4" />
            <div className="pt-4 space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-5 w-44" />
              <div className="pt-4">
                <Skeleton className="h-5 w-56" />
              </div>
              <Skeleton className="h-5 w-32" />
              <div className="pt-4">
                <Skeleton className="h-5 w-44" />
              </div>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-56" />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug pr-8">
                {agent.fullName}
                {agent.brokerageName ? ` | ${agent.brokerageName}` : ""}
              </DialogTitle>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {[agent.category || "Real Estate Agent", agent.city && agent.state ? `${agent.city}, ${agent.state}` : null]
                  .filter(Boolean)
                  .join(" \u00b7 ")}
              </p>
            </DialogHeader>

            <button
              type="button"
              onClick={handleMasterCopy}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border-0 shadow-none my-4"
            >
              {masterCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  Business info copied to clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy business info
                </>
              )}
            </button>

            <div className="pt-1">
              <SectionHeader icon={Building2} title="Entity & Geography" />
              <FieldRow
                icon={Building2}
                label="Company"
                value={agent.brokerageName || "--"}
              />
              <FieldRow
                icon={MapPin}
                label="Address"
                value={agent.brokerageAddress || "--"}
              />
              <FieldRow
                icon={MapPin}
                label="City"
                value={agent.city || "--"}
              />
              <FieldRow
                icon={MapPin}
                label="State"
                value={agent.state || "--"}
              />
              <FieldRow
                icon={MapPin}
                label="Zip Code"
                value={(agent.zipCode || "").slice(0, 5) || "--"}
              />
              <FieldRow
                icon={Clock}
                label="Timezone"
                value={formatTimezone(agent.timezone)}
              />

              <SectionHeader icon={Mail} title="Contact Channels" />
              <FieldRow
                icon={Mail}
                label="Email"
                value={agent.email || "--"}
                badge={
                  agent.emailStatus ? (
                    <span className="text-[11px] font-semibold text-[#14A800] bg-[#14A800]/10 px-2 py-0.5 rounded whitespace-nowrap">
                      {agent.emailStatus}
                    </span>
                  ) : null
                }
              />
              <FieldRow
                icon={Phone}
                label="Phone"
                value={agent.phone || "--"}
              />
              <FieldRow
                icon={Globe}
                label="Website"
                value={agent.websiteUrl || "--"}
                href={agent.websiteUrl || undefined}
              />

              <SectionHeader icon={Star} title="Reputation & System Metadata" />
              <FieldRow
                icon={Star}
                label="Rating"
                value={
                  agent.rating != null
                    ? `${agent.rating.toFixed(1)} \u00b7 ${agent.reviewCount ?? 0} reviews`
                    : "--"
                }
              />
              <FieldRow
                icon={MapPin}
                label="Category"
                value={agent.category || "--"}
              />
              <FieldRow
                icon={MapPin}
                label="Place ID"
                value={agent.googlePlaceId || "--"}
                mono
              />
              <FieldRow
                icon={ExternalLink}
                label="Google Maps"
                value={agent.googleMapsLink || "--"}
                href={agent.googleMapsLink || undefined}
              />
              <FieldRow
                icon={Clock}
                label="Scraped At"
                value={formatTimestamp(agent.scrapedAt)}
              />
              <FieldRow
                icon={ShieldCheck}
                label="Verification"
                value={
                  agent.verificationScore != null
                    ? `${agent.verificationScore}/100`
                    : "--"
                }
                badge={
                  agent.verificationScore != null && agent.verificationScore >= 90 ? (
                    <span className="text-[11px] font-semibold text-[#14A800] bg-[#14A800]/10 px-2 py-0.5 rounded whitespace-nowrap">
                      High
                    </span>
                  ) : null
                }
              />
              <FieldRow
                icon={Database}
                label="Data Source"
                value={agent.dataSource || "--"}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
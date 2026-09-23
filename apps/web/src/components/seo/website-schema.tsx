"use client";

import { JsonLd } from "./json-ld";

const website = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LeadsDom",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Verified US real estate agent data intelligence platform for B2B lead generation, search, filtering, and CSV export.",
  url: "https://getleadsdom.com",
  offers: {
    "@type": "Offer",
    price: "0.019",
    priceCurrency: "USD",
    description: "Per verified lead pricing",
  },
};

const webSite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "LeadsDom",
  url: "https://getleadsdom.com",
  description:
    "Access verified data on 2M+ US real estate agents. Search, filter, and export leads by state, brokerage, transaction volume, and more.",
};

export function SoftwareApplicationSchema() {
  return <JsonLd data={website} />;
}

export function WebSiteSchema() {
  return <JsonLd data={webSite} />;
}

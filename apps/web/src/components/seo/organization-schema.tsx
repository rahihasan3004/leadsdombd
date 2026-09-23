"use client";

import { JsonLd } from "./json-ld";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "LeadsDom",
  url: "https://getleadsdom.com",
  logo: "https://getleadsdom.com/logo.png",
  description:
    "LeadsDom provides verified US real estate agent data intelligence for B2B lead generation and prospecting.",
  sameAs: [
    "https://twitter.com",
    "https://linkedin.com",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: "sales@leadsdom.com",
  },
};

export function OrganizationSchema() {
  return <JsonLd data={organization} />;
}

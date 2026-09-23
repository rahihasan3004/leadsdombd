import { Metadata } from "next";
import { LeadOrderEngine } from "@/components/dashboard/search/lead-order-engine";

export const metadata: Metadata = {
  title: "Order Real Estate Leads | LeadsDom",
};

export default function SearchPage() {
  return <LeadOrderEngine />;
}

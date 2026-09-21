import { Metadata } from "next";
import { LeadOrderEngine } from "@/components/dashboard/search/lead-order-engine";

export const metadata: Metadata = {
  title: "Order Real Estate Leads | LeadsDom",
};

export default function SearchPage() {
  return (
    <div className="max-w-[1440px] w-full mx-auto p-6 md:p-8 space-y-6">
      <LeadOrderEngine />
    </div>
  );
}

import { Gift } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ReferralPage() {
  return (
    <ComingSoon
      title="Referral Program"
      description="Invite colleagues to LeadsDom and get rewarded."
      icon={Gift}
      highlights={[
        "A personal referral link to share with your network",
        "Commission on purchases made by customers you refer",
        "A dashboard to track sign-ups and earnings",
      ]}
      note="Interested in early access? Let our team know."
      cta={{ href: "/dashboard/support", label: "Contact support" }}
    />
  );
}

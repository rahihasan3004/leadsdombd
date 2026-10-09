import { ShieldCheck } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ValidationsPage() {
  return (
    <ComingSoon
      title="Validations"
      description="Email and phone verification results for your leads."
      icon={ShieldCheck}
      highlights={[
        "Per-lead verification details for email and phone",
        "On-demand re-validation of previously unlocked lists",
        "Deliverability trends across your territories",
      ]}
      note="Every lead you unlock is already email-verified before delivery."
      cta={{ href: "/dashboard/lists", label: "View my verified leads" }}
    />
  );
}

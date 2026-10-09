import { Bell } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function NotificationsPage() {
  return (
    <ComingSoon
      title="Notifications"
      description="Your account notifications and alerts."
      icon={Bell}
      highlights={[
        "Alerts when your orders are fulfilled and exports are ready",
        "Low credit balance reminders",
        "Security notices for sign-ins, password and email changes",
      ]}
      note="Until then, important account updates are sent to your email."
      cta={{ href: "/dashboard/settings", label: "Account settings" }}
    />
  );
}

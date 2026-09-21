import { auth } from "@fine-leads/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    walletBalance: (session.user as { walletBalance?: number }).walletBalance ?? 25.0,
  };

  return (
    <div className="h-screen max-h-screen w-full flex overflow-hidden bg-surface-50 dark:bg-surface-950">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden w-full">{children}</main>
      </div>
    </div>
  );
}
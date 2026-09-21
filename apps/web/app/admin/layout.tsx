import { requireAdmin } from "@/lib/admin-guard";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();

  return (
    <div className="h-screen max-h-screen w-full flex overflow-hidden bg-surface-50 dark:bg-surface-950">
      <AdminSidebar user={user} />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <AdminHeader />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
import { auth } from "@fine-leads/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user) {
    const userRole = (session.user as { role?: string }).role;
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen w-full bg-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[400px]">
        {children}
      </div>
    </main>
  );
}

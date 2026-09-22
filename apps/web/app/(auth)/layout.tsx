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

  return <>{children}</>;
}
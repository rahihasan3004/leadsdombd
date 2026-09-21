import { auth } from "@fine-leads/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    const role = session.user.role;
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[100dvh] w-full bg-white text-surface-950 flex flex-col items-center justify-center p-4 sm:p-6">
      {children}
    </div>
  );
}
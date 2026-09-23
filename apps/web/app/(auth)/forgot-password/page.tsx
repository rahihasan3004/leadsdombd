import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Forgot Password | LeadsDom",
  description:
    "Reset your LeadsDom account password. Enter your email to receive a 6-digit verification code.",
};

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex flex-col items-center text-center mb-6">
        <div className="mb-4">
          <Logo showText={false} size={56} className="w-14 h-14 object-contain transition-transform hover:scale-105" />
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 py-12 sm:py-16">
          <div className="w-full max-w-[400px] sm:max-w-[420px] flex flex-col items-center">
            <ForgotPasswordForm />
          </div>
        </main>
    </>
  );
}

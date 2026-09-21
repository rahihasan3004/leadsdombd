import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password | LeadsDom",
  description:
    "Reset your LeadsDom account password. Enter your email to receive a 6-digit verification code.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
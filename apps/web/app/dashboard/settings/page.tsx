"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Mail, Key, Trash2, Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button, Input } from "@fine-leads/ui";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fine-leads/ui";

interface SecurityInfo {
  hasPassword: boolean;
  provider: string;
  isGoogleUser: boolean;
}

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [securityInfo, setSecurityInfo] = useState<SecurityInfo | null>(null);
  const [securityLoading, setSecurityLoading] = useState(true);

  const [name, setName] = useState(user?.name ?? "");
  const [nameLoading, setNameLoading] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false);
  const [currentEmailCode, setCurrentEmailCode] = useState("");
  const [newEmailCode, setNewEmailCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dangerConfirm, setDangerConfirm] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteOtpLoading, setDeleteOtpLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function fetchSecurityInfo() {
      try {
        const res = await fetch("/api/user/security");
        if (res.ok) {
          const data = await res.json();
          setSecurityInfo(data);
        }
      } catch {
        // silently fail
      } finally {
        setSecurityLoading(false);
      }
    }
    fetchSecurityInfo();
  }, []);

  const isOAuthUser = securityInfo && !securityInfo.hasPassword;
  const provider = securityInfo?.provider ?? "credentials";
  const isGoogleUser = securityInfo?.isGoogleUser ?? false;

  async function handleSaveName() {
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setNameLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      await update({ name: name.trim() });
      toast.success("Name updated successfully");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setNameLoading(false);
    }
  }

  async function handleRequestEmailChange() {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setEmailLoading(true);
    try {
      const res = await fetch("/api/user/email/request-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      setCurrentEmailCode("");
      setNewEmailCode("");
      setOtpError(null);
      setShowEmailOTPModal(true);
    } catch {
      toast.error("Network error");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleVerifyEmailChange() {
    setOtpError(null);
    if (!currentEmailCode || currentEmailCode.length !== 6) {
      setOtpError("Enter the 6-digit code sent to your current email");
      return;
    }
    if (!newEmailCode || newEmailCode.length !== 6) {
      setOtpError("Enter the 6-digit code sent to your new email");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch("/api/user/email/verify-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: newEmail.trim(),
          currentEmailCode,
          newEmailCode,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      if (!res.ok) {
        setOtpError(data.error ?? "Verification failed");
        return;
      }
      setShowEmailOTPModal(false);
      setNewEmail("");
      toast.success("Email updated successfully");
      await update({ email: newEmail.trim() });
      router.refresh();
    } catch {
      setOtpError("Network error");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleUpdatePassword() {
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Network error");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleSendDeleteOtp() {
    setDeleteError(null);
    setDeleteOtpLoading(true);
    try {
      const res = await fetch("/api/user/delete-account/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: dangerConfirm }),
      });
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      if (!res.ok) {
        setDeleteError(data.error ?? "Something went wrong");
        return;
      }
      setDeleteOtpSent(true);
      toast.success("Deletion code sent to your email");
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteOtpLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    if (dangerConfirm !== "DELETE" || deleteOtp.length !== 6) {
      setDeleteError("You must type DELETE and enter a valid 6-digit OTP");
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/user/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: deleteOtp }),
      });
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      if (!res.ok) {
        setDeleteError(data.error ?? "Deletion failed");
        return;
      }
      signOut({ callbackUrl: "/login" });
    } catch {
      setDeleteError("Network error");
      setDeleteLoading(false);
    }
  }

  function closeDeleteModal() {
    setShowDeleteModal(false);
    setDangerConfirm("");
    setDeleteOtp("");
    setDeleteOtpSent(false);
    setDeleteError(null);
  }

  const canDelete = dangerConfirm === "DELETE" && deleteOtp.length === 6;

  return (
    <div className="w-full min-h-screen bg-slate-50 p-3.5 sm:p-6 lg:p-8 pb-3.5 sm:pb-6 lg:pb-8 space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Manage your account and security settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Profile Information */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 tracking-tight mb-1">
              Profile Information
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Update your personal details and email address.
            </p>

            <div className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Full Name
                </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-2.5 rounded-xl outline-none focus:border-blue-500"
                />
                <Button
                  onClick={handleSaveName}
                  disabled={nameLoading}
                  className="shrink-0 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-slate-200/80 shadow-sm"
                >
                  {nameLoading ? "Saving..." : "Save Name"}
                </Button>
              </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-slate-700">{user?.email}</span>
                  <CheckCircle2
                    className="h-4.5 w-4.5 text-[#465FFF]"
                  />
                </div>
                {!securityLoading && securityInfo?.isGoogleUser && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    Email is managed securely by your Google Account.
                  </div>
                )}
                {!securityLoading && securityInfo && !securityInfo.isGoogleUser && (
                  <div className="flex gap-3 mt-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter new email address"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleRequestEmailChange}
                      disabled={emailLoading}
                      variant="outline"
                      className="shrink-0"
                    >
                      {emailLoading ? "Sending..." : "Request Email Change"}
                    </Button>
                  </div>
                )}
                {!securityLoading && securityInfo && !securityInfo.isGoogleUser && (
                  <p className="text-[11px] text-slate-400 mt-2 font-normal">
                    You will receive a 6-digit verification code at both your current and new email addresses.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Security & Password */}
          {(securityLoading || !securityInfo) ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <div className="h-7 w-32 bg-slate-200 rounded-md animate-pulse mb-2" />
              <div className="h-4 w-48 bg-slate-200 rounded-md animate-pulse mb-6" />
              <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : securityInfo.isGoogleUser ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 tracking-tight mb-1">
                Security
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Password and authentication settings.
              </p>

              <div className="mt-4 flex items-start gap-3.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Authenticated via Google</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Your account is secured with Google OAuth. Passwords, two-factor authentication, and security settings are managed directly in your Google Security Center.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 tracking-tight mb-1">
                Security & Password
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Update your password to keep your account secure.
              </p>

              <div className="space-y-4 max-w-md">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Current Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleUpdatePassword}
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-slate-200/80 shadow-sm"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Danger Zone */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 border border-red-200">
            <h2 className="text-base font-bold text-red-600 tracking-tight mb-1 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Permanently delete your account, wallet balance, and unlocked lead data. Requires typing DELETE and verifying an email OTP to proceed. This action is irreversible.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteModal(true)}
              className="h-11 px-5 text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      {/* Email OTP Verification Modal */}
      <Dialog open={showEmailOTPModal} onOpenChange={setShowEmailOTPModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Email Change</DialogTitle>
            <DialogDescription>
              Enter the 6-digit codes sent to both your current and new email addresses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Current Email Code
              </label>
              <Input
                type="text"
                maxLength={6}
                value={currentEmailCode}
                onChange={(e) => setCurrentEmailCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                New Email Code
              </label>
              <Input
                type="text"
                maxLength={6}
                value={newEmailCode}
                onChange={(e) => setNewEmailCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
              />
            </div>
            {otpError && (
              <p className="text-xs font-medium text-red-600">{otpError}</p>
            )}
            <Button
              onClick={handleVerifyEmailChange}
              disabled={otpLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-slate-200/80 shadow-sm"
            >
              {otpLoading ? "Verifying..." : "Verify & Update Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Modal */}
      <Dialog open={showDeleteModal} onOpenChange={(open) => { if (!open) closeDeleteModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-left mt-3">
              <span className="block mb-1 font-semibold text-red-600">
                To confirm deletion, please complete the two verification steps below:
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Step 1: Type confirmation text
              </p>
              <Input
                type="text"
                value={dangerConfirm}
                onChange={(e) => setDangerConfirm(e.target.value)}
                placeholder="Type DELETE to proceed"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Step 2: Email OTP Verification
              </p>
              <Button
                type="button"
                onClick={handleSendDeleteOtp}
                disabled={dangerConfirm !== "DELETE" || deleteOtpLoading || deleteOtpSent}
                className="mb-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-slate-200/80 shadow-sm"
              >
                {deleteOtpSent ? "Code Sent" : deleteOtpLoading ? "Sending..." : "Send Deletion Code"}
              </Button>
              <Input
                type="text"
                maxLength={6}
                value={deleteOtp}
                onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit OTP code"
              />
            </div>

            {deleteError && (
              <p className="text-xs font-medium text-red-600">{deleteError}</p>
            )}

            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={!canDelete || deleteLoading}
              className="w-full"
            >
              {deleteLoading ? "Deleting..." : "Permanently Delete Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Mail, Key, Trash2, AlertTriangle, ShieldAlert, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fine-leads/ui";

function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      {message}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      {message}
    </div>
  );
}

const inputClass =
  "h-10 w-full px-3 bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-md text-sm focus:ring-1 focus:ring-surface-950 focus:outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [name, setName] = useState(user?.name ?? "");
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameLoading, setNameLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false);
  const [currentEmailCode, setCurrentEmailCode] = useState("");
  const [newEmailCode, setNewEmailCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dangerConfirm, setDangerConfirm] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteOtpLoading, setDeleteOtpLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleSaveName() {
    setNameError(null);
    setNameSuccess(null);
    if (!name.trim()) {
      setNameError("Name cannot be empty");
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
        setNameError(data.error ?? "Something went wrong");
        return;
      }
      await update({ name: name.trim() });
      setNameSuccess(data.message ?? "Name updated");
      router.refresh();
    } catch {
      setNameError("Network error");
    } finally {
      setNameLoading(false);
    }
  }

  async function handleRequestEmailChange() {
    setEmailError(null);
    setEmailSuccess(null);
    if (!newEmail || !newEmail.includes("@")) {
      setEmailError("Enter a valid email address");
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
        setEmailError(data.error ?? "Something went wrong");
        return;
      }
      setCurrentEmailCode("");
      setNewEmailCode("");
      setOtpError(null);
      setShowEmailOTPModal(true);
    } catch {
      setEmailError("Network error");
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
      setEmailSuccess("Email updated successfully");
      await update({ email: newEmail.trim() });
      router.refresh();
    } catch {
      setOtpError("Network error");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleUpdatePassword() {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!currentPassword) {
      setPasswordError("Current password is required");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      if (!res.ok) {
        setPasswordError(data.error ?? "Something went wrong");
        return;
      }
      setPasswordSuccess(data.message ?? "Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setPasswordError("Network error");
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
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteOtpLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    if (dangerConfirm !== "DANGER" || deleteOtp.length !== 6) {
      setDeleteError("You must type DANGER and enter a valid 6-digit OTP");
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

  const canDelete = dangerConfirm === "DANGER" && deleteOtp.length === 6;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your account and security settings.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Profile & Security */}
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-md p-6 sm:p-7 shadow-2xs mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Profile &amp; Security</h2>

          <div className="space-y-8">
            {/* Name Update */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <User className="h-4 w-4 text-slate-400" />
                Full Name
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Your full name"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={nameLoading}
                  className="h-10 px-4 bg-surface-950 hover:bg-surface-800 text-white dark:bg-white dark:text-surface-950 rounded-md text-xs font-semibold transition-colors shrink-0 disabled:opacity-60"
                >
                  {nameLoading ? "Saving..." : "Save Name"}
                </button>
              </div>
              {nameSuccess && <div className="mt-3"><SuccessMessage message={nameSuccess} /></div>}
              {nameError && <div className="mt-3"><ErrorMessage message={nameError} /></div>}
            </div>

            {/* Email Change */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <Mail className="h-4 w-4 text-slate-400" />
                Email Address
              </label>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Current: {user?.email}
              </p>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={inputClass}
                  placeholder="New email address"
                />
                <button
                  type="button"
                  onClick={handleRequestEmailChange}
                  disabled={emailLoading}
                  className="h-10 px-4 bg-surface-950 hover:bg-surface-800 text-white dark:bg-white dark:text-surface-950 rounded-md text-xs font-semibold transition-colors shrink-0 disabled:opacity-60"
                >
                  {emailLoading ? "Sending..." : "Request Email Change"}
                </button>
              </div>
              {emailSuccess && <div className="mt-3"><SuccessMessage message={emailSuccess} /></div>}
              {emailError && <div className="mt-3"><ErrorMessage message={emailError} /></div>}
            </div>

            {/* Password Change */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <Key className="h-4 w-4 text-slate-400" />
                Password
              </label>
              <div className="space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Current password"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder="New password (min 8 characters)"
                />
                <button
                  type="button"
                  onClick={handleUpdatePassword}
                  disabled={passwordLoading}
                  className="h-10 px-4 bg-surface-950 hover:bg-surface-800 text-white dark:bg-white dark:text-surface-950 rounded-md text-xs font-semibold transition-colors mt-2 disabled:opacity-60"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
              {passwordSuccess && <div className="mt-3"><SuccessMessage message={passwordSuccess} /></div>}
              {passwordError && <div className="mt-3"><ErrorMessage message={passwordError} /></div>}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50/40 dark:bg-red-950/20 border border-red-200/70 dark:border-red-900/50 rounded-md p-6 sm:p-7 mb-8">
          <h2 className="text-base font-bold text-red-600 mb-1">
            <ShieldAlert className="inline h-5 w-5 mr-1.5 -mt-0.5" />
            Danger Zone
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Permanently delete your account, wallet balance, and unlocked lead data. Requires typing DANGER and verifying an email OTP to proceed. This action is irreversible.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Account
          </button>
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
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Current Email Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={currentEmailCode}
                  onChange={(e) => setCurrentEmailCode(e.target.value.replace(/\D/g, ""))}
                  className={inputClass}
                  placeholder="6-digit code"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  New Email Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={newEmailCode}
                  onChange={(e) => setNewEmailCode(e.target.value.replace(/\D/g, ""))}
                  className={inputClass}
                  placeholder="6-digit code"
                />
              </div>
              {otpError && <ErrorMessage message={otpError} />}
              <button
                type="button"
                onClick={handleVerifyEmailChange}
                disabled={otpLoading}
                className="w-full h-11 cursor-pointer rounded-xl bg-[#14A800] text-sm font-semibold text-white hover:bg-[#108A00] transition-colors border-0 shadow-none disabled:opacity-60"
              >
                {otpLoading ? "Verifying..." : "Verify & Update Email"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Account Modal */}
        <Dialog open={showDeleteModal} onOpenChange={(open) => { if (!open) closeDeleteModal(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
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
                <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Step 1: Type confirmation text
                </p>
                <input
                  type="text"
                  value={dangerConfirm}
                  onChange={(e) => setDangerConfirm(e.target.value)}
                  placeholder="Type DANGER to proceed"
                  className="w-full h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold border-0"
                />
              </div>

              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Step 2: Email OTP Verification
                </p>
                <button
                  type="button"
                  onClick={handleSendDeleteOtp}
                  disabled={dangerConfirm !== "DANGER" || deleteOtpLoading || deleteOtpSent}
                  className="mb-3 h-10 cursor-pointer rounded-xl bg-[#14A800] px-4 text-sm font-semibold text-white hover:bg-[#108A00] transition-colors border-0 shadow-none disabled:opacity-60"
                >
                  {deleteOtpSent ? "Code Sent" : deleteOtpLoading ? "Sending..." : "Send Deletion Code"}
                </button>
                <input
                  type="text"
                  maxLength={6}
                  value={deleteOtp}
                  onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, ""))}
                  className={inputClass}
                  placeholder="6-digit OTP code"
                />
              </div>

              {deleteError && <ErrorMessage message={deleteError} />}

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!canDelete || deleteLoading}
                className="w-full h-11 cursor-pointer rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 transition-colors border-0 shadow-none disabled:opacity-60"
              >
                {deleteLoading ? "Deleting..." : "Permanently Delete Account"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
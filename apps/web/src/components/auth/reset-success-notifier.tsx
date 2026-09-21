"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function ResetSuccessNotifier() {
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (searchParams.get("reset") === "success") {
      fired.current = true;
      toast.success("Password updated successfully. You can now log in.");
    }
  }, [searchParams]);

  return null;
}
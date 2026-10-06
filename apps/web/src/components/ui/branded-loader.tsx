"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

export function BrandedLoader() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 550;

    function tick(now: number) {
      const elapsed = now - start;
      const raw = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      setProgress(eased * 100);
      if (raw < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => setVisible(false), 300);
      }
    }

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 opacity-100"
      style={progress >= 100 ? { opacity: 0 } : undefined}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full bg-blue-500/30 blur-2xl"
            style={{ width: 80, height: 80 }}
          />
          <Logo size={56} showText={false} />
        </div>

        <div className="w-40 h-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-sm font-medium text-slate-500 tracking-wide">
          Preparing your workspace...
        </p>
      </div>
    </div>
  );
}

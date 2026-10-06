"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

const shimmerKeyframes = `
@keyframes shimmer-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
@keyframes logo-glow {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.08); opacity: 1; }
}
`;

export function BrandedLoader() {
  const [visible, setVisible] = useState(true);
  const [readyToHide, setReadyToHide] = useState(false);

  useEffect(() => {
    const minTimer = setTimeout(() => setReadyToHide(true), 550);
    return () => clearTimeout(minTimer);
  }, []);

  const handleHidden = () => setVisible(false);

  if (!visible) return null;

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 ${
          readyToHide ? "opacity-0" : "opacity-100"
        }`}
        onTransitionEnd={handleHidden}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div
              className="absolute rounded-full bg-blue-500/30 blur-2xl"
              style={{
                width: 80,
                height: 80,
                animation: "logo-glow 2s ease-in-out infinite",
              }}
            />
            <div style={{ animation: "logo-glow 2s ease-in-out infinite" }}>
              <Logo size={56} showText={false} />
            </div>
          </div>

          <div className="w-40 h-1 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500"
              style={{
                width: "40%",
                animation: "shimmer-slide 1.5s ease-in-out infinite",
              }}
            />
          </div>

          <p className="text-sm font-medium text-slate-500 tracking-wide animate-pulse">
            Preparing your workspace...
          </p>
        </div>
      </div>
    </>
  );
}

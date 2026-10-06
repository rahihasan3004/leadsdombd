"use client";

import Image from "next/image";

export function BrandedLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center animate-pulse">
          <Image
            src="/favicon.svg"
            alt="LeadsDom Logo"
            width={48}
            height={48}
            className="object-contain"
            priority
          />
        </div>

        <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden relative">
          <div className="h-full bg-blue-600 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
        </div>

        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Preparing your workspace...
        </p>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 70%; transform: translateX(20%); }
          100% { width: 100%; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

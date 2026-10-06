"use client";

import { useEffect, useState, useRef } from "react";
import { Logo } from "@/components/logo";

export function BrandedLoader() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tickleDuration = 400;
    const waitDuration = 2000;
    const totalProgressDuration = tickleDuration + waitDuration;
    const tickleTarget = 70;
    const waitTarget = 90;

    function tick(now: number) {
      const elapsed = now - start;

      if (elapsed < totalProgressDuration) {
        if (elapsed < tickleDuration) {
          const t = elapsed / tickleDuration;
          const eased = 1 - Math.pow(1 - t, 3);
          setProgress(eased * tickleTarget);
        } else {
          const t = (elapsed - tickleDuration) / waitDuration;
          const eased = 1 - Math.pow(1 - t, 3);
          setProgress(tickleTarget + eased * (waitTarget - tickleTarget));
        }
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setProgress(waitTarget);
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (progress >= 90) {
      fadeTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, 300);
    }
    return () => {
      if (fadeTimerRef.current !== null) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [progress]);

  useEffect(() => {
    const mountTime = performance.now();
    const minimumDuration = 400;
    let minimumTimer: ReturnType<typeof setTimeout>;
    if (visible) {
      minimumTimer = setTimeout(() => {
        const elapsed = performance.now() - mountTime;
        if (elapsed < minimumDuration) {
          setVisible(true);
        }
      }, minimumDuration);
    }
    return () => {
      if (minimumTimer) {
        clearTimeout(minimumTimer);
      }
    };
  }, [visible]);

  if (!visible) return null;

  const shouldFade = progress >= 90;
  const containerStyle = shouldFade
    ? { opacity: 0 }
    : { opacity: 1 };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300"
      style={containerStyle}
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
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 transition-all duration-300 ease-out"
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

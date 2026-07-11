// src/shared/components/RouteProgressBar.tsx

"use client";
import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

const SHOW_DELAY_MS = 120;

export function RouteProgressBar() {
  const isPending = useRouterState({ select: (s) => s.status === "pending" });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isPending) {
      const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [isPending]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[999] h-[3px] overflow-hidden"
    >
      <div className="route-progress-bar h-full w-1/3 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-800" />
      <style>{`
        @keyframes route-progress-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .route-progress-bar {
          animation: route-progress-slide 0.9s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
"use client";
import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { CartDrawer } from "@/features/market/components/CartDrawer";
import { CheckOut } from "@/features/checkout/components/CheckOut";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isStudio = location.pathname.startsWith("/studio");
  const isProductDetail = location.pathname.startsWith("/product/");
  // Immersive/focused screens: minimal header, no bottom tab bar. On PDP
  // this also avoids the tab bar clashing with the page's own sticky
  // "Add to bag" bar; on Studio it keeps the canvas full-height.
  const isMinimal = isStudio || isProductDetail;

  const { isTelegram, isFullscreen, disableVerticalSwipes, enableVerticalSwipes } = useTelegram();

  // Block swipe-down-to-close in studio (fullscreen TG miniapp only).
  // Falls back gracefully on older Bot API versions — the methods simply won't exist.
  useEffect(() => {
    if (!isTelegram || !isStudio) return;
    disableVerticalSwipes();
    return () => enableVerticalSwipes();
  }, [isTelegram, isStudio, disableVerticalSwipes, enableVerticalSwipes]);

  // Extra top clearance on mobile when running in TG fullscreen mode so our
  // elements don't clash with the native close / menu icons (~52 px covers them).
  const tgSafeTop = isTelegram && isFullscreen && !isStudio ? "pt-[54px] md:pt-0" : "";

  return (
    <div className={cn("flex min-h-dvh flex-col bg-background", tgSafeTop)}>
      <Header variant={isMinimal ? "minimal" : "full"} />

      <main className="flex-1">{children}</main>

      {!isMinimal && <BottomNav />}

      <CartDrawer />
      <CheckOut />
    </div>
  );
}
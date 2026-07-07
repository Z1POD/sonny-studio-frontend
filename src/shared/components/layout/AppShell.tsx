"use client";
import { useCallback, useEffect } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { CartDrawer } from "@/features/market/components/CartDrawer";
import { CheckOut } from "@/features/checkout/components/CheckOut";
import { useTheme, applyThemeClass } from "@/shared/stores/theme-store";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const router = useRouter();
  const isStudio = location.pathname.startsWith("/studio");
  const isProductDetail = location.pathname.startsWith("/product/");
  const isMinimal = isStudio || isProductDetail;

  const {
    tg,
    isTelegram,
    isFullscreen,
    safeAreaInset,
    contentSafeAreaInset,
    disableVerticalSwipes,
    enableVerticalSwipes,
  } = useTelegram();

  const themeMode = useTheme((s) => s.mode);
  useEffect(() => {
    applyThemeClass(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!isTelegram || !isStudio) return;
    disableVerticalSwipes();
    return () => enableVerticalSwipes();
  }, [isTelegram, isStudio, disableVerticalSwipes, enableVerticalSwipes]);

  const handleBack = useCallback(() => {
    router.history.back();
  }, [router]);

  useEffect(() => {
    if (!tg?.BackButton) return;

    const canGoBack = router.history.canGoBack();

    if (isFullscreen && canGoBack) {
      tg.BackButton.show();
      tg.BackButton.onClick(handleBack);
    } else {
      tg.BackButton.hide();
    }

    return () => tg.BackButton.offClick(handleBack);
  }, [tg, isFullscreen, handleBack, router, location.pathname]);

  useEffect(() => {
    const root = document.documentElement;
    const top = isFullscreen
      ? (safeAreaInset?.top ?? 0) + (contentSafeAreaInset?.top ?? 0)
      : 0;
    const bottom = isFullscreen ? (safeAreaInset?.bottom ?? 0) : 0;

    root.style.setProperty("--tg-safe-area-top", `${top}px`);
    root.style.setProperty("--tg-safe-area-bottom", `${bottom}px`);
  }, [isFullscreen, safeAreaInset, contentSafeAreaInset]);

  const applySafeAreaTop = isTelegram && isFullscreen && !isStudio && !isProductDetail;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background",
        applySafeAreaTop && "pt-[var(--tg-safe-area-top)]"
      )}
    >
      <Header variant={isMinimal ? "minimal" : "full"} />

      <main className="flex-1">{children}</main>

      {!isMinimal && <BottomNav />}

      <CartDrawer />
      <CheckOut />
    </div>
  );
}
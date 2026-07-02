"use client";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  CircleDotDashed,
  LayoutGrid,
  LogOut,
  Palette,
  Store as StoreIcon,
  Wallet as WalletIcon,
  X,
  PenLine,
  ShoppingBag,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuthStore } from "@/features/auth/store";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { cn } from "@/lib/utils";

const NAV = [
  // { to: "/store", label: "Store", icon: StoreIcon },
  // { to: "/analytics", label: "Analytics", icon: BarChart3 },
  // { to: "/wallet", label: "Wallet", icon: WalletIcon },
  { to: "/catalog", label: "Catalog", icon: LayoutGrid },
  { to: "/studio", label: "Studio", icon: Palette },
  { to: "/designs", label: "Designs", icon: PenLine },
  { to: "/orders", label: "Orders", icon: ShoppingBag },

] as const;

// Avatar dropdown 

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isTelegram } = useTelegram();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initial = (user?.display_name ?? "?")[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold transition hover:bg-primary/25"
      >
        {initial}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-10 z-50 min-w-[180px] overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-xl"
          >
            {/* User info */}
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-sm font-medium leading-tight">
                {user?.display_name ?? "—"}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                {user?.role ?? "guest"}
              </p>
            </div>

            {/* Logout — only outside Telegram */}
            {!isTelegram && (
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-muted-foreground transition hover:bg-surface-overlay hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Studio nav FAB

function StudioNavFab() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close when navigating away
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      {/* FAB — top-left, mobile only */}
      <div className="fixed left-1/2 top-10 z-20 md:hidden -translate-x-1/2">
        <motion.button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          whileTap={{ scale: 0.92 }}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-colors duration-200 backdrop-blur-xl",
            open
              ? "border-border/90 bg-surface/30 text-foreground"
              : "border-border/80 bg-surface/10 text-muted-foreground",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? "close" : "open"}
              initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              {open ? <X className="h-4 w-4" /> : <CircleDotDashed className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Slide-up nav tray */}
      <AnimatePresence>
        {open && (
          <>
            {/* Dim backdrop — tap to close */}
            <motion.div
              key="fab-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Nav tray */}
            <motion.nav
              key="fab-nav"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: "spring", damping: 28, stiffness: 340 }}
              className="fixed top-20 inset-x-0 z-40 md:hidden safe-top"
            >
              <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-border/60 bg-surface/90 shadow-2xl backdrop-blur-xl">
                <div className="grid grid-cols-4">
                  {NAV.map(({ to, label, icon: Icon }) => {
                    const active = location.pathname.startsWith(to);
                    return (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 py-3.5 text-[10px] font-medium transition",
                          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-xl transition",
                          active ? "bg-primary/10" : "bg-transparent",
                        )}>
                          <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                        </div>
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// AppShell

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isStudio = location.pathname.startsWith("/studio");
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
      {/* Top bar — desktop only */}
      <header className="sticky top-0 z-30 glass border-b border-border safe-top hidden md:block">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/store" className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Palette className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Sonny</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-surface-overlay"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <UserMenu />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Studio: floating toggle + slide-up nav tray (mobile only) */}
      {isStudio && <StudioNavFab />}

      {/* Bottom tab bar — mobile only, non-studio pages */}
      {!isStudio && (
        <nav className="sticky bottom-3 w-[95%] z-30 glass-strong border border-border rounded-2xl mx-auto safe-bottom shadow-2xl md:hidden backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[10px]",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
// src/components/layout/UserMenu.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, LogOut, ShoppingBag } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const ACCOUNT_NAV = [{ to: "/analytics", label: "Analytics", icon: BarChart3 }] as const;

// Link to the separate buyer/marketplace app (optional — set VITE_BUYER_APP_URL).
const BUYER_APP_URL = (import.meta.env.VITE_BUYER_APP_URL as string | undefined) || "";

interface UserMenuProps {
  anchor?: "header" | "tab";
  className?: string;
  children: ReactNode;
}

export function UserMenu({ anchor = "header", className, children }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const { isTelegram } = useTelegram();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleTrigger = () => {
    if (!user) {
      navigate({ to: "/login", search: { redirect: undefined } });
      return;
    }
    setOpen((v) => !v);
  };
  const handleSignIn = () => {
    if (!user) {
    setOpen(false);
    navigate({ to: "/login", search: { redirect: undefined } });
    return;
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={ref} className="relative flex min-h-[44px] flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground">
      <button
        onClick={handleSignIn}
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        className={className}
      >
        {children}
      </button>

      <AnimatePresence>
        {open && user && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: anchor === "tab" ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: anchor === "tab" ? 4 : -4 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "absolute z-50 min-w-[200px] overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-xl",
              anchor === "tab" ? "bottom-full right-0 mb-2" : "right-0 top-10",
            )}
          >
          <div className="flex items-start justify-between border-b border-border/40 px-4 py-3">
            <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight">
                {user.display_name ?? "—"}
                </p>
                {/* <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {user.role ?? "guest"}
                </p> */}
            </div>

            <ThemeToggle className="bg-muted/60" />
          </div>

            <div className="border-b border-border/40 py-1.5">
              {ACCOUNT_NAV.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-surface-overlay hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>
            {BUYER_APP_URL && (
              <a
                href={BUYER_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 border-b border-border/40 px-4 py-2.5 text-sm text-primary transition hover:bg-surface-overlay"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Open the marketplace
              </a>
            )}

            {!isTelegram && (
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                role="menuitem"
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
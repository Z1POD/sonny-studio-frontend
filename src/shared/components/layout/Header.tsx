// src/shared/components/layout/Header.tsx
"use client";

import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Palette,
  Moon,
  LayoutGrid,
  ShoppingBag,
  Store as StoreIcon,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/store";
import { useCart } from "@/features/market/store";
import { useTheme } from "@/shared/stores/theme-store";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const NAV = [
  { to: "/marketplace", label: "Market", icon: StoreIcon },
  { to: "/catalog", label: "Customize", icon: Palette },
  { to: "/designs", label: "Designs", icon: LayoutGrid },
] as const;



interface HeaderProps {
  variant?: "full" | "minimal";
}

export function Header({ variant = "full" }: HeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cartCount = useCart((s) => s.items.reduce((a, b) => a + b.quantity, 0));
  const openCart = useCart((s) => s.openDrawer);
  const user = useAuthStore((s) => s.user);

  const [isExpanded, setIsExpanded] = useState(false);
  const isMinimal = variant === "minimal";

  useEffect(() => setIsExpanded(false), [pathname]);

  const isHome = pathname === "/" || pathname === "/marketplace";

  return (
    <header
        className={cn(
          "z-50 h-14 transition-colors duration-300 md:h-20",
          isMinimal
            ? "fixed inset-x-0 md:top-0"
            : "sticky top-[var(--tg-safe-area-top,0px)] hidden md:block md:mx-auto md:w-[800px]",
          isHome && !isExpanded && !isMinimal ? "border-none bg-transparent" : "rounded-2xl",
        )}
      >
      <div
        className={cn(
          "absolute left-1/2 top-0 mt-2 flex w-full -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-border bg-background/60 px-4 shadow-2xl backdrop-blur transition-all duration-300 md:bg-glass md:px-8 md:backdrop-blur",
          isExpanded
            ? "h-auto max-w-[calc(100%-2rem)] md:max-w-[600px] flex-col gap-4 py-4"
            : isMinimal
              ? "h-10 max-w-[150px] justify-center md:h-12"
              : "h-10 max-w-[190px] justify-between md:h-16 md:max-w-7xl",
        )}
      >
        {!isMinimal && (
          <Link
            to="/marketplace"
            className={cn("items-center gap-2", isExpanded ? "flex" : "hidden md:flex")}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background">
              <span className="text-[11px] font-bold">S</span>
            </span>
            <span className="text-base font-semibold tracking-tight">Sonny</span>
          </Link>
        )}

        {/* Desktop nav links */}
        {!isMinimal && (
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ className: "text-foreground" }}
                className="transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side controls */}
        <div
          className={cn(
            "flex items-center gap-1.5",
            isExpanded ? "w-full justify-between" : "justify-center",
          )}
        >

          <button
            aria-label={isExpanded ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((v) => !v)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              !isMinimal && "md:hidden",
            )}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <div className="flex items-center gap-1.5">
            {isMinimal ? <ThemeToggle /> : ""}

            <button
              aria-label="Open cart"
              onClick={openCart}
              className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShoppingBag className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                  {cartCount}
                </span>
              )}
            </button>

            {!isMinimal && (
              <UserMenu
                anchor="header"
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {user ? (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {(user.display_name ?? "?")[0]?.toUpperCase()}
                  </span>
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
              </UserMenu>
            )}
          </div>
        </div>

        {isExpanded && (
          <nav
            className={cn(
              "flex w-full flex-col gap-1 border-t border-border/40 pt-2",
              !isMinimal && "md:hidden",
            )}
          >
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ className: "bg-muted text-foreground" }}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
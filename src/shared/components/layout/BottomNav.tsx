// src/components/layout/BottomNav.tsx
"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Palette, ShoppingBag, Store as StoreIcon, User as UserIcon } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";
import { useCart } from "@/features/market/store";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";

// Same three core destinations as the desktop header nav — kept in parity
// so the IA doesn't shift between devices. Cart and Account fill out the
// remaining two of the five HIG-recommended tab slots.
const TABS = [
  { to: "/marketplace", label: "Market", icon: StoreIcon },
  { to: "/catalog", label: "Customize", icon: Palette },
  { to: "/designs", label: "Designs", icon: LayoutGrid },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cartCount = useCart((s) => s.items.reduce((a, b) => a + b.quantity, 0));
  const openCart = useCart((s) => s.openDrawer);
  const user = useAuthStore((s) => s.user);

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-2 z-30 mx-auto w-[95%] rounded-2xl border border-border glass-strong shadow-2xl backdrop-blur-xl safe-bottom md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}

        <button
          onClick={openCart}
          aria-label="Open cart"
          className="relative flex min-h-[44px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted-foreground"
        >
          <ShoppingBag className="h-5 w-5" />
          Cart
          {cartCount > 0 && (
            <span className="absolute right-[26%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-bold text-primary-foreground">
              {cartCount}
            </span>
          )}
        </button>

        <UserMenu
          anchor="tab"
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted-foreground"
        >
          {user ? (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
              {(user.display_name ?? "?")[0]?.toUpperCase()}
            </span>
          ) : (
            <UserIcon className="h-5 w-5" />
          )}
        </UserMenu>
      </div>
    </nav>
  );
}
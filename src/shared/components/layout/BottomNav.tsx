// src/shared/components/layout/BottomNav.tsx
"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Palette, Store as StoreIcon, User as UserIcon, Wallet as WalletIcon } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";


const TABS = [
  { to: "/catalog", label: "Catalog", icon: Palette },
  { to: "/designs", label: "Designs", icon: LayoutGrid },
  { to: "/store", label: "Dashboard", icon: StoreIcon },
  { to: "/wallet", label: "Earnings", icon: WalletIcon },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
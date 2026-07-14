"use client";

import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Palette,
  Shirt,
  ShoppingBag,
} from "lucide-react";

import { useAuthStore } from "@/features/auth/store";
import { getStoredToken } from "@/shared/api/client";
import { AppShell } from "@/shared/components/layout/AppShell";
import { BrandLoader } from "@/components/ui/loader";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    if (typeof window !== "undefined" && !getStoredToken()) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
  },
  component: AuthenticatedLayout,
});

const steps = [
  { icon: Shirt, label: "Pick" },
  { icon: Palette, label: "Customize" },
  { icon: ShoppingBag, label: "Sell/Order" },
];

function AuthenticatedLayout() {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (status === "idle") hydrate();
  }, [status, hydrate]);

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate({
        to: "/login",
        search: { redirect: pathname },
        replace: true,
      });
    }
  }, [status, navigate, pathname]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0a3a30] via-[#06241e] to-[#031411] px-4 text-white select-none">
        {/* Center Loader */}
        <div className="relative z-10 my-auto flex flex-col items-center">
          <BrandLoader size="md" />
        </div>

        {/* Bottom Steps - Mobile optimized card grid */}
        <div className="w-full max-w-sm pb-8 z-10">
          <div className="grid grid-cols-3 gap-2.5">
            {steps.map(({ label }, index) => (
              <div key={label || index}>
                <p className="mt-2 text-center text-[10px] font-medium tracking-wide text-white/70">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
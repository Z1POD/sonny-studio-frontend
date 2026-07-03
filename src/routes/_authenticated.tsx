"use client";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { getStoredToken } from "@/shared/api/client";
import { AppShell } from "@/shared/components/layout/AppShell";
import { BrandLoader } from "@/components/ui/loader";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    // Synchronous token-presence check — full session is hydrated client-side.
    if (typeof window !== "undefined" && !getStoredToken()) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "idle") hydrate();
  }, [status, hydrate]);

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate({ to: "/login" });
    }
  }, [status, navigate]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-t from-[#062d27] via-[#083b32] to-[#0d5044]">
        <BrandLoader size="md" />
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

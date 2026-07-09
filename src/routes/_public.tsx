// src/routes/_public.tsx

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { AppShell } from "@/shared/components/layout/AppShell";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    if (status === "idle") hydrate();
  }, [status, hydrate]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
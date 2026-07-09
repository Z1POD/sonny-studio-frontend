// src/routes/_public.tsx
//
// Layout for routes that must render instantly regardless of auth state —
// shared product links, Telegram deep links, anything the backend already
// serves as AllowAny. Uses the same AppShell as `_authenticated`, but:
//  - no beforeLoad token check / redirect to /login
//  - no blocking "idle/loading" gate before the page can render
// If a token is already stored, hydrate() still runs so cart/wishlist/user
// menu personalize once it resolves — it just never blocks the page.

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
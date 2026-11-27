import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginCard } from "@/features/auth/components/LoginCard";
import { getStoredToken } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/store";
import { parseHref } from "@/lib/nav";

/**
 * Plain module-level check — we're outside React here, so we can't use the
 * useTelegram() hook. Mirrors the same field `client.ts` reads.
 */
function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
      .Telegram?.WebApp?.initData,
  );
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    // Telegram users never see the manual login form — auth is owned by
    // useTelegramLaunch (root) / useTelegramAutoLogin (splash). If a
    // guarded route sent them here, bounce them to splash instead,
    // preserving where they were trying to go so splash can send them
    // there once sign-in resolves.
    if (isTelegramMiniApp()) {
      throw redirect({
        to: "/",
        search: { redirect: search.redirect },
        replace: true,
      });
    }

    if (getStoredToken()) {
      // A stored token isn't proof of a valid session — verify before
      // trusting it, otherwise a stale/rejected token bounces the user
      // straight into a page that immediately 403s with no recovery.
      await useAuthStore.getState().hydrate().catch(() => {});
      if (useAuthStore.getState().status === "authenticated") {
        throw redirect({ ...(parseHref(search.redirect || "/designs") as any) });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — M I M O Creator" },
      {
        name: "description",
        content: "Sign in to your M I M O creator account.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  // LoginCard is a full-screen surface that shares the splash design.
  return <LoginCard redirectTo={redirectTo || "/designs"} />;
}

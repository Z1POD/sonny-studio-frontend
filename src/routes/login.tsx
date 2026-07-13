import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginCard } from "@/features/auth/components/LoginCard";
import { getStoredToken } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/store";

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
        throw redirect({ to: search.redirect || "/marketplace" });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — Sonny" },
      {
        name: "description",
        content: "Sign in to your Sonny design studio account.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#083b32] px-4 safe-top safe-bottom">
      {/* Subtle ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 30% 45%, oklch(0.45 0.18 280 / 0.2), transparent 60%), radial-gradient(ellipse 40% 35% at 70% 55%, oklch(0.4 0.16 320 / 0.15), transparent 55%)",
        }}
      />
      <LoginCard />
    </div>
  );
}
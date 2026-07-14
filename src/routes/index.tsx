import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getStoredToken } from "@/shared/api/client";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { useTelegramAutoLogin } from "@/features/auth/hooks/useTelegramAutoLogin";
import { useAuthStore } from "@/features/auth/store";
import { SplashPage } from "@/features/auth/components/SplashPage";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "M I M O — Design Studio" },
      {
        name: "description",
        content:
          "M I M O is a creator studio for designing and selling custom apparel.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { isTelegram } = useTelegram();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Telegram path: this is the safety net / retry for
  // useTelegramLaunch's background sign-in — and the landing spot for
  // users bounced here from /login by a guarded route. `redirect` (if
  // present) carries the page they were originally trying to reach, so
  // they land there instead of always going to /marketplace.
  const { tgLoading, checked } = useTelegramAutoLogin({
    redirectTo: redirect || "/marketplace",
  });

  // Browser path: a stored token isn't proof of a valid session — verify
  // via hydrate() before navigating away, otherwise a stale token bounces
  // the user into a page that immediately 403s with no recovery.
  useEffect(() => {
    if (!mounted || isTelegram) return;
    if (!getStoredToken()) return;

    let cancelled = false;
    useAuthStore
      .getState()
      .hydrate()
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        if (useAuthStore.getState().status === "authenticated") {
          navigate({ to: redirect || "/marketplace", replace: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mounted, isTelegram, navigate, redirect]);

  return (
    <SplashPage
      isTelegramLaunching={mounted && isTelegram && (!checked || tgLoading)}
    />
  );
}
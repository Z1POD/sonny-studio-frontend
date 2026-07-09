// src/features/auth/hooks/useTelegramLaunch.ts

import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { parseStartParam } from "@/lib/telegram-start-param";
import { getStoredToken } from "@/shared/api/client";
import { authApi } from "../api";
import { useAuthStore } from "../store";

export function useTelegramLaunch() {
  const { tg } = useTelegram();
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const handled = useRef(false);

  // Captured via ref (not a dependency) — we only care what the URL was
  // at the moment `tg` first becomes available, not on every navigation.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (handled.current) return;
    // Wait for the real WebApp object — this is what start_param/initData
    // actually live on. Non-Telegram browsers leave `tg` null forever,
    // so this simply never fires there, harmlessly.
    if (!tg) return;
    handled.current = true;

    const initData = tg.initData;
    const signIn = () => {
      if (!initData || getStoredToken()) return Promise.resolve();
      return authApi.loginTelegram(initData).then((data) => {
        setToken(data.token, data.user);
      });
    };

    const target = parseStartParam(tg.initDataUnsafe?.start_param);

    if (target?.type === "product") {
      // Speed matters — navigate now, sign in quietly in parallel.
      navigate({ to: "/p/$slug", params: { slug: target.id }, replace: true });
      signIn().catch(() => {
        // Silent by design — /login's useTelegramAutoLogin retries and
        // surfaces a real error if the user lands there directly.
      });
      return;
    }

    if (pathnameRef.current === "/") {
      // Plain launch, no deep link — wait for sign-in to settle before
      // leaving "/". index.tsx hides the CTAs for the whole time we're
      // in Telegram, so there's no flash of "Get Started" here either way.
      signIn()
        .catch(() => {})
        .finally(() => {
          navigate({ to: "/marketplace", replace: true });
        });
      return;
    }

    // Landed somewhere else entirely (e.g. deep-linked to a route that
    // isn't the product flow) — sign in quietly, nothing to redirect.
    signIn().catch(() => {});
  }, [tg, navigate, setToken]);
}
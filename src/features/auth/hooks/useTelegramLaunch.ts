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
  const hydrate = useAuthStore((s) => s.hydrate);
  const handled = useRef(false);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (handled.current) return;
    if (!tg) return;
    handled.current = true;

    const initData = tg.initData;

    const signIn = async () => {
      if (getStoredToken()) {
        await hydrate().catch(() => {});
        if (useAuthStore.getState().status === "authenticated") return;
      }

      if (!initData) {
        await hydrate().catch(() => {});
        return;
      }

      await useAuthStore.getState().loginWithTelegram(initData).catch(() => {
        // Swallowed — user keeps browsing unauthenticated. Splash /
        // marketplace fall back to showing a login CTA. Guarded pages will
        // redirect to /login, which bounces Telegram users back to splash
        // where useTelegramAutoLogin retries.
      });
    };

    const target = parseStartParam(tg.initDataUnsafe?.start_param);

    // Navigate immediately — do not wait on auth for public destinations.
    if (target?.type === "product") {
      navigate({ to: "/p/$slug", params: { slug: target.id }, replace: true });
    } else if (target?.type === "route") {
      navigate({ to: "/", search: { redirect: target.path }, replace: true });
    } else if (pathnameRef.current === "/") {
      navigate({ to: "/marketplace", replace: true });
    }

    // Fire-and-forget: resolves auth state in the background.
    void signIn();
  }, [tg, navigate, setToken, hydrate]);
}
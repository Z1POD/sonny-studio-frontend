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
        // A stored token isn't proof of a valid session — the backend
        // decides. hydrate() clears it if it's stale/rejected (401/403).
        await hydrate().catch(() => {});
        if (useAuthStore.getState().status === "authenticated") return;
        // token was invalid and has now been cleared — fall through to a
        // fresh Telegram sign-in below
      }

      if (!initData) {
        // Nothing to sign in with — settle status to "unauthenticated" so
        // consumers (e.g. guarded routes) stop waiting.
        await hydrate().catch(() => {});
        return;
      }

      try {
        const data = await authApi.loginTelegram(initData);
        setToken(data.token, data.user);
      } catch {
        // Swallowed — user keeps browsing unauthenticated. Splash /
        // marketplace fall back to showing a login CTA. Guarded pages will
        // redirect to /login, which bounces Telegram users back to splash
        // where useTelegramAutoLogin retries.
      }
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
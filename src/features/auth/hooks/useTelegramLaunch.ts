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

    // 1. Resolve the deep link immediately — no auth wait.
    const target = parseStartParam(tg.initDataUnsafe?.start_param);
    if (target?.type === "product") {
      navigate({ to: "/p/$slug", params: { slug: target.id }, replace: true });
    } else if (pathnameRef.current === "/") {
      // Plain Telegram launch, no deep link — skip the marketing splash.
      navigate({ to: "/marketplace", replace: true });
    }

    // 2. Silently authenticate in the background, in parallel — purely
    //    for personalization. Skip if a token's already stored.
    const initData = tg.initData;
    if (initData && !getStoredToken()) {
      authApi
        .loginTelegram(initData)
        .then((data) => setToken(data.token, data.user))
        .catch(() => {
          // Silent by design. If the user ends up on /login directly,
          // useTelegramAutoLogin retries and surfaces a real error there.
        });
    }
  }, [tg, navigate, setToken]);
}
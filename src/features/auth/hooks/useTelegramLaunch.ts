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

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (handled.current) return;
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

    if (target?.type === "product" || pathnameRef.current === "/") {

      signIn()
        .catch(() => {

        })
        .finally(() => {
          if (target?.type === "product") {
            navigate({ to: "/p/$slug", params: { slug: target.id }, replace: true });
          } else {
            navigate({ to: "/marketplace", replace: true });
          }
        });
      return;
    }

    signIn().catch(() => {});
  }, [tg, navigate, setToken]);
}
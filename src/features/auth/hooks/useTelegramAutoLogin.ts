// src/features/auth/hooks/useTelegramAutoLogin.ts

import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { appToast as toast } from "@/lib/toaster";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { getStoredToken } from "@/shared/api/client";
import { authApi } from "../api";
import { useAuthStore } from "../store";

interface UseTelegramAutoLoginOptions {
  redirectTo?: string;
  enabled?: boolean;
}

export function useTelegramAutoLogin({
  redirectTo = "/marketplace",
  enabled = true,
}: UseTelegramAutoLoginOptions = {}) {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const hydrate = useAuthStore((s) => s.hydrate);
  const { tg, isTelegram } = useTelegram();

  const [tgLoading, setTgLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const ownedPathnameRef = useRef(pathname); // the route this hook instance started on

  useEffect(() => {
    if (!enabled) return;

    if (!isTelegram) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    const stillOwnsRoute = () => pathnameRef.current === ownedPathnameRef.current;

    async function run() {
      if (getStoredToken()) {
        await hydrate().catch(() => {});
        if (cancelled || !stillOwnsRoute()) return;
        if (useAuthStore.getState().status === "authenticated") {
          navigate({ to: redirectTo, replace: true });
          setChecked(true);
          return;
        }
      }

      const initData = tg?.initData;
      if (!initData) {
        setChecked(true);
        return;
      }

      setTgLoading(true);
      try {
        const data = await authApi.loginTelegram(initData);
        if (cancelled || !stillOwnsRoute()) return;
        setToken(data.token, data.user);
        navigate({ to: redirectTo, replace: true });
      } catch (err) {
        if (!cancelled) {
          toast.error((err as Error).message || "Auto sign-in failed");
        }
      } finally {
        if (!cancelled) {
          setTgLoading(false);
          setChecked(true);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isTelegram, tg, setToken, navigate, redirectTo, hydrate]);

  return { tgLoading, isTelegram, checked };
}
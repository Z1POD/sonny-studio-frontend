// src/features/auth/hooks/useTelegramAutoLogin.ts


import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { parseStartParam } from "@/lib/telegram-start-param";
import { authApi } from "../api";
import { useAuthStore } from "../store";

interface UseTelegramAutoLoginOptions {
  redirectTo?: string;
  /** Set false to skip the auto-login attempt entirely (rarely needed). */
  enabled?: boolean;
}

export function useTelegramAutoLogin({
  redirectTo = "/marketplace",
  enabled = true,
}: UseTelegramAutoLoginOptions = {}) {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const { tg, isTelegram } = useTelegram();

  const [tgLoading, setTgLoading] = useState(false);

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    if (!isTelegram) {
      setChecked(true);
      return;
    }

    const initData = tg?.initData;
    if (!initData) {
      setChecked(true);
      return;
    }

    setTgLoading(true);
    authApi
      .loginTelegram(initData)
      .then((data) => {
        setToken(data.token, data.user);

        // A product deep link takes priority over the default redirect.
        const target = parseStartParam(tg?.initDataUnsafe?.start_param);
        if (target?.type === "product") {
          navigate({ to: "/p/$slug", params: { slug: target.id } });
        } else {
          navigate({ to: redirectTo });
        }
      })
      .catch((err: Error) => {
        toast.error(err.message || "Auto sign-in failed");
      })
      .finally(() => {
        setTgLoading(false);
        setChecked(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isTelegram, tg, setToken, navigate, redirectTo]);

  return { tgLoading, isTelegram, checked };
}
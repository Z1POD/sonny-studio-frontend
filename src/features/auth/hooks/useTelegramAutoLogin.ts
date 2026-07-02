// src/features/auth/hooks/useTelegramAutoLogin.ts

/**
 * Auto-signs the user in when the app is running inside the Telegram Mini
 * App, using the initData Telegram injects on load.
 *
 * IMPORTANT: this is written against the actual `useTelegram()` hook shape
 * (`tg`, `isTelegram`) as uploaded in use-telegram.ts. The original
 * LoginCard.tsx referenced `isReady` / `isInTelegramMiniApp()` / `webApp`,
 * none of which that hook exposes — those were dead/mismatched props. If
 * your real use-telegram.ts differs from the uploaded one, adjust the two
 * destructured fields below accordingly.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { authApi } from "../api";
import { useAuthStore } from "../store";

interface UseTelegramAutoLoginOptions {
  redirectTo?: string;
  /** Set false to skip the auto-login attempt entirely (rarely needed). */
  enabled?: boolean;
}

export function useTelegramAutoLogin({
  redirectTo = "/catalog",
  enabled = true,
}: UseTelegramAutoLoginOptions = {}) {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const { tg, isTelegram } = useTelegram();

  const [tgLoading, setTgLoading] = useState(false);
  // `checked` flips true once we've resolved whether we're in Telegram and
  // (if so) finished the sign-in attempt — callers use this to avoid
  // flashing the wrong UI while the environment check settles.
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
        navigate({ to: redirectTo });
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
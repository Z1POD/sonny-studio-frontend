// src/features/auth/hooks/useTelegramAutoLogin.ts

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { appToast as toast } from "@/lib/toaster";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { getStoredToken } from "@/shared/api/client";
import { authApi } from "../api";
import { useAuthStore } from "../store";

interface UseTelegramAutoLoginOptions {
  redirectTo?: string;
  /** Set false to skip the auto-login attempt entirely (rarely needed). */
  enabled?: boolean;
}

/**
 * Splash-page hook. Acts as the safety net / retry path for Telegram
 * sign-in: handles the case where `useTelegramLaunch`'s background
 * sign-in (root-mounted) hasn't resolved yet, or where a guarded route
 * bounced the user to `/login` -> `/` because their stored token was
 * rejected by the backend.
 *
 * Never trusts `getStoredToken()` presence alone — a token in storage is
 * not proof it still grants access, so it's verified via `hydrate()`
 * before being treated as a valid session.
 */
export function useTelegramAutoLogin({
  redirectTo = "/marketplace",
  enabled = true,
}: UseTelegramAutoLoginOptions = {}) {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const hydrate = useAuthStore((s) => s.hydrate);
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

    let cancelled = false;

    async function run() {
      if (getStoredToken()) {
        // Verify before trusting — the token may have been revoked or
        // expired server-side since it was written to storage.
        await hydrate().catch(() => {});
        if (cancelled) return;
        if (useAuthStore.getState().status === "authenticated") {
          navigate({ to: redirectTo });
          setChecked(true);
          return;
        }
        // invalid token — hydrate() already cleared it. Fall through to a
        // real Telegram sign-in below.
      }

      const initData = tg?.initData;
      if (!initData) {
        setChecked(true);
        return;
      }

      setTgLoading(true);
      try {
        const data = await authApi.loginTelegram(initData);
        if (cancelled) return;
        setToken(data.token, data.user);
        navigate({ to: redirectTo });
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
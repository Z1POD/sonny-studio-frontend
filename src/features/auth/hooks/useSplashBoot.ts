// src/features/auth/hooks/useSplashBoot.ts
//
// Drives the splash screen. Each stage is real work, not a timer:
//   1. Telegram WebApp ready (or confirmed absent)
//   2. Session resolved — stored token verified, or Telegram initData exchanged
//   3. Catalog warmed — the queries the marketplace renders first
// A sign-in failure inside Telegram stops on the splash with a retry; catalog
// failures never block (the marketplace shows its own error state).

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { getStoredToken } from "@/shared/api/client";
import { parseHref } from "@/lib/nav";
import { parseStartParam } from "@/lib/telegram-start-param";
import { homepageQuery, productsInfiniteQuery } from "@/features/market/queries";
import { useAuthStore } from "../store";

export type BootStage = 0 | 1 | 2 | 3;
export type BootPhase = "loading" | "ready" | "error";

/** Keep the splash on screen long enough to register, even when everything is cached. */
const MIN_VISIBLE_MS = 1400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useSplashBoot(redirect?: string) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { tg, isTelegram } = useTelegram();
  const [stage, setStage] = useState<BootStage>(0);
  const [phase, setPhase] = useState<BootPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);
  const startedAt = useRef<number>(0);

  /** Where to go once boot is done: deep link > guarded-route redirect > marketplace. */
  const target = useCallback((): string | { slug: string } => {
    const sp = parseStartParam(tg?.initDataUnsafe?.start_param);
    if (sp?.type === "product") return { slug: sp.id };
    if (sp?.type === "route") return sp.path;
    return redirect || "/marketplace";
  }, [tg, redirect]);

  const go = useCallback(() => {
    const t = target();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof t === "string") navigate({ ...(parseHref(t) as any), replace: true });
    else navigate({ to: "/p/$slug", params: { slug: t.slug }, replace: true });
  }, [navigate, target]);

  const run = useCallback(
    async (opts: { skipAuth?: boolean } = {}) => {
      const id = ++runId.current;
      const alive = () => runId.current === id;
      startedAt.current = Date.now();
      setPhase("loading");
      setError(null);
      setStage(1);

      if (!opts.skipAuth) {
        try {
          if (getStoredToken()) {
            await useAuthStore.getState().hydrate().catch(() => {});
          }
          const st = useAuthStore.getState();
          if (st.status !== "authenticated" && isTelegram && tg?.initData) {
            await st.loginWithTelegram(tg.initData);
          }
        } catch (e) {
          if (!alive()) return;
          setError(e instanceof Error ? e.message : "We couldn't sign you in.");
          setPhase("error");
          return;
        }
      }
      if (!alive()) return;
      setStage(2);

      await Promise.allSettled([
        qc.prefetchQuery(homepageQuery()),
        qc.prefetchInfiniteQuery(productsInfiniteQuery({ sort: "popular", page_size: 12 })),
      ]);
      if (!alive()) return;
      setStage(3);

      await sleep(Math.max(450, MIN_VISIBLE_MS - (Date.now() - startedAt.current)));
      if (!alive()) return;
      setPhase("ready");
    },
    [qc, tg, isTelegram],
  );

  // Wait one tick for useTelegram() to resolve `tg`/`isTelegram` before signing in.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    const t = setTimeout(() => {
      started.current = true;
      void run();
    }, 60);
    return () => clearTimeout(t);
  }, [run]);

  const authed = useAuthStore((s) => s.status === "authenticated");

  // Telegram users (and anyone already signed in) continue automatically; browser guests press Continue.
  useEffect(() => {
    if (phase === "ready" && (isTelegram || authed)) go();
  }, [phase, isTelegram, authed, go]);

  return {
    stage,
    phase,
    error,
    isTelegram,
    authed,
    retry: () => void run(),
    continueAsGuest: () => void run({ skipAuth: true }),
    go,
  };
}

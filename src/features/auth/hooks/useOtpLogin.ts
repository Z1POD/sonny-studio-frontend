// src/features/auth/hooks/useOtpLogin.ts
//
// Browser sign-in via a one-time code delivered over Telegram (registered users only).
//   request → "Check your Telegram" (10-minute countdown) → verify → session.
// Rules from the contract this hook follows:
//  - the request response is identical for unknown usernames — never say "not found";
//  - verify errors (with remaining attempts) are shown verbatim;
//  - requests are limited to 3 per 5 minutes per username → lock "Resend" for the window;
//  - an expired code clears the input and offers a fresh one.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ApiError } from "@/shared/api/client";
import { parseHref } from "@/lib/nav";
import { authApi } from "../api";
import { useAuthStore } from "../store";

export type OtpStep = "username" | "code";

const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const CODE_LENGTH = 6;

/** Usernames are shown with an "@" in Telegram; the API wants the bare handle. */
export const normalizeUsername = (v: string) => v.trim().replace(/^@+/, "");

export function useOtpLogin(redirectTo: string) {
  const navigate = useNavigate();
  const [step, setStep] = useState<OtpStep>("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const expiredHandled = useRef(false);

  // One ticker drives both countdowns (code expiry, resend lock).
  useEffect(() => {
    if (!expiresAt && !lockedUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt, lockedUntil]);

  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const expired = step === "code" && expiresAt !== null && secondsLeft === 0;
  const lockSeconds = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const rateLimited = lockSeconds > 0;

  useEffect(() => {
    if (expired && !expiredHandled.current) {
      expiredHandled.current = true;
      setCode("");
      setError("This code has expired. Request a new one.");
    }
  }, [expired]);

  const requestCode = useCallback(async () => {
    const u = normalizeUsername(username);
    if (!u || busy || (lockedUntil && Date.now() < lockedUntil)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.otpRequest(u);
      expiredHandled.current = false;
      setUsername(u);
      setCode("");
      setServerMessage(res.message);
      setExpiresAt(Date.now() + res.expires_in * 1000);
      setNow(Date.now());
      setStep("code");
    } catch (e) {
      if (e instanceof ApiError && e.code === "otp_error" && /too many/i.test(e.message)) {
        setLockedUntil(Date.now() + RATE_LIMIT_WINDOW_MS);
        setNow(Date.now());
      }
      setError(e instanceof Error ? e.message : "Couldn't send a code. Try again.");
    } finally {
      setBusy(false);
    }
  }, [username, busy, lockedUntil]);

  const verify = useCallback(async () => {
    if (code.length !== CODE_LENGTH || busy || expired) return;
    setBusy(true);
    setError(null);
    try {
      await useAuthStore.getState().loginWithOtp(username, code);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ ...(parseHref(redirectTo) as any), replace: true });
    } catch (e) {
      setCode("");
      setError(e instanceof Error ? e.message : "Couldn't verify the code. Try again.");
      setBusy(false);
    }
  }, [code, busy, expired, username, navigate, redirectTo]);

  const changeUsername = useCallback(() => {
    setStep("username");
    setCode("");
    setError(null);
    setExpiresAt(null);
  }, []);

  return {
    step,
    username,
    setUsername: (v: string) => { setUsername(v); setError(null); },
    code,
    setCode: (v: string) => { setCode(v.replace(/\D/g, "").slice(0, CODE_LENGTH)); setError(null); },
    codeLength: CODE_LENGTH,
    serverMessage,
    error,
    busy,
    secondsLeft,
    expired,
    rateLimited,
    lockSeconds,
    requestCode,
    verify,
    changeUsername,
  };
}

export const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

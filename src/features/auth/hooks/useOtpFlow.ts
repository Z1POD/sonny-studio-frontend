// src/features/auth/hooks/useOtpFlow.ts

/**
 * Shared 2-step OTP login state machine (username -> code).
 *
 * API error shape:
 *   { success: false, error: { code: "NOT_FOUND", message: "User not found.", details: {} } }
 *
 * All API errors surface the `error.message` to the user via toast.
 * NOT_FOUND also shows an inline signup banner.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { authApi } from "../api";
import { useAuthStore } from "../store";
import { ApiError } from "@/shared/api/client";
import { getTelegramLink } from "../lib/miniapp";

export type OtpStage = "username" | "code";

interface UseOtpFlowOptions {
  redirectTo?: string;
  onSuccess?: () => void;
  otpLength?: number;
  resendSeconds?: number;
}

/** Extract the human-readable message from any API or runtime error. */
function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.data) {
    const body = err.data as {
      success?: boolean;
      error?: { code?: string; message?: string; details?: Record<string, string> };
    };
    if (body?.error?.message) return body.error.message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something went wrong. Please try again.";
}

export function useOtpFlow({
  redirectTo,
  onSuccess,
  otpLength = 6,
  resendSeconds = 60,
}: UseOtpFlowOptions = {}) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const setToken = useAuthStore((s) => s.setToken);

  const [stage, setStage] = useState<OtpStage>("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [signupLink, setSignupLink] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalRedirect = redirectTo ?? search.redirect ?? "/marketplace";

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setResendCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const requestOtp = async (isResend = false) => {
    const u = username.trim().replace(/^@/, "");
    if (u.length < 3) {
      toast.error("Enter a valid username (at least 3 characters)");
      return;
    }

    if (isResend) setResending(true);
    else setSending(true);
    setSignupLink(null);
    setOtpError(null);

    try {
      await authApi.requestOtp(u);
      setUsername(u);
      setCode("");
      setStage("code");
      startCountdown(resendSeconds);
      toast.success(isResend ? "Code resent" : "Code sent", {
        description: "Check your Telegram for the code.",
      });
    } catch (err) {
      const message = getErrorMessage(err);

      if (err instanceof ApiError && err.data) {
        const body = err.data as {
          error?: { code?: string; message?: string; details?: Record<string, string> };
        };
        if (body?.error?.code === "NOT_FOUND") {
          setSignupLink(getTelegramLink(body.error.details));
        }
      }

      toast.error(message);
    } finally {
      setSending(false);
      setResending(false);
    }
  };

  const verifyCode = async (value: string) => {
    setCode(value);
    setOtpError(null);
    if (value.length !== otpLength || verifying) return;

    setVerifying(true);
    try {
      const data = await authApi.verifyOtp(username, value);
      setToken(data.token, data.user);
      const firstName = (data.user as { first_name?: string } | undefined)?.first_name;
      toast.success(firstName ? `Welcome, ${firstName}` : "Welcome back");

      // FIX: Always call onSuccess (e.g. close dialog) AND always navigate.
      // Previously: if (onSuccess) onSuccess(); else navigate(...)
      // This meant onSuccess replaced navigation entirely.
      if (onSuccess) onSuccess();
      navigate({ to: finalRedirect });
    } catch (err) {
      const message = getErrorMessage(err);
      setOtpError(message);
      toast.error(message);
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const backToUsername = () => {
    setStage("username");
    setCode("");
    setOtpError(null);
    setSignupLink(null);
    setResendCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const reset = () => {
    setUsername("");
    backToUsername();
  };

  return {
    stage,
    username,
    setUsername,
    code,
    sending,
    verifying,
    resending,
    otpError,
    signupLink,
    resendCountdown,
    requestOtp,
    verifyCode,
    backToUsername,
    reset,
    redirectTo: finalRedirect,
  };
}
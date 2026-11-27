// src/features/auth/components/LoginCard.tsx
//
// Sign-in screen, in the splash design.
//  · Inside Telegram: shows progress while `useTelegramAutoLogin` completes the exchange.
//  · In a browser: registered users sign in with a one-time code sent to their Telegram.

"use client";
import { Loader2 } from "lucide-react";
import { getMiniAppUrl } from "../lib/miniapp";
import { useTelegramAutoLogin } from "../hooks/useTelegramAutoLogin";
import { formatClock, useOtpLogin } from "../hooks/useOtpLogin";
import { ghostClass, pillClass, SplashLayout } from "./SplashLayout";

const inputClass =
  "h-14 w-full rounded-full bg-neutral-100 px-5 text-center text-base text-[#111] outline-none ring-0 placeholder:text-neutral-400 focus:bg-neutral-50 focus:shadow-[0_0_0_2px_rgba(0,0,0,0.25)] disabled:opacity-50";

export function LoginCard({ redirectTo = "/designs" }: { redirectTo?: string }) {
  const { tgLoading } = useTelegramAutoLogin({ redirectTo });
  const otp = useOtpLogin(redirectTo);
  const miniAppUrl = getMiniAppUrl();
  const buyerUrl = (import.meta.env.VITE_BUYER_APP_URL as string | undefined) || null;

  if (tgLoading) {
    return (
      <SplashLayout
        title="Signing you in"
        subtitle="Hold on while we confirm your Telegram account."
        ariaLabel="Signing in"
        progress={{ stage: 1, running: true }}
      >
        <button type="button" disabled aria-busy className={pillClass}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span aria-live="polite">Signing you in…</span>
        </button>
      </SplashLayout>
    );
  }

  if (otp.step === "code") {
    const canVerify = otp.code.length === otp.codeLength && !otp.busy && !otp.expired;
    return (
      <SplashLayout
        title="Check your Telegram"
        // Verbatim from the API: identical for existing and unknown usernames.
        subtitle={otp.serverMessage || "If this account exists, an OTP has been sent."}
        ariaLabel="Enter your code"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void otp.verify();
          }}
          className="space-y-3"
        >
          <input
            value={otp.code}
            onChange={(e) => otp.setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={otp.codeLength}
            placeholder="- - - - - -"
            aria-label={`${otp.codeLength}-digit code`}
            disabled={otp.busy || otp.expired}
            autoFocus
            className={`${inputClass} text-2xl font-semibold tracking-[0.5em] indent-[0.5em]`}
          />

          <p className="text-xs text-neutral-500" aria-live="off">
            {otp.expired ? "Code expired" : `Code expires in ${formatClock(otp.secondsLeft)}`}
          </p>

          {otp.error && (
            <p role="alert" className="mx-auto max-w-[20rem] text-sm text-red-600">
              {otp.error}
            </p>
          )}

          <button type="submit" disabled={!canVerify} className={`${pillClass} ${!canVerify ? "opacity-40" : ""}`}>
            {otp.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {otp.busy ? "Verifying…" : "Verify"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void otp.requestCode()}
          disabled={otp.busy || otp.rateLimited}
          className={`${ghostClass} disabled:opacity-40`}
        >
          {otp.rateLimited ? `Too many requests — try again in ${formatClock(otp.lockSeconds)}` : "Resend code"}
        </button>
        <button type="button" onClick={otp.changeUsername} className={ghostClass.replace("mt-2", "mt-0")}>
          Use a different username
        </button>
      </SplashLayout>
    );
  }

  const canSend = otp.username.trim().length > 0 && !otp.busy && !otp.rateLimited;
  return (
    <SplashLayout
      title="Sign in to continue"
      subtitle="Enter your Telegram username and we'll send you a one-time code."
      ariaLabel="Sign in"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void otp.requestCode();
        }}
        className="space-y-3"
      >
        <input
          value={otp.username}
          onChange={(e) => otp.setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Username"
          aria-label="Username"
          disabled={otp.busy}
          className={inputClass}
        />

        {otp.error && (
          <p role="alert" className="mx-auto max-w-[20rem] text-sm text-red-600">
            {otp.error}
          </p>
        )}
        {otp.rateLimited && (
          <p className="text-xs text-neutral-500">You can try again in {formatClock(otp.lockSeconds)}.</p>
        )}

        <button type="submit" disabled={!canSend} className={`${pillClass} ${!canSend ? "opacity-40" : ""}`}>
          {otp.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {otp.busy ? "Sending code…" : "Send code"}
        </button>
      </form>

      <p className="mx-auto mt-3 max-w-[20rem] text-xs leading-snug text-neutral-500">
        Only registered accounts can sign in here. New creator? Open the app in Telegram first to create your account.
      </p>

      {miniAppUrl && (
        <a href={miniAppUrl} target="_blank" rel="noopener noreferrer" className={ghostClass}>
          Open in Telegram instead
        </a>
      )}
      {buyerUrl && (
        <a href={buyerUrl} target="_blank" rel="noopener noreferrer" className={ghostClass.replace("mt-2", miniAppUrl ? "mt-0" : "mt-2")}>
          Open the marketplace
        </a>
      )}
    </SplashLayout>
  );
}

// src/features/auth/components/LoginDialog.tsx

"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Send, ChevronLeft, Sparkles } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useOtpFlow } from "../hooks/useOtpFlow";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
}

export function LoginDialog({ open, onOpenChange, redirectTo = "/catalog" }: LoginDialogProps) {
  const {
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
    reset,
    backToUsername,
  } = useOtpFlow({
    redirectTo,
    onSuccess: () => onOpenChange(false),
  });

  const [shake, setShake] = useState(false);

  const handleRequestOtp = async () => {
    if (!username.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    await requestOtp(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      modal={false}
    >
      <DrawerContent className="border-white/[0.08] bg-[oklch(0.1_0.02_280)]/95 backdrop-blur-xl">
        <DrawerHeader className="mx-auto w-full max-w-sm pb-1 pt-7 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[0.75rem] bg-white text-[oklch(0.08_0.02_280)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <DrawerTitle className="text-[1.25rem] font-semibold tracking-tight text-white">
            {stage === "username" ? "Sign in" : "Enter your code"}
          </DrawerTitle>
          <DrawerDescription className="mt-1 text-[13px] text-white/50">
            {stage === "username"
              ? "We'll send a one-time code to your Telegram."
              : `Sent to @${username}`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="mx-auto w-full max-w-sm px-6 pb-10 pt-4 safe-bottom">
          <AnimatePresence mode="wait">
            {stage === "username" ? (
              <motion.div
                key="username"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
                    Telegram Username
                  </Label>
                  <motion.div animate={shake ? { x: [-5, 5, -3, 3, 0] } : {}} transition={{ duration: 0.35 }}>
                    <Input
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                      placeholder="your_username"
                      className="h-12 rounded-2xl border-white/10 bg-white/[0.06] text-[15px] text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-white/20"
                    />
                  </motion.div>
                </div>

                <AnimatePresence>
                  {signupLink && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                        <p className="text-[13px] leading-snug text-white/70">
                          <span className="font-medium text-white">No account found.</span>{" "}
                          <span className="text-white/50">
                            Sign up via Telegram to get started.
                          </span>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleRequestOtp}
                  disabled={sending}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-[oklch(0.08_0.02_280)] shadow-lg shadow-white/10 transition-all hover:scale-[1.02] hover:shadow-white/20 active:scale-[0.98] disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.1em] text-white/30">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <a
                  href={signupLink ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!signupLink}
                  className={`flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] text-[13px] font-medium text-white/70 backdrop-blur-sm transition hover:bg-white/[0.08] hover:text-white ${
                    !signupLink ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  Open in Telegram
                </a>
              </motion.div>
            ) : (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-5"
              >
                <button
                  onClick={backToUsername}
                  className="self-start flex items-center gap-1 text-[11px] font-medium text-white/40 transition hover:text-white"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>

                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={verifyCode}
                  disabled={verifying}
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className={`h-12 w-10 rounded-xl text-base font-medium text-white transition-all ${
                          otpError
                            ? "border-red-400/60 ring-red-400/20 focus-visible:ring-red-400/40"
                            : "border-white/10 focus-visible:ring-white/20"
                        }`}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                <AnimatePresence>
                  {otpError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[12px] font-medium text-red-400"
                    >
                      {otpError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <p className="h-4 text-[12px] text-white/40">
                  {verifying ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Verifying…
                    </span>
                  ) : (
                    "\\u00A0"
                  )}
                </p>

                {resendCountdown > 0 ? (
                  <p className="text-[12px] text-white/40">
                    Resend in{" "}
                    <span className="font-medium text-white tabular-nums">
                      {resendCountdown}s
                    </span>
                  </p>
                ) : (
                  <button
                    onClick={() => requestOtp(true)}
                    disabled={resending}
                    className="text-[12px] font-medium text-white/60 underline underline-offset-4 transition hover:text-white disabled:opacity-50"
                  >
                    {resending ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Resending…
                      </span>
                    ) : (
                      "Resend code"
                    )}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
// src/features/auth/components/LoginCard.tsx

"use client";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { authApi } from "../api";
import { useAuthStore } from "../store";
import { ApiError } from "@/shared/api/client";

type Stage = "username" | "code";

const DEMO_USERNAME = "user1";
const DEMO_CODE = "123456";

const MINIAPP_HANDLE =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_MINIAPP_HANDLE?: string } }).env
      ?.VITE_MINIAPP_HANDLE) ||
  null;

function getTelegramLink(details?: Record<string, string>): string | null {
  // Prefer link from server error details
  if (details?.signup_link) return details.signup_link;
  // Fall back to env var handle → https://t.me/handle
  if (MINIAPP_HANDLE) return MINIAPP_HANDLE;
  return null;
}

export function LoginCard() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const setToken = useAuthStore((s) => s.setToken);
  const { isReady, isInTelegramMiniApp, webApp } = useTelegram();

  const [stage, setStage] = useState<Stage>("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [signupLink, setSignupLink] = useState<string | null>(null);

  const redirectTo = search.redirect || "/store";

  // Auto-login when running inside Telegram WebApp
  useEffect(() => {
    if (!isReady || !isInTelegramMiniApp()) return;
    const initData = webApp?.initData;
    if (!initData) return;

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
      .finally(() => setTgLoading(false));
  }, [isReady, isInTelegramMiniApp, webApp, setToken, navigate, redirectTo]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    // Clear any previous not-found state
    setSignupLink(null);
    setLoading(true);

    try {
      if (username.trim() === DEMO_USERNAME) {
        toast.success(`Demo account — use code ${DEMO_CODE}`);
        setStage("code");
        return;
      }
      await authApi.requestOtp(username.trim());
      toast.success("Code sent. Check your messages.");
      setStage("code");
    } catch (err) {
      if (err instanceof ApiError && err.data) {
        const body = err.data as {
          error?: { code?: string; message?: string; details?: Record<string, string> };
        };
        if (body?.error?.code === "NOT_FOUND") {
          const link = getTelegramLink(body.error.details);
          setSignupLink(link);
          // Don't toast — we show inline UI instead
          return;
        }
      }
      toast.error((err as Error).message || "Could not request code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      if (username.trim() === DEMO_USERNAME && code.trim() === DEMO_CODE) {
        setToken("demo-token", {
          id: "demo-user-1",
          username: DEMO_USERNAME,
          role: "creator",
        });
        toast.success("Welcome, demo user");
        navigate({ to: redirectTo });
        return;
      }
      const data = await authApi.verifyOtp(username.trim(), code.trim());
      setToken(data.token, data.user);
      toast.success("Welcome back");
      navigate({ to: redirectTo });
    } catch (err) {
      toast.error((err as Error).message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="relative w-full max-w-md"
    >
      <div className="glass-strong rounded-3xl border border-border p-8 shadow-[var(--shadow-elevated)]">
        <div className="mb-7 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sonny</h1>
            <p className="text-xs text-muted-foreground">Design Studio</p>
          </div>
        </div>

        {tgLoading ? (
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing you in with Telegram…
          </div>
        ) : stage === "username" ? (
          <form onSubmit={handleRequest} className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your username — we'll send a one-time code.
              </p>
            </div>

            <Input
              autoFocus
              placeholder="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (signupLink) setSignupLink(null);
              }}
              className="h-12 rounded-xl bg-input/60 text-base"
            />

            {/* Not-found inline notice */}
            <AnimatePresence>
              {signupLink && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-border/60 bg-surface-elevated/60 px-4 py-3 text-sm"
                >
                  <p className="font-medium text-foreground">No account found</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sign up via Telegram to get started.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons — stacks when signup link appears */}
            <div className={`flex gap-2 ${signupLink ? "flex-col" : ""}`}>
              <Button
                type="submit"
                className="h-12 flex-1 rounded-xl text-base font-medium"
                disabled={loading || !username.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Continue"
                )}
              </Button>

              <AnimatePresence>
                {signupLink && (
                  <motion.a
                    href={signupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl  px-4 text-sm font-semibold text-white transition hover:color-[#2a80ee]"
                  >
                    <Send className="h-4 w-4" />
                    Open in Telegram
                  </motion.a>
                )}
              </AnimatePresence>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Enter code</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sent to <span className="text-foreground">{username}</span>.
              </p>
            </div>
            <Input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              className="h-14 rounded-xl bg-input/60 text-center font-mono text-2xl tracking-[0.4em]"
            />
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-medium"
              disabled={loading || code.length < 4}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStage("username");
                setCode("");
              }}
              className="block w-full text-center text-sm text-muted-foreground transition hover:text-foreground"
            >
              Use a different username
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
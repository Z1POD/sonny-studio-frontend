// src/features/auth/components/LoginCard.tsx


"use client";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { authApi } from "../api";
import { useAuthStore } from "../store";

type Stage = "username" | "code";


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
    setLoading(true);
    try {
      await authApi.requestOtp(username.trim());
      toast.success("Code sent. Check your messages.");
      setStage("code");
    } catch (err) {
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
              <h2 className="text-2xl font-semibold tracking-tight">
                Sign in
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your username — we'll send a one-time code.
              </p>
            </div>
            <Input
              autoFocus
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 rounded-xl bg-input/60 text-base"
            />
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-medium"
              disabled={loading || !username.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Enter code
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sent to{" "}
                <span className="text-foreground">{username}</span>.
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
// src/features/auth/components/SplashPage.tsx

"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, Shirt, Palette, ShoppingBag, Sparkles } from "lucide-react";
import { getMiniAppUrl } from "../lib/miniapp";
import { LoginDialog } from "./LoginDialog";

interface SplashPageProps {
  isSigningIn?: boolean;
}

/* ── Floating feature card (decorative) ── */
function FeatureCard({
  icon: Icon,
  label,
  delay,
  x,
  y,
}: {
  icon: React.ElementType;
  label: string;
  delay: number;
  x: string;
  y: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      className="absolute pointer-events-none hidden sm:block"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 backdrop-blur-md shadow-2xl shadow-black/20">
        <Icon className="h-4 w-4 text-white/70" />
        <span className="text-[13px] font-medium text-white/80">{label}</span>
      </div>
    </motion.div>
  );
}

/* ── Main splash page ── */
export function SplashPage({ isSigningIn = false }: SplashPageProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const miniAppUrl = getMiniAppUrl();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0a0a0f] text-white">
      {/* ── Background ── */}

      {/* Static ambient glow spots (CSS only, no JS animation) */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          background: `
            radial-gradient(circle at 20% 35%, rgba(139, 92, 246, 0.18), transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.14), transparent 45%),
            radial-gradient(circle at 60% 80%, rgba(59, 130, 246, 0.12), transparent 55%),
            #0a0a0f
          `,
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* Nav */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="flex items-center justify-between px-6 pt-6 sm:px-8 sm:pt-8"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#0a0a0f]">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Sonny</span>
          </div>
          <button
            onClick={() => setLoginOpen(true)}
            className="text-[13px] font-medium text-white/60 transition hover:text-white"
          >
            Log in
          </button>
        </motion.header>

        {/* Hero */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-6">
          {/* Floating feature cards */}
          <FeatureCard icon={Palette} label="Design" delay={0.4} x="8%" y="18%" />
          <FeatureCard icon={Shirt} label="Preview" delay={0.55} x="72%" y="12%" />
          <FeatureCard icon={ShoppingBag} label="Sell" delay={0.7} x="65%" y="55%" />
          <FeatureCard icon={Sparkles} label="Create" delay={0.85} x="12%" y="58%" />

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
            className="text-center"
          >
            <h1 className="text-[clamp(2.5rem,8vw,5.5rem)] font-bold leading-[1.05] tracking-tighter">
              Design your
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent">
                next drop.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-white/50 sm:max-w-md sm:text-base">
              Create custom apparel, preview it in real-time, and sell to your
              audience — all from one studio.
            </p>
          </motion.div>
        </div>

        {/* ── Bottom CTA with frosted blur fade ── */}
        <div className="relative">
          {/* Frosted blur overlay fading upward */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 -top-40"
            style={{
              background:
                "linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.8) 20%, rgba(10,10,15,0.45) 45%, rgba(10,10,15,0.15) 70%, transparent 100%)",
              backdropFilter: "blur(24px) saturate(1.3)",
              WebkitBackdropFilter: "blur(24px) saturate(1.3)",
              maskImage: "linear-gradient(to top, black 0%, black 25%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to top, black 0%, black 25%, transparent 100%)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 px-6 pb-10 pt-6 text-center sm:pb-14"
          >
            <div className="mx-auto flex w-full max-w-xs flex-col gap-3 sm:max-w-sm">
              {isSigningIn ? (
                <div
                  aria-live="polite"
                  className="flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-white/10 text-[15px] font-semibold text-white/70 backdrop-blur-sm"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </div>
              ) : (
                <a
                  href={miniAppUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!miniAppUrl}
                  className={`group flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-[#0a0a0f] shadow-lg shadow-white/10 transition-all hover:scale-[1.02] hover:shadow-white/20 active:scale-[0.98] ${
                    !miniAppUrl ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  Get Started
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              )}

              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                disabled={isSigningIn}
                className="flex h-[3.25rem] w-full items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.04] text-[15px] font-medium text-white/70 backdrop-blur-sm transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
              >
                Already have an account?
                <span className="ml-1 font-semibold text-white">Log in</span>
              </button>
            </div>

            <p className="mt-5 text-[11px] text-white/25">
              By continuing, you agree to our Terms and Privacy Policy.
            </p>
          </motion.div>
        </div>
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
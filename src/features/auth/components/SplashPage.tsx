// src/features/auth/components/SplashPage.tsx

"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Shirt, Palette, ShoppingBag, Sparkles, ShoppingCart, Truck } from "lucide-react";
import { BrandLoader } from "@/components/ui/loader";
import { getMiniAppUrl } from "../lib/miniapp";
import { LoginDialog } from "./LoginDialog";

interface SplashPageProps {
  isTelegramLaunching?: boolean;
}

/*    Floating feature card (decorative)    */
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
      className="absolute pointer-events-none sm:block"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 backdrop-blur-md shadow-2xl shadow-black/20">
        <Icon className="h-4 w-4 text-white/70" />
        <span className="text-[13px] font-medium text-white/80">{label}</span>
      </div>
    </motion.div>
  );
}

/*    Main splash page    */
export function SplashPage({ isTelegramLaunching = false }: SplashPageProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const miniAppUrl = getMiniAppUrl();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#083b32] text-white">
      {/*    Background    */}
      <div
        className="absolute inset-0 -z-30 bg-cover bg-center"
        />

        {/* Dark cinematic overlay */}
        <div className="absolute inset-0 -z-20 bg-black/60" />

        {/* Luxury gold glow */}
        <div
        className="absolute inset-0 -z-10"
        style={{
            background: `
            radial-gradient(circle at 25% 18%, rgba(212,175,55,.22), transparent 40%),
            radial-gradient(circle at 78% 25%, rgba(255,232,170,.12), transparent 35%),
            linear-gradient(
                to bottom,
                rgba(0,0,0,.25),
                rgba(0,0,0,.45),
                rgba(0,0,0,.82)
            )
            `,
        }}
        />


      {/*    Content    */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* Nav */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="flex items-center justify-center px-6 pt-6 sm:px-8 sm:pt-8"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-semibold tracking-tight">M I M O</span>
          </div>
        </motion.header>

        {/* Hero */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-6">
          {/* Floating feature cards */}
          <FeatureCard icon={Palette} label="Design" delay={0.4} x="8%" y="18%" />
          <FeatureCard icon={Shirt} label="Mockups" delay={0.55} x="72%" y="12%" />
          <FeatureCard icon={ShoppingCart} label="Order" delay={0.3} x="35%" y="85%" />
          <FeatureCard icon={ShoppingBag} label="Sell" delay={0.7} x="75%" y="65%" />
          <FeatureCard icon={Sparkles} label="Create" delay={0.85} x="12%" y="58%" />

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
            className="text-center"
          >
            <h1 className="text-[clamp(2.5rem,8dvw,5.5rem)] font-bold leading-[1.05] tracking-tighter text-white">
              Design your
              <br />
              <span className="bg-gradient-to-b from-[#FFF2C2] via-[#D4AF37] to-[#4A3B17] bg-clip-text text-transparent">
                next drop.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-white/50 hidden sm:block sm:max-w-md sm:text-base">
              Create custom apparel, preview it in real-time, and order it for yourself or sell to your
              audience — all from one studio.
            </p>
          </motion.div>
        </div>

        {/*    Bottom CTA with frosted blur fade    */}
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
              {isTelegramLaunching ? (
                <>
                <div
                  aria-live="polite"
                  className="flex h-[3.25rem] w-full items-center justify-center"
                >
                  <BrandLoader size="md" />
                </div>
                <div className="relative z-10 w-full max-w-sm pb-5">
                  <div className="relative h-6 overflow-hidden">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
        
                    <motion.div
                      className="absolute top-0"
                      animate={{
                        x: ["-10%", "1110%"],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-sm bg-emerald-300/60" />
                        <Truck className="h-5 w-5 text-amber-300/70" />
                      </div>
                    </motion.div>
                  </div>
                </div>
                </>
              ) : (
                <>
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

                  <button
                    type="button"
                    onClick={() => setLoginOpen(true)}
                    className="flex h-[3.25rem] w-full items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.04] text-[15px] font-medium text-white/70 backdrop-blur-sm transition hover:bg-white/[0.08] hover:text-white"
                  >
                    Already have an account?
                    <span className="ml-1 font-semibold text-white">Log in</span>
                  </button>
                </>
              )}
            </div>

            {!isTelegramLaunching && (
              <p className="mt-5 text-[11px] text-white/25">
                By continuing, you agree to our Terms and Privacy Policy.
              </p>
            )}
          </motion.div>
        </div>
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
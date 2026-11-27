// src/features/auth/components/SplashLayout.tsx
//
// Shared visual shell for the splash and sign-in screens: 3 long vertical column strips on top, a white
// sheet below with headline, subtitle, optional 3-step progress bars and an action area.

"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Import your 3 long vertical column strip images from src/assets/splash
import col1Img from "@/assets/splash/col-1.1.png";
import col2Img from "@/assets/splash/col-2.2.png";
import col3Img from "@/assets/splash/col-3.3.png";

type Column = {
  offset: string;
  motion: string;
  src: string;
};

const COLUMNS: Column[] = [
  {
    offset: "-mt-16",
    motion: "splash-drift-up",
    src: col1Img,
  },
  {
    offset: "-mt-64",
    motion: "splash-drift-down",
    src: col2Img,
  },
  {
    offset: "-mt-8",
    motion: "splash-drift-up",
    src: col3Img,
  },
];

export interface SplashProgress {
  /** 0–3: how many stages are complete */
  stage: number;
  /** show the sweeping indicator on the current bar */
  running: boolean;
}

interface SplashLayoutProps {
  title: string;
  subtitle: string;
  ariaLabel: string;
  progress?: SplashProgress;
  /** Buttons / messages shown under the progress bars. */
  children: React.ReactNode;
}

export function SplashLayout({ title, subtitle, ariaLabel, progress, children }: SplashLayoutProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-[#e9e9e9] text-[#111]"
      role="status"
      aria-label={ariaLabel}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[460px] flex-col overflow-hidden md:max-w-none">
        {/* Collage */}
        <div className="relative min-h-0 flex-1 " aria-hidden>
          <div className="absolute -top-[6%] left-1/2 h-[125%] w-[128%] -translate-x-1/2 -rotate-[-8deg] md:w-[110%] lg:w-[105%]">
            <div className="grid h-full grid-cols-3 gap-3 lg:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => COLUMNS[i % COLUMNS.length]).map(
                (col, ci) => (
                  <div
                    key={ci}
                    className={cn(
                      "flex flex-col gap-3",
                      col.offset,
                      col.motion
                    )}
                  >
                    <div className="h-full w-full shrink-0 overflow-hidden rounded-[28px] bg-white/60">
                      <img
                        src={col.src}
                        alt=""
                        decoding="async"
                        draggable={false}
                        className="h-full w-full object-cover mix-blend-multiply"
                        style={{
                          transform: `scale(1.15)`,
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Sheet */}
        <motion.section
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 30,
            delay: 0.1,
          }}
          className="relative z-10 -mt-9 rounded-t-[2.25rem] bg-white px-6 pt-10 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.18)] md:px-10 lg:mx-auto lg:w-full lg:max-w-5xl lg:rounded-[2.25rem]"
        >
          <h1 className="text-balance text-[32px] font-semibold leading-[1.14] tracking-tight">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-[20rem] text-balance text-[17px] font-light leading-snug text-neutral-500">
            {subtitle}
          </p>

          {progress && (
            <div
              role="progressbar"
              aria-label="Loading progress"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={progress.stage}
              className="mt-7 flex items-center justify-center gap-1.5"
            >
              {[0, 1, 2].map((i) => {
                const done = progress.stage > i;
                const active = progress.stage === i && progress.running;

                return (
                  <span
                    key={i}
                    className="relative h-[3px] w-12 overflow-hidden rounded-full bg-black/15"
                  >
                    <span
                      className={cn(
                        "absolute inset-0 origin-left rounded-full bg-black transition-transform duration-500 ease-out",
                        done ? "scale-x-100" : "scale-x-0"
                      )}
                    />
                    {active && (
                      <span className="splash-sweep absolute inset-y-0 left-0 w-2/5 rounded-full bg-black/60" />
                    )}
                  </span>
                );
              })}
            </div>
          )}

          <div className={progress ? "mt-5" : "mt-7"}>{children}</div>
        </motion.section>
      </div>
    </div>
  );
}

/** The black pill used by both screens. */
export const pillClass =
  "flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#111] text-base font-medium text-white transition-transform active:scale-[0.98] disabled:cursor-default";
export const ghostClass = "mt-2 flex h-11 w-full items-center justify-center text-sm font-medium text-neutral-600";
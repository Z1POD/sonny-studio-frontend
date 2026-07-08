/**
 * src/shared/components/NotFoundPage.tsx
 *
 * Fashion-forward 404 page with grid background and smooth animations.
 */

import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shirt, ArrowLeft, Sparkles } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
        aria-hidden
      />

      {/* Gradient orbs */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" aria-hidden />

      <div className="relative z-10 max-w-md text-center">
        {/* Animated 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mb-8 inline-flex"
        >
          <div className="flex items-center justify-center rounded-3xl border border-border/50 bg-surface-elevated/80 px-8 py-6 backdrop-blur-xl">
            <span className="bg-gradient-to-br from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-7xl font-bold tracking-tighter text-transparent sm:text-8xl">
              404
            </span>
          </div>
          {/* Floating sparkle */}
          <motion.div
            animate={{ y: [0, -8, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-3 -top-3"
          >
            <Sparkles className="h-5 w-5 text-primary/60" />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          Page not found
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-3 text-sm leading-relaxed text-muted-foreground"
        >
          This piece seems to have left the collection. Let's get you back to the studio.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          <Link
            to="/designs"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Shirt className="h-4 w-4" />
            Back to Studio
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </motion.div>
      </div>
    </div>
  );
}

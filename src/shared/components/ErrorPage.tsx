/**
 * src/shared/components/ErrorPage.tsx
 *
 * Fashion-forward error boundary with grid background and recovery options.
 */

import { useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, Home, Shirt } from "lucide-react";

interface ErrorPageProps {
  error: Error;
  reset: () => void;
}

export function ErrorPage({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  const handleRetry = () => {
    router.invalidate();
    reset();
  };

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
      <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-destructive/10 blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-1/3 h-96 w-96 rounded-full bg-primary/5 blur-[120px]" aria-hidden />

      <div className="relative z-10 max-w-md text-center">
        {/* Animated error icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-8 inline-flex"
        >
          <div className="flex items-center justify-center rounded-3xl border border-destructive/20 bg-destructive/5 px-8 py-6 backdrop-blur-xl">
            <AlertTriangle className="h-12 w-12 text-destructive/70" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          Something went wrong
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-3 text-sm leading-relaxed text-muted-foreground"
        >
          {error.message || "An unexpected error occurred. We're working on a fix."}
        </motion.p>

        {/* Error details (collapsed, for debugging) */}
        {process.env.NODE_ENV === "development" && (
          <motion.details
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-left"
          >
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              Stack trace
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-border bg-surface p-3 text-[11px] text-muted-foreground">
              {error.stack}
            </pre>
          </motion.details>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <a
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            Go Home
          </a>
        </motion.div>
      </div>
    </div>
  );
}

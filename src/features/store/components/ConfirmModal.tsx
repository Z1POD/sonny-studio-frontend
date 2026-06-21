/**
 * src/features/store/components/ConfirmModal.tsx
 *
 * Reusable confirmation bottom-sheet / modal.
 * Usage:
 *   const [confirm, ConfirmModal] = useConfirm();
 *   await confirm({ title: "Delete?", description: "...", danger: true });
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Resolver = (confirmed: boolean) => void;

export function useConfirm(): [
  (opts: ConfirmOptions) => Promise<boolean>,
  React.ReactElement,
] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const resolve = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpts(null);
  };

  const modal = (
    <AnimatePresence>
      {opts && (
        <>
          {/* Backdrop */}
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={() => resolve(false)}
          />

          {/* Sheet — bottom on mobile, centred on desktop */}
          <motion.div
            key="confirm-sheet"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            className="fixed inset-x-0 bottom-0 z-[61] overflow-hidden rounded-t-3xl border border-border/60 bg-surface shadow-2xl md:inset-x-auto md:left-1/2 md:bottom-auto md:top-1/2 md:w-[400px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
          >
            {/* Mobile handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            <div className="px-6 pb-8 pt-5 md:pt-6">
              {/* Icon */}
              <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
                opts.danger ? "bg-red-500/10" : "bg-primary/10"
              }`}>
                {opts.danger
                  ? <AlertTriangle className="h-6 w-6 text-red-500" />
                  : <Info className="h-6 w-6 text-primary" />
                }
              </div>

              <h3 className="text-center text-base font-semibold">{opts.title}</h3>
              {opts.description && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {opts.description}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  onClick={() => resolve(true)}
                  variant={opts.danger ? "destructive" : "default"}
                  className="w-full"
                >
                  {opts.confirmLabel ?? (opts.danger ? "Delete" : "Confirm")}
                </Button>
                <Button
                  onClick={() => resolve(false)}
                  variant="ghost"
                  className="w-full text-muted-foreground"
                >
                  {opts.cancelLabel ?? "Cancel"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return [confirm, modal];
}
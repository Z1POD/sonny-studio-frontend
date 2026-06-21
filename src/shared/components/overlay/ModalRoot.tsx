// src/shared/components/overlay/ModalRoot.tsx

"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useOverlayStore } from "@/shared/stores/overlay-store";

const SIZE_CLASS: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function ModalRoot() {
  const modals = useOverlayStore((s) => s.modals);
  const closeModal = useOverlayStore((s) => s.closeModal);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modals.length) {
        const top = modals[modals.length - 1];
        if (top.dismissible !== false) closeModal(top.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modals, closeModal]);

  return (
    <AnimatePresence>
      {modals.map((m) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[220] flex items-center justify-center px-4"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => m.dismissible !== false && closeModal(m.id)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "relative w-full glass-strong rounded-2xl border border-border shadow-[var(--shadow-elevated)] overflow-hidden",
              SIZE_CLASS[m.size ?? "md"],
            )}
          >
            {(m.title || m.dismissible !== false) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
                <div className="min-w-0">
                  {m.title && (
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      {m.title}
                    </h2>
                  )}
                  {m.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m.description}
                    </p>
                  )}
                </div>
                {m.dismissible !== false && (
                  <button
                    type="button"
                    onClick={() => closeModal(m.id)}
                    className="-mr-2 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className="px-6 pb-6 max-h-[100%] overflow-auto">{m.content}</div>
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

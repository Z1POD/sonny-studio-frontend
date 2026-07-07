// src/shared/components/overlay/SheetRoot.tsx


"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useOverlayStore } from "@/shared/stores/overlay-store";

export function SheetRoot() {
  const sheets = useOverlayStore((s) => s.sheets);
  const closeSheet = useOverlayStore((s) => s.closeSheet);

  return (
    <AnimatePresence>
      {sheets.map((s) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => s.dismissible !== false && closeSheet(s.id)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="relative w-full sm:max-w-lg glass-strong rounded-t-3xl sm:rounded-2xl border border-border safe-bottom shadow-[var(--shadow-elevated)] overflow-hidden"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 && s.dismissible !== false) {
                closeSheet(s.id);
              }
            }}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border-strong" />
            {s.title && (
              <div className="px-6 pt-4">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  {s.title}
                </h2>
                {s.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                )}
              </div>
            )}
            <div className="max-h-[80dvh] overflow-y-auto px-6 py-5">
              {s.content}
            </div>
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

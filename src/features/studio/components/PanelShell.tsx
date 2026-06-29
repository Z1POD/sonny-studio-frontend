// src/features/studio/components/PanelShell.tsx

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface PanelShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;

  dismissible?: boolean; // default: true
}

/**
 * Shared slide-out panel container.
 * Desktop: slides in from the right edge, anchored top-right.
 * Mobile: slides up from the bottom as a floating sheet (not full-height).
 */
export function PanelShell({
    open,
    onClose,
    title,
    subtitle,
    children,
    dismissible = true,
  }: PanelShellProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-auto fixed inset-0 z-30 bg-black/40"
              onClick={dismissible ? onClose : undefined}
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              drag={dismissible ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={
                dismissible
                  ? (_, info) => {
                      if (info.offset.y > 80) onClose();
                    }
                  : undefined
              }
              className="pointer-events-auto fixed inset-x-0 bottom-20 z-40 mx-3 max-h-[60vh] overflow-hidden rounded-2xl border border-border/60 shadow-elevated glass-light"
            >
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{subtitle ?? "Studio"}</p>
                  <h2 className="text-sm font-semibold">{title}</h2>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="max-h-[calc(60vh-4.5rem)] overflow-y-auto px-4 py-4 backdrop-blur-xl no-scrollbar">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          className="pointer-events-auto absolute right-4 top-4 z-20 w-[320px] max-w-[90vw]"
        >
          <div className="glass-light overflow-hidden rounded-2xl border border-border/60 shadow-elevated backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{subtitle ?? "Studio"}</p>
                <h2 className="text-sm font-semibold">{title}</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-5 py-4 no-scrollbar">
              {children}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
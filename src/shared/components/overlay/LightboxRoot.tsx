// src/shared/components/overlay/LightboxRoot.tsx

"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { useOverlayStore } from "@/shared/stores/overlay-store";

export function LightboxRoot() {
  const lightbox = useOverlayStore((s) => s.lightbox);
  const close = useOverlayStore((s) => s.closeLightbox);
  const setIndex = useOverlayStore((s) => s.setLightboxIndex);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft")
        setIndex(Math.max(0, lightbox.index - 1));
      if (e.key === "ArrowRight")
        setIndex(Math.min(lightbox.images.length - 1, lightbox.index + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, close, setIndex]);

  return (
    <AnimatePresence>
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/92 backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {lightbox.images.length > 1 && lightbox.index > 0 && (
            <button
              type="button"
              onClick={() => setIndex(lightbox.index - 1)}
              className="absolute left-4 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {lightbox.images.length > 1 &&
            lightbox.index < lightbox.images.length - 1 && (
              <button
                type="button"
                onClick={() => setIndex(lightbox.index + 1)}
                className="absolute right-4 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

          <motion.div
            key={lightbox.index}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="flex max-h-[92vh] max-w-[92vw] flex-col items-center"
          >
            <img
              src={lightbox.images[lightbox.index].src}
              alt={lightbox.images[lightbox.index].alt ?? ""}
              className="max-h-[82vh] max-w-[92vw] rounded-xl object-contain"
            />
            {lightbox.images[lightbox.index].caption && (
              <p className="mt-3 text-sm text-white/80">
                {lightbox.images[lightbox.index].caption}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

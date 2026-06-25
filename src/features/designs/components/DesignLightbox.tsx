/**
 * src/features/designs/components/DesignLightbox.tsx
 *
 * Full-screen image lightbox with prev/next navigation for mockup images.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface DesignLightboxProps {
  images: { url: string; label?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

export function DesignLightbox({ images, initialIndex = 0, onClose }: DesignLightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const [dir, setDir] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const go = (d: number) => {
    setDir(d);
    setIdx((i) => (i + d + images.length) % images.length);
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? "60%" : "-60%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-60%" : "60%", opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 backdrop-blur"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Image */}
      <AnimatePresence mode="popLayout" custom={dir}>
        <motion.div
          key={idx}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="flex max-h-[85dvh] max-w-[90vw] items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={images[idx].url}
            alt={images[idx].label ?? `Mockup ${idx + 1}`}
            className="max-h-[85dvh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
          />
        </motion.div>
      </AnimatePresence>

      {/* Prev/Next */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setDir(i > idx ? 1 : -1); setIdx(i); }}
              className={`h-12 w-12 overflow-hidden rounded-xl border-2 transition ${
                i === idx ? "border-white" : "border-white/20 opacity-50"
              }`}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
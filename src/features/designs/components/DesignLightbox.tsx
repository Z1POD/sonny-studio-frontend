// src/features/designs/components/DesignLightbox.tsx

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface DesignLightboxProps {
  images: { url: string; label?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

export function DesignLightbox({ images, initialIndex = 0, onClose }: DesignLightboxProps) {
  const [idx, setIdx] = useState(initialIndex);

  const go = (d: number) => setIdx((i) => (i + d + images.length) % images.length);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/95 backdrop-blur data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[80] flex items-center justify-center outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") go(-1);
            if (e.key === "ArrowRight") go(1);
          }}
        >
          <DialogPrimitive.Title className="sr-only">Design mockup preview</DialogPrimitive.Title>

          {/* Close */}
          <DialogPrimitive.Close
            className="absolute top-16 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
              {idx + 1} / {images.length}
            </div>
          )}

          {/* Image — stopPropagation so clicking the image itself doesn't dismiss */}
          <div
            className="flex max-h-[85dvh] max-w-[90vw] aspect-[4/5] items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TransformWrapper
              key={idx}
              initialScale={1}
              minScale={1}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "zoomIn" }}
              pinch={{ step: 5 }}
              wheel={{ disabled: true }}
            >
              <TransformComponent
                wrapperClass="!h-full !w-full !overflow-hidden"
                contentClass="flex items-center justify-center !h-full !w-full"
              >
                <img
                  src={images[idx].url}
                  alt={images[idx].label ?? `Mockup ${idx + 1}`}
                  className="w-full h-full object-cover max-h-[85dvh] max-w-[90dvw] rounded-2xl object-contain shadow-2xl select-none"
                  draggable={false}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>

          {/* Prev/Next */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Thumbnails */}
          {images.length > 1 && (
            <div
              className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-12 w-12 overflow-hidden rounded-xl border-2 transition ${
                    i === idx ? "border-white" : "border-white/20 opacity-50"
                  }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
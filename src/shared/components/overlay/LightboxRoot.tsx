// src/shared/components/overlay/LightboxRoot.tsx

"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOverlayStore } from "@/shared/stores/overlay-store";

export function LightboxRoot() {
  const lightbox = useOverlayStore((s) => s.lightbox);
  const close = useOverlayStore((s) => s.closeLightbox);
  const setIndex = useOverlayStore((s) => s.setLightboxIndex);

  if (!lightbox) return null;

  const current = lightbox.images[lightbox.index];

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[220] bg-black/92 backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[220] flex items-center justify-center outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={close}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setIndex(Math.max(0, lightbox.index - 1));
            if (e.key === "ArrowRight")
              setIndex(Math.min(lightbox.images.length - 1, lightbox.index + 1));
          }}
        >
          <DialogPrimitive.Title className="sr-only">Image preview</DialogPrimitive.Title>

          {lightbox.images.length > 1 && lightbox.index > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex(lightbox.index - 1);
              }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(lightbox.index + 1);
                }}
                className="absolute right-4 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

          {/* stopPropagation here so clicking the image/caption itself doesn't dismiss —
              only clicks on the surrounding backdrop (the Content element) do. */}
          <div
            className="flex max-h-[92dvh] max-w-[92dvw] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <DialogPrimitive.Close
              className="z-10 mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
            <img
              src={current.src}
              alt={current.alt ?? ""}
              className="max-h-[82dvh] max-w-[92dvw] rounded-xl object-contain"
            />
            {current.caption && (
              <p className="mt-3 text-sm text-white/80">{current.caption}</p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
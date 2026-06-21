import { useOverlayStore } from "@/shared/stores/overlay-store";

export const useModal = () => {
  const openModal = useOverlayStore((s) => s.openModal);
  const closeModal = useOverlayStore((s) => s.closeModal);
  return { open: openModal, close: closeModal };
};

export const useSheet = () => {
  const openSheet = useOverlayStore((s) => s.openSheet);
  const closeSheet = useOverlayStore((s) => s.closeSheet);
  return { open: openSheet, close: closeSheet };
};

export const useLightbox = () => {
  const openLightbox = useOverlayStore((s) => s.openLightbox);
  const closeLightbox = useOverlayStore((s) => s.closeLightbox);
  return { open: openLightbox, close: closeLightbox };
};

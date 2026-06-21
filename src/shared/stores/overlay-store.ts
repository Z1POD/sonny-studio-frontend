/**
 * Centralized overlay system — modals, bottom sheets, and the image lightbox
 * all flow through a single Zustand store. Features push payloads via the
 * `useModal`, `useSheet`, and `useLightbox` hooks; the OverlayRoot in the
 * app shell renders them.
 */
import type { ReactNode } from "react";
import { create } from "zustand";

export type OverlaySize = "sm" | "md" | "lg" | "xl";

interface ModalPayload {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  content: ReactNode;
  size?: OverlaySize;
  dismissible?: boolean;
}

interface SheetPayload {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  content: ReactNode;
  dismissible?: boolean;
}

interface LightboxImage {
  src: string;
  alt?: string;
  caption?: string;
}

interface OverlayState {
  modals: ModalPayload[];
  sheets: SheetPayload[];
  lightbox: { images: LightboxImage[]; index: number } | null;
  openModal: (payload: Omit<ModalPayload, "id"> & { id?: string }) => string;
  closeModal: (id: string) => void;
  openSheet: (payload: Omit<SheetPayload, "id"> & { id?: string }) => string;
  closeSheet: (id: string) => void;
  openLightbox: (images: LightboxImage[], index?: number) => void;
  closeLightbox: () => void;
  setLightboxIndex: (index: number) => void;
}

let nextId = 0;
const genId = (prefix: string) => `${prefix}-${++nextId}`;

export const useOverlayStore = create<OverlayState>((set) => ({
  modals: [],
  sheets: [],
  lightbox: null,
  openModal: (payload) => {
    const id = payload.id ?? genId("modal");
    set((s) => ({
      modals: [
        ...s.modals.filter((m) => m.id !== id),
        { dismissible: true, size: "md", ...payload, id },
      ],
    }));
    return id;
  },
  closeModal: (id) =>
    set((s) => ({ modals: s.modals.filter((m) => m.id !== id) })),
  openSheet: (payload) => {
    const id = payload.id ?? genId("sheet");
    set((s) => ({
      sheets: [
        ...s.sheets.filter((m) => m.id !== id),
        { dismissible: true, ...payload, id },
      ],
    }));
    return id;
  },
  closeSheet: (id) =>
    set((s) => ({ sheets: s.sheets.filter((m) => m.id !== id) })),
  openLightbox: (images, index = 0) => set({ lightbox: { images, index } }),
  closeLightbox: () => set({ lightbox: null }),
  setLightboxIndex: (index) =>
    set((s) =>
      s.lightbox ? { lightbox: { ...s.lightbox, index } } : { lightbox: null },
    ),
}));

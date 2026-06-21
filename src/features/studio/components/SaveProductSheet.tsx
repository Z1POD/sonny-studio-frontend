/**
 * src/features/studio/components/SaveProductSheet.tsx
 *
 * Wrapper that renders SaveProductDialog as a bottom-sheet on mobile
 * and as a modal on desktop. Uses the overlay store for lifecycle management.
 */

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useOverlayStore } from "@/shared/stores/overlay-store";
import { SaveProductDialog, type Props as SaveProductDialogProps } from "./SaveProductDialog";

interface SaveProductSheetProps extends SaveProductDialogProps {
  /** Called when the sheet/modal should close */
  onClose: () => void;
}

export function SaveProductSheet(props: SaveProductSheetProps) {
  const { onClose, modalId, ...dialogProps } = props;
  const closeModal = useOverlayStore((s) => s.closeModal);

  const handleClose = useCallback(() => {
    closeModal(modalId);
    onClose();
  }, [closeModal, modalId, onClose]);

  return (
    <motion.div
      key="save-product-sheet"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Sheet container — bottom on mobile, centered modal on desktop */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="relative z-10 w-full max-h-[92dvh] overflow-hidden rounded-t-3xl border border-border/60 bg-surface shadow-2xl md:w-[600px] md:max-h-[85vh] md:rounded-3xl"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <h2 className="text-base font-semibold">Save Product</h2>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(92dvh - 60px)" }}>
          <SaveProductDialog
            {...dialogProps}
            modalId={modalId}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

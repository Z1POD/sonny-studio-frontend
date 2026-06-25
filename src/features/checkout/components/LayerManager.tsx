// src/features/checkout/components/LayerManager.tsx
/**
 * LayerManager.tsx
 *
 * A clean, minimalist layer management drawer for the studio.
 * Allows users to manage artwork layers per print area.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, X, Eye, EyeOff, GripVertical, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/features/studio/store";

interface LayerManagerProps {
  open: boolean;
  onClose: () => void;
}

export function LayerManager({ open, onClose }: LayerManagerProps) {
  const store = useStudioStore();
  const product = store.product;
  const artworks = store.artworks;

  const activeLayers = product?.printAreas
    .filter((area) => artworks[area.id]?.decalUrl)
    .map((area) => ({
      id: area.id,
      name: area.name,
      areaKey: area.areaKey,
      artwork: artworks[area.id],
    })) ?? [];

  const handleDeleteLayer = (areaId: string) => {
    store.setArtwork(areaId, {
      decalUrl: "",
      decalAspect: 1,
      decalScale: 0.15,
      decalRotation: 0,
      decalOffsetX: 0,
      decalOffsetY: 0,
    });
  };

  const handleSelectLayer = (areaId: string) => {
    store.setSelectedPrintArea(areaId);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[60%] rounded-t-3xl border-t border-border bg-background shadow-2xl"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Layers</h3>
                <span className="text-[10px] text-muted-foreground">
                  {activeLayers.length} active
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Layer List */}
            <div className="overflow-y-auto px-4 py-3 pb-8 no-scrollbar">
              {activeLayers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Layers className="h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">No artwork layers yet</p>
                  <p className="text-[11px] text-muted-foreground">
                    Add artwork from the library to see layers here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeLayers.map((layer, index) => (
                    <motion.div
                      key={layer.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`group flex items-center gap-3 rounded-xl border p-3 transition-all ${
                        store.selectedPrintAreaId === layer.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-surface hover:border-foreground/20"
                      }`}
                    >
                      {/* Drag Handle */}
                      <GripVertical className="h-4 w-4 text-muted-foreground/40" />

                      {/* Thumbnail */}
                      <div
                        className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border/40 bg-surface-overlay"
                        style={{ aspectRatio: layer.artwork.decalAspect }}
                      >
                        {layer.artwork.decalUrl ? (
                          <img
                            src={layer.artwork.decalUrl}
                            alt={layer.name}
                            className="h-full w-full object-contain"
                          />
                        ) : null}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1" onClick={() => handleSelectLayer(layer.id)}>
                        <p className="text-sm font-medium">{layer.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {layer.areaKey} · Scale {(layer.artwork.decalScale * 100).toFixed(0)}%
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDeleteLayer(layer.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          title="Delete layer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Inactive print areas */}
              {product && activeLayers.length < product.printAreas.length && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Available areas
                  </p>
                  <div className="space-y-1">
                    {product.printAreas
                      .filter((p) => !artworks[p.id]?.decalUrl)
                      .map((area) => (
                        <button
                          key={area.id}
                          onClick={() => handleSelectLayer(area.id)}
                          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-3 py-2.5 text-left transition hover:border-foreground/20"
                        >
                          <div className="h-8 w-8 flex-shrink-0 rounded-lg border border-border/40 bg-surface-overlay" />
                          <div>
                            <p className="text-sm text-muted-foreground">{area.name}</p>
                            <p className="text-[11px] text-muted-foreground/60">
                              {area.widthCm}×{area.heightCm}cm
                            </p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
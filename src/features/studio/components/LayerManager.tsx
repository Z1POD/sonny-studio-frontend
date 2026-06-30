// src/features/studio/components/LayerManager.tsx
/**
 * LayerManager.tsx — v2
 *
 * Proper layer management with:
 * - Visual z-index stack (higher index = rendered on top)
 * - Layer reordering via up/down controls
 * - "Full wrap" badge when placement === "full"
 * - Thumbnail preview with overlay warning when a logo sits atop a full wrap
 * - Tap a layer to jump to that print area
 */

import { useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Layers, X, GripVertical, Trash2, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudioStore, getDefaultArtwork } from "@/features/studio/store";

interface LayerManagerProps {
  open: boolean;
  onClose: () => void;
}

export function LayerManager({ open, onClose }: LayerManagerProps) {
  const store = useStudioStore();
  const product = store.product;
  const artworks = store.artworks;

  // Build ordered layer list — sorted by sortOrder then by whether they have artwork
  // We derive z-index from position in this array (index 0 = bottom, last = top)
  const activeLayers = (product?.printAreas ?? [])
    .filter((area) => artworks[area.id]?.decalUrl)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((area, index) => ({
      id: area.id,
      name: area.name,
      areaKey: area.areaKey,
      placement: area.placement,
      widthCm: area.widthCm,
      heightCm: area.heightCm,
      artwork: artworks[area.id],
      zIndex: index,
    }));

  // Warn when a "full" wrap exists alongside other layers (logo on top of full-wrap)
  const hasFullWrap = activeLayers.some((l) => l.placement === "full");
  const hasOverlap = hasFullWrap && activeLayers.length > 1;

  const handleDelete = (areaId: string) => {
    store.setArtwork(areaId, getDefaultArtwork());
  };

  const handleSelect = (areaId: string) => {
    store.setSelectedPrintArea(areaId);
    onClose();
  };

  // Reorder: swap with adjacent layer by updating sortOrder via setArtwork workaround
  // Since sortOrder lives on the product (read-only here), we track order in local state
  const [order, setOrder] = useState<string[]>([]);

  // Sync order with activeLayers on open
  const effectiveOrder =
    order.length > 0 && order.every((id) => activeLayers.find((l) => l.id === id))
      ? order
      : activeLayers.map((l) => l.id);

  const orderedLayers = effectiveOrder
    .map((id) => activeLayers.find((l) => l.id === id))
    .filter(Boolean) as typeof activeLayers;

  const moveLayer = (index: number, direction: "up" | "down") => {
    const next = [...effectiveOrder];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    setOrder(next);
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
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[65%] rounded-t-3xl backdrop-blur-xl border-t border-border shadow-2xl shadow-elevated"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border/60" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Layers</h3>
                <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-muted-foreground">
                  {orderedLayers.length}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-y-auto px-4 py-3 pb-10 no-scrollbar">
              {/* Full-wrap overlap warning */}
              <AnimatePresence>
                {hasOverlap && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-600 dark:text-amber-400"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      A <strong>full-wrap</strong> layer is active. Layers above it will be composited on top —
                      make sure your logo is the <strong>topmost</strong> layer.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {orderedLayers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Layers className="h-10 w-10 text-muted-foreground/20" />
                  <p className="mt-3 text-sm text-muted-foreground">No layers yet</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Add artwork from the library to see layers here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Render top-to-bottom (highest z first) */}
                  {[...orderedLayers].reverse().map((layer, reversedIndex) => {
                    const index = orderedLayers.length - 1 - reversedIndex;
                    const isTop = index === orderedLayers.length - 1;
                    const isBottom = index === 0;
                    const isFullWrap = layer.placement === "full";
                    const isSelected = store.selectedPrintAreaId === layer.id;

                    return (
                      <motion.div
                        key={layer.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reversedIndex * 0.04 }}
                        className={`group flex items-center gap-3 rounded-2xl border p-3 transition-all ${
                          isSelected
                            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/50 bg-surface/60 hover:border-border"
                        }`}
                      >
                        {/* Z-order indicator */}
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <button
                            onClick={() => moveLayer(index, "up")}
                            disabled={isTop}
                            className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-elevated disabled:opacity-20"
                            aria-label="Move layer up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <span className="text-[9px] font-mono text-muted-foreground/50">
                            {index + 1}
                          </span>
                          <button
                            onClick={() => moveLayer(index, "down")}
                            disabled={isBottom}
                            className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-elevated disabled:opacity-20"
                            aria-label="Move layer down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Thumbnail */}
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-surface-overlay">
                          {layer.artwork.decalUrl && (
                            <img
                              src={layer.artwork.decalUrl}
                              alt={layer.name}
                              className="h-full w-full object-contain"
                            />
                          )}
                          {isFullWrap && (
                            <div className="absolute inset-0 flex items-end justify-center pb-0.5">
                              <span className="rounded-sm bg-primary/80 px-1 text-[8px] font-bold uppercase text-primary-foreground">
                                Wrap
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Meta */}
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => handleSelect(layer.id)}
                        >
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{layer.name}</p>
                            {isTop && (
                              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                                Top
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {layer.areaKey} · {(layer.artwork.decalScale * 100).toFixed(0)}% scale
                          </p>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(layer.id)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-muted-foreground opacit-90 md:opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          title="Remove layer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Available (empty) print areas */}
              {product && activeLayers.length < product.printAreas.length && (
                <div className="mt-5">
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    Available areas
                  </p>
                  <div className="space-y-1.5">
                    {product.printAreas
                      .filter((p) => !artworks[p.id]?.decalUrl)
                      .map((area) => (
                        <button
                          key={area.id}
                          onClick={() => handleSelect(area.id)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/40 px-3 py-2.5 text-left transition hover:border-foreground/20 hover:bg-surface/60"
                        >
                          <div className="h-9 w-9 shrink-0 rounded-xl border border-border/30 bg-surface-overlay" />
                          <div>
                            <p className="text-sm text-muted-foreground">{area.name}</p>
                            <p className="text-[11px] text-muted-foreground/50">
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
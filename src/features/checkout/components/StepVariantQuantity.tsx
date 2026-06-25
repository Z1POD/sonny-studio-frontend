// src/features/checkout/components/StepVariantQuantity.tsx

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Palette, Ruler, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckoutStore } from "../store";
import type { CheckoutVariant } from "../types";

interface Props {
  variants: CheckoutVariant[];
  onContinue: () => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export function StepVariantQuantity({ variants, onContinue }: Props) {
  const {
    selectedColors,
    selectedSizes,
    selectedVariants,
    toggleColor,
    toggleSize,
    setVariantQuantity,
    getSelectedVariants,
    getTotalQuantity,
  } = useCheckoutStore();

  const totalQty = getTotalQuantity();
  const selectedItems = getSelectedVariants();

  // Group variants by color
  const colors = useMemo(() => {
    const map = new Map<string, { hex: string; name: string; variants: CheckoutVariant[] }>();
    for (const v of variants) {
      const existing = map.get(v.color.hex);
      if (existing) {
        existing.variants.push(v);
      } else {
        map.set(v.color.hex, { hex: v.color.hex, name: v.color.name, variants: [v] });
      }
    }
    return Array.from(map.values());
  }, [variants]);

  // Get all unique sizes
  const allSizes = useMemo(() => {
    const sizes = new Set<string>();
    for (const v of variants) sizes.add(v.size);
    return Array.from(sizes);
  }, [variants]);

  // Check if any variant is selected
  const canContinue = selectedItems.length > 0 && totalQty >= 1;

  // Check if a size is available for at least one selected color
  const isSizeAvailable = (size: string) => {
    return variants.some((v) => v.isInStock && selectedColors.has(v.color.hex) && v.size === size);
  };

  return (
    <motion.div
      custom={1}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col"
    >
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar">
        {/* Color Selection — Multi-select pills */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Colors</h3>
            <span className="text-[10px] text-muted-foreground">{selectedColors.size} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const isSelected = selectedColors.has(color.hex);
              const hasStock = color.variants.some((v) => v.isInStock);
              return (
                <button
                  key={color.hex}
                  onClick={() => hasStock && toggleColor(color.hex)}
                  disabled={!hasStock}
                  className={`group relative flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-all ${
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : hasStock
                        ? "border-border bg-surface text-foreground hover:border-foreground/40"
                        : "border-border/30 bg-surface/50 text-muted-foreground/40 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full border ${isSelected ? "border-white/30" : "border-border/40"}`}
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                  {isSelected && (
                    <motion.div
                      layoutId={`color-check-${color.hex}`}
                      className="ml-0.5"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Size Selection — Multi-select pills */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Sizes</h3>
            <span className="text-[10px] text-muted-foreground">{selectedSizes.size} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allSizes.map((size) => {
              const isSelected = selectedSizes.has(size);
              const available = isSizeAvailable(size);
              return (
                <button
                  key={size}
                  onClick={() => available && toggleSize(size)}
                  disabled={!available}
                  className={`relative flex h-11 min-w-[3rem] items-center justify-center rounded-xl border text-sm font-medium transition-all ${
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : available
                        ? "border-border bg-surface text-foreground hover:border-foreground/40"
                        : "border-border/30 bg-surface/50 text-muted-foreground/40 cursor-not-allowed"
                  }`}
                >
                  {size}
                  {isSelected && (
                    <motion.div
                      layoutId={`size-check-${size}`}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Variants with Quantity */}
        <AnimatePresence>
          {selectedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Selected items</h3>
                <span className="text-[10px] text-muted-foreground">{totalQty} total</span>
              </div>

              <div className="space-y-2">
                {selectedItems.map((item) => {
                  const variant = variants.find((v) => v.id === item.variantId);
                  if (!variant) return null;
                  return (
                    <motion.div
                      key={item.variantId}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-6 w-6 rounded-full border border-border/40"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        <div>
                          <p className="text-sm font-medium">{item.colorName}</p>
                          <p className="text-[11px] text-muted-foreground">Size {item.size}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setVariantQuantity(item.variantId, item.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-surface-elevated"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => setVariantQuantity(item.variantId, item.quantity + 1)}
                          disabled={item.quantity >= variant.stockQuantity}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-surface-elevated disabled:opacity-30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state hint */}
        {selectedItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">Select colors and sizes to continue</p>
          </div>
        )}
      </div>

      {/* Sticky Continue Button */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">{totalQty} item{totalQty !== 1 ? "s" : ""}</span>
          <span className="text-sm font-semibold">
            {/* Price will be calculated in review step */}
          </span>
        </div>
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full h-12 rounded-2xl text-base font-semibold"
          size="lg"
        >
          Continue
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
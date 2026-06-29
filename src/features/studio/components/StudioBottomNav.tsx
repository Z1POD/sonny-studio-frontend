// src/features/studio/components/StudioBottomNav.tsx
/**
 * StudioBottomNav.tsx — Fused Bottom Navigation with Dynamic Price Bar
 *
 * Combines the original bottom nav with FloatingPriceBar into a single component.
 * - Price/Continue section slides out as an extended tab when artwork is applied
 * - All nav buttons use flex-col layout with icon + label
 * - Artwork Library toggle uses the pattern from ArtworkLibrary component
 * - Save button removed (both Save and Continue lead to checkout)
 * - Artwork manipulation (decal panel) is separate from Artwork Library
 * - When artwork applied, shows "Save & Continue" instead of price
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Info,
  Palette,
  Shirt as ShirtIcon,
  Layers,
  MoreHorizontal,
  X,
  ShoppingBag,
  Loader2,
  ImagePlus,
  HandGrab,
  RectangleHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useStudioStore } from "../store";
import Tooltip from "@/components/ui/tooltip2";
import { LayerManager } from "@/features/checkout/components/LayerManager";

export type StudioPanelId = "info" | "color" | "printArea" | "decal" | null;

interface StudioBottomNavProps {
  activePanel: StudioPanelId;
  onTogglePanel: (id: StudioPanelId) => void;
  onContinue: () => void;
  isCapturing?: boolean;
  showHomeMenu?: boolean;
  onToggleHomeMenu?: () => void;
  onToggleArtworkLibrary?: () => void;
  artworkLibraryOpen?: boolean;
}

export function StudioBottomNav({
  activePanel,
  onTogglePanel,
  onContinue,
  isCapturing,
  showHomeMenu,
  onToggleHomeMenu,
  onToggleArtworkLibrary,
  artworkLibraryOpen = false,
}: StudioBottomNavProps) {
  const store = useStudioStore();
  const selectedPrintArea = store.product?.printAreas.find((p) => p.id === store.selectedPrintAreaId);
  const hasArtwork = selectedPrintArea ? !!store.artworks[selectedPrintArea.id]?.decalUrl : false;

  // Layer manager state
  const [layerManagerOpen, setLayerManagerOpen] = useState(false);

  // Price bar visibility state
  const [showPriceBar, setShowPriceBar] = useState(false);

  const anyArtwork = store.product?.printAreas.some((p) => store.artworks[p.id]?.decalUrl);

  // Show price bar when artwork is applied
  useEffect(() => {
    if (anyArtwork) {
      setShowPriceBar(true);
    } else {
      setShowPriceBar(false);
    }
  }, [anyArtwork]);

  // Artwork library toggle
  const handleArtworkLibraryToggle = () => {
    onToggleArtworkLibrary?.();
  };

  // Nav items with appropriate icons
  const items: { id: NonNullable<StudioPanelId>; icon: React.ReactNode; label: string }[] = [
    { id: "info", icon: <Info className="h-4 w-4" />, label: "Info" },
    { id: "color", icon: <Palette className="h-4 w-4" />, label: "Color" },
    { id: "printArea", icon: <RectangleHorizontal className="h-4 w-4" />, label: "Areas" },
    { id: "decal", icon: <HandGrab className="h-4 w-4" />, label: "Edit" },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="pointer-events-auto fixed inset-x-0 bottom-4 z-20 flex justify-center px-3"
      >
        <div className="flex w-full max-w-sm flex-col rounded-2xl border border-border/60 shadow-2xl backdrop-blur-xl p-1.5 shadow-elevated">
          {/* Dynamic Price Section — shows "Save & Continue" when artwork applied */}
          <AnimatePresence>
            {showPriceBar && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: 10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: 10 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mb-1.5 flex items-center justify-between rounded-2xl bg-primary/5 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Ready to order
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Save & Continue
                    </span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={onContinue}
                    disabled={isCapturing || !anyArtwork}
                    className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {isCapturing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShoppingBag className="h-4 w-4" />
                    )}
                    {isCapturing ? "Saving…" : "Continue"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Row */}
          <div className="flex items-center gap-2 justify-evenly">
            {onToggleHomeMenu && (
              <>
                <Tooltip text="Menu">
                  <button
                    onClick={onToggleHomeMenu}
                    className={`flex h-11 w-11 flex-col items-center justify-center rounded-full text-[9px] font-medium transition ${
                      showHomeMenu
                        ? "bg-primary/30 text-primary-foreground"
                        : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    }`}
                  >
                    {showHomeMenu ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                    <span className="mt-0.5 leading-none">Menu</span>
                  </button>
                </Tooltip>

                <div className="mx-1 h-6 w-px bg-border/60" />
              </>
            )}

            {items.map((item) => (
              <Tooltip key={item.id} text={item.label}>
                <button
                  onClick={() =>
                    onTogglePanel(activePanel === item.id ? null : item.id)
                  }
                  className={`flex h-11 w-11 flex-col items-center justify-center rounded-full text-[9px] font-medium transition ${
                    activePanel === item.id
                      ? "bg-primary/15"
                      : "text-foreground hover:bg-surface-elevated hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  <span className="mt-0.5 leading-none">{item.label}</span>
                </button>
              </Tooltip>
            ))}

            <Tooltip text="Layers">
              <button
                onClick={() => setLayerManagerOpen(true)}
                className="flex h-11 w-11 flex-col items-center justify-center rounded-full text-[9px] font-medium text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
              >
                <Layers className="h-4 w-4" />
                <span className="mt-0.5 leading-none">Layers</span>
              </button>
            </Tooltip>

            <Tooltip
              text={artworkLibraryOpen ? "Close Library" : "Artwork Library"}
            >
              <button
                onClick={handleArtworkLibraryToggle}
                className={`flex h-11 w-11 flex-col items-center justify-center rounded-full text-[9px] font-medium transition ${
                  artworkLibraryOpen
                    ? "bg-primary/70 text-primary-foreground"
                    : hasArtwork
                      ? "text-primary hover:bg-primary/10"
                      : "text-foreground hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <ImagePlus className="h-4 w-4" />
                <span className="mt-0.5 leading-none">Design</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </motion.div>

      {/* Layer Manager Drawer */}
      <LayerManager open={layerManagerOpen} onClose={() => setLayerManagerOpen(false)} />
    </>
  );
}
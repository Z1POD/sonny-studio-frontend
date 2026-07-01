// src/features/studio/components/StudioBottomNav.tsx
/**
 * StudioBottomNav.tsx — v4
 *
 * Apple HIG-inspired minimal bottom navigation.
 * - Home/exit button navigates to /designs
 * - Price bar slides out when artwork is applied
 * - Pill-style active states, SF-style icon+label layout
 * - Layers button opens LayerManager
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Info,
  Palette,
  SquareDashed,
  Move,
  Layers,
  ImagePlus,
  ShoppingBag,
  Loader2,
  X,
} from "lucide-react";
import { useStudioStore } from "../store";
import { LayerManager } from "./LayerManager";

export type StudioPanelId = "info" | "color" | "printArea" | "decal" | null;

interface StudioBottomNavProps {
  activePanel: StudioPanelId;
  onTogglePanel: (id: StudioPanelId) => void;
  onContinue: () => void;
  isCapturing?: boolean;
  onToggleArtworkLibrary?: () => void;
  artworkLibraryOpen?: boolean;
}

const NAV_ITEMS: {
  id: NonNullable<StudioPanelId>;
  icon: React.ReactNode;
  label: string;
}[] = [
  {
    id: "info",
    icon: <Info className="h-[18px] w-[18px]" />,
    label: "Info",
  },
  {
    id: "color",
    icon: <Palette className="h-[18px] w-[18px]" />,
    label: "Color",
  },
  {
    id: "printArea",
    icon: <SquareDashed className="h-[18px] w-[18px]" />,
    label: "Zone",
  },
  {
    id: "decal",
    icon: <Move className="h-[18px] w-[18px]" />,
    label: "Move",
  },
];

export function StudioBottomNav({
  activePanel,
  onTogglePanel,
  onContinue,
  isCapturing,
  onToggleArtworkLibrary,
  artworkLibraryOpen = false,
}: StudioBottomNavProps) {
  
  const store = useStudioStore();
  const [layerManagerOpen, setLayerManagerOpen] = useState(false);
  const [showContinueToCheckoutBar, setShowContinueToCheckoutBar] = useState(false);

  const anyArtwork = store.product?.printAreas.some((p) => store.artworks[p.id]?.decalUrl);
  const selectedPrintArea = store.product?.printAreas.find((p) => p.id === store.selectedPrintAreaId);
  const hasArtwork = selectedPrintArea ? !!store.artworks[selectedPrintArea.id]?.decalUrl : false;

  useEffect(() => {
    setShowContinueToCheckoutBar(!!anyArtwork);
  }, [anyArtwork]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className="pointer-events-auto fixed inset-x-0 bottom-4 z-20 flex justify-center px-3"
      >
        <div className="flex w-full max-w-sm flex-col rounded-2xl border border-border/60 shadow-2xl backdrop-blur-xl p-1.5 shadow-elevated">
          {/* Price / Continue bar */}
          <AnimatePresence>
            {showContinueToCheckoutBar && (
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

          {/* Main Nav Bar */}
          <div className="flex items-center rounded-2xl border border-border/50 bg-background/80 px-2 py-1.5 backdrop-blur-xl shadow-lg gap-0.5">

            {/* Panel nav items */}
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activePanel === item.id}
                onClick={() => onTogglePanel(activePanel === item.id ? null : item.id)}
              />
            ))}

            {/* Divider */}
            <div className="mx-1 h-5 w-px shrink-0 rounded-full bg-border/60" />

            {/* Layers */}
            <NavButton
              icon={<Layers className="h-[18px] w-[18px]" />}
              label="Layers"
              active={layerManagerOpen}
              onClick={() => setLayerManagerOpen(true)}
            />

            {/* Artwork Library / Design */}
            <NavButton
              icon={<ImagePlus className="h-[18px] w-[18px]" />}
              label="Design"
              active={artworkLibraryOpen}
              highlighted={!artworkLibraryOpen && hasArtwork}
              onClick={() => onToggleArtworkLibrary?.()}
            />
          </div>
        </div>
      </motion.div>

      {/* Layer Manager Drawer */}
      <LayerManager open={layerManagerOpen} onClose={() => setLayerManagerOpen(false)} />
    </>
  );
}

// NavButton 
interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  highlighted?: boolean;
  onClick: () => void;
  title?: string;
}

function NavButton({ icon, label, active, highlighted, onClick, title }: NavButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      aria-pressed={active}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors
        ${active
          ? "bg-primary/15 text-primary"
          : highlighted
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
        }`}
    >
      {icon}
      <span className="text-[9px] font-medium leading-none tracking-wide">{label}</span>
    </motion.button>
  );
}
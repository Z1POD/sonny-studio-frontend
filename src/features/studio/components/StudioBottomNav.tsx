// src/features/studio/components/StudioBottomNav.tsx

import { motion } from "framer-motion";
import { Info, Palette, Shirt as ShirtIcon, SlidersHorizontal, Save, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStudioStore, getDefaultArtwork } from "../store";
import Tooltip from "@/components/ui/tooltip2";

export type StudioPanelId = "info" | "color" | "printArea" | "decal" | null;

interface StudioBottomNavProps {
  activePanel: StudioPanelId;
  onTogglePanel: (id: StudioPanelId) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function StudioBottomNav({ activePanel, onTogglePanel, onSave, isSaving }: StudioBottomNavProps) {
  const store = useStudioStore();
  const selectedPrintArea = store.product?.printAreas.find((p) => p.id === store.selectedPrintAreaId);
  const hasArtwork = selectedPrintArea ? !!store.artworks[selectedPrintArea.id]?.decalUrl : false;

  const handleDeleteArtwork = () => {
    if (!selectedPrintArea) {
      toast.error("Select a print area first");
      return;
    }
    if (!hasArtwork) return;
    store.setArtwork(selectedPrintArea.id, getDefaultArtwork());
    toast.success(`Artwork removed from ${selectedPrintArea.name}`);
  };

  const items: { id: NonNullable<StudioPanelId>; icon: React.ReactNode; label: string }[] = [
    { id: "info", icon: <Info className="h-4 w-4" />, label: "Info" },
    { id: "color", icon: <Palette className="h-4 w-4" />, label: "Color" },
    { id: "printArea", icon: <ShirtIcon className="h-4 w-4" />, label: "Areas" },
    { id: "decal", icon: <SlidersHorizontal className="h-4 w-4" />, label: "Artwork" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="pointer-events-auto fixed inset-x-0 bottom-4 z-20 flex justify-center px-3"
    >
      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-surface/90 p-1.5 shadow-elevated backdrop-blur-xl">
        {items.map((item) => (
          <Tooltip key={item.id} text={item.label}>
            <button
              onClick={() =>
                onTogglePanel(activePanel === item.id ? null : item.id)
              }
              className={`flex h-10 w-10 flex-col items-center justify-center rounded-full text-[9px] font-medium transition ${
                activePanel === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              }`}
              aria-label={item.label}
            >
              {item.icon}
            </button>
          </Tooltip>
        ))}

        <div className="mx-1 h-6 w-px bg-border/60" />

        <button
          onClick={handleDeleteArtwork}
          disabled={!hasArtwork}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          title="Delete current artwork"
          aria-label="Delete current artwork"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          onClick={onSave}
          disabled={isSaving || !hasArtwork}
          className="flex h-10 items-center gap-1.5 rounded-full bg-gold px-4 text-xs font-semibold text-gold-foreground transition disabled:opacity-30 "
          title="Save Custom Product"
          aria-label="Save current Custom Product"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </motion.div>
  );
}
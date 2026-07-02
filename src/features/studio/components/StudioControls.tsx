// src/features/studio/components/StudioControls.tsx
/**
 * StudioControls.tsx — v4
 * Passes onContinue through to StudioBottomNav for fused price bar.
 * Passes artwork library toggle state.
 * onSave / isSaving props removed from nav (both save paths go through onContinue).
 */

import { useState } from "react";
import { useStudioStore } from "../store";
import { PanelShell } from "./PanelShell";
import { ProductInfoPanel } from "./ProductInfoPanel";
import { ColorPanel } from "./ColorPanel";
import { PrintAreaPanel } from "./PrintAreaPanel";
import { DecalPanel } from "./DecalPanel";
import { StudioBottomNav, type StudioPanelId } from "./StudioBottomNav";

interface Props {
  onSave: () => void;
  isSaving: boolean;
  onContinue: () => void;
  onToggleArtworkLibrary?: () => void;
  artworkLibraryOpen?: boolean;
}

const PANEL_META: Record<NonNullable<StudioPanelId>, { title: string }> = {
  info:      { title: "Product info" },
  color:     { title: "Colors"       },
  printArea: { title: "Print areas"  },
  decal:     { title: "Artwork"      },
};

export function StudioControls({
  onSave,
  isSaving,
  onContinue,
  onToggleArtworkLibrary,
  artworkLibraryOpen,
}: Props) {
  const [activePanel, setActivePanel] = useState<StudioPanelId>(null);

  return (
    <>
      <PanelShell
        open={activePanel === "info"}
        onClose={() => setActivePanel(null)}
        title={PANEL_META.info.title}
      >
        <ProductInfoPanel />
      </PanelShell>

      <PanelShell
        open={activePanel === "color"}
        onClose={() => setActivePanel(null)}
        title={PANEL_META.color.title}
      >
        <ColorPanel />
      </PanelShell>

      <PanelShell
        open={activePanel === "printArea"}
        onClose={() => setActivePanel(null)}
        title={PANEL_META.printArea.title}
      >
        <PrintAreaPanel />
      </PanelShell>

      <PanelShell
        open={activePanel === "decal"}
        onClose={() => setActivePanel(null)}
        title={PANEL_META.decal.title}
        dismissible={true}
      >
        <DecalPanel />
      </PanelShell>

      <StudioBottomNav
        activePanel={activePanel}
        onTogglePanel={setActivePanel}
        onContinue={onContinue}
        isCapturing={isSaving}
        onToggleArtworkLibrary={onToggleArtworkLibrary}
        artworkLibraryOpen={artworkLibraryOpen}
      />
    </>
  );
}
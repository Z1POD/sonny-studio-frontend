// src/features/studio/components/StudioControls.tsx

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

const PANEL_META: Record<NonNullable<StudioPanelId>, { title: string }> = {
  info: { title: "Product info" },
  color: { title: "Colors" },
  printArea: { title: "Print areas" },
  decal: { title: "Artwork" },
};

export function StudioControls({ onSave, isSaving }: Props) {
  const [activePanel, setActivePanel] = useState<StudioPanelId>(null);
  const reset = useStudioStore((s) => s.reset);

  return (
    <>
      {/* Reset — fixed top corner */}
      <div className="pointer-events-auto absolute right-4 top-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={reset}
          title="Reset"
          aria-label="Reset"
          className="h-10 w-10 rounded-full border border-border/60 bg-surface/90 shadow-elevated backdrop-blur-xl"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

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
      >
        <DecalPanel />
      </PanelShell>

      <StudioBottomNav
        activePanel={activePanel}
        onTogglePanel={setActivePanel}
        onSave={onSave}
        isSaving={isSaving}
      />
    </>
  );
}
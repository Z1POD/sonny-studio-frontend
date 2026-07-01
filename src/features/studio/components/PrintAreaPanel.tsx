// src/features/studio/components/PrintAreaPanel.tsx

import { useMemo } from "react";
import { Check, ChevronRight, Layers, Zap, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStudioStore, type PrintArea, type PrintMethod } from "../store";
import { AnimatePresence, motion } from "framer-motion";

// Placement icon / label 

const PLACEMENT_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  left_sleeve: "L. Sleeve",
  right_sleeve: "R. Sleeve",
  hood: "Hood",
  full: "Full Print",
};


// Size pill 
function SizePill({ size, active, onClick }: { size: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center rounded-full border px-3 text-[10px] font-semibold tracking-wide transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 bg-surface-elevated/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {size}
    </button>
  );
}

// Method card 
function MethodCard({
  method,
  active,
  activeTier,
  currency,
  onMethodSelect,
  onTierSelect,
}: {
  method: PrintMethod;
  active: boolean;
  activeTier: string;
  currency?: { code: string; symbol: string };
  onMethodSelect: () => void;
  onTierSelect: (size: string) => void;
}) {
  const sym = currency?.symbol ?? "$";
  const currentTier = method.tiers.find((t) => t.size === activeTier) ?? method.tiers[0];

  return (
    <div
      className={`rounded-2xl border transition-all ${
        active
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/50 bg-surface-elevated/30"
      }`}
    >
      {/* Method header — click to select method */}
      <button
        onClick={onMethodSelect}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
              active ? "border-primary bg-primary" : "border-border/60"
            }`}
          >
            {active && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
              {method.name}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{method.code}</p>
          </div>
        </div>
        {currentTier && (
          <div className="flex items-center gap-1 text-xs font-semibold text-primary">
            {sym}{currentTier.price}
          </div>
        )}
      </button>

      {/* Tier selector — only visible when method is active */}
      <AnimatePresence>
        {active && method.tiers.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-border/30 px-4 pb-3"
          >
            <p className="mb-2 mt-2.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              Print size
            </p>
            <div className="flex flex-wrap gap-1.5">
              {method.tiers.map((tier) => (
                <SizePill
                  key={tier.size}
                  size={`${tier.size} : ${sym}${tier.price}`}
                  active={activeTier === tier.size}
                  onClick={() => onTierSelect(tier.size)}
                />
              ))}
            </div>
            {currentTier && (
              <div className="mt-2.5 rounded-xl border border-border/30 bg-surface/50 px-3 py-2 text-[11px] text-muted-foreground">
                Max: <span className="font-medium text-foreground">{currentTier.max_w}×{currentTier.max_h}cm</span>
                {parseFloat(currentTier.extra_color_price) > 0 && (
                  <> · +{sym}{currentTier.extra_color_price}<span className="text-[10px]">/color</span></>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// PrintAreaButton 
function PrintAreaButton({
  area,
  active,
  hasArtwork,
  onClick,
}: {
  area: PrintArea;
  active: boolean;
  hasArtwork: boolean;
  onClick: () => void;
}) {
  const label = PLACEMENT_LABELS[area.placement] ?? area.name;

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all ${
        active
          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
          : "border-border/50 bg-surface-elevated/40 hover:border-primary/30 hover:bg-surface-elevated/70"
      }`}
    >
      {/* Artwork badge */}
      {hasArtwork && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}

      <div className="text-center">
        <p className={`text-[11px] font-semibold leading-tight ${active ? "text-foreground" : "text-muted-foreground"}`}>
          {label}
        </p>
        <p className="text-[9px] text-muted-foreground">
          {area.widthCm}×{area.heightCm}cm
        </p>
      </div>

      {active && (
        <div className="h-1 w-8 rounded-full bg-primary" />
      )}
    </button>
  );
}

// PrintAreaPanel 

export function PrintAreaPanel() {
  const store = useStudioStore();
  const product = store.product;
  if (!product) return null;

  const selectedPrintArea = product.printAreas.find((p) => p.id === store.selectedPrintAreaId);

  const activeMethods = useMemo(() => {
    if (!selectedPrintArea) return {};
    return {
      method: store.selectedMethods[selectedPrintArea.id] ?? selectedPrintArea.methods[0]?.code ?? "",
      tier: store.selectedTiers[selectedPrintArea.id] ?? selectedPrintArea.methods[0]?.tiers[0]?.size ?? "",
    };
  }, [selectedPrintArea, store.selectedMethods, store.selectedTiers]);

  return (
    <div className="flex flex-col gap-5">
      {/* Print area grid */}
      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Choose area</p>
        <div className="grid grid-cols-3 gap-2">
          {product.printAreas.map((area) => (
            <PrintAreaButton
              key={area.id}
              area={area}
              active={store.selectedPrintAreaId === area.id}
              hasArtwork={!!store.artworks[area.id]?.decalUrl}
              onClick={() => store.setSelectedPrintArea(area.id)}
            />
          ))}
        </div>
      </section>

      {/* Method & tier selection for selected area */}
      {selectedPrintArea && selectedPrintArea.methods.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Print method · {selectedPrintArea.name}
            </p>
            <Badge variant="outline" className="text-[9px]">
              {selectedPrintArea.widthCm}×{selectedPrintArea.heightCm}cm
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {selectedPrintArea.methods.map((method) => (
              <MethodCard
                key={method.code}
                method={method}
                active={activeMethods.method === method.code}
                activeTier={activeMethods.tier}
                currency={selectedPrintArea.currency}
                onMethodSelect={() =>
                  store.setSelectedMethod(selectedPrintArea.id, method.code)
                }
                onTierSelect={(size) =>
                  store.setSelectedTier(selectedPrintArea.id, size)
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
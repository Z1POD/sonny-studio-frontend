// src/features/studio/components/ColorPanel.tsx

import { Label } from "@/components/ui/label";
import { useStudioStore } from "../store";

const BACKGROUND_PRESETS = [
  { label: "Studio dark", value: "linear-gradient(135deg, #0b0b15, #1a1a2e)" },
  { label: "Warm", value: "linear-gradient(135deg, #0b0b15, #b44e04)" },
  { label: "Mint", value: "linear-gradient(135deg, #0b0b15, #04b462)" },
  { label: "Plain white", value: "#ffffff" },
  { label: "Plain black", value: "#0b0b0f" },
];

export function ColorPanel() {
  const store = useStudioStore();
  const product = store.product;
  if (!product) return null;

  const capabilities = product.studioCapabilities;
  const currentBg = product.renderConfig.background;

  return (
    <div className="flex flex-col gap-5">
      {(!capabilities || capabilities.allowColorChange) && (
        <section className="space-y-2">
          <Label className="text-xs text-muted-foreground">Apparel color</Label>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c) => (
              <button
                key={c}
                onClick={() => store.setSelectedColor(c)}
                style={{ background: c }}
                className={`h-8 w-8 rounded-full border-2 transition ${
                  store.selectedColor === c
                    ? "border-primary scale-110"
                    : "border-border/40"
                }`}
                aria-label={c}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <Label className="text-xs text-muted-foreground">Background</Label>
        <div className="grid grid-cols-2 gap-2">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => store.setBackground(preset.value)}
              className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs transition ${
                currentBg === preset.value
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-surface-elevated/50 hover:border-primary/40"
              }`}
            >
              <span
                className="h-6 w-6 shrink-0 rounded-full border border-border/40"
                style={{ background: preset.value }}
              />
              <span className="truncate">{preset.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground">Custom</Label>
          <input
            type="color"
            value={/^#[0-9a-f]{3,8}$/i.test(currentBg) ? currentBg : "#0b0b15"}
            onChange={(e) => store.setBackground(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded-md border border-border/60 bg-transparent"
          />
          <p className="text-[10px] text-muted-foreground">Solid color override</p>
        </div>
      </section>
    </div>
  );
}
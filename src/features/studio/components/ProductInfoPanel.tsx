// src/features/studio/components/ProductInfoPanel.tsx

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sparkles } from "lucide-react";
import { useStudioStore } from "../store";

export function ProductInfoPanel() {
  const store = useStudioStore();
  const product = store.product;
  if (!product) return null;

  return (
    <div className="flex flex-col gap-5">
      <section className="space-y-2">
        <Label className="text-xs text-muted-foreground">Product</Label>
        <div className="rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
          <p className="text-sm font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.description}</p>
          <p className="mt-1 text-xs text-primary">
            Base {product.currencySymbol}{product.basePrice}
          </p>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm">Auto-rotate</span>
        </div>
        <Switch checked={store.autoRotate} onCheckedChange={store.setAutoRotate} />
      </section>
    </div>
  );
}
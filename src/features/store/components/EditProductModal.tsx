// src/features/store/components/EditProductModal.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Loader2,
  Pencil,
  Sparkles,
  AlertTriangle,
  Check,
  Palette,
  ChevronRight,
  PackageCheck,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { storeProductDetailQuery, storeProductKeys } from "../queries";
import { storeProductApi, type ProductVariant } from "../api";
import { useConfirm } from "./ConfirmModal";

//     Variant matrix                                                            

function VariantMatrix({
  variants,
  enabledIds,
  onToggle,
}: {
  variants: ProductVariant[];
  enabledIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const colors = useMemo(
    () => [...new Map(variants.map((v) => [v.color.hex, v.color])).values()],
    [variants],
  );
  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size))],
    [variants],
  );

  const getVariant = (hex: string, size: string) =>
    variants.find((v) => v.color.hex === hex && v.size === size);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Enabled Variants</Label>
        <button
          onClick={() => {
            const all = variants.every((v) => enabledIds.has(v.id));
            variants.forEach((v) => {
              if (all === enabledIds.has(v.id)) onToggle(v.id);
            });
          }}
          className="text-[10px] text-primary hover:underline"
        >
          {variants.every((v) => enabledIds.has(v.id)) ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full min-w-[220px] text-xs">
          <thead>
            <tr className="border-b border-border/40 bg-surface-elevated/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Color</th>
              {sizes.map((s) => (
                <th key={s} className="px-2 py-2 text-center font-medium text-muted-foreground">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((color, i) => (
              <tr key={color.hex} className={i % 2 === 0 ? "bg-surface/30" : "bg-surface-elevated/20"}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-full border border-border/40" style={{ background: color.hex }} />
                    <span className="text-[11px]">{color.name}</span>
                  </div>
                </td>
                {sizes.map((size) => {
                  const v = getVariant(color.hex, size);
                  if (!v) return (
                    <td key={size} className="px-2 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground/30">—</span>
                    </td>
                  );
                  const on = enabledIds.has(v.id);
                  return (
                    <td key={size} className="px-2 py-2 text-center">
                      <button
                        onClick={() => onToggle(v.id)}
                        className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/50 bg-surface-elevated/40 text-muted-foreground hover:border-primary/60"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {enabledIds.size} of {variants.length} variants enabled
      </p>
    </div>
  );
}

//     Pricing preview                                                           

function PricingPreview({
  basePrice,
  markupPct,
  currency,
}: {
  basePrice: string;
  markupPct: number;
  currency: string | { code: string; symbol: string; name: string };
}) {
  const base = parseFloat(basePrice) || 0;
  // In edit modal we only have base price (no print cost available), markup is % of base
  const markupAmt = (base * markupPct) / 100;
  const retail = base + markupAmt;
  const currencySymbol = typeof currency === "object" ? currency.symbol : currency;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/40 bg-surface-elevated/30 p-3 text-center text-xs">
      <div>
        <p className="text-muted-foreground">Base</p>
        <p className="font-semibold">{currencySymbol} {base.toFixed(2)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Markup</p>
        <p className="font-semibold">+ {currencySymbol} {markupAmt.toFixed(2)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Retail</p>
        <p className="text-base font-bold text-primary">{currencySymbol} {retail.toFixed(2)}</p>
      </div>
    </div>
  );
}

//     Tab type                                                                  

type Tab = "info" | "variants";

//     EditProductModal                                                          

interface Props {
  productId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProductModal({ productId, onClose, onSaved }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirm, ConfirmModal] = useConfirm();

  const { data: product, isLoading } = useQuery(storeProductDetailQuery(productId));

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [markupPct, setMarkupPct] = useState(0);
  const [markupInput, setMarkupInput] = useState("0");
  const [isLimited, setIsLimited] = useState(false);
  const [maxQty, setMaxQty] = useState(100);
  const [isProductionReady, setIsProductionReady] = useState(false);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("info");
  const [dirty, setDirty] = useState(false);

  // Hydrate form once product loads
  useEffect(() => {
    if (!product) return;
    setTitle(product.title ?? "");
    setDescription(product.description ?? "");
    const base = parseFloat(product.pricing?.base_price ?? "0") || 0;
    const retail = parseFloat(product.pricing?.retail_price ?? "0") || 0;
    const markup = base > 0 ? ((retail - base) / base) * 100 : 0;
    const rounded = Math.round(markup * 100) / 100;
    setMarkupPct(rounded);
    setMarkupInput(String(rounded));
    setIsLimited(product.is_limited_edition);
    setMaxQty(product.max_quantity ?? 100);
    setIsProductionReady((product as any).production_ready ?? false);
    setEnabledIds(new Set((product.enabled_variant ?? []).map((v) => v.id)));
  }, [product]);

  const toggleVariant = (id: string) => {
    setDirty(true);
    setEnabledIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allVariants: ProductVariant[] = useMemo(() => {
    if (!product) return [];
    return product.enabled_variant ?? [];
  }, [product]);

  // Slider ↔ input sync
  const handleMarkupSlider = (val: number) => {
    setMarkupPct(val);
    setMarkupInput(String(val));
    setDirty(true);
  };

  const handleMarkupInput = (raw: string) => {
    setMarkupInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n)) {
      const clamped = Math.min(200, Math.max(0, n));
      setMarkupPct(Math.round(clamped * 100) / 100);
      setDirty(true);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("No product");
      const base = parseFloat(product.pricing?.base_price ?? "0") || 0;
      const markupAmt = (base * markupPct) / 100;

      return storeProductApi.update(productId, {
        title,
        description,
        markup_price: markupAmt.toFixed(2),
        enabled_variants: [...enabledIds],
        is_limited_edition: isLimited,
        max_quantity: isLimited ? maxQty : null,
        // production_ready forwarded if backend supports it
        ...({ production_ready: isProductionReady } as any),
      });
    },
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: storeProductKeys.detail(productId) });
      onSaved();
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to update product");
    },
  });

  const handleClose = async () => {
    if (!dirty) { onClose(); return; }
    const ok = await confirm({
      title: "Discard changes?",
      description: "You have unsaved changes. Leave anyway?",
      confirmLabel: "Discard",
      danger: true,
    });
    if (ok) onClose();
  };

  const handleEditInStudio = () => {
    if (!product?.snapshot) return;
    onClose();
    navigate({
      to: "/studio",
      state: {
        apparelId: (product.snapshot as any)?.productId ?? product.base_apparel?.id,
        restoreSnapshot: product.snapshot,
      } as any,
    });
  };

  const isDraft = !product?.is_published;

  return (
    <>
      <motion.div
        key="edit-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Sheet */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className="relative z-10 w-full max-h-[90dvh] overflow-hidden rounded-t-3xl border border-border/60 bg-surface shadow-2xl md:w-[720px] md:rounded-3xl md:max-h-[85vh]"
        >
          {/* Mobile drag handle */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between border-b border-border/40 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">Edit Product</h2>
              {product && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{product.title}</p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !product ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Failed to load product.
            </div>
          ) : (
            <div className="flex flex-col overflow-hidden" style={{ maxHeight: "calc(90dvh - 80px)" }}>
              {/* Tabs */}
              <div className="flex gap-0 border-b border-border/40 px-5">
                {(["info", "variants"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2.5 text-xs font-medium capitalize transition border-b-2 ${
                      tab === t
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "info" ? "Info & Pricing" : "Variants"}
                  </button>
                ))}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <AnimatePresence mode="wait">
                  {tab === "info" && (
                    <motion.div
                      key="info"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      className="space-y-4"
                    >
                      {!isDraft && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            This product is published. Some fields may be read-only.
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label htmlFor="e-title">Title</Label>
                        <Input
                          id="e-title"
                          value={title}
                          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                          disabled={!isDraft}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="e-desc">Description</Label>
                        <Textarea
                          id="e-desc"
                          value={description}
                          onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
                          rows={3}
                          disabled={!isDraft}
                        />
                      </div>

                      {/* Markup — slider + number input */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="e-markup">Markup</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={200}
                              step={1}
                              value={markupInput}
                              onChange={(e) => handleMarkupInput(e.target.value)}
                              onBlur={() => setMarkupInput(String(markupPct))}
                              disabled={!isDraft}
                              className="h-7 w-16 rounded-lg px-2 text-xs text-right"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                        <input
                          id="e-markup"
                          type="range"
                          min={0}
                          max={200}
                          step={1}
                          value={markupPct}
                          onChange={(e) => handleMarkupSlider(Number(e.target.value))}
                          disabled={!isDraft}
                          className="w-full accent-primary"
                        />
                        <PricingPreview
                          basePrice={product.pricing?.base_price ?? "0"}
                          markupPct={markupPct}
                          currency={product.pricing?.currency ?? "$"}
                        />
                      </div>

                      {/* Toggles */}
                      <div className="space-y-2">
                        {/* Limited edition */}
                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
                          <div>
                            <p className="text-sm font-medium">Limited edition</p>
                            <p className="text-xs text-muted-foreground">Cap total units</p>
                          </div>
                          <Switch
                            checked={isLimited}
                            onCheckedChange={(v) => { setIsLimited(v); setDirty(true); }}
                            disabled={!isDraft}
                          />
                        </div>
                        {isLimited && isDraft && (
                          <div className="space-y-1.5">
                            <Label htmlFor="e-maxqty">Max quantity</Label>
                            <Input
                              id="e-maxqty"
                              type="number"
                              min={1}
                              value={maxQty}
                              onChange={(e) => { setMaxQty(Number(e.target.value)); setDirty(true); }}
                            />
                          </div>
                        )}

                        {/* Production ready */}
                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
                          <div className="flex items-center gap-2">
                            <PackageCheck className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Production ready</p>
                              <p className="text-xs text-muted-foreground">Approve for fulfillment</p>
                            </div>
                          </div>
                          <Switch
                            checked={isProductionReady}
                            onCheckedChange={(v) => { setIsProductionReady(v); setDirty(true); }}
                            disabled={!isDraft}
                          />
                        </div>
                      </div>

                      {/* Edit in Studio */}
                      {isDraft && product.snapshot && (
                        <div className="rounded-xl border border-border/40 bg-surface-elevated/30 p-3">
                          <p className="text-xs font-medium">3D Mockup</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Reopen the studio canvas to adjust artwork placement, colors, and angles.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-8 rounded-full text-xs"
                            onClick={handleEditInStudio}
                            disabled
                            title="Editing 3D mockup not allowed"
                          >
                            <Palette className="mr-1.5 h-3.5 w-3.5" />
                            Edit in Studio
                            <ChevronRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {tab === "variants" && (
                    <motion.div
                      key="variants"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                    >
                      {allVariants.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No variant data available.
                        </p>
                      ) : (
                        <VariantMatrix
                          variants={allVariants}
                          enabledIds={enabledIds}
                          onToggle={toggleVariant}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              {isDraft && (
                <div className="border-t border-border/40 px-5 py-16">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleClose}
                      disabled={mutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => mutation.mutate()}
                      disabled={mutation.isPending || !dirty}
                    >
                      {mutation.isPending ? (
                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving…</>
                      ) : (
                        <><Sparkles className="mr-2 h-3.5 w-3.5" /> Save changes</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Confirm modal portal */}
      {ConfirmModal}
    </>
  );
}
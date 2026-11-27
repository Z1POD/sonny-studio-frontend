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
  Store,
} from "lucide-react";
import { useNavigate, Link } from "@tanstack/react-router";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { storeProductDetailQuery, storeProductKeys } from "../queries";
import {
  storeProductApi,
  priceCurrency,
  PUBLISH_BLOCKER_TEXT,
  type ProductDetail,
  type ProductVariantMatrix,
  type PublishBlocker,
  type UpdateProductPayload,
} from "../api";
import { designKeys } from "@/features/designs/queries";
import { formatPrice, type CurrencyLike } from "@/lib/format";
import { useConfirm } from "../../../shared/components/ConfirmModal";
import { useHasVerifiedStore } from "@/shared/hooks/use-store-access";

//     Variant matrix                                                            

function MarkBox({ state, onClick, label, disabled }: { state: "all" | "some" | "none"; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-30 ${
        state === "none"
          ? "border-border/60 bg-surface-elevated/40 hover:border-primary/60"
          : "border-primary bg-primary text-primary-foreground"
      }`}
    >
      {state === "all" && <Check className="h-3 w-3" />}
      {state === "some" && <span className="h-0.5 w-2.5 rounded bg-primary-foreground" />}
    </button>
  );
}

function VariantMatrix({
  matrix,
  enabledIds,
  onToggle,
  onSetMany,
}: {
  matrix: ProductVariantMatrix;
  enabledIds: Set<string>;
  onToggle: (id: string) => void;
  /** Switch a group of variants on or off at once (a colour row, a size column, or everything). */
  onSetMany: (ids: string[], on: boolean) => void;
}) {
  const sizes = useMemo(() => [...matrix.sizes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [matrix.sizes]);
  const colors = useMemo(() => [...matrix.colors].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [matrix.colors]);
  const find = (colorId: string, sizeId: string) => matrix.combinations.find((v) => v.color_id === colorId && v.size_id === sizeId);

  // Only variants that are in stock can be switched on.
  const idsOf = (pred: (v: ProductVariantMatrix["combinations"][number]) => boolean) =>
    matrix.combinations.filter((v) => v.in_stock && pred(v)).map((v) => v.variant_id);
  const stateOf = (ids: string[]): "all" | "some" | "none" => {
    const on = ids.filter((id) => enabledIds.has(id)).length;
    return ids.length === 0 || on === 0 ? "none" : on === ids.length ? "all" : "some";
  };
  const toggleGroup = (ids: string[]) => onSetMany(ids, stateOf(ids) !== "all");

  const allIds = idsOf(() => true);
  const allState = stateOf(allIds);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Variants you sell</Label>
        <button type="button" onClick={() => toggleGroup(allIds)} className="text-[11px] font-medium text-primary hover:underline">
          {allState === "all" ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full min-w-[240px] text-xs">
          <thead>
            <tr className="border-b border-border/40 bg-surface-elevated/40">
              <th className="px-3 py-2 text-left">
                <div className="flex items-center gap-2">
                  <MarkBox state={allState} onClick={() => toggleGroup(allIds)} label={allState === "all" ? "Deselect every variant" : "Select every variant"} disabled={allIds.length === 0} />
                  <span className="font-medium text-muted-foreground">Color</span>
                </div>
              </th>
              {sizes.map((s) => {
                return (
                  <th key={s.id} className="px-2 py-2 text-center font-medium text-muted-foreground">
                    <span>{s.label}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {colors.map((color, i) => {
              const rowIds = idsOf((v) => v.color_id === color.id);
              return (
                <tr key={color.id} className={i % 2 === 0 ? "bg-surface/30" : "bg-surface-elevated/20"}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <MarkBox state={stateOf(rowIds)} onClick={() => toggleGroup(rowIds)} label={`${stateOf(rowIds) === "all" ? "Deselect" : "Select"} every size of ${color.name}`} disabled={rowIds.length === 0} />
                      <span className="h-3.5 w-3.5 rounded-full border border-border/40" style={{ background: color.hex }} />
                      <span className="text-[11px]">{color.name}</span>
                    </div>
                  </td>
                  {sizes.map((size) => {
                    const v = find(color.id, size.id);
                    if (!v) return (
                      <td key={size.id} className="px-2 py-2 text-center">
                        <span className="text-[10px] text-muted-foreground/30">—</span>
                      </td>
                    );
                    const on = enabledIds.has(v.variant_id);
                    return (
                      <td key={size.id} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => onToggle(v.variant_id)}
                          disabled={!v.in_stock}
                          title={v.in_stock ? undefined : "Out of stock at the printer"}
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-30 ${
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
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {enabledIds.size} of {matrix.combinations.length} variants enabled · tap a colour, a size or the corner box to mark or unmark a whole group
      </p>
    </div>
  );
}

//     Pricing preview                                                           

/** Cost = blank + print. The markup is a % of that cost, so the creator's margin is what they expect. */
function PricingPreview({
  cost,
  markupPct,
  currency,
}: {
  /** Blank + print, combined. */
  cost: number;
  markupPct: number;
  currency: CurrencyLike;
}) {
  const markupAmt = (cost * markupPct) / 100;
  const retail = cost + markupAmt;
  const f = (n: number) => formatPrice(n, currency);

  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/40 bg-surface-elevated/30 p-3 text-center text-xs">
      <div>
        <p className="text-muted-foreground">Base price</p>
        <p className="font-semibold">{f(cost)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Your markup</p>
        <p className="font-semibold">+ {f(markupAmt)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Price</p>
        <p className="text-base font-bold text-primary">{f(retail)}</p>
      </div>
    </div>
  );
}

//     Tab type                                                                  

type Tab = "details" | "sell";

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
  const hasStore = useHasVerifiedStore();

  const { data: product, isLoading } = useQuery(storeProductDetailQuery(productId));

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [markupPct, setMarkupPct] = useState(0);
  const [markupInput, setMarkupInput] = useState("0");
  const [isLimited, setIsLimited] = useState(false);
  const [allowsOnTop, setAllowsOnTop] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxQty, setMaxQty] = useState(100);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("details");
  const [dirty, setDirty] = useState(false);

  // Cost = blank + print (server-computed). The markup % is relative to it.
  const cost = useMemo(() => (product ? (parseFloat(product.pricing.base_price) || 0) + (parseFloat(product.pricing.print_cost) || 0) : 0), [product]);
  const currency: CurrencyLike = product ? product.pricing.currency : {};

  // Hydrate the form once the product loads
  useEffect(() => {
    if (!product) return;
    setTitle(product.title ?? "");
    setDescription(product.description ?? "");
    const markup = parseFloat(product.pricing.markup_price) || 0;
    const pct = cost > 0 ? Math.round((markup / cost) * 10000) / 100 : 0;
    setMarkupPct(pct);
    setMarkupInput(String(pct));
    setIsLimited(product.is_limited_edition);
    setAllowsOnTop(!!product.allows_customization_on_top);
    setIsPrivate(!!product.is_private);
    setMaxQty(product.max_quantity ?? 100);
    // Every variant of the blank is listed; `enabled` says which ones the creator sells.
    setEnabledIds(new Set(product.variant_matrix.combinations.filter((v) => v.enabled).map((v) => v.variant_id)));
    setDirty(false);
  }, [product, cost]);

  const toggleVariant = (id: string) => {
    setDirty(true);
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setManyVariants = (ids: string[], on: boolean) => {
    setDirty(true);
    setEnabledIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  };

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

  const isPending = !!product && product.status === "pending_review";
  const isPublished = !!product && (product.is_published || product.status === "published");
  // A design waiting for review is locked like a published one until staff decide.
  const isDraft = !isPublished && !isPending;

  // What would still block publishing with the CURRENT form values (the server enforces the same rules).
  const blockers = useMemo<PublishBlocker[]>(() => {
    if (!product) return [];
    const out: PublishBlocker[] = [];
    if (markupPct <= 0) out.push("markup_required");
    if (enabledIds.size === 0) out.push("no_variants");
    if (product.publish_blockers.includes("no_mockups")) out.push("no_mockups");
    return out;
  }, [product, markupPct, enabledIds]);

  const buildPayload = (p: ProductDetail): UpdateProductPayload => {
    const payload: UpdateProductPayload = {};
    if (isDraft) {
      payload.title = title.trim() || p.title;
      payload.description = description;
    }
    if (hasStore) {
      payload.markup_price = ((cost * markupPct) / 100).toFixed(p.pricing.currency.decimal_places ?? 2);
      payload.enabled_variant_ids = [...enabledIds];
      payload.allows_customization_on_top = allowsOnTop;
      if (isDraft) {
        payload.is_private = isPrivate;
        payload.is_limited_edition = isLimited;
        payload.max_quantity = isLimited ? maxQty : null;
      }
    }
    return payload;
  };

  const refreshCaches = () => {
    qc.invalidateQueries({ queryKey: storeProductKeys.all });
    qc.invalidateQueries({ queryKey: designKeys.all });
  };

  const mutation = useMutation({
    mutationFn: async (opts: { publish: boolean }) => {
      if (!product) throw new Error("No product");
      const saved = dirty ? await storeProductApi.update(productId, buildPayload(product)) : product;
      if (opts.publish) await storeProductApi.publish(productId);
      return saved;
    },
    onSuccess: (_saved, opts) => {
      toast.success(opts.publish ? "Submitted for review — it goes live once approved" : "Product updated");
      refreshCaches();
      onSaved();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to update product");
      refreshCaches();
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

  const handleEditInStudio = async () => {
    if (!product) return;
    if (dirty) {
      const ok = await confirm({
        title: "Leave without saving?",
        description: "Changes to the details and pricing on this screen won't be kept.",
        confirmLabel: "Open studio",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
    navigate({ to: "/studio", search: { blank: product.blank.slug, design: product.id } });
  };

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
          className="relative z-10 w-full max-h-[90dvh] overflow-hidden rounded-t-3xl border border-border/60 bg-surface shadow-2xl md:w-[720px] md:rounded-3xl md:max-h-[85dvh]"
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
              {hasStore && (
                <div className="flex gap-0 border-b border-border/40 px-5">
                  {(["details", "sell"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-4 py-2.5 text-xs font-medium transition border-b-2 ${
                        tab === t
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t === "details" ? "Details" : "Pricing & variants"}
                    </button>
                  ))}
                </div>
              )}

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
                <AnimatePresence mode="wait">
                  {tab === "details" && (
                    <motion.div
                      key="details"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      className="space-y-4"
                    >
                      {!isDraft && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            {isPending ? "This product is waiting for review. Editing is locked until staff approve or reject it." : "This product is published. Some fields may be read-only."}
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

                      {/* Edit in Studio */}
                      {product.status !== "archived" && (
                        <div className="rounded-xl border border-border/40 bg-surface-elevated/30 p-3">
                          <p className="text-xs font-medium">3D Mockup</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Reopen the studio to adjust artwork placement, colors, and angles. Your design opens exactly as you saved it.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-8 rounded-full text-xs"
                            onClick={handleEditInStudio}
                          >
                            <Palette className="mr-1.5 h-3.5 w-3.5" />
                            Edit in Studio
                            <ChevronRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Upsell for non-sellers */}
                      {!hasStore && (
                        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                          <Store className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Have something worth selling?</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Get a verified store to set pricing, curate variants, and publish this design to the marketplace.
                            </p>
                            <Button asChild variant="outline" size="sm" className="mt-2 h-8 rounded-full text-xs">
                              <Link to="/store">
                                Get a store
                                <ChevronRight className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {tab === "sell" && hasStore && (
                    <motion.div
                      key="sell"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      className="space-y-4"
                    >
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
                          className="w-full accent-primary"
                        />
                        <PricingPreview cost={cost} markupPct={markupPct} currency={currency} />
                        <p className="text-[10px] text-muted-foreground">
                          Markup is a percentage of the base price. Buyers pay base price + your markup.
                        </p>
                      </div>

                      {/* Visibility */}
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
                        <div>
                          <p className="text-sm font-medium">{isPrivate ? "Private" : "Public"}</p>
                          <p className="text-xs text-muted-foreground">
                            {isDraft
                              ? isPrivate
                                ? "Hidden from the market and search. Only people with your share link can view and order it."
                                : "Listed in the market and search once approved."
                              : "Visibility can't change after submission. Copy the design to publish it with different visibility."}
                          </p>
                        </div>
                        <Switch
                          checked={isPrivate}
                          disabled={!isDraft}
                          aria-label="Private product"
                          onCheckedChange={(v) => { setIsPrivate(v); setDirty(true); }}
                        />
                      </div>

                      {/* Customization on top */}
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
                        <div>
                          <p className="text-sm font-medium">Allow customization on top</p>
                          <p className="text-xs text-muted-foreground">Let buyers add their own artwork to your design in the studio.</p>
                        </div>
                        <Switch
                          checked={allowsOnTop}
                          onCheckedChange={(v) => { setAllowsOnTop(v); setDirty(true); }}
                        />
                      </div>

                      {/* Limited edition */}
                      <div className="space-y-2">
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
                      </div>

                      {/* Variant matrix */}
                      {product.variant_matrix.combinations.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No variant data available.
                        </p>
                      ) : (
                        <VariantMatrix
                          matrix={product.variant_matrix}
                          enabledIds={enabledIds}
                          onToggle={toggleVariant}
                          onSetMany={setManyVariants}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="border-t border-border/40 px-5 py-4">
                {isDraft && blockers.length > 0 && (
                  <ul className="mb-3 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400">
                    {blockers.map((b) => (
                      <li key={b} className="flex gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {PUBLISH_BLOCKER_TEXT[b]}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleClose} disabled={mutation.isPending}>
                    Cancel
                  </Button>
                  <Button
                    variant={isDraft ? "outline" : "default"}
                    className="flex-1"
                    onClick={() => mutation.mutate({ publish: false })}
                    disabled={mutation.isPending || !dirty}
                  >
                    {mutation.isPending && !mutation.variables?.publish ? (
                      <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving…</>
                    ) : (
                      <><Sparkles className="mr-2 h-3.5 w-3.5" /> Save changes</>
                    )}
                  </Button>
                  {isDraft && hasStore && (
                    <Button
                      className="flex-1"
                      onClick={() => mutation.mutate({ publish: true })}
                      disabled={mutation.isPending || blockers.length > 0}
                    >
                      {mutation.isPending && mutation.variables?.publish ? (
                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Submitting…</>
                      ) : (
                        <><Store className="mr-2 h-3.5 w-3.5" /> Submit for review</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Confirm modal portal */}
      {ConfirmModal}
    </>
  );
}
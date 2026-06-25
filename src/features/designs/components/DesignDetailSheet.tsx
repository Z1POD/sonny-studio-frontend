/**
 * src/features/userDesigns/components/DesignDetailSheet.tsx
 *
 * Bottom sheet showing full detail for a saved design:
 * - Mockup carousel with lightbox tap
 * - Actions: edit in studio, 3D canvas, reorder/checkout, delete
 * - Pricing info
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Pencil, Box, ShoppingCart, Trash2, Loader2,
  ChevronLeft, ChevronRight, Globe, Archive, ImageIcon,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { designDetailQuery, designKeys } from "../queries";
import { storeProductApi, getRetailPrice } from "@/features/store/api";
import type { ProductListItem } from "@/features/store/api";
import { useConfirm } from "@/features/store/components/ConfirmModal";
import { useCheckoutStore } from "@/features/checkout/store";
import { DesignLightbox } from "./DesignLightbox";

interface DesignDetailSheetProps {
  design: ProductListItem | null;
  onClose: () => void;
  onMutated: () => void;
}

export function DesignDetailSheet({ design, onClose, onMutated }: DesignDetailSheetProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirm, ConfirmModal] = useConfirm();
  const openCheckout = useCheckoutStore((s) => s.open);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [mockupIdx, setMockupIdx] = useState(0);

  const { data: detail, isLoading } = useQuery({
    ...designDetailQuery(design?.id ?? ""),
    enabled: !!design?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => storeProductApi.deleteProduct(design!.id),
    onSuccess: () => {
      toast.success("Design deleted");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete design"),
  });

  const archiveMutation = useMutation({
    mutationFn: () => storeProductApi.archive(design!.id),
    onSuccess: () => {
      toast.success("Design archived");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to archive"),
  });

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete this design?",
      description: "This cannot be undone. All mockups and data will be removed.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) deleteMutation.mutate();
  };

  const handleArchive = async () => {
    const ok = await confirm({
      title: "Archive this design?",
      description: "The design will be hidden from your store but you can still reorder it.",
      confirmLabel: "Archive",
    });
    if (ok) archiveMutation.mutate();
  };

  const handleEditInStudio = () => {
    if (!design) return;
    onClose();
    navigate({ to: "/studio", state: { productId: design.id } });
  };

  const handle3DCanvas = () => {
    if (!design) return;
    onClose();
    navigate({ to: "/studio", state: { productId: design.id, mode: "3d" } });
  };

  const handleReorder = () => {
    if (!detail) {
      toast.error("Design details still loading");
      return;
    }
    const pricing = detail.pricing;
    const sym =
      typeof pricing?.currency === "object" ? pricing.currency.symbol : "Br";
    const retail = parseFloat(pricing?.retail_price ?? "0");
    const variants = detail.enabled_variant ?? [];

    openCheckout({
      productId: detail.id,
      productName: detail.title,
      thumbnailUrl: detail.thumbnail_url,
      mockupUrl: detail.mockups?.[0]?.url,
      basePrice: parseFloat(pricing?.base_price ?? "0"),
      printCost: 0,
      currencySymbol: sym,
      variants: variants.map((v) => ({ ...v, quantity: 1 })),
      artworks: {},
      printAreas: [],
    });
  };

  const mockups = detail?.mockups ?? [];
  const lightboxImages = mockups.map((m) => ({
    url: m.url,
    label: m.type,
  }));

  const isDraft = !design?.is_published && design?.status !== "archived";
  const isPublished = design?.is_published || design?.status === "published";
  const isArchived = design?.status === "archived";

  return (
    <>
      <AnimatePresence>
        {design && (
          <>
            <motion.div
              key="design-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              key="design-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border/60 bg-background shadow-2xl"
            >
              {/* Handle */}
              <div className="flex shrink-0 justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>

              {/* Title bar */}
              <div className="flex shrink-0 items-center justify-between px-5 pb-3">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="truncate font-semibold">{design.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {isPublished ? "Published" : isArchived ? "Archived" : "Draft"}
                    {" · "}
                    {getRetailPrice(design)}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto pb-8">
                {isLoading || !detail ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-5 px-5">
                    {/* Mockup carousel */}
                    {mockups.length > 0 ? (
                      <div>
                        <div className="relative overflow-hidden rounded-2xl bg-muted aspect-square">
                          <img
                            src={mockups[mockupIdx]?.url}
                            alt={mockups[mockupIdx]?.type ?? "Mockup"}
                            className="h-full w-full cursor-zoom-in object-cover"
                            onClick={() => setLightboxIdx(mockupIdx)}
                          />
                          {/* Primary badge */}
                          {mockups[mockupIdx]?.is_primary && (
                            <span className="absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                              Primary
                            </span>
                          )}
                          {/* Nav arrows */}
                          {mockups.length > 1 && (
                            <>
                              <button
                                onClick={() => setMockupIdx((i) => (i - 1 + mockups.length) % mockups.length)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setMockupIdx((i) => (i + 1) % mockups.length)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {/* Tap hint */}
                          <div className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                            Tap to expand
                          </div>
                        </div>

                        {/* Thumbnail strip */}
                        {mockups.length > 1 && (
                          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                            {mockups.map((m, i) => (
                              <button
                                key={m.id}
                                onClick={() => setMockupIdx(i)}
                                className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                                  i === mockupIdx ? "border-primary" : "border-transparent opacity-60"
                                }`}
                              >
                                <img src={m.url} alt={m.type} className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted">
                        <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Retail price", value: getRetailPrice(design) },
                        { label: "Sold", value: String(detail.sold_quantity) },
                        { label: "Views", value: String(detail.analytics?.view_count ?? 0) },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-center">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="mt-0.5 text-base font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    {detail.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {detail.description}
                      </p>
                    )}

                    {/* Variants */}
                    {detail.enabled_variant?.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Variants
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.enabled_variant.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs"
                            >
                              <span
                                className="h-3 w-3 rounded-full border border-border/60"
                                style={{ background: v.color.hex }}
                              />
                              {v.color.name} · {v.size}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Primary actions */}
                    <div className="space-y-2">
                      <Button
                        className="w-full gap-2"
                        onClick={handleReorder}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {detail.sold_quantity > 0 ? "Reorder" : "Order Now"}
                      </Button>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="gap-2 text-sm"
                          onClick={handleEditInStudio}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit Design
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2 text-sm"
                          onClick={handle3DCanvas}
                        >
                          <Box className="h-4 w-4" />
                          3D View
                        </Button>
                      </div>
                    </div>

                    {/* Secondary actions */}
                    <div className="flex gap-2 pt-1">
                      {!isArchived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 gap-1.5 text-muted-foreground text-xs"
                          onClick={handleArchive}
                          disabled={archiveMutation.isPending}
                        >
                          {archiveMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                          Archive
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 gap-1.5 text-destructive text-xs hover:text-destructive"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && lightboxImages.length > 0 && (
          <DesignLightbox
            images={lightboxImages}
            initialIndex={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
          />
        )}
      </AnimatePresence>

      {ConfirmModal}
    </>
  );
}
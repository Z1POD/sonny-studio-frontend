// src/features/userDesigns/components/DesignDetailSheet.tsx

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Pencil, Box, Rocket, Trash2, Loader2,
  ChevronLeft, ChevronRight, ImageIcon, Archive,
  ChevronDown,
} from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { designDetailQuery, designKeys } from "../queries";
import { storeProductApi, getRetailPrice, enabledByColor } from "@/features/store/api";
import type { ProductListItem } from "@/features/store/api";
import { useConfirm } from "@/shared/components/ConfirmModal";
import { DesignLightbox } from "./DesignLightbox";
import { BrandLoader } from "@/components/ui/loader";


//     Component                                                                  

interface DesignDetailSheetProps {
  design: ProductListItem | null;
  onClose: () => void;
  onEdit: (d: ProductListItem) => void;
  onMutated: () => void;
}

export function DesignDetailSheet({ design, onClose, onEdit, onMutated }: DesignDetailSheetProps) {
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const [confirm, ConfirmModal] = useConfirm();
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
  const [mockupIdx, setMockupIdx]         = useState(0);
  const [variantsExpanded, setVariantsExpanded] = useState(false);

  const [localDesign, setLocalDesign] = useState<ProductListItem | null>(design);
  if (design && design !== localDesign) {
    setLocalDesign(design);
  }
  const isOpen = !!design;

  // Full product detail (mockups, pricing, variant matrix, stats)
  const { data: detail, isLoading } = useQuery({
    ...designDetailQuery(localDesign?.id ?? ""),
    enabled: !!localDesign?.id,
  });

  //    Mutations                                                                
  const deleteMutation = useMutation({
    mutationFn: () => storeProductApi.deleteProduct(localDesign!.id),
    onSuccess: () => {
      toast.success("Design deleted");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const archiveMutation = useMutation({
    mutationFn: () => storeProductApi.archive(localDesign!.id),
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
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) deleteMutation.mutate();
  };

  const handleArchive = async () => {
    const ok = await confirm({
      title: "Archive this design?",
      description: "Hidden from your store but still reorderable.",
    });
    if (ok) archiveMutation.mutate();
  };

  //    Edit entry point — same modal used everywhere else                       
  const handleEdit = () => {
    onClose();
    onEdit(localDesign!);
  };

  const handle3DCanvas = () => {
    onClose();
    navigate({ to: "/studio", search: { blank: localDesign!.blank.slug, design: localDesign!.id, view: "3d" } });
  };

  // Colours and the sizes the creator currently sells in each.
  const groupedVariants = useMemo(
    () => (detail ? enabledByColor(detail.variant_matrix).map((g) => ({ name: g.color.name, hex: g.color.hex, sizes: g.sizes })) : []),
    [detail],
  );

  const mockups        = detail?.mockups ?? [];
  const lightboxImages = mockups.map((m) => ({ url: m.url, label: m.angle }));
  const isArchived     = localDesign?.status === "archived";
  const isPublished    = localDesign?.is_published || localDesign?.status === "published";

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-border/60 p-0 [&>button]:hidden"
        >
          {/* Handle */}
          <div className="flex shrink-0 justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Title bar */}
          <SheetHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 px-5 pb-3 text-left">
            <div className="min-w-0 flex-1 pr-3">
              <SheetTitle className="truncate text-base font-semibold">
                {localDesign?.title}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {isPublished ? "Published" : isArchived ? "Archived" : "Draft"}
                {" · "}
                {localDesign ? getRetailPrice(localDesign) : null}
              </SheetDescription>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto pb-8 max-w-[100%] md:max-w-[600px] mx-auto no-scrollbar w-full">
            {isLoading || !detail ? (
              <div className="flex items-center justify-center py-20">
                <BrandLoader size="md" />
              </div>
            ) : (
              <div className="space-y-5 px-5">
                    {/* Mockup carousel */}
                    {mockups.length > 0 ? (
                      <div>
                        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                          <img
                            src={mockups[mockupIdx]?.url}
                            alt={mockups[mockupIdx]?.angle ?? "Mockup"}
                            className="h-full w-full cursor-zoom-in object-cover"
                            onClick={() => setLightboxIdx(mockupIdx)}
                          />
                          {mockups[mockupIdx]?.is_primary && (
                            <span className="absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                              Primary
                            </span>
                          )}
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
                                <img src={m.url} alt={m.angle} className="h-full w-full object-cover" />
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

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Price",  value: localDesign ? getRetailPrice(localDesign) : "" },
                        { label: "Sold",   value: String(detail.stats.sold_quantity) },
                        { label: "Views",  value: String(detail.stats.view_count) },
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
                    {groupedVariants.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setVariantsExpanded((v) => !v)}
                          className="mb-2 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          <span>
                            Variants ({groupedVariants.length} colors)
                          </span>

                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              variantsExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>


                        <div className="space-y-2">
                          {groupedVariants
                            .slice(0, variantsExpanded ? groupedVariants.length : 1)
                            .map((color) => (
                              <div
                                key={color.name}
                                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-2.5"
                              >
                                <div className="flex min-w-28 items-center gap-2">
                                  <span
                                    className="h-4 w-4 rounded-full border border-border"
                                    style={{ backgroundColor: color.hex }}
                                  />

                                  <span className="text-sm font-medium">
                                    {color.name}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  {color.sizes.map((size) => (
                                    <span
                                      key={size}
                                      className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium"
                                    >
                                      {size}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>


                        {groupedVariants.length > 1 && !variantsExpanded && (
                          <button
                            type="button"
                            onClick={() => setVariantsExpanded(true)}
                            className="mt-2 text-xs font-medium text-primary"
                          >
                            + {groupedVariants.length - 1} more colors
                          </button>
                        )}
                      </div>
                    )}

                    {/* Primary CTA — Publish & Review */}
                    <Button className="w-full gap-2" onClick={handleEdit} disabled={isLoading}>
                      <Rocket className="h-4 w-4" />
                      {detail.is_published ? "Edit pricing & variants" : "Review & publish"}
                    </Button>

                    {/* Secondary CTAs */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="gap-2 text-sm"
                        onClick={handleEdit}
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

                    {/* Danger zone */}
                    <div className="flex gap-2 pt-1">
                      {!isArchived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 gap-1.5 text-muted-foreground text-xs"
                          onClick={handleArchive}
                          disabled={archiveMutation.isPending}
                        >
                          {archiveMutation.isPending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Archive className="h-3.5 w-3.5" />}
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
                        {deleteMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                        Delete
                      </Button>
                    </div>

                  </div>
                )}
              </div>
        </SheetContent>
      </Sheet>

      {/* Lightbox */}
      {lightboxIdx !== null && lightboxImages.length > 0 && (
        <DesignLightbox
          images={lightboxImages}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {ConfirmModal}
    </>
  );
}
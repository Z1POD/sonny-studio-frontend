/**
 * src/features/userDesigns/components/DesignDetailSheet.tsx — v4
 *
 * Fixes:
 *  - mapToApparelProduct uses exact editor-config shape (render_config, model.glb_url)
 *  - Reorder flow: loadDesign now reads artworks from
 *    detail.render_config.artworkPrintInfos (real saved shape)
 *  - studioDetailQuery still fetched for methods/tiers when user wants to
 *    reorder with a modified design — but for a straight reorder we can
 *    reconstruct from detail.render_config directly (fast path)
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Pencil, Box, ShoppingCart, Trash2, Loader2,
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
import { storeProductApi, getRetailPrice } from "@/features/store/api";
import type { ProductListItem, ProductDetail } from "@/features/store/api";
import { useConfirm } from "@/features/store/components/ConfirmModal";
import { useCheckoutStore } from "@/features/checkout/store";
import { DesignLightbox } from "./DesignLightbox";
import type { ApparelProduct, PrintArea } from "@/features/studio/store";
import { BrandLoader } from "@/components/ui/loader";

//     Build ApparelProduct from saved product's render_config                  
// Mirrors mapSavedProductToApparelProduct in StudioWorkspace.
// No extra fetch — everything needed is already in detail.render_config.

function buildApparelProductFromDetail(detail: any): ApparelProduct {
  const rc     = detail.render_config ?? {};
  const cam    = rc.camera ?? {};
  const orbit  = cam.orbit ?? {};
  const shadows = rc.contact_shadows ?? {};

  const printAreas: PrintArea[] = (rc.print_areas ?? []).map((pa: any) => ({
    id:               pa.print_area_id,
    areaKey:          pa.area_key,
    name:             pa.name,
    placement:        pa.placement,
    meshName:         pa.mesh_name ?? "",
    widthCm:          pa.width_cm,
    heightCm:         pa.height_cm,
    allowScaling:     true,
    allowRotation:    false,
    maxLayers:        2,
    allowedFileTypes: ["png", "jpg", "svg"],
    methods:          [],
    uvBounds: pa.uv_config?.uv_bounds
      ? { minU: pa.uv_config.uv_bounds.min_u, minV: pa.uv_config.uv_bounds.min_v,
          maxU: pa.uv_config.uv_bounds.max_u, maxV: pa.uv_config.uv_bounds.max_v }
      : undefined,
    worldBounds: pa.uv_config?.world_bounds
      ? { center: pa.uv_config.world_bounds.center,
          halfExtents: pa.uv_config.world_bounds.half_extents,
          rotation: pa.uv_config.world_bounds.rotation }
      : undefined,
  }));

  const variants = (detail.enabled_variant ?? []).map((v: any) => ({
    id:              v.id,
    sku:             v.sku ?? "",
    color:           v.color,
    size:            v.size,
    stockQuantity:   v.stock_quantity ?? 99,
    isInStock:       v.is_in_stock ?? true,
    additionalPrice: "0.00",
  }));

  return {
    id:             detail.base_apparel?.id ?? "",
    name:           detail.base_apparel?.name ?? detail.title ?? "",
    slug:           "",
    description:    detail.description ?? "",
    basePrice:      detail.pricing?.base_price ?? "0.00",
    currencySymbol: detail.pricing?.currency?.symbol ?? "Br",
    modelUrl:       rc.model_url ?? "",
    environment:    rc.environment ?? "studio",
    cameraConfig: {
      position: cam.position ?? [0, 1.5, 3],
      fov:      cam.fov ?? 35,
      captureDistanceScale: cam.captureDistanceScale ?? cam.capture_distance_scale ?? 1,
      captureLookAtOffset:  cam.captureLookAtOffset  ?? cam.capture_look_at_offset  ?? [0, 0, 0],
      orbit: {
        minDistance:   orbit.min_distance   ?? 0.8,
        maxDistance:   orbit.max_distance   ?? 8,
        minPolarAngle: orbit.min_polar_angle ?? 0.8,
        maxPolarAngle: orbit.max_polar_angle ?? 1.8,
        enablePan:     orbit.enable_pan     ?? false,
        enableZoom:    orbit.enable_zoom    ?? true,
      },
    },
    renderConfig: {
      environment:   rc.environment   ?? "studio",
      background:    rc.background    ?? "#f5f5f5",
      modelPosition: rc.model_position ?? [0, 0, 0],
      ...(rc.lighting ? { lighting: rc.lighting } : {}),
      contactShadows: {
        enabled:  shadows.enabled  ?? true,
        position: shadows.position ?? [0, -1, 0],
        opacity:  shadows.opacity  ?? 0.7,
        scale:    shadows.scale    ?? 8,
        blur:     shadows.blur     ?? 3,
        far:      shadows.far      ?? 3,
      },
    } as any,
    materialConfig: {
      textureUrl:   rc.material?.texture_url   ?? null,
      normalMapUrl: rc.material?.normal_map_url ?? null,
      roughness:    rc.material?.roughness      ?? 0.9,
      metalness:    rc.material?.metalness      ?? 0,
    },
    colors:          [...new Set<string>(variants.map((v: any) => v.color.hex))],
    colorableMeshes: rc.colorable_meshes ?? [],
    printAreas,
    variants,
    defaultView:         undefined,
    studioCapabilities:  undefined,
  };
}

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
  const loadDesign  = useCheckoutStore((s) => s.loadDesign);
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
  const [mockupIdx, setMockupIdx]         = useState(0);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [variantsExpanded, setVariantsExpanded] = useState(false);

  const [localDesign, setLocalDesign] = useState<ProductListItem | null>(design);
  if (design && design !== localDesign) {
    setLocalDesign(design);
  }
  const isOpen = !!design;

  // Full product detail (has render_config, snapshot, mockups, enabled_variant)
  const { data: detailRaw, isLoading } = useQuery({
    ...designDetailQuery(localDesign?.id ?? ""),
    enabled: !!localDesign?.id,
  });
  const detail = (detailRaw as any)?.data ?? detailRaw;

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

  //    Reorder: reconstruct ApparelProduct from detail.render_config            
  // Fast path — no extra API call needed. All data is already in the product detail.
  const handleReorder = async () => {
    if (!detail) { toast.error("Design details still loading"); return; }

    setReorderLoading(true);
    try {
      const apparelProduct = buildApparelProductFromDetail(detail);
      loadDesign(detail as ProductDetail, apparelProduct);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to prepare checkout");
    } finally {
      setReorderLoading(false);
    }
  };

  //    Edit entry point — same modal used everywhere else                       
  const handleEdit = () => {
    onClose();
    onEdit(localDesign!);
  };

  const handle3DCanvas = () => {
    onClose();
    navigate({
      to: "/studio",
      state: {
        productId: localDesign!.id,
        apparelId: detail?.base_apparel?.id,
        mode: "3d",
      },
    });
  };

  const variants = detail?.enabled_variant ?? [];
  const groupedVariants = useMemo(() => {
  const map = new Map();

  variants.forEach((variant) => {
      const key = variant.color.id ?? variant.color.name;

      if (!map.has(key)) {
        map.set(key, {
          name: variant.color.name,
          hex: variant.color.hex,
          sizes: [],
        });
      }

      map.get(key)!.sizes.push(variant.size);
    });

    return [...map.values()];
  }, [variants]);

  const mockups        = detail?.mockups ?? [];
  const lightboxImages = mockups.map((m: any) => ({ url: m.url, label: m.type }));
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
                            alt={mockups[mockupIdx]?.type ?? "Mockup"}
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
                            {mockups.map((m: any, i: number) => (
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

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Price",  value: localDesign ? getRetailPrice(localDesign) : "" },
                        // { label: "Sold",    value: String(detail.sold_quantity ?? 0) },
                        // { label: "Views",   value: String(detail.analytics?.view_count ?? 0) },
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

                    {/* Primary CTA — Reorder */}
                    <Button
                      className="w-full gap-2"
                      onClick={handleReorder}
                      disabled={reorderLoading || isLoading}
                    >
                      {reorderLoading ? (
                        <><BrandLoader size="md" />Preparing order…</>
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4" />
                          {detail.sold_quantity > 0 ? "Order Now" : "Order Now"}
                        </>
                      )}
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
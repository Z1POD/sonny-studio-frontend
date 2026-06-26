/**
 * src/features/userDesigns/components/DesignDetailSheet.tsx — v3
 *
 * Fixed: mapToApparelProduct now uses the real API response shape
 * (d.apparel.*, config.render_config, config.model.glb_url, d.print_areas, d.variants)
 * matching the original StudioWorkspace v7.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Pencil, Box, ShoppingCart, Trash2, Loader2,
  ChevronLeft, ChevronRight, ImageIcon, Archive,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { designDetailQuery, designKeys } from "../queries";
import { storeProductApi, getRetailPrice } from "@/features/store/api";
import type { ProductListItem, ProductDetail } from "@/features/store/api";
import { useConfirm } from "@/features/store/components/ConfirmModal";
import { useCheckoutStore } from "@/features/checkout/store";
import { DesignLightbox } from "./DesignLightbox";
import { studioDetailQuery } from "@/features/studio/queries";
import type { ApparelProduct, PrintArea } from "@/features/studio/store";

// ─── Map API response → ApparelProduct ────────────────────────────────────────
// Shape: d.apparel.*, d.variants, d.print_areas, d["3d_configuration"].render_config

function mapToApparelProduct(d: any, config: any): ApparelProduct {
  const render  = config.render_config;          // ← real key
  const cam     = render.camera;
  const orbit   = cam.orbit;
  const shadows = render.contact_shadows;

  const printAreas: PrintArea[] = (d.print_areas ?? []).map((p: any) => {
    const uvConfig           = p.uv_config || {};
    const rawWorldBounds     = uvConfig.world_bounds;
    const rawUvBounds        = uvConfig.uv_bounds;
    const rawTransformLimits = uvConfig.transform_limits;
    return {
      id:               p.id,
      areaKey:          p.key ?? p.area_key,
      name:             p.name,
      placement:        p.placement,
      meshName:         p.mesh ?? p.mesh_name,
      aspectRatio:      p.ratio ?? p.aspect_ratio,
      allowScaling:     p.rules?.scale      ?? p.allow_scaling   ?? true,
      allowRotation:    p.rules?.rotate     ?? p.allow_rotation  ?? false,
      maxLayers:        p.rules?.max_layers ?? p.max_layers      ?? 1,
      widthCm:          p.w  ?? p.width_cm  ?? 35,
      heightCm:         p.h  ?? p.height_cm ?? 42,
      allowedFileTypes: p.rules?.file_types ?? p.allowed_file_types ?? ["png", "jpg", "svg"],
      sortOrder:        p.sort,
      currency:         p.currency,
      methods: (p.methods ?? []).map((m: any) => ({
        code: m.code,
        name: m.name,
        tiers: (m.tiers ?? []).map((t: any) => ({
          size:              t.size,
          max_w:             t.max_w,
          max_h:             t.max_h,
          price:             t.price,
          extra_color_price: t.extra_color_price ?? "0.00",
        })),
      })),
      uvBounds: rawUvBounds && typeof rawUvBounds === "object"
        ? { minU: rawUvBounds.min_u, minV: rawUvBounds.min_v,
            maxU: rawUvBounds.max_u, maxV: rawUvBounds.max_v }
        : undefined,
      worldBounds: rawWorldBounds && typeof rawWorldBounds === "object"
        ? { center: rawWorldBounds.center,
            halfExtents: rawWorldBounds.half_extents,
            rotation: rawWorldBounds.rotation }
        : undefined,
      transformLimits: rawTransformLimits && typeof rawTransformLimits === "object"
        ? { minScale: rawTransformLimits.min_scale, maxScale: rawTransformLimits.max_scale,
            minX: rawTransformLimits.min_x,         maxX: rawTransformLimits.max_x,
            minY: rawTransformLimits.min_y,         maxY: rawTransformLimits.max_y }
        : undefined,
      cameraFocus: p.camera_focus
        ? { position: p.camera_focus.position, target: p.camera_focus.target }
        : undefined,
      previewImage: p.preview_image,
    };
  });

  return {
    id:             d.apparel.id,
    name:           d.apparel.name,
    slug:           d.apparel.slug,
    description:    d.apparel.description ?? "",
    basePrice:      d.apparel.pricing?.base_price ?? d.apparel.base_price ?? "0.00",
    currencySymbol: d.apparel.pricing?.currency?.symbol ?? "Br",
    modelUrl: config.model?.glb_url ?? config.model_url ?? "",    // ← real key
    environment:    render.environment,
    cameraConfig: {
      position: cam.position,
      fov:      cam.fov,
      captureDistanceScale: cam.capture_distance_scale ?? cam.captureDistanceScale ?? 0.42,
      captureLookAtOffset:  cam.capture_look_at_offset  ?? cam.captureLookAtOffset  ?? [0, -0.08, 0],
      orbit: {
        minDistance:   orbit.min_distance,
        maxDistance:   orbit.max_distance,
        minPolarAngle: orbit.min_polar_angle,
        maxPolarAngle: orbit.max_polar_angle,
        enablePan:     orbit.enable_pan,
        enableZoom:    orbit.enable_zoom,
      },
    },
    renderConfig: {
      environment:   render.environment,
      background:    render.background,
      modelPosition: render.model_position,
      ...(render.lighting ? { lighting: render.lighting } : {}),
      contactShadows: {
        enabled:  shadows.enabled,
        position: shadows.position,
        opacity:  shadows.opacity,
        scale:    shadows.scale,
        blur:     shadows.blur,
        far:      shadows.far,
      },
    } as any,
    materialConfig: {
      textureUrl:   config.material?.texture_url   ?? null,
      normalMapUrl: config.material?.normal_map_url ?? null,
      roughness:    config.material?.roughness      ?? 0.9,
      metalness:    config.material?.metalness      ?? 0,
    },
    colors:          [...new Set<string>(d.variants.map((v: any) => v.color.hex))],
    colorableMeshes: render.colorable_meshes ?? config.colorable_meshes ?? [],
    printAreas,
    variants: d.variants.map((v: any) => ({
      id:              v.id,
      sku:             v.sku,
      color:           v.color,
      size:            v.size,
      stockQuantity:   v.stock_quantity,
      isInStock:       v.is_in_stock,
      additionalPrice: v.additional_price,
    })),
    defaultView: render.default_view,
    studioCapabilities: d.studio_capabilities ? {
      allowText:           d.studio_capabilities.allow_text,
      allowImages:         d.studio_capabilities.allow_images,
      allowSvg:            d.studio_capabilities.allow_svg,
      allowMultipleLayers: d.studio_capabilities.allow_multiple_layers,
      allowColorChange:    d.studio_capabilities.allow_color_change,
      allowArPreview:      d.studio_capabilities.allow_ar_preview,
    } : undefined,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface DesignDetailSheetProps {
  design: ProductListItem | null;
  onClose: () => void;
  onMutated: () => void;
}

export function DesignDetailSheet({ design, onClose, onMutated }: DesignDetailSheetProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirm, ConfirmModal] = useConfirm();
  const loadDesign = useCheckoutStore((s) => s.loadDesign);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [mockupIdx, setMockupIdx] = useState(0);
  const [reorderLoading, setReorderLoading] = useState(false);

  // ── Full product detail ─────────────────────────────────────────────────────
  const { data: detail, isLoading } = useQuery({
    ...designDetailQuery(design?.id ?? ""),
    enabled: !!design?.id,
  });

  // ── Apparel config (needed for reorder + studio nav) ────────────────────────
  const apparelId = (detail as any)?.base_apparel?.id ?? null;
  const { data: studioData } = useQuery({
    ...studioDetailQuery(apparelId ?? ""),
    enabled: !!apparelId,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => storeProductApi.deleteProduct(design!.id),
    onSuccess: () => {
      toast.success("Design deleted");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
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

  // ── Reorder: build apparelProduct then loadDesign ───────────────────────────
  const handleReorder = async () => {
    if (!detail) { toast.error("Design details still loading"); return; }
    if (!studioData) { toast.error("Loading product config, try again in a moment"); return; }

    setReorderLoading(true);
    try {
      const d = (studioData as any).data ?? studioData;
      const config = d["3d_configuration"];
      const apparelProduct = mapToApparelProduct(d, config);
      loadDesign(detail as ProductDetail, apparelProduct);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to prepare checkout");
    } finally {
      setReorderLoading(false);
    }
  };

  // ── Navigate to studio with saved state ─────────────────────────────────────
  const handleEditInStudio = () => {
    if (!detail) return;
    onClose();
    navigate({
      to: "/studio",
      state: {
        productId: design!.id,
        apparelId: (detail as any)?.base_apparel?.id,
      },
    });
  };

  const handle3DCanvas = () => {
    if (!detail) return;
    onClose();
    navigate({
      to: "/studio",
      state: {
        productId: design!.id,
        apparelId: (detail as any)?.base_apparel?.id,
        mode: "3d",
      },
    });
  };

  const mockups = (detail as any)?.mockups ?? [];
  const lightboxImages = mockups.map((m: any) => ({ url: m.url, label: m.type }));
  const isArchived = design?.status === "archived";
  const isPublished = design?.is_published || design?.status === "published";

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
                        { label: "Retail", value: getRetailPrice(design) },
                        { label: "Sold", value: String((detail as any).sold_quantity ?? 0) },
                        { label: "Views", value: String((detail as any).analytics?.view_count ?? 0) },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-center">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="mt-0.5 text-base font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    {(detail as any).description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {(detail as any).description}
                      </p>
                    )}

                    {/* Variants */}
                    {(detail as any).enabled_variant?.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Variants
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(detail as any).enabled_variant.map((v: any) => (
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

                    {/* Primary CTA */}
                    <Button
                      className="w-full gap-2"
                      onClick={handleReorder}
                      disabled={reorderLoading || !studioData}
                    >
                      {reorderLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Preparing order…</>
                      ) : !studioData ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4" />
                          {(detail as any).sold_quantity > 0 ? "Reorder" : "Order Now"}
                        </>
                      )}
                    </Button>

                    {/* Secondary CTAs */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="gap-2 text-sm" onClick={handleEditInStudio}>
                        <Pencil className="h-4 w-4" />
                        Edit Design
                      </Button>
                      <Button variant="outline" className="gap-2 text-sm" onClick={handle3DCanvas}>
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
/**
 * src/features/studio/components/StudioWorkspace.tsx — v7
 *
 * - Fused bottom nav with integrated price bar
 * - Continue button saves custom product to API first, then opens checkout with returned pricing
 * - ArtworkLibrary visibility controlled by StudioBottomNav
 * - Multi-variant selection support
 * - Passes user full name to checkout
 * - Captures all mockup angles for review carousel
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Shirt } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useStudioStore, getDefaultArtwork } from "../store";
import { studioDetailQuery } from "../queries";
import { StudioCanvas, type StudioCanvasHandle } from "./StudioCanvas";
import { StudioControls } from "./StudioControls";
import { ArtworkLibrary } from "./ArtworkLibrary";
import { CanvasDrop } from "./CanvasDrop";
import { Button } from "@/components/ui/button";
import { CheckOut } from "@/features/checkout/components/CheckOut";
import { useCheckoutStore } from "@/features/checkout/store";
import { storeProductApi } from "@/features/store/api";
import { useAuthStore } from "@/features/auth/store"; 
import type { PrintArea, ArtworkState } from "../store";

const CM = 0.01;

function classifyPrintSize(w: number, h: number) {
  const a = w * h;
  if (a <= 25) return "logo";
  if (a <= 74) return "a6";
  if (a <= 149) return "a5";
  if (a <= 312) return "a4";
  if (a <= 624) return "a3";
  return "large";
}

async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export function StudioWorkspace() {
  const canvasRef = useRef<StudioCanvasHandle>(null);
  const [mounted, setMounted] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [artworkLibraryOpen, setArtworkLibraryOpen] = useState(false);
  const [capturedMockups, setCapturedMockups] = useState<string[]>([]);

  const routerState = useRouterState();
  const locationState = routerState.location.state as { apparelId?: string } | undefined;
  const apparelId = locationState?.apparelId ?? null;
  const hasApparel = Boolean(apparelId);

  const setProduct = useStudioStore((s) => s.setProduct);
  const product = useStudioStore((s) => s.product);
  const selectedPrintAreaId = useStudioStore((s) => s.selectedPrintAreaId);
  const setArtwork = useStudioStore((s) => s.setArtwork);
  const artworks = useStudioStore((s) => s.artworks);
  const selectedColor = useStudioStore((s) => s.selectedColor);
  const selectedMethods = useStudioStore((s) => s.selectedMethods);
  const selectedTiers = useStudioStore((s) => s.selectedTiers);

  const openCheckout = useCheckoutStore((s) => s.open);

  const { data, isLoading, error } = useQuery({
    ...studioDetailQuery(apparelId ?? ""),
    enabled: hasApparel,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!data) return;
    const d = (data as any).data ?? data;
    const config = d["3d_configuration"];
    const render = config.render_config;

    setProduct({
      id: d.apparel.id,
      name: d.apparel.name,
      slug: d.apparel.slug,
      description: d.apparel.description ?? "",
      basePrice: d.apparel.pricing?.base_price ?? d.apparel.base_price ?? "0.00",
      currencySymbol: d.apparel.pricing?.currency?.symbol ?? "$",
      modelUrl: config.model?.glb_url ?? "models/shirt.glb",
      environment: render.environment,
      cameraConfig: {
        position: render.camera.position,
        fov: render.camera.fov,
        orbit: {
          minDistance: render.camera.orbit.min_distance,
          maxDistance: render.camera.orbit.max_distance,
          minPolarAngle: render.camera.orbit.min_polar_angle,
          maxPolarAngle: render.camera.orbit.max_polar_angle,
          enablePan: render.camera.orbit.enable_pan,
          enableZoom: render.camera.orbit.enable_zoom,
        },
      },
      renderConfig: {
        environment: render.environment,
        background: render.background,
        modelPosition: render.model_position,
        ...(render.lighting ? { lighting: render.lighting } : {}),
        contactShadows: {
          enabled: render.contact_shadows.enabled,
          position: render.contact_shadows.position,
          opacity: render.contact_shadows.opacity,
          scale: render.contact_shadows.scale,
          blur: render.contact_shadows.blur,
          far: render.contact_shadows.far,
        },
      },
      materialConfig: {
        textureUrl: config.material?.texture_url || null,
        normalMapUrl: config.material?.normal_map_url || null,
        roughness: config.material?.roughness ?? 0.9,
        metalness: config.material?.metalness ?? 0,
      },
      colors: [...new Set<string>(d.variants.map((v: any) => v.color.hex))],
      colorableMeshes: render.colorable_meshes ?? config.colorable_meshes ?? [],
      printAreas: d.print_areas.map((p: any) => {
        const uvConfig = p.uv_config || {};
        const rawWorldBounds = uvConfig.world_bounds;
        const rawUvBounds = uvConfig.uv_bounds;
        const rawTransformLimits = uvConfig.transform_limits;
        return {
          id: p.id,
          areaKey: p.key ?? p.area_key,
          name: p.name,
          placement: p.placement,
          meshName: p.mesh ?? p.mesh_name,
          aspectRatio: p.ratio ?? p.aspect_ratio,
          allowScaling: p.rules?.scale ?? p.allow_scaling ?? true,
          allowRotation: p.rules?.rotate ?? p.allow_rotation ?? false,
          maxLayers: p.rules?.max_layers ?? p.max_layers ?? 1,
          widthCm: p.w ?? p.width_cm ?? 35,
          heightCm: p.h ?? p.height_cm ?? 42,
          allowedFileTypes: p.rules?.file_types ?? p.allowed_file_types ?? ["png", "jpg", "svg"],
          sortOrder: p.sort,
          currency: p.currency,
          methods: (p.methods ?? []).map((m: any) => ({
            code: m.code,
            name: m.name,
            tiers: (m.tiers ?? []).map((t: any) => ({
              size: t.size,
              max_w: t.max_w,
              max_h: t.max_h,
              price: t.price,
              extra_color_price: t.extra_color_price ?? "0.00",
            })),
          })),
          uvBounds: rawUvBounds && typeof rawUvBounds === "object"
            ? { minU: rawUvBounds.min_u, minV: rawUvBounds.min_v, maxU: rawUvBounds.max_u, maxV: rawUvBounds.max_v }
            : undefined,
          worldBounds: rawWorldBounds && typeof rawWorldBounds === "object"
            ? { center: rawWorldBounds.center, halfExtents: rawWorldBounds.half_extents, rotation: rawWorldBounds.rotation }
            : undefined,
          transformLimits: rawTransformLimits && typeof rawTransformLimits === "object"
            ? { minScale: rawTransformLimits.min_scale, maxScale: rawTransformLimits.max_scale, minX: rawTransformLimits.min_x, maxX: rawTransformLimits.max_x, minY: rawTransformLimits.min_y, maxY: rawTransformLimits.max_y }
            : undefined,
          cameraFocus: p.camera_focus ? { position: p.camera_focus.position, target: p.camera_focus.target } : undefined,
          previewImage: p.preview_image,
        };
      }),
      variants: d.variants.map((v: any) => ({
        id: v.id,
        sku: v.sku,
        color: v.color,
        size: v.size,
        stockQuantity: v.stock_quantity,
        isInStock: v.is_in_stock,
        additionalPrice: v.additional_price,
      })),
      defaultView: render.default_view,
      studioCapabilities: d.studio_capabilities ? {
        allowText: d.studio_capabilities.allow_text,
        allowImages: d.studio_capabilities.allow_images,
        allowSvg: d.studio_capabilities.allow_svg,
        allowMultipleLayers: d.studio_capabilities.allow_multiple_layers,
        allowColorChange: d.studio_capabilities.allow_color_change,
        allowArPreview: d.studio_capabilities.allow_ar_preview,
      } : undefined,
    });
  }, [data, setProduct]);

  /* ── Calculate print cost ───────────────────────────────────────────── */
  const calculatePrintCost = useCallback(() => {
    if (!product) return 0;
    let print = 0;
    for (const area of product.printAreas) {
      const art = artworks[area.id];
      if (!art?.decalUrl) continue;
      const methodCode = selectedMethods[area.id];
      const tierSize = selectedTiers[area.id];
      const method = area.methods.find((m) => m.code === methodCode) ?? area.methods[0];
      const tier = method?.tiers.find((t) => t.size === tierSize) ?? method?.tiers[0];
      if (tier) print += parseFloat(tier.price) || 0;
    }
    return print;
  }, [product, artworks, selectedMethods, selectedTiers]);

  /* ── Build print areas payload for API ──────────────────────────────── */
  const buildPrintAreasPayload = useCallback(() => {
    if (!product) return [];
    const activeAreas = product.printAreas.filter((p) => artworks[p.id]?.decalUrl);
    
    return activeAreas.map((area) => {
      const art = artworks[area.id];
      const selectedMethodCode = selectedMethods[area.id] ?? area.methods[0]?.code ?? "";
      const selectedTierSize = selectedTiers[area.id] ?? area.methods[0]?.tiers[0]?.size ?? "";
      const method = area.methods.find((m) => m.code === selectedMethodCode) ?? area.methods[0];
      const tier = method?.tiers.find((t) => t.size === selectedTierSize) ?? method?.tiers[0];

      return {
        print_area: area.areaKey,
        print_area_id: area.id,
        print_method: selectedMethodCode,
        width_cm: area.widthCm.toFixed(2),
        height_cm: area.heightCm.toFixed(2),
        color_count: 1,
        design_data: {
          layers: [{
            type: "image" as const,
            url: art.decalUrl,
            aspect_ratio: art.decalAspect,
            position: { x: art.decalOffsetX, y: art.decalOffsetY },
            offset_x: art.decalOffsetX,
            offset_y: art.decalOffsetY,
            scale: art.decalScale,
            rotation: art.decalRotation,
            z_index: 0,
          }],
        },
      };
    });
  }, [product, artworks, selectedMethods, selectedTiers]);

  /* ── Build render config for API ────────────────────────────────────── */
  const buildRenderConfig = useCallback(() => {
    if (!product) return {};
    const cam = product.cameraConfig;
    const render = product.renderConfig;
    const activeAreas = product.printAreas.filter((p) => artworks[p.id]?.decalUrl);

    return {
      version: 3,
      background: render.background,
      environment: render.environment,
      model_position: render.modelPosition,
      model_url: product.modelUrl,
      colorable_meshes: product.colorableMeshes,
      material: {
        texture_url: product.materialConfig.textureUrl,
        normal_map_url: product.materialConfig.normalMapUrl,
        roughness: product.materialConfig.roughness,
        metalness: product.materialConfig.metalness,
      },
      camera: {
        position: cam.position,
        fov: cam.fov,
        orbit: {
          min_distance: cam.orbit.minDistance,
          max_distance: cam.orbit.maxDistance,
          min_polar_angle: cam.orbit.minPolarAngle,
          max_polar_angle: cam.orbit.maxPolarAngle,
          enable_pan: cam.orbit.enablePan,
          enable_zoom: cam.orbit.enableZoom,
        },
      },
      lighting: (render as any).lighting,
      contact_shadows: {
        enabled: render.contactShadows.enabled,
        position: render.contactShadows.position,
        opacity: render.contactShadows.opacity,
        scale: render.contactShadows.scale,
        blur: render.contactShadows.blur,
        far: render.contactShadows.far,
      },
      shots: [
        { id: "front", label: "Front", azimuth: 0, polar: Math.PI / 2, enabled: true },
        { id: "back", label: "Back", azimuth: Math.PI, polar: Math.PI / 2, enabled: true },
        { id: "angle", label: "3/4 Angle", azimuth: Math.PI / 6, polar: Math.PI / 2.4, enabled: true },
      ],
      default_view: product.defaultView,
      print_areas: product.printAreas.map((area) => ({
        print_area_id: area.id,
        area_key: area.areaKey,
        name: area.name,
        placement: area.placement,
        mesh_name: area.meshName,
        width_cm: area.widthCm,
        height_cm: area.heightCm,
        uv_config: {
          world_bounds: area.worldBounds,
          uv_bounds: area.uvBounds
            ? { min_u: area.uvBounds.minU, min_v: area.uvBounds.minV, max_u: area.uvBounds.maxU, max_v: area.uvBounds.maxV }
            : undefined,
          transform_limits: area.transformLimits
            ? {
                min_scale: area.transformLimits.minScale,
                max_scale: area.transformLimits.maxScale,
                min_x: area.transformLimits.minX,
                max_x: area.transformLimits.maxX,
                min_y: area.transformLimits.minY,
                max_y: area.transformLimits.maxY,
              }
            : undefined,
        },
      })),
      artworkPrintInfos: activeAreas.map((area) => {
        const art = artworks[area.id];
        return {
          printAreaId: area.id,
          printAreaName: area.name,
          areaKey: area.areaKey,
          widthCm: area.widthCm,
          heightCm: area.heightCm,
          sizeTier: classifyPrintSize(area.widthCm, area.heightCm),
          decalUrl: art.decalUrl,
          decalAspect: art.decalAspect,
          decalScale: art.decalScale,
          decalRotation: art.decalRotation,
          decalOffsetX: art.decalOffsetX,
          decalOffsetY: art.decalOffsetY,
        };
      }),
    };
  }, [product, artworks]);

  /* ── Build snapshot for API ─────────────────────────────────────────── */
  const buildSnapshot = useCallback(() => {
    const store = useStudioStore.getState();
    const activeAreas = product?.printAreas.filter((p) => artworks[p.id]?.decalUrl) ?? [];
    
    return {
      productId: product?.id ?? "",
      productName: product?.name ?? "",
      selectedColor: store.selectedColor,
      selectedPrintAreaId: store.selectedPrintAreaId,
      artworks: store.artworks,
      selectedMethods: store.selectedMethods,
      selectedTiers: store.selectedTiers,
      artworkCount: activeAreas.length,
      artworkPrintInfos: activeAreas.map((area) => ({
        printAreaId: area.id,
        areaKey: area.areaKey,
        sizeTier: classifyPrintSize(area.widthCm, area.heightCm),
        widthCm: area.widthCm,
        heightCm: area.heightCm,
      })),
    };
  }, [product, artworks]);

  /* ── Save product and open checkout ─────────────────────────────────── */
  const handleContinueToCheckout = useCallback(async () => {
    if (!canvasRef.current || !product) {
      toast.error("Canvas not ready");
      return;
    }

    const activeAreas = product.printAreas.filter((p) => artworks[p.id]?.decalUrl);
    if (activeAreas.length === 0) {
      toast.error("Add artwork to at least one print area");
      return;
    }

    setIsCapturing(true);
    toast.info("Saving your design…");

    try {
      // Capture shots
      const shots = [
        { id: "front", label: "Front", azimuth: 0, polar: Math.PI / 2, enabled: true },
        { id: "back", label: "Back", azimuth: Math.PI, polar: Math.PI / 2, enabled: true },
        { id: "angle", label: "3/4 Angle", azimuth: Math.PI / 6, polar: Math.PI / 2.4, enabled: true },
      ];
      
      const capturedShots = await canvasRef.current.captureAllShots(shots);
      const dataUrls = capturedShots.filter((s) => s.dataUrl).map((s) => s.dataUrl!);
      const mainMockup = dataUrls[0] ?? canvasRef.current.capture();
      
      setCapturedMockups(dataUrls);

      // 1. Create the custom product via API (simplified — no markup, variants, etc.)
      const created = await storeProductApi.create({
        title: `${product.name} — Custom`,
        description: `Custom ${product.name} with artwork`,
        base_apparel: product.id,
        markup_price: 0, // No markup for customer order
        print_areas: buildPrintAreasPayload(),
        snapshot: buildSnapshot(),
        render_config: buildRenderConfig(),
        enabled_variants: product.variants.filter((v) => v.isInStock).map((v) => v.id),
        is_limited_edition: false,
        max_quantity: null,
        production_ready: true,
      });

      // 2. Upload mockup images
      const enabledShots = capturedShots.filter((s) => s.enabled && s.dataUrl);
      const blobs = await Promise.all(
        enabledShots.map(async (shot) => ({
          blob: await blobFromDataUrl(shot.dataUrl!),
          type: shot.id,
          name: `mockup-${shot.id}.png`,
        })),
      );

      const assetsData = await storeProductApi.uploadAssets(created.id, blobs);

      // 3. Extract pricing from API response
      const apiPricing = created.pricing;
      const retailPrice = parseFloat(apiPricing?.retail_price ?? "0");
      const basePrice = parseFloat(product.basePrice) || 0;
      const printCost = calculatePrintCost();
      const currencySymbol = typeof apiPricing?.currency === "object" 
        ? apiPricing.currency.symbol 
        : product.currencySymbol ?? "Br";

      // 4. Open checkout with API-returned pricing
      const checkoutVariants = product.variants.map((v) => ({
        ...v,
        quantity: 1,
      }));
      const user = useAuthStore.getState().user;

      openCheckout({
        userFullName: user?.full_name ?? user?.name ?? "",
        productId: created.id,
        productName: created.title ?? product.name,
        thumbnailUrl: assetsData.thumbnail_url ?? mainMockup ?? undefined,
        mockupUrl: mainMockup ?? undefined,
        basePrice: basePrice,
        printCost: printCost,
        currencySymbol: currencySymbol,
        variants: checkoutVariants,
        artworks,
        printAreas: product.printAreas.map((p) => ({
          id: p.id,
          name: p.name,
          widthCm: p.widthCm,
          heightCm: p.heightCm,
          areaKey: p.areaKey,
        })),
        selectedColor: selectedColor ?? undefined,
        preselectedVariantId: product.variants.find((v) => v.color.hex === selectedColor)?.id,
      });

      toast.success("Design saved. Continue to checkout.");
    } catch (err: any) {
      const detail = err?.data?.error?.message ?? err?.message ?? "Failed to save design";
      toast.error(detail);
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  }, [product, artworks, selectedColor, selectedMethods, selectedTiers, openCheckout, calculatePrintCost, buildPrintAreasPayload, buildRenderConfig, buildSnapshot]);

  /* ── Apply artwork ────────────────────────────────────────────────── */
  const handleArtworkSelect = ({ url, aspect }: { url: string; aspect: number }) => {
    if (!selectedPrintAreaId) { toast.error("Select a print area first"); return; }
    const printArea = product?.printAreas.find((p) => p.id === selectedPrintAreaId);
    if (!printArea) { toast.error("Print area not found"); return; }
    const initialScale = Math.min(printArea.widthCm, printArea.heightCm) * CM * 0.6;
    setArtwork(selectedPrintAreaId, {
      ...getDefaultArtwork(),
      decalUrl: url,
      decalAspect: aspect,
      decalScale: initialScale,
      decalRotation: 0,
      decalOffsetX: 0,
      decalOffsetY: 0,
    });
    toast.success(`Artwork applied to ${printArea.name}`);
  };

  if (!hasApparel) {
    return (
      <div className="flex h-[calc(100dvh-7.5rem)] flex-col items-center justify-center gap-4">
        <Button asChild className="rounded-full">
          <Link to="/catalog"><Shirt className="mr-2 h-4 w-4" /> Open Catalog</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Choose an apparel to start designing</p>
      </div>
    );
  }

  if (isLoading || !mounted) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-red-500">
        Failed to load studio product
      </div>
    );
  }

  return (
    <>
      <div className="relative h-[calc(100dvh-0rem)] w-full overflow-hidden bg-background md:h-[calc(100dvh-3.5rem)]">
        <CanvasDrop onUploaded={handleArtworkSelect}>
          <StudioCanvas ref={canvasRef} />
        </CanvasDrop>
        
        {/* Artwork Library — visibility controlled by bottom nav */}
        <ArtworkLibrary 
          onSelect={handleArtworkSelect} 
          isOpen={artworkLibraryOpen}
          onClose={() => setArtworkLibraryOpen(false)}
        />
        
        <StudioControls 
          onSave={handleContinueToCheckout} 
          isSaving={isCapturing}
          onContinue={handleContinueToCheckout}
          onToggleArtworkLibrary={() => setArtworkLibraryOpen((v) => !v)}
          artworkLibraryOpen={artworkLibraryOpen}
        />

        <div className="pointer-events-none hidden md:flex absolute top-1 left-16 z-10 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-md">
          Drag to rotate · scroll to zoom · drop artwork to upload
        </div>
      </div>

      {/* Full-page Checkout Wizard */}
      <CheckOut mockupUrls={capturedMockups} />
    </>
  );
}
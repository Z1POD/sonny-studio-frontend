/**
 * src/features/studio/components/StudioWorkspace.tsx — v9
 *
 * Fixes:
 *  - mapApiToApparelProduct uses exact editor-config response shape
 *  - hydrateStudioFromSavedDesign reads artworks from
 *    snapshot.render_config.artworkPrintInfos (real saved shape)
 *  - When editing a saved design, reconstruct the ApparelProduct directly
 *    from detail.render_config + detail.enabled_variant (no extra fetch needed)
 *  - captureDistanceScale read correctly (camelCase on camera object)
 *  - Update existing product uses PATCH /store/products/{id}/ (no /update/)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Shirt } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useStudioStore, getDefaultArtwork } from "../store";
import { studioDetailQuery } from "../queries";
import { storeProductDetailQuery } from "@/features/store/queries";
import { StudioCanvas, type StudioCanvasHandle } from "./StudioCanvas";
import { StudioControls } from "./StudioControls";
import { ArtworkLibrary } from "./ArtworkLibrary";
import { CanvasDrop } from "./CanvasDrop";
import { Button } from "@/components/ui/button";
import { CheckOut } from "@/features/checkout/components/CheckOut";
import { useCheckoutStore } from "@/features/checkout/store";
import { storeProductApi } from "@/features/store/api";
import { useAuthStore } from "@/features/auth/store";
import type { PrintArea, ArtworkState, ApparelProduct } from "../store";
import type { ShotConfig } from "./SaveProductDialog";

const CM = 0.01;

async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

// ─── Map editor-config API → ApparelProduct ───────────────────────────────────
// Source: /api/v1/apparels/{id}/editor-config/
// Top-level fields: data.apparel, data.variants, data.print_areas
// 3D config:        data["3d_configuration"] → { model, material, render_config }
// render_config has: background, environment, model_position, contact_shadows,
//                   lighting, camera { position, fov, captureDistanceScale, orbit }

function mapEditorConfigToApparelProduct(rawData: any): ApparelProduct {
  const d      = rawData.data ?? rawData;            // unwrap { success, data }
  const config = d["3d_configuration"];
  const render = config.render_config;
  const cam    = render.camera;
  const orbit  = cam.orbit;
  const shadows = render.contact_shadows;

  const printAreas: PrintArea[] = (d.print_areas ?? []).map((p: any) => {
    const uv  = p.uv_config || {};
    const uvB = uv.uv_bounds;
    const wB  = uv.world_bounds;
    const tL  = uv.transform_limits;
    return {
      id:               p.id,
      areaKey:          p.key ?? p.area_key,
      name:             p.name,
      placement:        p.placement,
      meshName:         p.mesh ?? p.mesh_name ?? "",
      aspectRatio:      p.ratio ?? p.aspect_ratio,
      allowScaling:     p.rules?.scale      ?? p.allow_scaling   ?? true,
      allowRotation:    p.rules?.rotate     ?? p.allow_rotation  ?? false,
      maxLayers:        p.rules?.max_layers ?? p.max_layers      ?? 1,
      widthCm:          p.w  ?? p.width_cm  ?? 35,
      heightCm:         p.h  ?? p.height_cm ?? 42,
      allowedFileTypes: p.rules?.file_types ?? p.allowed_file_types ?? ["png","jpg","svg"],
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
      uvBounds: uvB
        ? { minU: uvB.min_u, minV: uvB.min_v, maxU: uvB.max_u, maxV: uvB.max_v }
        : undefined,
      worldBounds: wB
        ? { center: wB.center, halfExtents: wB.half_extents, rotation: wB.rotation }
        : undefined,
      transformLimits: tL
        ? { minScale: tL.min_scale, maxScale: tL.max_scale,
            minX: tL.min_x, maxX: tL.max_x, minY: tL.min_y, maxY: tL.max_y }
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
    basePrice:      d.apparel.pricing?.base_price ?? "0.00",
    currencySymbol: d.apparel.pricing?.currency?.symbol ?? "Br",
    modelUrl:       config.model?.glb_url ?? "",
    environment:    render.environment,
    cameraConfig: {
      position: cam.position,
      fov:      cam.fov,
      // camelCase directly on camera object in real API (not snake_case)
      captureDistanceScale: cam.captureDistanceScale ?? cam.capture_distance_scale ?? 1,
      captureLookAtOffset:  cam.captureLookAtOffset  ?? cam.capture_look_at_offset  ?? [0, 0, 0],
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
    colorableMeshes: render.colorable_meshes ?? [],
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

// ─── Build ApparelProduct from a saved product's render_config ────────────────
// Source: /api/v1/store/products/{id}/ → data.render_config
// This avoids a second apparel fetch when editing a saved design.
//
// render_config has: model_url, camera, lighting, contact_shadows,
//                   colorable_meshes, material, print_areas
// We also need enabled_variant and base_apparel from the product detail.

function mapSavedProductToApparelProduct(detail: any): ApparelProduct {
  const rc     = detail.render_config;
  const cam    = rc.camera;
  const orbit  = cam.orbit;
  const shadows = rc.contact_shadows ?? {};

  // Reconstruct print areas from render_config.print_areas
  // These are lightweight (no methods/tiers) — we use them for decal placement only.
  // Methods/tiers are not needed for the edit flow (they're already baked in the snapshot).
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
    stockQuantity:   (v as any).stock_quantity ?? 99,
    isInStock:       (v as any).is_in_stock ?? true,
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
      position: cam.position,
      fov:      cam.fov,
      captureDistanceScale: cam.captureDistanceScale ?? cam.capture_distance_scale ?? 1,
      captureLookAtOffset:  cam.captureLookAtOffset  ?? cam.capture_look_at_offset  ?? [0, 0, 0],
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
    defaultView:    undefined,
    studioCapabilities: undefined,
  };
}

// ─── Hydrate studio store from saved snapshot ─────────────────────────────────
// Artworks live in:
//   snapshot.render_config.artworkPrintInfos[]
//   { printAreaId, decalUrl, decalAspect, decalScale, decalRotation,
//     decalOffsetX, decalOffsetY }

function hydrateStudioFromSavedDesign(detail: any) {
  const store    = useStudioStore.getState();
  const snapshot = detail.snapshot ?? {};
  const rc       = snapshot.render_config ?? detail.render_config ?? {};

  // Restore artworks from artworkPrintInfos
  const artworkInfos: any[] = rc.artworkPrintInfos ?? [];
  for (const info of artworkInfos) {
    if (!info.decalUrl) continue;
    store.setArtwork(info.printAreaId, {
      decalUrl:     info.decalUrl,
      decalAspect:  info.decalAspect  ?? 1,
      decalScale:   info.decalScale   ?? 0.5,
      decalRotation:info.decalRotation ?? 0,
      decalOffsetX: info.decalOffsetX ?? 0,
      decalOffsetY: info.decalOffsetY ?? 0,
    });
  }

  // Restore selected print area (first one that has artwork)
  if (artworkInfos.length > 0) {
    store.setSelectedPrintArea(artworkInfos[0].printAreaId);
  }

  // Restore color from enabled_variant (snapshot doesn't store selectedColor explicitly)
  const firstVariant = detail.enabled_variant?.[0];
  if (firstVariant?.color?.hex) {
    store.setSelectedColor(firstVariant.color.hex);
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StudioWorkspace() {
  const canvasRef             = useRef<StudioCanvasHandle>(null);
  const [mounted, setMounted] = useState(false);
  const [isCapturing, setIsCapturing]           = useState(false);
  const [artworkLibraryOpen, setArtworkLibraryOpen] = useState(false);
  const [capturedMockups, setCapturedMockups]   = useState<string[]>([]);

  // ── Route state ─────────────────────────────────────────────────────────────
  const routerState   = useRouterState();
  const locationState = routerState.location.state as {
    apparelId?: string;
    productId?: string;   // saved design to reopen
    mode?: "3d";
  } | undefined;

  const apparelId      = locationState?.apparelId ?? null;
  const savedProductId = locationState?.productId ?? null;
  const is3DMode       = locationState?.mode === "3d";

  // ── Studio store ─────────────────────────────────────────────────────────────
  const setProduct         = useStudioStore((s) => s.setProduct);
  const product            = useStudioStore((s) => s.product);
  const selectedPrintAreaId= useStudioStore((s) => s.selectedPrintAreaId);
  const setArtwork         = useStudioStore((s) => s.setArtwork);
  const artworks           = useStudioStore((s) => s.artworks);
  const selectedColor      = useStudioStore((s) => s.selectedColor);
  const selectedMethods    = useStudioStore((s) => s.selectedMethods);
  const selectedTiers      = useStudioStore((s) => s.selectedTiers);
  const setAutoRotate      = useStudioStore((s) => s.setAutoRotate);

  const openCheckout = useCheckoutStore((s) => s.open);

  // ── Fetch editor config (new design from catalog) ───────────────────────────
  const { data: editorData, isLoading: editorLoading } = useQuery({
    ...studioDetailQuery(apparelId ?? ""),
    enabled: !!apparelId && !savedProductId,
  });

  // ── Fetch saved product detail (edit/3D from My Designs) ───────────────────
  const { data: savedDetail, isLoading: savedLoading } = useQuery({
    ...storeProductDetailQuery(savedProductId ?? ""),
    enabled: !!savedProductId,
  });

  useEffect(() => setMounted(true), []);

  // ── Hydrate: new design from catalog ────────────────────────────────────────
  useEffect(() => {
    if (!editorData || savedProductId) return;
    const ap = mapEditorConfigToApparelProduct(editorData);
    setProduct(ap);
    if (is3DMode) setAutoRotate(true);
  }, [editorData, savedProductId, setProduct, is3DMode, setAutoRotate]);

  // ── Hydrate: saved design ───────────────────────────────────────────────────
  useEffect(() => {
    if (!savedDetail) return;
    const detail = (savedDetail as any).data ?? savedDetail;
    const ap = mapSavedProductToApparelProduct(detail);
    setProduct(ap);
    hydrateStudioFromSavedDesign(detail);
    if (is3DMode) setAutoRotate(true);
  }, [savedDetail, is3DMode, setProduct, setAutoRotate]);

  // ── Print cost ───────────────────────────────────────────────────────────────
  const calculatePrintCost = useCallback(() => {
    if (!product) return 0;
    let cost = 0;
    for (const area of product.printAreas) {
      if (!artworks[area.id]?.decalUrl) continue;
      const methodCode = selectedMethods[area.id] ?? area.methods[0]?.code ?? "";
      const tierSize   = selectedTiers[area.id]   ?? area.methods[0]?.tiers[0]?.size ?? "";
      const method     = area.methods.find((m) => m.code === methodCode) ?? area.methods[0];
      const tier       = method?.tiers.find((t) => t.size === tierSize)  ?? method?.tiers[0];
      if (tier) cost += parseFloat(tier.price) || 0;
    }
    return cost;
  }, [product, artworks, selectedMethods, selectedTiers]);

  // ── Build print_areas payload ────────────────────────────────────────────────
  const buildPrintAreasPayload = useCallback(() => {
    if (!product) return [];
    return product.printAreas
      .filter((p) => artworks[p.id]?.decalUrl)
      .map((area) => {
        const art            = artworks[area.id];
        const methodCode     = selectedMethods[area.id] ?? area.methods[0]?.code ?? "";
        const tierSize       = selectedTiers[area.id]   ?? area.methods[0]?.tiers[0]?.size ?? "";
        return {
          print_area:    area.areaKey,
          print_area_id: area.id,
          print_method:  methodCode,
          width_cm:      area.widthCm.toFixed(2),
          height_cm:     area.heightCm.toFixed(2),
          color_count:   1,
          design_data: {
            layers: [{
              type:         "image" as const,
              url:          art.decalUrl,
              aspect_ratio: art.decalAspect,
              position:     { x: art.decalOffsetX, y: art.decalOffsetY },
              offset_x:     art.decalOffsetX,
              offset_y:     art.decalOffsetY,
              scale:        art.decalScale,
              rotation:     art.decalRotation,
              z_index:      0,
            }],
          },
        };
      });
  }, [product, artworks, selectedMethods, selectedTiers]);

  // ── Build render_config snapshot ─────────────────────────────────────────────
  const buildRenderConfig = useCallback(() => {
    if (!product) return {};
    const cam    = product.cameraConfig;
    const render = product.renderConfig;
    const activeAreas = product.printAreas.filter((p) => artworks[p.id]?.decalUrl);
    return {
      version:          3,
      background:       render.background,
      environment:      render.environment,
      model_position:   render.modelPosition,
      model_url:        product.modelUrl,
      colorable_meshes: product.colorableMeshes,
      material:         product.materialConfig,
      camera: {
        position: cam.position,
        fov:      cam.fov,
        orbit: {
          min_distance:   cam.orbit.minDistance,
          max_distance:   cam.orbit.maxDistance,
          min_polar_angle: cam.orbit.minPolarAngle,
          max_polar_angle: cam.orbit.maxPolarAngle,
          enable_pan:     cam.orbit.enablePan,
          enable_zoom:    cam.orbit.enableZoom,
        },
      },
      lighting:         (render as any).lighting,
      contact_shadows:  render.contactShadows,
      shots: [
        { id: "front", label: "Front",    azimuth: 0,           polar: Math.PI / 2,   enabled: true },
        { id: "back",  label: "Back",     azimuth: Math.PI,     polar: Math.PI / 2,   enabled: true },
        { id: "angle", label: "3/4 Angle",azimuth: Math.PI / 6, polar: Math.PI / 2.4, enabled: true },
      ],
      print_areas: activeAreas.map((area) => ({
        print_area_id: area.id,
        area_key:      area.areaKey,
        name:          area.name,
        placement:     area.placement,
        mesh_name:     area.meshName,
        width_cm:      area.widthCm,
        height_cm:     area.heightCm,
        uv_config:     {},
      })),
      // Store artwork transforms so they can be restored later
      artworkPrintInfos: activeAreas.map((area) => {
        const art = artworks[area.id];
        return {
          printAreaId:   area.id,
          printAreaName: area.name,
          areaKey:       area.areaKey,
          widthCm:       area.widthCm,
          heightCm:      area.heightCm,
          sizeTier:      "large",
          decalUrl:      art.decalUrl,
          decalAspect:   art.decalAspect,
          decalScale:    art.decalScale,
          decalRotation: art.decalRotation,
          decalOffsetX:  art.decalOffsetX,
          decalOffsetY:  art.decalOffsetY,
        };
      }),
    };
  }, [product, artworks]);

  // ── Save and open checkout ────────────────────────────────────────────────────
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
      const shots: ShotConfig[] = [
        { id: "front", label: "Front",     azimuth: 0,           polar: Math.PI / 2,   enabled: true },
        { id: "back",  label: "Back",      azimuth: Math.PI,     polar: Math.PI / 2,   enabled: true },
        { id: "angle", label: "3/4 Angle", azimuth: Math.PI / 6, polar: Math.PI / 2.4, enabled: true },
      ];

      const capturedShots = await canvasRef.current.captureAllShots(shots);
      const dataUrls      = capturedShots.filter((s) => s.dataUrl).map((s) => s.dataUrl!);
      const mainMockup    = dataUrls[0] ?? canvasRef.current.capture();
      setCapturedMockups(dataUrls);

      const renderConfig   = buildRenderConfig();
      const printAreasPayload = buildPrintAreasPayload();
      const enabledVariantIds = product.variants.filter((v) => v.isInStock).map((v) => v.id);

      let savedProduct: any;

      if (savedProductId) {
        // ── Update existing product ─────────────────────────────────────────
        // PATCH /api/v1/store/products/{uuid}/
        savedProduct = await storeProductApi.update(savedProductId, {
          title:            product.name,
          enabled_variants: enabledVariantIds,
          print_areas:      printAreasPayload,
        } as any);
      } else {
        // ── Create new product ──────────────────────────────────────────────
        savedProduct = await storeProductApi.create({
          title:             `${product.name} — Custom`,
          description:       `Custom ${product.name} with artwork`,
          base_apparel:      product.id,
          markup_price:      "0",
          print_areas:       printAreasPayload,
          snapshot:          { render_config: renderConfig },
          render_config:     renderConfig,
          enabled_variants:  enabledVariantIds,
          is_limited_edition: false,
          max_quantity:      null,
          production_ready:  true,
        });
      }

      // ── Upload mockups ─────────────────────────────────────────────────────
      const blobs = await Promise.all(
        capturedShots
          .filter((s) => s.enabled && s.dataUrl)
          .map(async (shot) => ({
            blob: await blobFromDataUrl(shot.dataUrl!),
            type: shot.id,
            name: `mockup-${shot.id}.png`,
          })),
      );
      const assetsData = await storeProductApi.uploadAssets(
        savedProduct.id ?? savedProductId,
        blobs,
      );

      // ── Open checkout ──────────────────────────────────────────────────────
      const pricing       = savedProduct.pricing ?? {};
      const basePrice     = parseFloat(pricing.base_price ?? product.basePrice ?? "0");
      const printCost     = calculatePrintCost();
      const currencySymbol =
        typeof pricing.currency === "object"
          ? pricing.currency.symbol
          : product.currencySymbol ?? "Br";

      const user = useAuthStore.getState().user;

      openCheckout({
        userFullName:        user?.full_name ?? user?.name ?? "",
        productId:           savedProduct.id ?? savedProductId!,
        productName:         savedProduct.title ?? product.name,
        thumbnailUrl:        assetsData.thumbnail_url ?? mainMockup ?? undefined,
        mockupUrl:           mainMockup ?? undefined,
        mockupUrls:          dataUrls,
        basePrice,
        printCost,
        currencySymbol,
        variants:            product.variants.map((v) => ({ ...v, quantity: 1 })),
        artworks,
        printAreas:          product.printAreas.map((p) => ({
          id: p.id, name: p.name, widthCm: p.widthCm, heightCm: p.heightCm, areaKey: p.areaKey,
        })),
        selectedColor:       selectedColor ?? undefined,
        preselectedVariantId: product.variants.find((v) => v.color.hex === selectedColor)?.id,
      });

      toast.success("Design saved. Continue to checkout.");
    } catch (err: any) {
      toast.error(err?.data?.error?.message ?? err?.message ?? "Failed to save design");
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  }, [
    product, artworks, selectedColor, savedProductId,
    buildPrintAreasPayload, buildRenderConfig, calculatePrintCost, openCheckout,
  ]);

  // ── Apply artwork from library / drop ─────────────────────────────────────
  const handleArtworkSelect = ({ url, aspect }: { url: string; aspect: number }) => {
    if (!selectedPrintAreaId) { toast.error("Select a print area first"); return; }
    const printArea = product?.printAreas.find((p) => p.id === selectedPrintAreaId);
    if (!printArea) { toast.error("Print area not found"); return; }
    const initialScale = Math.min(printArea.widthCm, printArea.heightCm) * CM * 0.6;
    setArtwork(selectedPrintAreaId, {
      ...getDefaultArtwork(),
      decalUrl:    url,
      decalAspect: aspect,
      decalScale:  initialScale,
    });
    toast.success(`Artwork applied to ${printArea.name}`);
  };

  // ── Render guards ───────────────────────────────────────────────────────────
  const isLoadingAny = editorLoading || savedLoading || !mounted;
  const hasSource    = !!apparelId || !!savedProductId;

  if (!hasSource) {
    return (
      <div className="flex h-[calc(100dvh-7.5rem)] flex-col items-center justify-center gap-4">
        <Button asChild className="rounded-full">
          <Link to="/catalog"><Shirt className="mr-2 h-4 w-4" />Open Catalog</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Choose an apparel to start designing</p>
      </div>
    );
  }

  if (isLoadingAny || !product) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="relative h-[calc(100dvh-0rem)] w-full overflow-hidden bg-background md:h-[calc(100dvh-3.5rem)]">
        <CanvasDrop onUploaded={handleArtworkSelect}>
          <StudioCanvas ref={canvasRef} />
        </CanvasDrop>

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

      <CheckOut mockupUrls={capturedMockups} />
    </>
  );
}
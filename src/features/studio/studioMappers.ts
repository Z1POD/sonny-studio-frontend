// src/features/studio/studioMappers.ts
//
// Pure data-transformation utilities for the Studio feature.
// Nothing here touches React or the DOM — safe to unit-test in isolation.
//
// Exports:
//   mapEditorConfigToApparelProduct  — /apparels/{id}/editor-config/ → ApparelProduct
//   mapSavedProductToApparelProduct  — /store/products/{id}/         → ApparelProduct
//   hydrateStudioFromSavedDesign     — restores artwork state into the studio store

import type { PrintArea, ApparelProduct } from "./store";
import { useStudioStore } from "./store";


export function mapEditorConfigToApparelProduct(rawData: any): ApparelProduct {
  const d      = rawData.data ?? rawData;           // unwrap { success, data }
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
      uvBounds: uvB
        ? { minU: uvB.min_u, minV: uvB.min_v, maxU: uvB.max_u, maxV: uvB.max_v }
        : undefined,
      worldBounds: wB
        ? { center: wB.center, halfExtents: wB.half_extents, rotation: wB.rotation }
        : undefined,
      transformLimits: tL
        ? {
            minScale: tL.min_scale, maxScale: tL.max_scale,
            minX: tL.min_x, maxX: tL.max_x,
            minY: tL.min_y, maxY: tL.max_y,
          }
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
      captureDistanceScale: cam.capture_distance_scale ?? 1,
      captureLookAtOffset:  cam.capture_look_at_offset  ?? [0, 0, 0],
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
    defaultView:        render.default_view,
    studioCapabilities: d.studio_capabilities
      ? {
          allowText:           d.studio_capabilities.allow_text,
          allowImages:         d.studio_capabilities.allow_images,
          allowSvg:            d.studio_capabilities.allow_svg,
          allowMultipleLayers: d.studio_capabilities.allow_multiple_layers,
          allowColorChange:    d.studio_capabilities.allow_color_change,
          allowArPreview:      d.studio_capabilities.allow_ar_preview,
        }
      : undefined,
  };
}


export function mapSavedProductToApparelProduct(detail: any): ApparelProduct {
  const rc     = detail.render_config;
  const cam    = rc.camera;
  const orbit  = cam.orbit;
  const shadows = rc.contact_shadows ?? {};

  const legacySnapshotByAreaId = new Map<string, any>(
    (detail.snapshot?.print_areas ?? []).map((entry: any) => [entry.print_area?.id, entry]),
  );

  const printAreas: PrintArea[] = (rc.print_areas ?? []).map((pa: any) => {
    const legacy        = legacySnapshotByAreaId.get(pa.print_area_id);
    const legacyMethod  = legacy?.print_method;
    const legacyPricing = legacy?.price_breakdown;

    const methodCode = pa.print_method_code ?? legacyMethod?.code;
    const methodName = pa.print_method_name ?? legacyMethod?.name ?? methodCode;
    const sizeTier    = pa.size_tier         ?? legacyPricing?.size_tier;
    const price       = pa.price             ?? legacyPricing?.total_price ?? legacyPricing?.base_price;
    const extraColor  = pa.extra_color_price ?? legacyPricing?.additional_color_price;

    return {
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
      methods: methodCode
        ? [{
            code: methodCode,
            name: methodName,
            tiers: [{
              size:              sizeTier ?? "",
              max_w:             pa.width_cm,
              max_h:             pa.height_cm,
              price:             price ?? "0.00",
              extra_color_price: extraColor ?? "0.00",
            }],
          }]
        : [],
      uvBounds: pa.uv_config?.uv_bounds
        ? {
            minU: pa.uv_config.uv_bounds.min_u,
            minV: pa.uv_config.uv_bounds.min_v,
            maxU: pa.uv_config.uv_bounds.max_u,
            maxV: pa.uv_config.uv_bounds.max_v,
          }
        : undefined,
      worldBounds: pa.uv_config?.world_bounds
        ? {
            center:      pa.uv_config.world_bounds.center,
            halfExtents: pa.uv_config.world_bounds.half_extents,
            rotation:    pa.uv_config.world_bounds.rotation,
          }
        : undefined,
    };
  });

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
      position: cam.position,
      fov:      cam.fov,
      captureDistanceScale: cam.capture_distance_scale ?? 1,
      captureLookAtOffset:  cam.capture_look_at_offset  ?? [0, 0, 0],
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
    defaultView:        undefined,
    studioCapabilities: undefined,
  };
}


export function hydrateStudioFromSavedDesign(detail: any): void {
  const store    = useStudioStore.getState();
  const snapshot = detail.snapshot ?? {};
  const rc       = snapshot.render_config ?? detail.render_config ?? {};

  const artworkInfos: any[] = rc.artworkPrintInfos ?? [];
  for (const info of artworkInfos) {
    if (!info.decalUrl) continue;
    store.setArtwork(info.printAreaId, {
      decalUrl:      info.decalUrl,
      decalAspect:   info.decalAspect   ?? 1,
      decalScale:    info.decalScale     ?? 0.5,
      decalRotation: info.decalRotation  ?? 0,
      decalOffsetX:  info.decalOffsetX   ?? 0,
      decalOffsetY:  info.decalOffsetY   ?? 0,
    });
  }

  // Restore selected print area (first one that has artwork)
  if (artworkInfos.length > 0) {
    store.setSelectedPrintArea(artworkInfos[0].printAreaId);
  }

  // Restore color from enabled_variant (snapshot doesn't store selectedColor)
  const firstVariant = detail.enabled_variant?.[0];
  if (firstVariant?.color?.hex) {
    store.setSelectedColor(firstVariant.color.hex);
  }
}
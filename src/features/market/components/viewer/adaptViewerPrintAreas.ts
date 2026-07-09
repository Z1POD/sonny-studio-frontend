// src/features/market/components/viewer/adaptViewerPrintAreas.ts

import type { PrintArea, ArtworkState } from "@/features/studio/store";
import type { Viewer3D, ViewerPrintArea } from "../../api";

function normalizePlacement(placement: string): string {
  return placement === "full" ? "wrap" : placement;
}

export function adaptViewerPrintAreas(printAreas: ViewerPrintArea[] = []): PrintArea[] {
  return printAreas.map((p): PrintArea => {
    const uv = p.uv_config ?? {};
    const wB = uv.world_bounds;
    const tL = uv.transform_limits;
    const uvB = uv.uv_bounds;

    return {
      id: p.area_key,
      areaKey: p.area_key,
      name: p.name,
      placement: normalizePlacement(p.placement),
      meshName: p.mesh_name ?? "",
      allowScaling: false,
      allowRotation: false,
      maxLayers: 1,
      widthCm: parseFloat(String(p.width_cm)),
      heightCm: parseFloat(String(p.height_cm)),
      allowedFileTypes: [],
      methods: [],
      uvBounds: uvB
        ? { minU: uvB.min_u, minV: uvB.min_v, maxU: uvB.max_u, maxV: uvB.max_v }
        : undefined,
      worldBounds: wB
        ? { center: wB.center, halfExtents: wB.half_extents, rotation: wB.rotation ?? [0, 0, 0] }
        : undefined,
      surfaceType: uv.surface_type ?? "flat",
      transformLimits: tL
        ? {
            minScale: tL.min_scale,
            maxScale: tL.max_scale,
            minX: tL.min_x ?? -Infinity,
            maxX: tL.max_x ?? Infinity,
            minY: tL.min_y ?? -Infinity,
            maxY: tL.max_y ?? Infinity,
          }
        : undefined,
    };
  });
}

export function adaptViewerArtworks(printAreas: ViewerPrintArea[] = []): Record<string, ArtworkState> {
  const artworks: Record<string, ArtworkState> = {};
  for (const p of printAreas) {
    const decal = p.decal;
    if (!decal?.url) continue;
    artworks[p.area_key] = {
      decalUrl: decal.url,
      decalAspect: decal.aspect_ratio,
      decalScale: decal.scale,
      decalRotation: decal.rotation,
      decalOffsetX: decal.offset_x,
      decalOffsetY: decal.offset_y,
    };
  }
  return artworks;
}

export function adaptViewerMaterial(material?: Viewer3D["material"]) {
  return {
    textureUrl: material?.texture_url ?? null,
    normalMapUrl: material?.normal_map_url ?? null,
    roughness: material?.roughness ?? 0.9,
    metalness: material?.metalness ?? 0,
  };
}
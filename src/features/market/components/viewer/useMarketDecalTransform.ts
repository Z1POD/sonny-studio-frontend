// src/features/market/components/viewer/useMarketDecalTransform.ts
//
// Places a product's already-baked print-area decal onto its GLB mesh for
// the marketplace's read-only 3D preview.
//
// This is a sibling of `features/studio/hooks/useDecalTransforms.ts`, not a
// reuse of it — the studio hook operates on the Studio's own `PrintArea` /
// `ArtworkState` shapes (camelCase, live editable transforms, full-wrap
// multi-face support). The marketplace API returns a different, simpler
// shape instead: snake_case `ViewerPrintArea` with a single fixed `decal`
// per zone and no in-viewer editing. The surface-placement geometry
// (which way each placement faces, where its centre sits on the mesh) is
// the same idea in both, so the math below mirrors the studio version,
// just wired to the marketplace's field names.

import { useMemo } from "react";
import * as THREE from "three";
import type { PrintAreaDecal, ViewerPrintArea } from "../../api";

const CM = 0.01;
const SURFACE_EPSILON = 0.005;
const MIN_REPEAT = 0.05; // guards against decal.scale === 0 producing Infinity repeat

export interface DecalTransform {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotation: THREE.Euler;
}

function placementToRotation(placement: string): THREE.Euler {
  switch (placement) {
    case "back":
      return new THREE.Euler(0, Math.PI, 0); // faces -Z
    case "left_sleeve":
      return new THREE.Euler(0, -Math.PI / 2, 0); // faces -X
    case "right_sleeve":
      return new THREE.Euler(0, Math.PI / 2, 0); // faces +X
    case "hood":
      return new THREE.Euler(-Math.PI / 4, 0, 0); // faces up-forward
    default: // front, left_chest, right_chest, full
      return new THREE.Euler(0, 0, 0); // faces +Z
  }
}

function computeCentreFromMesh(placement: string, meshNode: THREE.Mesh): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(meshNode);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  const size = new THREE.Vector3();
  box.getSize(size);

  switch (placement) {
    case "back":
      return new THREE.Vector3(centre.x, centre.y + size.y * 0.05, centre.z - size.z * 0.48);
    case "left_sleeve":
      return new THREE.Vector3(centre.x - size.x * 0.48, centre.y + size.y * 0.1, centre.z);
    case "right_sleeve":
      return new THREE.Vector3(centre.x + size.x * 0.48, centre.y + size.y * 0.1, centre.z);
    case "hood":
      return new THREE.Vector3(centre.x, centre.y + size.y * 0.45, centre.z + size.z * 0.2);
    default: // front, chest, full
      return new THREE.Vector3(centre.x, centre.y + size.y * 0.05, centre.z + size.z * 0.48);
  }
}

function getHardcodedCentre(placement: string): THREE.Vector3 {
  switch (placement) {
    case "back":
      return new THREE.Vector3(0, 0.55, -0.13);
    case "left_sleeve":
      return new THREE.Vector3(-0.28, 0.6, 0);
    case "right_sleeve":
      return new THREE.Vector3(0.28, 0.6, 0);
    case "hood":
      return new THREE.Vector3(0, 0.9, 0.05);
    default:
      return new THREE.Vector3(0, 0.55, 0.13);
  }
}

/** Pure function so it can be called per-mesh from map() without hook rules getting in the way. */
export function computeViewerDecalTransform(
  zone: ViewerPrintArea,
  meshNode?: THREE.Mesh,
): DecalTransform | null {
  const decal = zone.decal;
  if (!decal?.url) return null;

  const placement = zone.placement;
  const worldBounds = zone.uv_config?.world_bounds;

  // 1. Base surface orientation
  const baseRotation = worldBounds?.rotation
    ? new THREE.Euler(...worldBounds.rotation)
    : placementToRotation(placement);
  const baseQuat = new THREE.Quaternion().setFromEuler(baseRotation);

  // 2. Zone centre
  const centre = worldBounds?.center
    ? new THREE.Vector3(...worldBounds.center)
    : meshNode
      ? computeCentreFromMesh(placement, meshNode)
      : getHardcodedCentre(placement);

  // 3. Projector depth
  let halfThickness: number;
  if (worldBounds?.half_extents?.[2] != null) {
    halfThickness = worldBounds.half_extents[2];
  } else if (meshNode) {
    const box = new THREE.Box3().setFromObject(meshNode);
    const size = new THREE.Vector3();
    box.getSize(size);
    halfThickness = Math.min(size.x, size.y, size.z) / 2;
  } else {
    halfThickness = 0.02;
  }

  // 4. Print area physical size (cm → metres)
  const zoneWidthM = parseFloat(String(zone.width_cm)) * CM;
  const zoneHeightM = parseFloat(String(zone.height_cm)) * CM;

  // 5. Baked-in scale (aspect-preserving)
  const limits = zone.uv_config?.transform_limits ?? {
    min_scale: 0.02,
    max_scale: Math.min(zoneWidthM, zoneHeightM) * 0.95,
  };
  const rawScaleY = Math.max(limits.min_scale, Math.min(limits.max_scale, decal.scale));
  const scaleX = rawScaleY * decal.aspect_ratio;
  const maxWidth = zoneWidthM * 0.95;
  const finalScaleX = Math.min(scaleX, maxWidth);
  const finalScaleY = finalScaleX / decal.aspect_ratio;

  // 6. Offset clamped to zone
  const halfZoneW = zoneWidthM / 2;
  const halfZoneH = zoneHeightM / 2;
  const halfArtW = finalScaleX / 2;
  const halfArtH = finalScaleY / 2;
  // Same screen-space (X) vs world-space mismatch as the studio version.
  const offsetX = Math.max(-halfZoneW + halfArtW, Math.min(halfZoneW - halfArtW, -decal.offset_x));
  const offsetY = Math.max(-halfZoneH + halfArtH, Math.min(halfZoneH - halfArtH, decal.offset_y));

  // 7. World position
  const offsetLocal = new THREE.Vector3(offsetX, offsetY, 0);
  const offsetWorld = offsetLocal.clone().applyQuaternion(baseQuat);
  const position = centre.clone().add(offsetWorld);

  // 8. Projector depth
  const depthZ = halfThickness * 2 + SURFACE_EPSILON * 2;

  // 9. Final rotation (surface normal + baked-in spin)
  const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -decal.rotation));
  const finalQuat = baseQuat.clone().multiply(spin);
  const rotation = new THREE.Euler().setFromQuaternion(finalQuat);

  // 10. Scale vector
  const scale = new THREE.Vector3(finalScaleX, finalScaleY, depthZ);

  return { position, scale, rotation };
}

export function useViewerDecalTransform(
  zone: ViewerPrintArea,
  meshNode?: THREE.Mesh,
): DecalTransform | null {
  return useMemo(() => computeViewerDecalTransform(zone, meshNode), [zone, meshNode]);
}


export function isFullWrapZone(zone: ViewerPrintArea): boolean {
  return zone.placement === "full" || zone.placement === "wrap";
}

export interface WrapTextureTransform {
  repeat: [number, number];
  offset: [number, number];
  rotation: number;
  center: [number, number];
}

export function computeWrapTextureTransform(decal: PrintAreaDecal): WrapTextureTransform {
  const tilesY = Math.max(MIN_REPEAT, 1 / Math.max(decal.scale, 1e-4));
  const tilesX = tilesY / Math.max(decal.aspect_ratio, 1e-4);
  const offsetU = (decal.offset_x * tilesX) % 1;
  const offsetV = (decal.offset_y * tilesY) % 1;
  return {
    repeat: [tilesX, tilesY],
    offset: [offsetU, offsetV],
    rotation: decal.rotation,
    center: [0.5, 0.5],
  };
}

/** Mutates a THREE.Texture in place to apply a wrap transform + seamless tiling settings. */
export function applyWrapTextureTransform(texture: THREE.Texture, transform: WrapTextureTransform): void {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...transform.repeat);
  texture.offset.set(...transform.offset);
  texture.center.set(...transform.center);
  texture.rotation = transform.rotation;
  texture.needsUpdate = true;
}
// src/features/studio/hooks/useDecalTransforms.ts

import { useMemo } from "react";
import * as THREE from "three";
import type { PrintArea, ArtworkState } from "../store";

const CM = 0.01;
const SURFACE_EPSILON = 0.005;

export interface DecalTransform {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotation: THREE.Euler;
}


export interface WrapFace {
  /** Logical name matching the placement helpers below */
  placement: string;

  bleedFactor: number;
}

export const WRAP_FACES: WrapFace[] = [
  { placement: "front",        bleedFactor: 1.05 },
  { placement: "back",         bleedFactor: 1.05 },
  { placement: "left_sleeve",  bleedFactor: 1.10 },
  { placement: "right_sleeve", bleedFactor: 1.10 },
];

export const FULL_PRINT_PLACEMENTS = WRAP_FACES.map((f) => f.placement) as readonly string[];


export type PrintMode = "SINGLE" | "FRONT_BACK_SPLIT" | "TWO_SIDE_DISTINCT" | "FULL_WRAP";

export interface PrintModeResult {
  mode: PrintMode;
  /** Present only when mode is FRONT_BACK_SPLIT or TWO_SIDE_DISTINCT */
  frontZone?: PrintArea;
  backZone?: PrintArea;
}

function artworkIdentity(art: ArtworkState | undefined): string | null {
  if (!art?.decalUrl) return null;
  const maybeId = (art as { id?: string }).id;
  return maybeId ?? art.decalUrl;
}

function findZoneByPlacement(printAreas: PrintArea[], placement: string): PrintArea | undefined {
  return printAreas.find((z) => z.placement === placement);
}

export function derivePrintMode(
  printAreas: PrintArea[],
  artworks: Record<string, ArtworkState>,
): PrintModeResult {
  const wrapZone = printAreas.find(
    (z) => z.placement === "wrap" && !!artworks[z.id]?.decalUrl,
  );
  if (wrapZone) return { mode: "FULL_WRAP" };

  const frontZone = findZoneByPlacement(printAreas, "front");
  const backZone  = findZoneByPlacement(printAreas, "back");

  const frontArt = frontZone ? artworks[frontZone.id] : undefined;
  const backArt  = backZone  ? artworks[backZone.id]  : undefined;

  const frontHasArt = !!frontArt?.decalUrl;
  const backHasArt  = !!backArt?.decalUrl;

  if (frontZone && backZone && frontHasArt && backHasArt) {
    const sameArtwork = artworkIdentity(frontArt) === artworkIdentity(backArt);
    return {
      mode: sameArtwork ? "FRONT_BACK_SPLIT" : "TWO_SIDE_DISTINCT",
      frontZone,
      backZone,
    };
  }

  return { mode: "SINGLE" };
}


export interface WrapTextureTransform {
  repeat: [number, number];
  offset: [number, number];
  rotation: number;
  center: [number, number];
}

const MIN_REPEAT = 0.05; // guards against artwork.decalScale === 0 producing Infinity repeat

export function computeWrapTextureTransform(artwork: ArtworkState): WrapTextureTransform {

  const tilesY = Math.max(MIN_REPEAT, 1 / Math.max(artwork.decalScale, 1e-4));
  const tilesX = tilesY / Math.max(artwork.decalAspect, 1e-4);

  const offsetU = (artwork.decalOffsetX * tilesX) % 1;
  const offsetV = (artwork.decalOffsetY * tilesY) % 1;

  return {
    repeat: [tilesX, tilesY],
    offset: [offsetU, offsetV],
    rotation: artwork.decalRotation,
    center: [0.5, 0.5],
  };
}

/** Mutates a THREE.Texture in place to apply a wrap transform + seamless tiling settings. */
export function applyWrapTextureTransform(
  texture: THREE.Texture,
  transform: WrapTextureTransform,
): void {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...transform.repeat);
  texture.offset.set(...transform.offset);
  texture.center.set(...transform.center);
  texture.rotation = transform.rotation;
  texture.needsUpdate = true;
}


export interface ZoneTransformBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
}

/**
 * Single source of truth for a zone's drag/scale limits, shared by the
 * DecalPanel fine-tune sliders and the on-model TransformControls gizmo so
 * the two input methods can never disagree about what's in-bounds.
 */
export function getZoneTransformBounds(zone: PrintArea): ZoneTransformBounds {
  const halfWidth  = (zone.widthCm  * CM) / 2;
  const halfHeight = (zone.heightCm * CM) / 2;
  return {
    minX: zone.transformLimits?.minX ?? -halfWidth,
    maxX: zone.transformLimits?.maxX ??  halfWidth,
    minY: zone.transformLimits?.minY ?? -halfHeight,
    maxY: zone.transformLimits?.maxY ??  halfHeight,
    minScale: zone.transformLimits?.minScale ?? 0.02,
    maxScale: zone.transformLimits?.maxScale ?? Math.min(zone.widthCm, zone.heightCm) * CM * 0.95,
  };
}

export function useDecalTransform(
  zone: PrintArea,
  artwork: ArtworkState | undefined,
  meshNode?: THREE.Mesh,
): DecalTransform | null {
  return useMemo(() => {
    if (!artwork?.decalUrl) return null;
    return computeDecalTransform(zone, artwork, meshNode);
  }, [zone, artwork, meshNode]);
}


export function computeDecalTransform(
  zone: PrintArea,
  artwork: ArtworkState,
  meshNode?: THREE.Mesh,
  placementOverride?: string,
): DecalTransform | null {
  const placement = placementOverride ?? zone.placement;

  //    1. Base surface orientation 
  const baseRotation = (!placementOverride && zone.worldBounds?.rotation)
    ? new THREE.Euler(...zone.worldBounds.rotation)
    : placementToRotation(placement);
  const baseQuat = new THREE.Quaternion().setFromEuler(baseRotation);

  //    2. Zone centre
  let centre: THREE.Vector3;
  if (!placementOverride && zone.worldBounds?.center) {
    centre = new THREE.Vector3(...zone.worldBounds.center);
  } else if (!placementOverride && zone.cameraFocus?.target) {
    centre = new THREE.Vector3(...zone.cameraFocus.target);
  } else if (meshNode) {
    centre = computeCentreFromMesh(placement, meshNode);
  } else {
    centre = getHardcodedCentre(placement);
  }

  //    3. Projector depth 
  let halfThickness: number;
  if (!placementOverride && zone.worldBounds?.halfExtents?.[2] != null) {
    halfThickness = zone.worldBounds.halfExtents[2];
  } else if (meshNode) {
    const box  = new THREE.Box3().setFromObject(meshNode);
    const size = new THREE.Vector3();
    box.getSize(size);
    halfThickness = Math.min(size.x, size.y, size.z) / 2;
  } else {
    halfThickness = 0.02;
  }

  //    4. Print area physical size (cm → metres)
  const zoneWidthM  = zone.widthCm  * CM;
  const zoneHeightM = zone.heightCm * CM;

  //    5. User scale (aspect-preserving)
  const limits = zone.transformLimits ?? {
    minScale: 0.02,
    maxScale: Math.min(zoneWidthM, zoneHeightM) * 0.95,
  };
  const rawScaleY   = Math.max(limits.minScale, Math.min(limits.maxScale, artwork.decalScale));
  const scaleX      = rawScaleY * artwork.decalAspect;
  const maxWidth    = zoneWidthM * 0.95;
  const finalScaleX = Math.min(scaleX, maxWidth);
  const finalScaleY = finalScaleX / artwork.decalAspect;

  //    6. Offset clamped to zone   
  const halfZoneW = zoneWidthM  / 2;
  const halfZoneH = zoneHeightM / 2;
  const halfArtW  = finalScaleX / 2;
  const halfArtH  = finalScaleY / 2;
  // Negate X: same screen-space (panel/drag) vs world-space mismatch as the Y-axis
  // below. The full-wrap path (computeWrapTextureTransform) doesn't need this
  // because its UV space happens to already be wound in the same direction as
  // the drag axis — single decals placed directly in mesh-local world space do not.
  const offsetX   = Math.max(-halfZoneW + halfArtW, Math.min(halfZoneW - halfArtW, -artwork.decalOffsetX));
  // No negation here: the panel's drag handler already negates decalOffsetY to
  // account for the screen-space (Y↓) vs Three.js world-space (Y↑) mismatch, so
  // applying it again here would cancel it back out. Use the stored value as-is.
  const offsetY   = Math.max(-halfZoneH + halfArtH, Math.min(halfZoneH - halfArtH, artwork.decalOffsetY));

  //    7. World position
  const offsetLocal = new THREE.Vector3(offsetX, offsetY, 0);
  const offsetWorld = offsetLocal.clone().applyQuaternion(baseQuat);
  const position    = centre.clone().add(offsetWorld);

  //    8. Projector depth 
  const depthZ = halfThickness * 2 + SURFACE_EPSILON * 2;

  //    9. Final rotation (surface normal + user spin)
  // Negate rotation: canvas uses clockwise-positive, Three.js uses counter-clockwise-positive.
  const userSpin  = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -artwork.decalRotation));
  const finalQuat = baseQuat.clone().multiply(userSpin);
  const rotation  = new THREE.Euler().setFromQuaternion(finalQuat);

  //    10. Scale vector
  const scale = new THREE.Vector3(finalScaleX, finalScaleY, depthZ);

  return { position, scale, rotation };
}

export function computeWrapFaceTransform(
  face: WrapFace,
  artwork: ArtworkState,
  meshNode: THREE.Mesh,
): DecalTransform | null {
  const { placement, bleedFactor } = face;

  //    Orientation 
  const baseRotation = placementToRotation(placement);
  const baseQuat     = new THREE.Quaternion().setFromEuler(baseRotation);

  //    Centre of this face on the mesh  
  const centre = computeCentreFromMesh(placement, meshNode);

  //    Full mesh bounds → face dimension
  const box  = new THREE.Box3().setFromObject(meshNode);
  const size = new THREE.Vector3();
  box.getSize(size);

  // For each face we pick the two axes that define the visible surface.
  // The third axis becomes the projector depth.
  const { faceW, faceH, halfThickness } = getFaceDimensions(placement, size);

  // Scale = full face size, expanded by bleed factor
  // User offset is expressed as a fraction of face size so it pans naturally
  const scaledW = faceW * bleedFactor;
  const scaledH = faceH * bleedFactor;

  // User can nudge the pattern position within the face
  const maxOffX = faceW * 0.4;
  const maxOffY = faceH * 0.4;
  // Negate X: same convention fix as computeDecalTransform above.
  const offsetX = Math.max(-maxOffX, Math.min(maxOffX, -artwork.decalOffsetX));
  // No negation here: same reasoning as computeDecalTransform above — the panel
  // already negates decalOffsetY, so re-negating here would cancel it back out.
  const offsetY = Math.max(-maxOffY, Math.min(maxOffY, artwork.decalOffsetY));

  const offsetLocal = new THREE.Vector3(offsetX, offsetY, 0);
  const offsetWorld = offsetLocal.clone().applyQuaternion(baseQuat);
  const position    = centre.clone().add(offsetWorld);

  const depthZ = halfThickness * 2 + SURFACE_EPSILON * 2;

  // Negate rotation: clockwise-positive (canvas) → counter-clockwise-positive (Three.js).
  const userSpin  = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -artwork.decalRotation));
  const finalQuat = baseQuat.clone().multiply(userSpin);
  const rotation  = new THREE.Euler().setFromQuaternion(finalQuat);

  const scale = new THREE.Vector3(scaledW, scaledH, depthZ);

  return { position, scale, rotation };
}


export function decomposeDecalTransform(
  worldMatrix: THREE.Matrix4,
  zone: PrintArea,
): { offsetX: number; offsetY: number; scale: number; rotation: number } {
  const pos  = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl  = new THREE.Vector3();
  worldMatrix.decompose(pos, quat, scl);

  const baseRotation = zone.worldBounds?.rotation
    ? new THREE.Euler(...zone.worldBounds.rotation)
    : placementToRotation(zone.placement);
  const baseQuat = new THREE.Quaternion().setFromEuler(baseRotation);

  const centre = zone.worldBounds?.center
    ? new THREE.Vector3(...zone.worldBounds.center)
    : new THREE.Vector3(0, 0, 0);

  const invQuat  = baseQuat.clone().invert();
  const localPos = pos.clone().sub(centre).applyQuaternion(invQuat);

  const userQuat  = invQuat.clone().multiply(quat);
  const userEuler = new THREE.Euler().setFromQuaternion(userQuat, "XYZ");
  let userRotation = userEuler.z;
  while (userRotation >  Math.PI) userRotation -= Math.PI * 2;
  while (userRotation < -Math.PI) userRotation += Math.PI * 2;

  return {
    // Negate back: world local X → screen/store X convention, mirrors the X fix above.
    offsetX:   parseFloat(-localPos.x.toFixed(4)),
    // No negation: forward transform now uses decalOffsetY as-is (see computeDecalTransform).
    offsetY:   parseFloat( localPos.y.toFixed(4)),
    scale:     parseFloat(Math.abs(scl.y).toFixed(4)),
    // Negate back: Three.js CCW → canvas CW convention used by the store/UI.
    rotation:  parseFloat(-userRotation.toFixed(4)),
  };
}

function placementToRotation(placement: string): THREE.Euler {
  switch (placement) {
    case "back":
      return new THREE.Euler(0, Math.PI, 0);       // faces -Z
    case "left_sleeve":
      return new THREE.Euler(0, -Math.PI / 2, 0);  // faces -X
    case "right_sleeve":
      return new THREE.Euler(0,  Math.PI / 2, 0);  // faces +X
    case "hood":
      return new THREE.Euler(-Math.PI / 4, 0, 0);  // faces up-forward
    default:                                        // front, left_chest, right_chest, full
      return new THREE.Euler(0, 0, 0);              // faces +Z
  }
}


function computeCentreFromMesh(placement: string, meshNode: THREE.Mesh): THREE.Vector3 {
  const box    = new THREE.Box3().setFromObject(meshNode);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  const size = new THREE.Vector3();
  box.getSize(size);

  switch (placement) {
    case "back":
      return new THREE.Vector3(
        centre.x,
        centre.y + size.y * 0.05,   // slight upward nudge
        centre.z - size.z * 0.48,   // near the back surface
      );
    case "left_sleeve":
      return new THREE.Vector3(
        centre.x - size.x * 0.48,   // near the left surface
        centre.y + size.y * 0.10,
        centre.z,
      );
    case "right_sleeve":
      return new THREE.Vector3(
        centre.x + size.x * 0.48,   // near the right surface
        centre.y + size.y * 0.10,
        centre.z,
      );
    case "hood":
      return new THREE.Vector3(
        centre.x,
        centre.y + size.y * 0.45,
        centre.z + size.z * 0.20,
      );
    default: // front, chest, full
      return new THREE.Vector3(
        centre.x,
        centre.y + size.y * 0.05,
        centre.z + size.z * 0.48,   // near the front surface
      );
  }
}

function getHardcodedCentre(placement: string): THREE.Vector3 {
  switch (placement) {
    case "back":         return new THREE.Vector3( 0,    0.55, -0.13);
    case "left_sleeve":  return new THREE.Vector3(-0.28, 0.60,  0);
    case "right_sleeve": return new THREE.Vector3( 0.28, 0.60,  0);
    case "hood":         return new THREE.Vector3( 0,    0.90,  0.05);
    default:             return new THREE.Vector3( 0,    0.55,  0.13);
  }
}

function isLikelyCylindrical(meshSize: THREE.Vector3): boolean {
  const cross = [meshSize.x, meshSize.z].sort((a, b) => a - b);
  const [minCross, maxCross] = cross;
  if (maxCross <= 0) return false;
  return minCross / maxCross > 0.6;
}

function getFaceDimensions(
  placement: string,
  meshSize: THREE.Vector3,
): { faceW: number; faceH: number; halfThickness: number } {
  switch (placement) {
    case "left_sleeve":
    case "right_sleeve":
      return {
        faceW:         meshSize.z,
        faceH:         meshSize.y * 0.6,  // sleeves are shorter than the torso
        halfThickness: meshSize.x / 2,
      };
    default: { // front, back
      const cylindrical = isLikelyCylindrical(meshSize);
      const diameter = (meshSize.x + meshSize.z) / 2;
      const faceW = cylindrical ? (Math.PI * diameter) / 2 : meshSize.x;
      return {
        faceW,
        faceH:         meshSize.y,
        halfThickness: meshSize.z / 2,
      };
    }
  }
}
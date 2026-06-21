// hooks/useDecalTransforms.ts — COMPLETE REPLACEMENT

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

/**
 * Computes decal transform for a zone.
 * 
 * BACKEND PROVIDES (inside uv_config):
 *   - world_bounds.center:     [x, y, z] world position
 *   - world_bounds.half_extents: [hx, hy, hz] half-size (hz = thickness/2)
 *   - world_bounds.rotation:   [rx, ry, rz] surface normal orientation
 *   - transform_limits:        min/max scale and offset constraints
 *   - width_cm, height_cm:       Physical print area dimensions
 * 
 * FRONTEND CALCULATES:
 *   - Aspect-preserving scale from user decalScale input
 *   - Offset clamping within zone bounds
 *   - Z-depth from halfExtents[2] (or fallback thickness)
 *   - Final position = centre + rotated(offset)
 */
export function useDecalTransform(
  zone: PrintArea,
  artwork: ArtworkState | undefined,
  meshNode?: THREE.Mesh
): DecalTransform | null {
  return useMemo(() => {
    if (!artwork?.decalUrl) return null;

    // ═══════════════════════════════════════════════════════════════
    // 1. BASE ORIENTATION (which way does the surface face?)
    // ═══════════════════════════════════════════════════════════════
    
    const baseRotation = zone.worldBounds?.rotation
      ? new THREE.Euler(...zone.worldBounds.rotation)
      : placementToRotation(zone.placement);

    const baseQuat = new THREE.Quaternion().setFromEuler(baseRotation);

    // ═══════════════════════════════════════════════════════════════
    // 2. ZONE CENTRE (where on the mesh is the print area?)
    // ═══════════════════════════════════════════════════════════════
    
    let centre: THREE.Vector3;
    
    if (zone.worldBounds?.center) {
      // Backend provided exact centre
      centre = new THREE.Vector3(...zone.worldBounds.center);
    } else if (zone.cameraFocus?.target) {
      // Fallback to camera focus target
      centre = new THREE.Vector3(...zone.cameraFocus.target);
    } else if (meshNode) {
      // Compute from actual mesh geometry
      centre = computeCentreFromMesh(zone.placement, meshNode);
    } else {
      // Absolute fallback for shirt_baked.glb
      centre = getHardcodedCentre(zone.placement);
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. MESH THICKNESS AT ZONE (controls decal projector depth)
    // ═══════════════════════════════════════════════════════════════
    
    let halfThickness: number;
    
    if (zone.worldBounds?.halfExtents?.[2] != null) {
      // Backend provides thickness
      halfThickness = zone.worldBounds.halfExtents[2];
    } else if (meshNode) {
      // Estimate from mesh bounding box
      const box = new THREE.Box3().setFromObject(meshNode);
      const size = new THREE.Vector3();
      box.getSize(size);
      // Thickness is smallest dimension for a roughly flat garment
      halfThickness = Math.min(size.x, size.y, size.z) / 2;
    } else {
      // Default for t-shirt
      halfThickness = 0.02;
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. PHYSICAL PRINT AREA SIZE (cm → metres)
    // ═══════════════════════════════════════════════════════════════
    
    const zoneWidthM = zone.widthCm * CM;
    const zoneHeightM = zone.heightCm * CM;

    // ═══════════════════════════════════════════════════════════════
    // 5. USER SCALE (aspect-preserving)
    // ═══════════════════════════════════════════════════════════════
    
    const limits = zone.transformLimits ?? {
      minScale: 0.02,
      maxScale: Math.min(zoneWidthM, zoneHeightM) * 0.95,
    };

    // User inputs decalScale as HEIGHT in metres
    const rawScaleY = Math.max(
      limits.minScale,
      Math.min(limits.maxScale, artwork.decalScale)
    );

    // Preserve aspect: width = height * aspect_ratio
    const scaleY = rawScaleY;
    const scaleX = scaleY * artwork.decalAspect;

    // Clamp width to zone bounds
    const maxWidth = zoneWidthM * 0.95;
    const finalScaleX = Math.min(scaleX, maxWidth);
    const finalScaleY = finalScaleX / artwork.decalAspect;

    // ═══════════════════════════════════════════════════════════════
    // 6. CLAMP OFFSETS (keep artwork inside print area)
    // ═══════════════════════════════════════════════════════════════
    
    const halfZoneW = zoneWidthM / 2;
    const halfZoneH = zoneHeightM / 2;
    const halfArtW = finalScaleX / 2;
    const halfArtH = finalScaleY / 2;

    const offsetX = Math.max(
      -halfZoneW + halfArtW,
      Math.min(halfZoneW - halfArtW, artwork.decalOffsetX)
    );
    const offsetY = Math.max(
      -halfZoneH + halfArtH,
      Math.min(halfZoneH - halfArtH, artwork.decalOffsetY)
    );

    // ═══════════════════════════════════════════════════════════════
    // 7. WORLD POSITION
    //    centre + (offset rotated by base orientation)
    // ═══════════════════════════════════════════════════════════════
    
    const offsetLocal = new THREE.Vector3(offsetX, offsetY, 0);
    const offsetWorld = offsetLocal.clone().applyQuaternion(baseQuat);
    const position = centre.clone().add(offsetWorld);

    // ═══════════════════════════════════════════════════════════════
    // 8. Z-DEPTH (decal projector thickness)
    //    Must reach surface but NOT punch through to back
    // ═══════════════════════════════════════════════════════════════
    
    // depth = full thickness + small bleed on both sides
    // This is the KEY fix: thin enough for single-sided, thick enough to reach
    const depthZ = (halfThickness * 2) + (SURFACE_EPSILON * 2);

    // ═══════════════════════════════════════════════════════════════
    // 9. FINAL ROTATION (base orientation + user spin)
    // ═══════════════════════════════════════════════════════════════
    
    const userSpin = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, 0, artwork.decalRotation)
    );
    const finalQuat = baseQuat.clone().multiply(userSpin);
    const rotation = new THREE.Euler().setFromQuaternion(finalQuat);

    // ═══════════════════════════════════════════════════════════════
    // 10. SCALE VECTOR [width, height, depth]
    // ═══════════════════════════════════════════════════════════════
    
    const scale = new THREE.Vector3(finalScaleX, finalScaleY, depthZ);

    return { position, scale, rotation };
  }, [zone, artwork, meshNode]);
}

/**
 * Decomposes dragged world matrix back to user transform values.
 */
export function decomposeDecalTransform(
  worldMatrix: THREE.Matrix4,
  zone: PrintArea
): { offsetX: number; offsetY: number; scale: number; rotation: number } {
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  worldMatrix.decompose(pos, quat, scl);

  const baseRotation = zone.worldBounds?.rotation
    ? new THREE.Euler(...zone.worldBounds.rotation)
    : placementToRotation(zone.placement);
  const baseQuat = new THREE.Quaternion().setFromEuler(baseRotation);

  const centre = zone.worldBounds?.center
    ? new THREE.Vector3(...zone.worldBounds.center)
    : new THREE.Vector3(0, 0, 0);

  const invQuat = baseQuat.clone().invert();
  const localPos = pos.clone().sub(centre).applyQuaternion(invQuat);

  const userQuat = invQuat.clone().multiply(quat);
  const userEuler = new THREE.Euler().setFromQuaternion(userQuat, "XYZ");
  let userRotation = userEuler.z;

  while (userRotation > Math.PI) userRotation -= Math.PI * 2;
  while (userRotation < -Math.PI) userRotation += Math.PI * 2;

  return {
    offsetX: parseFloat(localPos.x.toFixed(4)),
    offsetY: parseFloat(localPos.y.toFixed(4)),
    scale: parseFloat(Math.abs(scl.y).toFixed(4)),
    rotation: parseFloat(userRotation.toFixed(4)),
  };
}

// ═════════════════════════════════════════════════════════════════
// FALLBACK HELPERS
// ═════════════════════════════════════════════════════════════════

function placementToRotation(placement: string): THREE.Euler {
  switch (placement) {
    case "back":
      return new THREE.Euler(0, Math.PI, 0);        // faces -Z
    case "left_sleeve":
      return new THREE.Euler(0, -Math.PI / 2, 0);   // faces -X
    case "right_sleeve":
      return new THREE.Euler(0, Math.PI / 2, 0);    // faces +X
    case "hood":
      return new THREE.Euler(-Math.PI / 4, 0, 0);   // faces up-forward
    default: // front, left_chest, right_chest
      return new THREE.Euler(0, 0, 0);              // faces +Z
  }
}

/**
 * Compute centre from actual mesh bounding box.
 * For shirt_baked.glb, the mesh spans roughly Y=[0,1], X=[-0.3,0.3], Z=[-0.15,0.15]
 */
function computeCentreFromMesh(
  placement: string,
  meshNode: THREE.Mesh
): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(meshNode);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  const size = new THREE.Vector3();
  box.getSize(size);

  // The shirt_baked.glb centre is roughly at Y=0.5, not origin
  // We need to place the decal on the SURFACE, not the centre of volume
  
  switch (placement) {
    case "back": {
      // Back surface: negative Z, upper half of Y
      const y = centre.y + size.y * 0.05; // slight nudge up from center
      const z = centre.z - size.z * 0.48; // near back surface
      return new THREE.Vector3(centre.x, y, z);
    }
    case "left_sleeve": {
      // Left surface: negative X, upper Y
      const x = centre.x - size.x * 0.48;
      const y = centre.y + size.y * 0.1;
      return new THREE.Vector3(x, y, centre.z);
    }
    case "right_sleeve": {
      // Right surface: positive X, upper Y
      const x = centre.x + size.x * 0.48;
      const y = centre.y + size.y * 0.1;
      return new THREE.Vector3(x, y, centre.z);
    }
    case "hood": {
      const y = centre.y + size.y * 0.45;
      const z = centre.z + size.z * 0.2;
      return new THREE.Vector3(centre.x, y, z);
    }
    default: { // front, chest
      const y = centre.y + size.y * 0.05;
      const z = centre.z + size.z * 0.48;
      return new THREE.Vector3(centre.x, y, z);
    }
  }
}

/**
 * Hardcoded fallback for shirt_baked.glb when meshNode unavailable.
 * These values are tuned for the adrianhajdin model.
 */
// function getHardcodedCentre(placement: string): THREE.Vector3 {
//   switch (placement) {
//     case "back":
//       return new THREE.Vector3(0, 0.5, -0.12);
//     case "left_sleeve":
//       // Z = -0.05 pushes the decal toward the back of the sleeve
//       // Increase the magnitude (e.g. -0.08) to go further back
//       return new THREE.Vector3(-0.28, 0.55, -0.05);
//     case "right_sleeve":
//       return new THREE.Vector3(0.28, 0.55, -0.05);
//     case "hood":
//       return new THREE.Vector3(0, 0.8, 0.1);
//     default: // front
//       return new THREE.Vector3(0, 0.5, 0.12);
//   }
// }

// Add to studio's useDecalTransforms.ts

export const FULL_PRINT_PLACEMENTS = ["front", "back", "left_sleeve", "right_sleeve"] as const;

/** Pure computation — mirrors useDecalTransform but callable in loops/useMemo. */
export function computeDecalTransform(
  zone: PrintArea,
  artwork: ArtworkState,
  meshNode?: THREE.Mesh,
  placementOverride?: string,
): DecalTransform | null {
  // Same math as useDecalTransform's useMemo body,
  // but uses placementOverride for centre + rotation lookups
  // and skips zone.worldBounds when placementOverride is set.
  const placement = placementOverride ?? zone.placement;
  const baseRotation = (!placementOverride && zone.worldBounds?.rotation)
    ? new THREE.Euler(...zone.worldBounds.rotation)
    : placementToRotation(placement);
  const baseQuat = new THREE.Quaternion().setFromEuler(baseRotation);

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

  let halfThickness: number;
  if (!placementOverride && zone.worldBounds?.halfExtents?.[2] != null) {
    halfThickness = zone.worldBounds.halfExtents[2];
  } else if (meshNode) {
    const box = new THREE.Box3().setFromObject(meshNode);
    const size = new THREE.Vector3();
    box.getSize(size);
    halfThickness = Math.min(size.x, size.y, size.z) / 2;
  } else {
    halfThickness = 0.02;
  }

  const zoneWidthM = zone.widthCm * CM;
  const zoneHeightM = zone.heightCm * CM;
  const limits = zone.transformLimits ?? {
    minScale: 0.02,
    maxScale: Math.min(zoneWidthM, zoneHeightM) * 0.95,
  };

  const rawScaleY = Math.max(limits.minScale, Math.min(limits.maxScale, artwork.decalScale));
  const scaleX = rawScaleY * artwork.decalAspect;
  const maxWidth = zoneWidthM * 0.95;
  const finalScaleX = Math.min(scaleX, maxWidth);
  const finalScaleY = finalScaleX / artwork.decalAspect;

  const halfZoneW = zoneWidthM / 2;
  const halfZoneH = zoneHeightM / 2;
  const halfArtW = finalScaleX / 2;
  const halfArtH = finalScaleY / 2;
  const offsetX = Math.max(-halfZoneW + halfArtW, Math.min(halfZoneW - halfArtW, artwork.decalOffsetX));
  const offsetY = Math.max(-halfZoneH + halfArtH, Math.min(halfZoneH - halfArtH, artwork.decalOffsetY));

  const offsetLocal = new THREE.Vector3(offsetX, offsetY, 0);
  const offsetWorld = offsetLocal.clone().applyQuaternion(baseQuat);
  const position = centre.clone().add(offsetWorld);

  const depthZ = halfThickness * 2 + SURFACE_EPSILON * 2;

  const userSpin = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, artwork.decalRotation));
  const finalQuat = baseQuat.clone().multiply(userSpin);
  const rotation = new THREE.Euler().setFromQuaternion(finalQuat);
  const scale = new THREE.Vector3(finalScaleX, finalScaleY, depthZ);

  return { position, scale, rotation };
}
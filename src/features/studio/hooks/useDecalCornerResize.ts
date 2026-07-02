// src/features/studio/hooks/useDecalCornerResize.ts
//
// One hook instance per draggable corner pin. Compared to hit-testing edge
// proximity on the artwork itself, this is both simpler and more reliable:
// the pin's own geometry *is* the grab target (with a generous fixed-size
// hit area, independent of the artwork's own size — which is exactly what
// makes small artwork easy to resize too), and the corner it represents is
// known up front, so there's no classification step to get subtly wrong.
//
// The resize is uniform (aspect-locked) about the decal's own centre:
// dragging a pin further from centre along its own original direction grows
// the artwork, dragging it back in shrinks it. Which specific pin was
// grabbed only matters for which fixed direction we measure along — the
// underlying math is identical for all four.

import { useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ArtworkState, PrintArea } from "../store";
import type { DecalTransform, ZoneTransformBounds } from "./useDecalTransforms";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

const DRAG_THRESHOLD = 0.0025;

export type Corner = "tl" | "tr" | "bl" | "br";

export const CORNER_SIGN: Record<Corner, { sx: 1 | -1; sy: 1 | -1 }> = {
  tl: { sx: -1, sy: 1 },
  tr: { sx: 1, sy: 1 },
  bl: { sx: -1, sy: -1 },
  br: { sx: 1, sy: -1 },
};

export const CORNER_CURSOR: Record<Corner, string> = {
  tl: "nwse-resize",
  br: "nwse-resize",
  tr: "nesw-resize",
  bl: "nesw-resize",
};

export function useDecalCornerResize(
  zone: PrintArea,
  transform: DecalTransform | null,
  artwork: ArtworkState,
  bounds: ZoneTransformBounds,
  onChange: (patch: Partial<ArtworkState>) => void,
  onSelect: (zoneId: string) => void,
  corner: Corner,
) {
  const planeRef = useRef(new THREE.Plane());
  const dragRef = useRef<{
    grabDir: THREE.Vector2;
    grabDist: number;
    initialScale: number;
    moved: boolean;
  } | null>(null);

  const orbitControls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const gl = useThree((s) => s.gl);

  const setCursor = (cursor: string) => {
    gl.domElement.style.cursor = cursor;
  };
  const setOrbitEnabled = (enabled: boolean) => {
    if (orbitControls) orbitControls.enabled = enabled;
  };

  const toLocal = (world: THREE.Vector3, t: DecalTransform) => {
    const invQuat = new THREE.Quaternion().setFromEuler(t.rotation).invert();
    const local = world.clone().sub(t.position).applyQuaternion(invQuat);
    return { x: local.x, y: local.y };
  };

  const onPointerDown = (e: any) => {
    if (!transform) return;
    e.stopPropagation();
    onSelect(zone.id);
    (e.target as Element)?.setPointerCapture?.(e.pointerId);

    const normal = new THREE.Vector3(0, 0, 1).applyEuler(transform.rotation);
    planeRef.current.setFromNormalAndCoplanarPoint(normal, transform.position);

    const { sx, sy } = CORNER_SIGN[corner];
    const grabDir = new THREE.Vector2(
      (sx * transform.scale.x) / 2,
      (sy * transform.scale.y) / 2,
    );
    const grabDist = grabDir.length();
    if (grabDist < 1e-5) return; // degenerate (near-zero-size) artwork — bail out safely

    dragRef.current = {
      grabDir: grabDir.normalize(),
      grabDist,
      initialScale: artwork.decalScale,
      moved: false,
    };
    setCursor(CORNER_CURSOR[corner]);
  };

  const onPointerMove = (e: any) => {
    const drag = dragRef.current;
    if (!drag || !transform) return;

    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(planeRef.current, hit)) return;
    const local = toLocal(hit, transform);

    if (!drag.moved) {
      const startPoint = drag.grabDir.clone().multiplyScalar(drag.grabDist);
      if (new THREE.Vector2(local.x, local.y).distanceTo(startPoint) < DRAG_THRESHOLD) return;
      drag.moved = true;
      setOrbitEnabled(false);
    }

    const projected = new THREE.Vector2(local.x, local.y).dot(drag.grabDir);
    const ratio = projected / drag.grabDist;
    onChange({
      decalScale: clamp(drag.initialScale * ratio, bounds.minScale, bounds.maxScale),
    });
  };

  const onPointerUp = (e: any) => {
    if (dragRef.current?.moved) setOrbitEnabled(true);
    dragRef.current = null;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    setCursor("auto");
  };

  const onPointerOver = () => setCursor(CORNER_CURSOR[corner]);
  const onPointerOut = () => {
    if (!dragRef.current) setCursor("auto");
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerOver, onPointerOut };
}
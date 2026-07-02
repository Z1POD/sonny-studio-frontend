// src/features/studio/hooks/useDecalDragMove.ts
//
// Interior drag → move. Resizing is handled separately by draggable corner
// pins (see useDecalCornerResize), so this hook only ever has to reason
// about position — no edge classification, no pinch bookkeeping.

import { useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ArtworkState, PrintArea } from "../store";
import {
  decomposeDecalTransform,
  type DecalTransform,
  type ZoneTransformBounds,
} from "./useDecalTransforms";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

const DRAG_THRESHOLD = 0.0025;

export function useDecalDragMove(
  zone: PrintArea,
  transform: DecalTransform | null,
  bounds: ZoneTransformBounds,
  onChange: (patch: Partial<ArtworkState>) => void,
  onSelect: (zoneId: string) => void,
) {
  const planeRef = useRef(new THREE.Plane());
  const dragRef = useRef<{
    grabOffset: THREE.Vector3;
    startHit: THREE.Vector3;
    moved: boolean;
  } | null>(null);

  // OrbitControls registers itself here via `makeDefault` in StudioCanvas.
  // R3F's synthetic pointer events are a separate system from the native
  // pointer listeners OrbitControls attaches directly to the canvas, so
  // stopPropagation() below does nothing to stop it on its own — we flip
  // `.enabled` off only once the gesture crosses the drag threshold, so a
  // simple tap-to-select never touches orbiting at all.
  const orbitControls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const gl = useThree((s) => s.gl);

  const setCursor = (cursor: string) => {
    gl.domElement.style.cursor = cursor;
  };
  const setOrbitEnabled = (enabled: boolean) => {
    if (orbitControls) orbitControls.enabled = enabled;
  };

  const onPointerDown = (e: any) => {
    if (!transform) return;
    e.stopPropagation();
    onSelect(zone.id);
    (e.target as Element)?.setPointerCapture?.(e.pointerId);

    const normal = new THREE.Vector3(0, 0, 1).applyEuler(transform.rotation);
    planeRef.current.setFromNormalAndCoplanarPoint(normal, transform.position);

    const hit = new THREE.Vector3();
    if (e.ray.intersectPlane(planeRef.current, hit)) {
      dragRef.current = {
        grabOffset: transform.position.clone().sub(hit),
        startHit: hit.clone(),
        moved: false,
      };
    }
  };

  const onPointerMove = (e: any) => {
    if (!dragRef.current || !transform) return;
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(planeRef.current, hit)) return;

    if (!dragRef.current.moved) {
      if (hit.distanceTo(dragRef.current.startHit) < DRAG_THRESHOLD) return;
      dragRef.current.moved = true;
      setOrbitEnabled(false);
      setCursor("grabbing");
    }

    const newPosition = hit.clone().add(dragRef.current.grabOffset);
    const matrix = new THREE.Matrix4().compose(
      newPosition,
      new THREE.Quaternion().setFromEuler(transform.rotation),
      transform.scale,
    );
    const decomposed = decomposeDecalTransform(matrix, zone);
    onChange({
      decalOffsetX: clamp(decomposed.offsetX, bounds.minX, bounds.maxX),
      decalOffsetY: clamp(decomposed.offsetY, bounds.minY, bounds.maxY),
    });
  };

  const onPointerUp = (e: any) => {
    if (dragRef.current?.moved) setOrbitEnabled(true);
    dragRef.current = null;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    setCursor("auto");
  };

  const onPointerOver = () => setCursor("grab");
  const onPointerOut = () => {
    if (!dragRef.current) setCursor("auto");
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerOver, onPointerOut };
}
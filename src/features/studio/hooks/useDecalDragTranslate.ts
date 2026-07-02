// src/features/studio/hooks/useDecalDragTranslate.ts

import { useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ArtworkState, PrintArea } from "../store";
import {
  decomposeDecalTransform,
  getZoneTransformBounds,
  type DecalTransform,
  type ZoneTransformBounds,
} from "./useDecalTransforms";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

const DRAG_THRESHOLD = 0.0025;

export function useDecalDragTranslate(
  zone: PrintArea,
  transform: DecalTransform | null,
  bounds: ZoneTransformBounds,
  onChange: (patch: Partial<ArtworkState>) => void,
  onSelect: (zoneId: string) => void
) {
  const planeRef = useRef(new THREE.Plane());
  const dragRef = useRef<{
    grabOffset: THREE.Vector3;
    startHit: THREE.Vector3;
    moved: boolean;
  } | null>(null);

  const orbitControls = useThree(
    (s) => s.controls
  ) as { enabled: boolean } | null;

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
      if (orbitControls) orbitControls.enabled = false;
    }

    const newPosition = hit.clone().add(dragRef.current.grabOffset);
    const matrix = new THREE.Matrix4().compose(
      newPosition,
      new THREE.Quaternion().setFromEuler(transform.rotation),
      transform.scale
    );
    const decomposed = decomposeDecalTransform(matrix, zone);
    onChange({
      decalOffsetX: clamp(decomposed.offsetX, bounds.minX, bounds.maxX),
      decalOffsetY: clamp(decomposed.offsetY, bounds.minY, bounds.maxY),
    });
  };

  const onPointerUp = (e: any) => {
    if (dragRef.current?.moved && orbitControls) orbitControls.enabled = true;
    dragRef.current = null;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
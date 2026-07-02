// src/features/studio/hooks/useDecalGesture.ts
//
// Unifies "move" and "resize" into a single, mode-free interaction directly
// on the decal — no separate translate/scale toggle required:
//
//   - Grab the interior          → move   (position only, same math as the
//                                            old useDecalDragTranslate)
//   - Grab near an edge/corner   → resize (uniform, about the decal's own
//                                            centre — desktop mouse, cursor
//                                            switches to the matching
//                                            nwse/nesw/ns/ew-resize icon)
//   - Two fingers down anywhere  → resize (pinch-to-zoom, touch)
//
// The gesture type is decided once, at the moment the pointer goes down (or
// the moment a second finger joins), and never re-evaluated mid-drag — that
// "decide once" rule is what keeps a resize from ever jumping into a move
// (or vice versa) partway through a single drag.

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

// How close to the boundary (in local decal space, i.e. metres) counts as
// "the edge" for resize purposes — a fraction of the artwork's own
// half-extent, clamped so tiny decals still get a workable grab target and
// large ones don't grow an oversized border.
// const EDGE_MARGIN_RATIO = 0.18;
// const EDGE_MARGIN_MIN = 0.006; // 0.6cm
// const EDGE_MARGIN_MAX = 0.035; // 3.5cm

const EDGE_MARGIN_RATIO = 0.05;
const EDGE_MARGIN_MIN = 0.0025; // 2.5 mm
const EDGE_MARGIN_MAX = 0.01;   // 1 cm

type HandleZone =
  | "interior"
  | "edge-top" | "edge-bottom" | "edge-left" | "edge-right"
  | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br";

function classifyLocalPoint(
  local: { x: number; y: number },
  halfW: number,
  halfH: number,
): HandleZone {
  const marginX = clamp(halfW * EDGE_MARGIN_RATIO, EDGE_MARGIN_MIN, EDGE_MARGIN_MAX);
  const marginY = clamp(halfH * EDGE_MARGIN_RATIO, EDGE_MARGIN_MIN, EDGE_MARGIN_MAX);

  const nearLeft   = local.x < -halfW + marginX;
  const nearRight  = local.x >  halfW - marginX;
  const nearTop    = local.y >  halfH - marginY;
  const nearBottom = local.y < -halfH + marginY;

  if (nearTop && nearLeft) return "corner-tl";
  if (nearTop && nearRight) return "corner-tr";
  if (nearBottom && nearLeft) return "corner-bl";
  if (nearBottom && nearRight) return "corner-br";
  if (nearTop) return "edge-top";
  if (nearBottom) return "edge-bottom";
  if (nearLeft) return "edge-left";
  if (nearRight) return "edge-right";
  return "interior";
}

// NOTE: this maps local (y-up) quadrants straight to screen-style resize
// cursors without accounting for the decal's own 3D rotation on the mesh —
// exactly right for front/back placements, an approximation on sharply
// angled ones (sleeves etc). Good enough as a directional hint in both cases.
function cursorForZone(zone: HandleZone): string {
  switch (zone) {
    case "corner-tl":
    case "corner-br":
      return "nwse-resize";
    case "corner-tr":
    case "corner-bl":
      return "nesw-resize";
    case "edge-top":
    case "edge-bottom":
      return "ns-resize";
    case "edge-left":
    case "edge-right":
      return "ew-resize";
    default:
      return "grab";
  }
}

interface TrackedPointer {
  clientX: number;
  clientY: number;
}

type DragState =
  | { kind: "move"; grabOffset: THREE.Vector3; startHit: THREE.Vector3; moved: boolean }
  | { kind: "resize"; handleZone: HandleZone; grabDir: THREE.Vector2; grabDist: number; initialScale: number; moved: boolean }
  | { kind: "pinch"; initialDistance: number; initialScale: number };

export function useDecalGesture(
  zone: PrintArea,
  transform: DecalTransform | null,
  artwork: ArtworkState,
  bounds: ZoneTransformBounds,
  onChange: (patch: Partial<ArtworkState>) => void,
  onSelect: (zoneId: string) => void,
  resizable: boolean = true,
) {
  const planeRef = useRef(new THREE.Plane());
  const dragRef = useRef<DragState | null>(null);
  const pointersRef = useRef<Map<number, TrackedPointer>>(new Map());

  // OrbitControls registers itself here via `makeDefault` in StudioCanvas.
  // R3F's synthetic pointer events are a separate system from the native
  // pointer listeners OrbitControls attaches directly to the canvas, so
  // stopPropagation() below does nothing to stop it on its own — we flip
  // `.enabled` off explicitly for the duration of an actual drag/pinch, and
  // only once the gesture crosses the drag threshold, so a simple tap never
  // touches orbiting at all.
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

  const beginPinch = () => {
    if (!resizable || pointersRef.current.size < 2) return;
    const [a, b] = [...pointersRef.current.values()];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (distance < 1) return;
    dragRef.current = {
      kind: "pinch",
      initialDistance: distance,
      initialScale: artwork.decalScale,
    };
    setOrbitEnabled(false);
    setCursor("grabbing");
  };

  const onPointerDown = (e: any) => {
    if (!transform) return;
    e.stopPropagation();
    onSelect(zone.id);
    (e.target as Element)?.setPointerCapture?.(e.pointerId);

    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // A second finger landing mid-gesture always wins into a pinch, no
    // matter what the first finger was already doing.
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    const normal = new THREE.Vector3(0, 0, 1).applyEuler(transform.rotation);
    planeRef.current.setFromNormalAndCoplanarPoint(normal, transform.position);

    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(planeRef.current, hit)) return;

    const local = toLocal(hit, transform);
    const halfW = transform.scale.x / 2;
    const halfH = transform.scale.y / 2;
    const handleZone = resizable ? classifyLocalPoint(local, halfW, halfH) : "interior";
    const grabDir = new THREE.Vector2(local.x, local.y);
    const grabDist = grabDir.length();

    if (handleZone === "interior" || grabDist < 1e-5) {
      dragRef.current = {
        kind: "move",
        grabOffset: transform.position.clone().sub(hit),
        startHit: hit.clone(),
        moved: false,
      };
    } else {
      dragRef.current = {
        kind: "resize",
        handleZone,
        grabDir: grabDir.clone().normalize(),
        grabDist,
        initialScale: artwork.decalScale,
        moved: false,
      };
    }
  };

  const onPointerMove = (e: any) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    const drag = dragRef.current;

    if (!drag) {
      // Hover only — no active gesture, just keep the cursor honest.
      if (!transform) return;
      if (!resizable) {
        setCursor("grab");
        return;
      }
      const normal = new THREE.Vector3(0, 0, 1).applyEuler(transform.rotation);
      const hoverPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, transform.position);
      const hit = new THREE.Vector3();
      if (!e.ray.intersectPlane(hoverPlane, hit)) return;
      const local = toLocal(hit, transform);
      const handleZone = classifyLocalPoint(local, transform.scale.x / 2, transform.scale.y / 2);
      setCursor(cursorForZone(handleZone));
      return;
    }

    if (drag.kind === "pinch") {
      if (pointersRef.current.size < 2) return;
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = distance / drag.initialDistance;
      onChange({ decalScale: clamp(drag.initialScale * ratio, bounds.minScale, bounds.maxScale) });
      return;
    }

    if (!transform) return;
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(planeRef.current, hit)) return;

    if (drag.kind === "move") {
      if (!drag.moved) {
        if (hit.distanceTo(drag.startHit) < DRAG_THRESHOLD) return;
        drag.moved = true;
        setOrbitEnabled(false);
        setCursor("grabbing");
      }
      const newPosition = hit.clone().add(drag.grabOffset);
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
      return;
    }

    // drag.kind === "resize" — uniform scale about the decal's own centre.
    // Position/rotation are never touched here, so the artwork can't jump:
    // computeDecalTransform derives position purely from offsetX/offsetY,
    // which this branch never sends a patch for.
    const local = toLocal(hit, transform);
    if (!drag.moved) {
      const startPoint = drag.grabDir.clone().multiplyScalar(drag.grabDist);
      const movedDist = new THREE.Vector2(local.x, local.y).distanceTo(startPoint);
      if (movedDist < DRAG_THRESHOLD) return;
      drag.moved = true;
      setOrbitEnabled(false);
      setCursor(cursorForZone(drag.handleZone));
    }
    const projected = new THREE.Vector2(local.x, local.y).dot(drag.grabDir);
    const ratio = projected / drag.grabDist;
    onChange({ decalScale: clamp(drag.initialScale * ratio, bounds.minScale, bounds.maxScale) });
  };

  const onPointerUp = (e: any) => {
    pointersRef.current.delete(e.pointerId);
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);

    const drag = dragRef.current;
    if (drag && (drag.kind === "pinch" || drag.moved)) {
      setOrbitEnabled(true);
    }
    dragRef.current = null;
    if (pointersRef.current.size === 0) setCursor("auto");
  };

  const onPointerOut = () => {
    if (!dragRef.current) setCursor("auto");
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerOut };
}
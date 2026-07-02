// src/features/studio/components/product-model/Decals.tsx

import { useRef, useMemo, useEffect } from "react";
import { Decal, TransformControls, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ArtworkState, PrintArea, TransformMode } from "../../store";
import {
  useDecalTransform,
  decomposeDecalTransform,
  getZoneTransformBounds,
  type DecalTransform,
} from "../../hooks/useDecalTransforms";
import { useDecalGesture } from "../../hooks/useDecalGesture";

// DecalMaterial

interface DecalMaterialProps {
  texture: THREE.Texture;
  polygonOffsetFactor?: number;
  selected?: boolean;
}

function DecalMaterial({
  texture,
  polygonOffsetFactor = -4,
  selected = false,
}: DecalMaterialProps) {
  return (
    <meshStandardMaterial
      map={texture}
      transparent
      alphaTest={0.02}
      depthTest
      depthWrite={false}
      polygonOffset
      polygonOffsetFactor={polygonOffsetFactor}
      polygonOffsetUnits={polygonOffsetFactor}
      color={selected ? new THREE.Color(0.5, 0.5, 0.54) : undefined}
      emissive={selected ? new THREE.Color("#2f5fe0") : undefined}
      emissiveIntensity={selected ? 0.12 : 0}
    />
  );
}

// DecalOutline

function DecalOutline({ transform }: { transform: DecalTransform }) {
  const lineRef = useRef<THREE.Line>(null!);

  const geometry = useMemo(() => {
    const w = transform.scale.x / 2;
    const h = transform.scale.y / 2;
    const points = [
      new THREE.Vector3(-w, -h, 0),
      new THREE.Vector3(w, -h, 0),
      new THREE.Vector3(w, h, 0),
      new THREE.Vector3(-w, h, 0),
      new THREE.Vector3(-w, -h, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [transform.scale.x, transform.scale.y]);

  useEffect(() => {
    lineRef.current?.computeLineDistances();
  }, [geometry]);

  return (
    <line
      ref={lineRef}
      geometry={geometry}
      position={transform.position}
      rotation={transform.rotation}
      renderOrder={500}
    >
      <lineDashedMaterial
        color="#2f5fe0"
        dashSize={0.012}
        gapSize={0.008}
        transparent
        opacity={0.9}
        depthTest
        polygonOffset
        polygonOffsetFactor={-8}
        polygonOffsetUnits={-8}
      />
    </line>
  );
}

// DecalRotateGizmo
// Move and resize now both happen via direct pointer interaction on the
// decal itself (see useDecalGesture) — this gizmo is only for rotation,
// which still needs its own dedicated handle.

interface DecalRotateGizmoProps {
  zone: PrintArea;
  transform: DecalTransform;
  onChange: (patch: Partial<ArtworkState>) => void;
}

function DecalRotateGizmo({ zone, transform, onChange }: DecalRotateGizmoProps) {
  const handleRef = useRef<THREE.Group>(null!);
  const controlsRef = useRef<any>(null);
  const draggingRef = useRef(false);

  const orbitControls = useThree(
    (s) => s.controls
  ) as { enabled: boolean } | null;

  useEffect(() => {
    if (draggingRef.current || !handleRef.current) return;
    handleRef.current.position.copy(transform.position);
    handleRef.current.rotation.copy(transform.rotation);
    handleRef.current.scale.copy(transform.scale);
  }, [transform]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleDraggingChanged = (e: any) => {
      draggingRef.current = e.value;
      if (orbitControls) orbitControls.enabled = !e.value;
    };

    const handleObjectChange = () => {
      const handle = handleRef.current;
      if (!handle) return;
      const matrix = new THREE.Matrix4().compose(
        handle.position,
        handle.quaternion,
        handle.scale
      );
      const decomposed = decomposeDecalTransform(matrix, zone);
      onChange({ decalRotation: decomposed.rotation });
    };

    controls.addEventListener("dragging-changed", handleDraggingChanged);
    controls.addEventListener("objectChange", handleObjectChange);
    return () => {
      controls.removeEventListener("dragging-changed", handleDraggingChanged);
      controls.removeEventListener("objectChange", handleObjectChange);
    };
  }, [zone, onChange, orbitControls]);

  return (
    <>
      <group ref={handleRef} />
      <TransformControls
        ref={controlsRef}
        object={handleRef}
        mode="rotate"
        showX={false}
        showY={false}
        showZ
        size={0.85}
      />
    </>
  );
}

// SingleDecalLayer

interface SingleDecalLayerProps {
  artwork: ArtworkState;
  zone: PrintArea;
  meshNode: THREE.Mesh;
  texture: THREE.Texture;
  stackIndex?: number;
  isActive?: boolean;
  transformMode: TransformMode;
  onSelect: (zoneId: string) => void;
  onTransformChange: (patch: Partial<ArtworkState>) => void;
}

function SingleDecalLayer({
  artwork,
  zone,
  meshNode,
  texture,
  stackIndex = 0,
  isActive = false,
  transformMode,
  onSelect,
  onTransformChange,
}: SingleDecalLayerProps) {
  const transform = useDecalTransform(zone, artwork, meshNode);
  const bounds = useMemo(() => getZoneTransformBounds(zone), [zone]);
  const gesture = useDecalGesture(
    zone,
    transform,
    artwork,
    bounds,
    onTransformChange,
    onSelect,
    zone.allowScaling
  );

  if (!transform) return null;

  // Move and resize are always live directly on the artwork — no mode
  // switch needed between them. Rotation is still an explicit, exclusive
  // mode (it needs its own dedicated handle), so the rotate gizmo only
  // shows up when transformMode is "rotate", and the direct-manipulation
  // handlers step aside while it's up so the two don't fight over the same
  // pointer.
  const showRotateGizmo = isActive && transformMode === "rotate";

  const gestureProps = showRotateGizmo
    ? {}
    : {
        onPointerDown: gesture.onPointerDown,
        onPointerMove: gesture.onPointerMove,
        onPointerUp: gesture.onPointerUp,
        onPointerOut: gesture.onPointerOut,
      };

  return (
    <>
      <Decal
        position={transform.position}
        rotation={transform.rotation}
        scale={transform.scale}
        renderOrder={stackIndex + 1}
        onClick={(e: any) => {
          e.stopPropagation();
          onSelect(zone.id);
        }}
        {...gestureProps}
      >
        <DecalMaterial
          texture={texture}
          polygonOffsetFactor={-4 - stackIndex}
          selected={isActive}
        />
      </Decal>

      {isActive && (
        <>
          <DecalOutline transform={transform} />
          {showRotateGizmo && (
            <DecalRotateGizmo
              zone={zone}
              transform={transform}
              onChange={onTransformChange}
            />
          )}
        </>
      )}
    </>
  );
}

// DecalLayer (public entry)

interface DecalLayerProps {
  artwork: ArtworkState;
  zone: PrintArea;
  meshNode: THREE.Mesh;
  stackIndex?: number;
  isActive?: boolean;
  transformMode: TransformMode;
  onSelect: (zoneId: string) => void;
  onTransformChange: (patch: Partial<ArtworkState>) => void;
}

export function DecalLayer({
  artwork,
  zone,
  meshNode,
  stackIndex = 0,
  isActive = false,
  transformMode,
  onSelect,
  onTransformChange,
}: DecalLayerProps) {
  const texture = useTexture(artwork.decalUrl || "");

  useMemo(() => {
    if (!texture) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  if (!texture) return null;
  if (zone.placement === "wrap") return null;

  return (
    <SingleDecalLayer
      artwork={artwork}
      zone={zone}
      meshNode={meshNode}
      texture={texture}
      stackIndex={stackIndex}
      isActive={isActive}
      transformMode={transformMode}
      onSelect={onSelect}
      onTransformChange={onTransformChange}
    />
  );
}